import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { ADMIN_NOTIFICATION_TYPES } from '@/lib/notifications/types'

// GET /api/console-notifications
// 管理者本人宛 System通知（recipient_profile_id = 自分）
// 他社・他管理者・Worker向け通知は返さない
// ADMIN_NOTIFICATION_TYPES と target_app の二重防御:
//   - type IN ADMIN_NOTIFICATION_TYPES: typeによる第1防御
//   - target_app='console' OR target_app IS NULL: appによる第2防御 (NULL=legacy互換)
//
// unread_count は list.filter ではなく別 count query で算出。
// list を .limit(30) で切っても unread の総数を正しく報告する。
export async function GET(_req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: notifications, error } = await auth.adminClient
    .from('notifications')
    .select('id, title, body, type, is_read, target_url, created_at')
    .eq('company_id', auth.companyId)
    .eq('recipient_profile_id', auth.userId)
    .in('type', ADMIN_NOTIFICATION_TYPES)
    .or('target_app.eq.console,target_app.is.null')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    // recipient_profile_id カラム未作成の場合は空を返す（安全対応）
    if (error.code === '42703') return NextResponse.json({ notifications: [], unread_count: 0 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 未読総数を別 count query で取得 (list limit の影響を受けない)
  const { count: unreadTotal, error: countError } = await auth.adminClient
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', auth.companyId)
    .eq('recipient_profile_id', auth.userId)
    .in('type', ADMIN_NOTIFICATION_TYPES)
    .or('target_app.eq.console,target_app.is.null')
    .eq('is_read', false)

  // count query 失敗時は list ベースの近似値へフォールバック (badge が壊れないように)
  const unread_count = countError || unreadTotal === null
    ? (notifications ?? []).filter((n: { is_read: boolean }) => !n.is_read).length
    : unreadTotal

  return NextResponse.json({ notifications: notifications ?? [], unread_count })
}
