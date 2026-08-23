import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// ============================================================
// GET /api/analytics/worker/[employee_id]
//
// 入力: employee_id = employees.id (CONSOLE管理ID)
// 内部: employees.auth_user_id → profiles.id へ解決し
//       既存 /analytics/worker/[id] 画面と同一Source・同一計算でデータ返却。
//
// 認証: CONSOLE Admin (getAuthContext)
// company_id: Server Auth確定。Request parameterに含めない。
// AI生成: なし (0 LLM call)
// Write操作: なし (READ only)
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export const maxDuration = 30

// 画面の getLast6Months() と同一ロジック
function getLast6Months(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ employee_id: string }> },
) {
  const { employee_id } = await params

  // ── 1. Auth ──────────────────────────────────────────────
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    )
  }
  const { companyId, adminClient } = auth
  const admin = adminClient as AnyClient

  // ── 2. Employee lookup (employees.id → auth_user_id) ────
  const { data: employee, error: empErr } = await admin
    .from('employees')
    .select('id, name, auth_user_id, company_id')
    .eq('id', employee_id)
    .single()

  if (empErr || !employee) {
    return NextResponse.json(
      { error: '従業員が見つかりませんでした。', code: 'EMPLOYEE_NOT_FOUND' },
      { status: 404 },
    )
  }

  // ── 3. Company ownership ─────────────────────────────────
  if (employee.company_id !== companyId) {
    return NextResponse.json(
      { error: 'この従業員へのアクセス権がありません。', code: 'FORBIDDEN' },
      { status: 403 },
    )
  }

  // ── 4. Profile ID bridge ─────────────────────────────────
  const profileId: string | null = employee.auth_user_id ?? null
  if (!profileId) {
    return NextResponse.json(
      { error: '従業員のシステムアカウントがありません。', code: 'PROFILE_NOT_FOUND' },
      { status: 404 },
    )
  }

  // ── 5. Analytics data（画面と同一 Source + Calculation）──
  try {
    const months = getLast6Months()

    // Jobs: worker_id = profiles.id（画面と同一filter）
    const { data: jobsRaw, error: jobErr } = await admin
      .from('jobs')
      .select('id, work_date')
      .eq('worker_id', profileId)

    if (jobErr) {
      return NextResponse.json(
        { error: '分析データの取得中にエラーが発生しました。', code: 'ANALYTICS_LOAD_ERROR' },
        { status: 500 },
      )
    }

    const jobsData: { id: string; work_date: string }[] = jobsRaw ?? []
    const jobIds = jobsData.map((j) => j.id)

    // Chat count（画面と同一: chat_messages.role='user' + job_id in jobIds）
    const chatRes = jobIds.length > 0
      ? await admin
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'user')
          .in('job_id', jobIds)
      : { count: 0, error: null }

    // AI evaluations（画面と同一: score + recommendation + photo_spots）
    const evalsRes = jobIds.length > 0
      ? await admin
          .from('ai_evaluations')
          .select('job_id, score, recommendation, photo_spots(name)')
          .in('job_id', jobIds)
      : { data: [], error: null }

    if (evalsRes.error) {
      return NextResponse.json(
        { error: '分析データの取得中にエラーが発生しました。', code: 'ANALYTICS_LOAD_ERROR' },
        { status: 500 },
      )
    }

    const evals: AnyClient[] = evalsRes.data ?? []

    // ── 集計: 画面と同一 calculation ────────────────────────

    // avgScore: 全期間スコア平均（丸め方も画面と同一: Math.round）
    const scores = evals.map((e: AnyClient) => e.score).filter((s: AnyClient) => s != null) as number[]
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null

    // passRate / redoCount（画面と同一: recommendation === 'pass'/'redo'）
    const redoCount = evals.filter((e: AnyClient) => e.recommendation === 'redo').length
    const passCount = evals.filter((e: AnyClient) => e.recommendation === 'pass').length
    const passRate  = evals.length > 0
      ? Math.round((passCount / evals.length) * 100)
      : null

    // monthlyTrends（画面と同一: 過去6ヶ月, job.work_date で月判定）
    const jobMonthMap: Record<string, string> = {}
    for (const job of jobsData) {
      jobMonthMap[job.id] = job.work_date.substring(0, 7)
    }
    const monthScores: Record<string, number[]> = {}
    const monthJobSet: Record<string, Set<string>> = {}
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
        avgScore: sc.length > 0
          ? Math.round(sc.reduce((a: number, b: number) => a + b, 0) / sc.length)
          : null,
        jobs: monthJobSet[m]?.size ?? 0,
      }
    })

    // spotScores（画面と同一: ai_evaluations.photo_spots.name, avgScore昇順 = 要改善順）
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
        avgScore: d.scores.length > 0
          ? Math.round(d.scores.reduce((a: number, b: number) => a + b, 0) / d.scores.length)
          : 0,
        count: d.total,
      }))
      .sort((a, b) => a.avgScore - b.avgScore)

    const hasAnalysisData = jobIds.length > 0 && evals.length > 0

    // ── Response ─────────────────────────────────────────────
    return NextResponse.json({
      employee_id,
      profile_id:  profileId,
      workerName:  employee.name,
      totalJobs:   jobIds.length,
      avgScore,
      passRate,
      redoCount,
      chatCount:   chatRes.count ?? 0,
      monthlyTrends,
      spotScores,
      hasAnalysisData,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[analytics/worker/employee_id] error:', msg)
    return NextResponse.json(
      { error: '分析データの取得中にエラーが発生しました。', code: 'ANALYTICS_LOAD_ERROR' },
      { status: 500 },
    )
  }
}
