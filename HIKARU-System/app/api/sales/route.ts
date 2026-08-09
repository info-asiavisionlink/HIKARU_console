import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const year  = req.nextUrl.searchParams.get('year')  ?? new Date().getFullYear().toString()
  const month = req.nextUrl.searchParams.get('month') ?? (new Date().getMonth() + 1).toString()

  const from = `${year}-${month.padStart(2, '0')}-01`
  const lastDay = new Date(Number(year), Number(month), 0).getDate()
  const to   = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: all } = await (supabase as any)
    .from('worker_proposals')
    .select('id, project_name, project_type, client_name, estimated_amount, status, created_at, updated_at')
    .eq('worker_id', user.id)
    .order('created_at', { ascending: false })

  const proposals = (all ?? []) as any[]

  // 今月の提案
  const thisMonth = proposals.filter((p: any) => {
    const d = p.created_at?.split('T')[0] ?? ''
    return d >= from && d <= to
  })

  const totalCount    = proposals.length
  const monthCount    = thisMonth.length
  const approvedCount = proposals.filter((p: any) => p.status === 'approved').length
  const pendingCount  = proposals.filter((p: any) => p.status === 'pending').length
  const monthApproved = thisMonth.filter((p: any) => p.status === 'approved').length
  const totalAmount   = proposals
    .filter((p: any) => p.status === 'approved')
    .reduce((s: number, p: any) => s + (p.estimated_amount ?? 0), 0)
  const monthAmount   = thisMonth
    .filter((p: any) => p.status === 'approved')
    .reduce((s: number, p: any) => s + (p.estimated_amount ?? 0), 0)

  return NextResponse.json({
    proposals,
    stats: {
      totalCount, monthCount,
      approvedCount, pendingCount,
      monthApproved,
      totalAmount, monthAmount,
      conversionRate: totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0,
    },
    year, month,
  })
}
