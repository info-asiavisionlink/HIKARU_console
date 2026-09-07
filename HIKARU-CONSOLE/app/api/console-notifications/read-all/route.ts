import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { ADMIN_NOTIFICATION_TYPES } from '@/lib/notifications/types'

// PATCH /api/console-notifications/read-all
// 管理者本人の CONSOLE 通知のみ一括既読化。
// 他管理者・他社・Worker 向け通知は対象外。
// System 側 /api/notifications/read-all と対称。
export async function PATCH(_req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await auth.adminClient
    .from('notifications')
    .update({ is_read: true } as never)
    .eq('company_id', auth.companyId)
    .eq('recipient_profile_id', auth.userId)
    .in('type', ADMIN_NOTIFICATION_TYPES)
    .or('target_app.eq.console,target_app.is.null')
    .eq('is_read', false)

  if (error) {
    if (error.code === '42703') {
      return NextResponse.json({ ok: true, updated: 0 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
