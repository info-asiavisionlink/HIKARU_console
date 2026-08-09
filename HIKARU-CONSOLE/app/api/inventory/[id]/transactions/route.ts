import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/inventory/[id]/transactions - 在庫履歴
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit  = Math.min(Number(req.nextUrl.searchParams.get('limit')  ?? 50), 200)
  const offset = Number(req.nextUrl.searchParams.get('offset') ?? 0)

  const { data, error, count } = await auth.adminClient
    .from('inventory_transactions')
    .select(`
      *,
      performer:performed_by (id, name),
      projects:project_id (id, name),
      shifts:shift_id (id, shift_date, start_time, end_time),
      jobs:job_id (id, work_date)
    `, { count: 'exact' })
    .eq('item_id', id)
    .eq('company_id', auth.companyId)
    .order('performed_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transactions: data ?? [], total: count ?? 0 })
}
