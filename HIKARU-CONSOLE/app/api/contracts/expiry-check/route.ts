import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { sendNotification } from '@/lib/line/notification.service'
import { contractExpiryTemplate } from '@/lib/line/templates'
import type { NotificationEventType } from '@/lib/line/types'

type ExpiryNotificationType = '60d' | '30d' | '7d' | '0d'

const NOTIFICATION_DAYS: Record<ExpiryNotificationType, number> = {
  '60d': 60,
  '30d': 30,
  '7d':  7,
  '0d':  0,
}

// POST /api/contracts/expiry-check
// 期限が近づいた契約をチェックし、管理者へLINE通知を送信する。
// cron または管理者による手動実行を想定。
export async function POST(_req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 期限が設定されている有効な契約を取得
  const contractsResult = (await auth.adminClient
    .from('contracts' as never)
    .select(`
      id, title, end_date, auto_renewal, status, company_id,
      clients:client_id   (name),
      partners:partner_id (company_name)
    `)
    .eq('company_id', auth.companyId)
    .not('end_date', 'is', null)
    .in('status', ['active', 'signed', 'reviewing'])) as { data: any[] | null; error: any }

  if (contractsResult.error) {
    return NextResponse.json({ error: String(contractsResult.error) }, { status: 500 })
  }
  const contracts = contractsResult.data ?? []

  // 管理者プロフィールを取得（通知先）
  const profilesResult = (await auth.adminClient
    .from('profiles' as never)
    .select('id, line_user_id, line_notify_enabled')
    .eq('company_id', auth.companyId)
    .eq('role', 'admin')) as { data: any[] | null }
  const adminProfiles = profilesResult.data ?? []

  const results: Array<{ contractId: string; type: string; sent: boolean; skipped: boolean }> = []

  for (const contract of contracts) {
    const endDate = new Date(contract.end_date)
    endDate.setHours(0, 0, 0, 0)
    const daysUntil = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    for (const [notifType, targetDays] of Object.entries(NOTIFICATION_DAYS) as [ExpiryNotificationType, number][]) {
      if (daysUntil !== targetDays) continue

      // 重複防止: 今年同じ通知が送られていないか確認
      const currentYear = today.getFullYear()

      const { data: existingNotif } = (await auth.adminClient
        .from('contract_expiry_notifications' as never)
        .select('id')
        .eq('contract_id', contract.id)
        .eq('notification_type', notifType)
        .eq('notification_year', currentYear)
        .limit(1)
        .maybeSingle()) as { data: any }

      if (existingNotif) {
        results.push({ contractId: contract.id, type: notifType, sent: false, skipped: true })
        continue
      }

      // 契約相手名を解決
      const counterpartyName =
        contract.clients?.name ??
        contract.partners?.company_name ??
        '不明'

      const message = contractExpiryTemplate({
        contractTitle:    contract.title,
        counterpartyName,
        endDate:          contract.end_date,
        daysUntilExpiry:  targetDays,
        autoRenewal:      contract.auto_renewal,
      })

      const eventType: NotificationEventType =
        notifType === '60d' ? 'contract_expiry_60d' :
        notifType === '30d' ? 'contract_expiry_30d' :
        notifType === '7d'  ? 'contract_expiry_7d'  :
        'contract_expiry_0d'

      // 全管理者に通知
      let sent = false
      for (const admin of adminProfiles) {
        const notifKey = `contract_expiry:${contract.id}:${notifType}:${currentYear}`
        const result = await sendNotification({
          companyId:       auth.companyId,
          eventType,
          notificationKey: notifKey,
          profileId:       admin.id,
          message,
        })
        if (result.success && !result.skipped) sent = true
      }

      // 通知記録（重複防止テーブル）- 重複挿入はエラーを無視
      try {
        await auth.adminClient.from('contract_expiry_notifications' as never).insert({
          contract_id:        contract.id,
          company_id:         auth.companyId,
          notification_type:  notifType,
          notification_year:  currentYear,
          notified_at:        new Date().toISOString(),
        } as never)
      } catch { /* unique constraint violation を無視 */ }

      results.push({ contractId: contract.id, type: notifType, sent, skipped: false })
    }
  }

  return NextResponse.json({
    checked:  contracts.length,
    notified: results.filter(r => r.sent).length,
    skipped:  results.filter(r => r.skipped).length,
    results,
  })
}
