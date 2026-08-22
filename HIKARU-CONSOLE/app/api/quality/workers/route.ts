import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import {
  ratingToScore, calculateHikaruQualityScore, calcAverage, isLowRating, DEFAULT_WEIGHTS,
} from '@/lib/quality/service'

// GET /api/quality/workers - 作業者別品質集計
// ?days=30
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p        = req.nextUrl.searchParams
  const days     = Math.min(Number(p.get('days') ?? 30), 365)
  const workerId = p.get('worker_id') ?? ''
  const dateFrom = new Date(Date.now() - days * 86400_000).toISOString().split('T')[0]

  type CompanyQW = { quality_weight_ai: number; quality_weight_customer: number }
  type JobRow    = { id: string; worker_id: string }
  type AiRow     = { job_id: string; score: number }
  type SurveyRow = { job_id: string; rating: number }
  type ProfileRow = { id: string; name: string; entity_type: string | null }

  const { data: company } = await auth.adminClient
    .from('companies').select('quality_weight_ai, quality_weight_customer').eq('id', auth.companyId).single() as { data: CompanyQW | null; error: unknown }
  const weights = company
    ? { ai: Number(company.quality_weight_ai), customer: Number(company.quality_weight_customer) }
    : DEFAULT_WEIGHTS

  // 完了ジョブ（worker_id指定時は個人フィルタ）
  let jobsQuery = auth.adminClient
    .from('jobs')
    .select('id, worker_id')
    .eq('company_id', auth.companyId)
    .eq('status', 'completed')
    .gte('work_date', dateFrom)
  if (workerId) jobsQuery = (jobsQuery as any).eq('worker_id', workerId)
  const { data: jobs } = await jobsQuery as { data: JobRow[] | null; error: unknown }

  if (!jobs?.length) return NextResponse.json({ workers: [] })

  const jobIds   = jobs.map(j => j.id)
  const jobWorker = new Map(jobs.map(j => [j.id, j.worker_id]))

  // AI評価
  const { data: aiEvals } = await auth.adminClient
    .from('ai_evaluations').select('job_id, score').in('job_id', jobIds) as { data: AiRow[] | null; error: unknown }

  // アンケート
  const { data: surveys } = await auth.adminClient
    .from('satisfaction_surveys' as never).select('job_id, rating').in('job_id', jobIds) as { data: SurveyRow[] | null; error: unknown }

  // プロフィール（従業員・協力業者）
  const workerIds = [...new Set(jobs.map(j => j.worker_id))]
  const { data: profiles } = await auth.adminClient
    .from('profiles').select('id, name, entity_type').in('id', workerIds) as { data: ProfileRow[] | null; error: unknown }
  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  // worker_id 別に集計
  const workerAi    = new Map<string, number[]>()
  const workerRating = new Map<string, number[]>()
  const workerJobs  = new Map<string, Set<string>>()

  for (const ev of aiEvals ?? []) {
    const wid = jobWorker.get(ev.job_id) ?? ''
    if (!wid) continue
    const arr = workerAi.get(wid) ?? []
    arr.push(ev.score as number)
    workerAi.set(wid, arr)
    const s = workerJobs.get(wid) ?? new Set()
    s.add(ev.job_id)
    workerJobs.set(wid, s)
  }
  for (const sv of surveys ?? []) {
    const wid = jobWorker.get(sv.job_id) ?? ''
    if (!wid) continue
    const arr = workerRating.get(wid) ?? []
    arr.push(sv.rating)
    workerRating.set(wid, arr)
    const s = workerJobs.get(wid) ?? new Set()
    s.add(sv.job_id)
    workerJobs.set(wid, s)
  }

  const result = workerIds.map(wid => {
    const profile   = profileMap.get(wid)
    const aiArr     = workerAi.get(wid) ?? []
    const ratingArr = workerRating.get(wid) ?? []
    const avgAi     = calcAverage(aiArr)
    const avgRating = calcAverage(ratingArr)
    const hqs       = calculateHikaruQualityScore(avgAi, avgRating, weights)
    const jobCount  = (workerJobs.get(wid) ?? new Set()).size
    const lowCount  = ratingArr.filter(isLowRating).length

    return {
      worker_id:    wid,
      name:         profile?.name ?? '不明',
      entity_type:  profile?.entity_type ?? 'employee',
      job_count:    jobCount,
      avg_ai_score:     avgAi,
      avg_rating:       avgRating,
      avg_customer_score: avgRating ? ratingToScore(avgRating) : null,
      avg_hqs:          hqs,
      low_rating_count: lowCount,
      survey_count:     ratingArr.length,
    }
  }).sort((a, b) => (b.avg_hqs ?? 0) - (a.avg_hqs ?? 0))

  return NextResponse.json({ workers: result, date_from: dateFrom })
}
