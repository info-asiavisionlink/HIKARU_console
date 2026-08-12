import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/expenses - 管理者用一覧（全経費）
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p         = req.nextUrl.searchParams
  const status    = p.get('status')
  const workerId  = p.get('worker_id')
  const projectId = p.get('project_id')
  const category  = p.get('category')
  const dateFrom  = p.get('date_from')
  const dateTo    = p.get('date_to')

  // expenses.worker_id → profiles のJOINはPostgRESTスキーマキャッシュ未登録のため別途取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (auth.adminClient as any)
    .from('expenses')
    .select(`
      *,
      projects:project_id (id, name),
      expense_receipts (id)
    `)
    .eq('company_id', auth.companyId)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status)    query = query.eq('status', status)
  if (workerId)  query = query.eq('worker_id', workerId)
  if (projectId) query = query.eq('project_id', projectId)
  if (category)  query = query.eq('category', category)
  if (dateFrom)  query = query.gte('expense_date', dateFrom)
  if (dateTo)    query = query.lte('expense_date', dateTo)

  const { data: expenses, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // profiles を worker_id で別途取得してマージ（FK未登録のためJOIN不可）
  const workerIds = [...new Set((expenses ?? []).map((e: any) => e.worker_id).filter(Boolean))]
  const profilesMap: Record<string, { id: string; name: string; email: string; entity_type: string }> = {}

  if (workerIds.length > 0) {
    const { data: profileRows } = await auth.adminClient
      .from('profiles')
      .select('id, name, email, entity_type')
      .in('id', workerIds)
      .eq('company_id', auth.companyId)

    for (const prof of profileRows ?? []) {
      profilesMap[prof.id] = prof
    }
  }

  const result = (expenses ?? []).map((e: any) => ({
    ...e,
    profiles: profilesMap[e.worker_id] ?? null,
  }))

  // KPI 集計（今月）
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: kpiData } = await auth.adminClient
    .from('expenses')
    .select('status, amount')
    .eq('company_id', auth.companyId)
    .gte('expense_date', monthStart)

  const kpi = { submitted: 0, approved: 0, settled: 0, rejected: 0,
    submitted_amount: 0, approved_amount: 0, settled_amount: 0 }
  for (const e of kpiData ?? []) {
    if (e.status === 'submitted') { kpi.submitted++; kpi.submitted_amount += e.amount ?? 0 }
    if (e.status === 'approved')  { kpi.approved++;  kpi.approved_amount  += e.amount ?? 0 }
    if (e.status === 'settled')   { kpi.settled++;   kpi.settled_amount   += e.amount ?? 0 }
    if (e.status === 'rejected')  { kpi.rejected++ }
  }

  return NextResponse.json({ expenses: result, kpi })
}
