import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// ============================================================
// GET /api/analytics/employees
//
// 全従業員のAnalytics一覧を返却。
// DB query: 固定3件 (employees + jobs → ai_evaluations)
// N+1: なし
// OpenAI: 0 calls
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

type EvalRow = { job_id: string; score: number | null; recommendation: string }

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { companyId, adminClient } = auth
  const admin = adminClient as AnyClient

  try {
    // Round 1: employees + jobs を並列取得
    const [employeesRes, jobsRes] = await Promise.all([
      admin.from('employees').select('id, name, auth_user_id').eq('company_id', companyId),
      admin.from('jobs').select('id, worker_id').eq('company_id', companyId),
    ])

    if (employeesRes.error) {
      console.error('[analytics/employees] employees:', employeesRes.error.message)
      return NextResponse.json({ error: 'DB error: employees' }, { status: 500 })
    }
    if (jobsRes.error) {
      console.error('[analytics/employees] jobs:', jobsRes.error.message)
      return NextResponse.json({ error: 'DB error: jobs' }, { status: 500 })
    }

    const employees: AnyClient[] = employeesRes.data ?? []
    const jobs:      AnyClient[] = jobsRes.data      ?? []
    const jobIds:    string[]    = jobs.map((j: AnyClient) => j.id as string)

    // Round 2: ai_evaluations (jobIds=0なら skip)
    let evals: EvalRow[] = []

    if (jobIds.length > 0) {
      const evalsRes = await admin
        .from('ai_evaluations')
        .select('job_id, score, recommendation')
        .in('job_id', jobIds)

      if (evalsRes.error) {
        console.error('[analytics/employees] ai_evaluations:', evalsRes.error.message)
        return NextResponse.json({ error: 'DB error: ai_evaluations' }, { status: 500 })
      }
      evals = (evalsRes.data ?? []) as EvalRow[]
    }

    // profile_id → job ids のマップ
    const profileJobMap: Record<string, string[]> = {}
    for (const job of jobs) {
      const wid = job.worker_id as string | null
      if (!wid) continue
      if (!profileJobMap[wid]) profileJobMap[wid] = []
      profileJobMap[wid].push(job.id as string)
    }

    // job_id → evals のマップ
    const jobEvalMap: Record<string, EvalRow[]> = {}
    for (const ev of evals) {
      if (!jobEvalMap[ev.job_id]) jobEvalMap[ev.job_id] = []
      jobEvalMap[ev.job_id].push(ev)
    }

    // 従業員ごとに集計
    const result = employees
      .map((emp: AnyClient) => {
        const profileId  = (emp.auth_user_id as string | null) ?? null
        const empJobIds  = profileId ? (profileJobMap[profileId] ?? []) : []
        const empEvals   = empJobIds.flatMap((jid) => jobEvalMap[jid] ?? [])

        const scores    = empEvals.map((e) => e.score).filter((s): s is number => s != null)
        const avgScore  = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null
        const passCount = empEvals.filter((e) => e.recommendation === 'pass').length
        const redoCount = empEvals.filter((e) => e.recommendation === 'redo').length
        const passRate  = empEvals.length > 0
          ? Math.round((passCount / empEvals.length) * 100)
          : null

        return {
          employee_id:     emp.id as string,
          profile_id:      profileId,
          workerName:      emp.name as string,
          jobCount:        empJobIds.length,
          avgScore,
          passRate,
          redoCount,
          hasAnalysisData: empJobIds.length > 0 && empEvals.length > 0,
        }
      })
      .sort((a, b) => a.workerName.localeCompare(b.workerName, 'ja'))

    return NextResponse.json({ employees: result })

  } catch (err) {
    console.error('[analytics/employees] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
