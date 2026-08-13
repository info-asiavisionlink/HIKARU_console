import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// 管理者向け通知 type のみ表示する。
// Worker 本人向け通知（expense_approved, shift_created 等）は除外。
// 将来の管理者通知を追加する場合はここに追記する。
const ADMIN_NOTIFICATION_TYPES = [
  'attendance_correction_submitted',
  'expense_submitted',
  'project_report_submitted',
  'project_proposal_submitted',
]

// GET /api/console-notifications
// 管理者本人宛 System通知（recipient_profile_id = 自分）
// 他社・他管理者・Worker向け通知は返さない
export async function GET(_req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: notifications, error } = await auth.adminClient
    .from('notifications')
    .select('id, title, body, type, is_read, target_url, created_at')
    .eq('company_id', auth.companyId)
    .eq('recipient_profile_id', auth.userId)
    .in('type', ADMIN_NOTIFICATION_TYPES)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    // recipient_profile_id カラム未作成の場合は空を返す（安全対応）
    if (error.code === '42703') return NextResponse.json({ notifications: [], unread_count: 0 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const unread_count = (notifications ?? []).filter((n: { is_read: boolean }) => !n.is_read).length
  return NextResponse.json({ notifications: notifications ?? [], unread_count })
}
