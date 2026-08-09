import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/surveys - 管理者: 全アンケート一覧
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p         = req.nextUrl.searchParams
  const projectId = p.get('project_id')
  const workerId  = p.get('worker_id')
  const rating    = p.get('rating')      // '1','2' など
  const dateFrom  = p.get('date_from')
  const dateTo    = p.get('date_to')
  const limit     = Math.min(Number(p.get('limit') ?? 50), 200)
  const offset    = Number(p.get('offset') ?? 0)

  let query = auth.adminClient
    .from('satisfaction_surveys')
    .select(`
      *,
      jobs:job_id (id, work_date, status, started_at, completed_at,
        projects:project_id (id, name, project_type, location_name),
        worker:worker_id (id, name)
      ),
      portal_accounts:portal_account_id (id, contact_name,
        clients:client_id (id, name)
      )
    `, { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (projectId) query = query.eq('project_id', projectId)
  if (workerId)  query = query.eq('jobs.worker_id', workerId)
  if (rating)    query = query.eq('rating', Number(rating))
  if (dateFrom)  query = query.gte('created_at', dateFrom)
  if (dateTo)    query = query.lte('created_at', dateTo)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ surveys: data ?? [], total: count ?? 0 })
}
