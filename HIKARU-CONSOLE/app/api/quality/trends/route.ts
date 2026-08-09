import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { ratingToScore, calculateHikaruQualityScore, DEFAULT_WEIGHTS } from '@/lib/quality/service'

// GET /api/quality/trends - 時系列分析
// ?project_id=...&days=90
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p         = req.nextUrl.searchParams
  const projectId = p.get('project_id')
  const days      = Math.min(Number(p.get('days') ?? 90), 365)
  const dateFrom  = new Date(Date.now() - days * 86400_000).toISOString().split('T')[0]

  // 会社の重み設定
  type CompanyQW = { quality_weight_ai: number; quality_weight_customer: number }
  type JobRow    = { id: string; work_date: string; project_id: string; worker_id: string }
  type AiRow     = { job_id: string; score: number }
  type SurveyRow = { job_id: string; rating: number }

  const { data: company } = await auth.adminClient
    .from('companies')
    .select('quality_weight_ai, quality_weight_customer')
    .eq('id', auth.companyId).single() as { data: CompanyQW | null; error: unknown }
  const weights = company
    ? { ai: Number(company.quality_weight_ai), customer: Number(company.quality_weight_customer) }
    : DEFAULT_WEIGHTS

  // 完了ジョブ取得（期間内）
  let jobsQuery = auth.adminClient
    .from('jobs')
    .select('id, work_date, project_id, worker_id')
    .eq('company_id', auth.companyId)
    .eq('status', 'completed')
    .gte('work_date', dateFrom)
    .order('work_date', { ascending: true })

  if (projectId) jobsQuery = jobsQuery.eq('project_id', projectId)

  const { data: jobs } = await jobsQuery as { data: JobRow[] | null; error: unknown }
  if (!jobs?.length) return NextResponse.json({ trends: [] })

  const jobIds = jobs.map(j => j.id)

  // AI評価を一括取得
  const { data: aiEvals } = await auth.adminClient
    .from('ai_evaluations')
    .select('job_id, score')
    .in('job_id', jobIds) as { data: AiRow[] | null; error: unknown }

  // アンケートを一括取得
  const { data: surveys } = await auth.adminClient
    .from('satisfaction_surveys' as never)
    .select('job_id, rating')
    .in('job_id', jobIds) as { data: SurveyRow[] | null; error: unknown }

  // job_id でインデックス
  const aiMap  = new Map<string, number[]>()
  const survMap = new Map<string, number>()

  for (const ev of aiEvals ?? []) {
    const arr = aiMap.get(ev.job_id) ?? []
    arr.push(ev.score as number)
    aiMap.set(ev.job_id, arr)
  }
  for (const sv of surveys ?? []) {
    survMap.set(sv.job_id, sv.rating)
  }

  const trends = jobs.map(job => {
    const scores = aiMap.get(job.id) ?? []
    const aiScore = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null
    const rating  = survMap.get(job.id) ?? null
    const hqs     = calculateHikaruQualityScore(aiScore, rating, weights)

    return {
      job_id:         job.id,
      work_date:      job.work_date,
      project_id:     job.project_id,
      ai_score:       aiScore,
      customer_rating: rating,
      customer_score:  rating ? ratingToScore(rating) : null,
      hqs,
    }
  })

  return NextResponse.json({ trends, date_from: dateFrom, days })
}
