import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// CONSOLE管理者向け通知と同じ境界（取得APIと一致させる）。
const ADMIN_NOTIFICATION_TYPES = [
  'attendance_correction_submitted',
  'expense_submitted',
  'project_report_submitted',
  'project_proposal_submitted',
]

// PATCH /api/console-notifications/[id]/read
// 管理者本人宛 CONSOLE 通知のみ既読化。
// type と target_app による Admin 境界を適用し、Worker向け通知を既読化しない。
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 本人所有・自社・Admin境界の四重確認を WHERE で担保。
  // target_app='worker' 通知は条件不一致 → 0件更新（既読化しない）。
  const { data: existing } = await auth.adminClient
    .from('notifications')
    .select('id, is_read')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .eq('recipient_profile_id', auth.userId)
    .in('type', ADMIN_NOTIFICATION_TYPES)
    .or('target_app.eq.console,target_app.is.null')
    .single()

  if (!existing) return NextResponse.json({ error: '通知が見つかりません' }, { status: 404 })
  if (existing.is_read) return NextResponse.json({ ok: true, already_read: true })

  const { error } = await auth.adminClient
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .eq('recipient_profile_id', auth.userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
