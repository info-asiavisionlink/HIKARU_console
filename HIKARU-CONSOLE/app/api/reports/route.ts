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
        `id, job_id, project_id, worker_id, version, overall_score, pdf_url, created_at,
         jobs(work_date, started_at, completed_at),
         projects(name, code, client_id, clients:client_id(name), stores(name, address)),
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

    // メール送信状態: report_ids をまとめて一括取得（N+1 禁止）
    const reportIds = (data ?? []).map((r: any) => r.id).filter(Boolean) as string[]
    type EmailEntry = { status: 'sent' | 'failed' | 'unsent'; lastSentAt: string | null }
    const emailStatusMap: Record<string, EmailEntry> = {}

    if (reportIds.length > 0) {
      const { data: emailLogs } = await auth.adminClient
        .from('document_email_logs')
        .select('report_id, status, sent_at')
        .eq('company_id', auth.companyId)
        .in('report_id', reportIds)
        .not('report_id', 'is', null)

      const grouped: Record<string, Array<{ status: string; sent_at: string | null }>> = {}
      for (const log of (emailLogs ?? [])) {
        if (!log.report_id) continue
        if (!grouped[log.report_id]) grouped[log.report_id] = []
        grouped[log.report_id].push({ status: log.status, sent_at: log.sent_at })
      }

      for (const [reportId, logs] of Object.entries(grouped)) {
        const sentLogs = logs.filter(l => l.status === 'sent')
        if (sentLogs.length > 0) {
          const lastSentAt = sentLogs
            .map(l => l.sent_at)
            .filter(Boolean)
            .sort()
            .at(-1) ?? null
          emailStatusMap[reportId] = { status: 'sent', lastSentAt }
        } else if (logs.some(l => l.status === 'failed')) {
          emailStatusMap[reportId] = { status: 'failed', lastSentAt: null }
        } else {
          emailStatusMap[reportId] = { status: 'unsent', lastSentAt: null }
        }
      }
    }

    const enrichedData = (data ?? []).map((r: any) => ({
      ...r,
      email_status:  emailStatusMap[r.id]?.status   ?? 'unsent',
      last_sent_at:  emailStatusMap[r.id]?.lastSentAt ?? null,
    }))

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
      data:  enrichedData,
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
