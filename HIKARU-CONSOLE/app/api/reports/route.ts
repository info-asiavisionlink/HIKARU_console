import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/reports
// 管理者向け報告書一覧取得。company_id フィルタで他社レコードを排除。
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1', 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)))
  const dateFrom = searchParams.get('dateFrom') ?? null
  const dateTo   = searchParams.get('dateTo')   ?? null

  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  try {
    let query = auth.adminClient
      .from('reports')
      .select(
        `id, job_id, project_id, worker_id, version, overall_score, created_at,
         jobs(work_date, started_at, completed_at),
         projects(name, code, stores(name, address)),
         profiles(name)`,
        { count: 'exact' }
      )
      .eq('company_id', auth.companyId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo)   query = query.lte('created_at', dateTo + 'T23:59:59Z')

    const { data, count, error } = await query

    if (error) {
      console.error('[api/reports]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // stats (同一会社の全件)
    const [{ data: allScores }, { data: monthly }] = await Promise.all([
      auth.adminClient
        .from('reports')
        .select('overall_score')
        .eq('company_id', auth.companyId),
      auth.adminClient
        .from('reports')
        .select('id')
        .eq('company_id', auth.companyId)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ])

    const scores   = (allScores ?? []).map((r: any) => r.overall_score).filter((s: any) => s != null) as number[]
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    return NextResponse.json({
      data:  data ?? [],
      count: count ?? 0,
      stats: {
        totalReports:   allScores?.length   ?? 0,
        avgScore,
        thisMonthCount: monthly?.length ?? 0,
      },
    })
  } catch (e) {
    console.error('[api/reports]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
