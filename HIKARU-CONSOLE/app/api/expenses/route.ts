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

  // expenses.worker_id → profiles のJOINはPostgRESTスキーマキャッシュ未登録のためフラット取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (auth.adminClient as any)
    .from('expenses')
    .select('*')
    .eq('company_id', auth.companyId)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status)    query = query.eq('status', status)
  if (workerId)  query = query.eq('worker_id', workerId)
  if (projectId) query = query.eq('project_id', projectId)
  if (category)  query = query.eq('category', category)
  if (dateFrom)  query = query.gte('expense_date', dateFrom)
  if (dateTo)    query = query.lte('expense_date', dateTo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // KPI 集計
  const allQuery = await auth.adminClient
    .from('expenses')
    .select('status, amount')
    .eq('company_id', auth.companyId)
    .gte('expense_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])

  const kpi = { submitted: 0, approved: 0, settled: 0, rejected: 0,
    submitted_amount: 0, approved_amount: 0, settled_amount: 0 }
  for (const e of allQuery.data ?? []) {
    if (e.status === 'submitted') { kpi.submitted++; kpi.submitted_amount += e.amount }
    if (e.status === 'approved')  { kpi.approved++;  kpi.approved_amount  += e.amount }
    if (e.status === 'settled')   { kpi.settled++;   kpi.settled_amount   += e.amount }
    if (e.status === 'rejected')  { kpi.rejected++ }
  }

  return NextResponse.json({ expenses: data ?? [], kpi })
}
