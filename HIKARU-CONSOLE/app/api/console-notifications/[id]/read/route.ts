import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// PATCH /api/console-notifications/[id]/read
// 管理者本人宛通知のみ既読化（他人・他社の通知は対象外）
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 本人所有・自社確認を WHERE で担保
  const { error } = await auth.adminClient
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .eq('recipient_profile_id', auth.userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
