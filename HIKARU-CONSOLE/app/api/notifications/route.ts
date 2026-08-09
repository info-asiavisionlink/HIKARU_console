import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/notifications - LINE通知ログ一覧（管理者のみ）
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p       = req.nextUrl.searchParams
  const status  = p.get('status')
  const event   = p.get('event_type')
  const limit   = Math.min(Number(p.get('limit') ?? 50), 200)
  const offset  = Number(p.get('offset') ?? 0)

  let query = auth.adminClient
    .from('line_notification_logs')
    .select(`
      id, event_type, notification_key, message, line_user_id,
      status, error_message, sent_at, created_at,
      profiles:profile_id (id, name, role)
    `, { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status)    query = query.eq('status', status)
  if (event)     query = query.eq('event_type', event)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data ?? [], total: count ?? 0 })
}
