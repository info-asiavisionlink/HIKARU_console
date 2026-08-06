import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/project-requests?status=pending
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''
  const countOnly = searchParams.get('count') === 'true'

  let query = auth.adminClient
    .from('client_project_requests')
    .select(`
      id, title, description, desired_date, location, project_type,
      status, admin_note, created_at,
      clients ( id, name ),
      client_portal_accounts ( contact_name )
    `, { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  if (countOnly) {
    const { count } = await auth.adminClient
      .from('client_project_requests')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', auth.companyId)
      .eq('status', 'pending')
    return NextResponse.json({ count: count ?? 0 })
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], count: count ?? 0 })
}
