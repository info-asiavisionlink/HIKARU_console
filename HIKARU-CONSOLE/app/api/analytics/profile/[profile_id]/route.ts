import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// ============================================================
// GET /api/analytics/profile/[profile_id]
//
// 個人Analytics詳細 — profile_id = profiles.id を入力とする。
// 認証: CONSOLE Admin (getAuthContext + adminClient)
// RLS: adminClientでバイパス（Browser RLS依存を排除）
// OpenAI: 0 calls
// N+1: なし
// DB query: 固定4件以下 (profile + jobs → evals + chat 並列)
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export const maxDuration = 30

function getLast6Months(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function monthLabel(ym: string): string {
  const [, m] = ym.split('-')
  return `${parseInt(m)}月`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ profile_id: string }> },
) {
  const { profile_id } = await params

  // ── 1. Auth ───────────────────────────────────────────────
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    )
  }
  const { companyId, adminClient } = auth
  const admin = adminClient as AnyClient

  try {
    // ── 2. Profile ownership確認 + Jobs 並列取得 ───────────
    const [profileRes, jobsRes] = await Promise.all([
      admin
        .from('profiles')
        .select('id, name, company_id')
        .eq('id', profile_id)
        .single(),
      admin
        .from('jobs')
        .select('id, work_date')
        .eq('worker_id', profile_id),
    ])

    if (!profileRes.data) {
      return NextResponse.json(
        { error: '従業員が見つかりませんでした。', code: 'PROFILE_NOT_FOUND' },
        { status: 404 },
      )
    }

    if (profileRes.data.company_id !== companyId) {
      return NextResponse.json(
        { error: 'この従業員へのアクセス権がありません。', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }

    if (jobsRes.error) {
      console.error('[analytics/profile] jobs:', jobsRes.error.message)
      return NextResponse.json(
        { error: '分析データの取得中にエラーが発生しました。', code: 'ANALYTICS_LOAD_ERROR' },
        { status: 500 },
      )
    }

    const workerName: string = profileRes.data.name
    const jobsData: { id: string; work_date: string }[] = jobsRes.data ?? []
    const jobIds = jobsData.map((j) => j.id)
    const months = getLast6Months()

    // ── 3. jobs 0件 → 即返却 ─────────────────────────────
    if (jobIds.length === 0) {
      return NextResponse.json({
        workerName,
        totalJobs:    0,
        avgScore:     null,
        passRate:     0,
        redoCount:    0,
        chatCount:    0,
        monthlyTrends: months.map((m) => ({
          month: m, label: monthLabel(m), avgScore: null, jobCount: 0,
        })),
        spotScores:   [],
        hasAnalysisData: false,
      })
    }

    // ── 4. ai_evaluations + chat count 並列取得 ───────────
    const [evalsRes, chatRes] = await Promise.all([
      admin
        .from('ai_evaluations')
        .select('job_id, score, recommendation, photo_spots(name)')
        .in('job_id', jobIds),
      admin
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .in('job_id', jobIds),
    ])

    if (evalsRes.error) {
      console.error('[analytics/profile] ai_evaluations:', evalsRes.error.message)
      return NextResponse.json(
        { error: '分析データの取得中にエラーが発生しました。', code: 'ANALYTICS_LOAD_ERROR' },
        { status: 500 },
      )
    }

    const evals: AnyClient[] = evalsRes.data ?? []

    // ── 5. 集計（既存詳細と同一計算）─────────────────────
    const scores    = evals.map((e: AnyClient) => e.score).filter((s: AnyClient) => s != null) as number[]
    const avgScore  = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null
    const passCount = evals.filter((e: AnyClient) => e.recommendation === 'pass').length
    const redoCount = evals.filter((e: AnyClient) => e.recommendation === 'redo').length
    const passRate  = evals.length > 0
      ? Math.round((passCount / evals.length) * 100)
      : 0

    // Monthly trends（過去6ヶ月、既存detailと同一ロジック）
    const jobMonthMap: Record<string, string> = {}
    for (const job of jobsData) {
      jobMonthMap[job.id] = job.work_date.substring(0, 7)
    }
    const monthScores: Record<string, number[]>      = {}
    const monthJobSet: Record<string, Set<string>>   = {}
    for (const ev of evals) {
      const month = jobMonthMap[ev.job_id]
      if (!month) continue
      if (!monthScores[month]) monthScores[month] = []
      if (!monthJobSet[month]) monthJobSet[month] = new Set()
      if (ev.score != null) monthScores[month].push(ev.score)
      monthJobSet[month].add(ev.job_id)
    }
    const monthlyTrends = months.map((m) => {
      const sc = monthScores[m] ?? []
      return {
        month:    m,
        label:    monthLabel(m),
        avgScore: sc.length > 0
          ? Math.round(sc.reduce((a: number, b: number) => a + b, 0) / sc.length)
          : null,
        jobCount: monthJobSet[m]?.size ?? 0,
      }
    })

    // Spot scores（要改善順、既存detailと同一ロジック）
    const spotData: Record<string, { scores: number[]; redoCount: number; total: number }> = {}
    for (const ev of evals) {
      const name = ev.photo_spots?.name as string | null
      if (!name) continue
      if (!spotData[name]) spotData[name] = { scores: [], redoCount: 0, total: 0 }
      spotData[name].total++
      if (ev.score != null) spotData[name].scores.push(ev.score)
      if (ev.recommendation === 'redo') spotData[name].redoCount++
    }
    const spotScores = Object.entries(spotData)
      .map(([spotName, d]) => ({
        spotName,
        avgScore:  d.scores.length > 0
          ? Math.round(d.scores.reduce((a: number, b: number) => a + b, 0) / d.scores.length)
          : 0,
        evalCount: d.total,
        redoRate:  d.total > 0 ? Math.round((d.redoCount / d.total) * 100) : 0,
      }))
      .sort((a, b) => a.avgScore - b.avgScore)

    return NextResponse.json({
      workerName,
      totalJobs:    jobIds.length,
      avgScore,
      passRate,
      redoCount,
      chatCount:    chatRes.count ?? 0,
      monthlyTrends,
      spotScores,
      hasAnalysisData: evals.length > 0,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[analytics/profile] unexpected error:', msg)
    return NextResponse.json(
      { error: '分析データの取得中にエラーが発生しました。', code: 'ANALYTICS_LOAD_ERROR' },
      { status: 500 },
    )
  }
}
