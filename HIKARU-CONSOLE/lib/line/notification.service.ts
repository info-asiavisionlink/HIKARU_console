// ============================================================
// LINE通知サービス
// 全LINE通知はこのサービス経由で送信する。
// 各機能からLINE APIを直接呼ばないこと。
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { sendLinePushMessage } from './client'
import type { NotificationRequest, NotificationResult } from './types'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * LINE通知を送信するメインエントリポイント
 *
 * - LINE User IDが未登録のユーザーは skipped として正常終了
 * - 通知OFFのユーザーは skipped として正常終了
 * - 同一notificationKeyは重複送信しない
 * - LINE API失敗は failed ログとして記録し、業務処理を止めない
 */
export async function sendNotification(
  req: NotificationRequest
): Promise<NotificationResult> {
  const db = getAdminClient()

  // ── 冪等チェック ──
  if (req.notificationKey) {
    const { data: existing } = await db
      .from('line_notification_logs')
      .select('id, status')
      .eq('company_id', req.companyId)
      .eq('notification_key', req.notificationKey)
      .single()

    if (existing && existing.status !== 'failed') {
      return { success: true, skipped: true, skipReason: 'duplicate', logId: existing.id }
    }
  }

  // ── LINE User ID解決 ──
  let resolvedLineUserId = req.lineUserId ?? req.clientLineUserId ?? null
  let notifyEnabled = true

  if (!resolvedLineUserId && req.profileId) {
    const { data: profile } = await db
      .from('profiles')
      .select('line_user_id, line_notify_enabled')
      .eq('id', req.profileId)
      .single()

    resolvedLineUserId   = profile?.line_user_id   ?? null
    notifyEnabled        = profile?.line_notify_enabled ?? true
  }

  if (!resolvedLineUserId && req.portalAccountId) {
    const { data: account } = await db
      .from('client_portal_accounts')
      .select('line_user_id, line_notify_enabled')
      .eq('id', req.portalAccountId)
      .single()

    resolvedLineUserId = account?.line_user_id   ?? null
    notifyEnabled      = account?.line_notify_enabled ?? true
  }

  // ── 未連携チェック ──
  if (!resolvedLineUserId) {
    await db.from('line_notification_logs').insert({
      company_id:       req.companyId,
      profile_id:       req.profileId       ?? null,
      portal_account_id: req.portalAccountId ?? null,
      event_type:       req.eventType,
      notification_key: req.notificationKey ?? null,
      message:          req.message,
      line_user_id:     null,
      status:           'skipped',
      error_message:    'LINE未連携',
    })
    return { success: true, skipped: true, skipReason: 'no_line_user_id' }
  }

  // ── 通知OFFチェック ──
  if (!notifyEnabled) {
    await db.from('line_notification_logs').insert({
      company_id:       req.companyId,
      profile_id:       req.profileId       ?? null,
      portal_account_id: req.portalAccountId ?? null,
      event_type:       req.eventType,
      notification_key: req.notificationKey ?? null,
      message:          req.message,
      line_user_id:     resolvedLineUserId,
      status:           'skipped',
      error_message:    '通知OFF',
    })
    return { success: true, skipped: true, skipReason: 'notify_disabled' }
  }

  // ── 送信 ──
  const result = await sendLinePushMessage(resolvedLineUserId, req.message)

  // ── ログ記録 ──
  const logPayload = {
    company_id:       req.companyId,
    profile_id:       req.profileId       ?? null,
    portal_account_id: req.portalAccountId ?? null,
    event_type:       req.eventType,
    notification_key: req.notificationKey ?? null,
    message:          req.message,
    line_user_id:     resolvedLineUserId,
    status:           result.success ? 'sent' : 'failed',
    error_message:    result.error   ?? null,
    sent_at:          result.success ? new Date().toISOString() : null,
  }

  // 冪等キーがある場合は UPSERT（失敗→再試行を許可）
  let logId: string | undefined
  if (req.notificationKey) {
    const { data: log } = await db
      .from('line_notification_logs')
      .upsert(logPayload, { onConflict: 'company_id,notification_key' })
      .select('id')
      .single()
    logId = log?.id
  } else {
    const { data: log } = await db
      .from('line_notification_logs')
      .insert(logPayload)
      .select('id')
      .single()
    logId = log?.id
  }

  return result.success
    ? { success: true, logId }
    : { success: false, logId, error: result.error }
}

/**
 * 失敗した通知ログを再送する
 * @param logId line_notification_logs.id
 * @param companyId テナントチェック用
 */
export async function resendNotification(
  logId: string,
  companyId: string
): Promise<NotificationResult> {
  const db = getAdminClient()

  const { data: log } = await db
    .from('line_notification_logs')
    .select('*')
    .eq('id', logId)
    .eq('company_id', companyId)
    .single()

  if (!log) return { success: false, error: 'ログが見つかりません' }
  if (log.status !== 'failed') return { success: false, error: '失敗ログのみ再送できます' }
  if (!log.line_user_id) return { success: false, error: 'LINE User IDがありません' }

  const result = await sendLinePushMessage(log.line_user_id, log.message)

  await db
    .from('line_notification_logs')
    .update({
      status:        result.success ? 'sent' : 'failed',
      error_message: result.error   ?? null,
      sent_at:       result.success ? new Date().toISOString() : null,
    })
    .eq('id', logId)

  return result.success
    ? { success: true, logId }
    : { success: false, logId, error: result.error }
}
