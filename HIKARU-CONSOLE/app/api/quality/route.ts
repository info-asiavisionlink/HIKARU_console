import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import {
  ratingToScore, calculateHikaruQualityScore, calculateQualityGap,
  isLowRating, isHighPriorityAlert, calcRatingDistribution, calcAverage,
  DEFAULT_WEIGHTS,
} from '@/lib/quality/service'

// GET /api/quality - 品質ダッシュボード KPI
// ?period=7d|30d|90d|ytd  &date_from=...&date_to=...
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p      = req.nextUrl.searchParams
  const period = p.get('period') ?? '30d'
  let dateFrom = p.get('date_from')
  let dateTo   = p.get('date_to')

  // 期間計算
  if (!dateFrom) {
    const now = new Date()
    if (period === '7d')  dateFrom = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0]
    else if (period === '90d') dateFrom = new Date(now.setDate(now.getDate() - 90)).toISOString().split('T')[0]
    else if (period === 'ytd') dateFrom = `${new Date().getFullYear()}-01-01`
    else dateFrom = new Date(Date.now() - 30 * 86400_000).toISOString().split('T')[0]
  }

  // 会社の重み設定を取得
  type CompanyQW = { quality_weight_ai: number; quality_weight_customer: number }
  type SurveyRow = { rating: number; ai_score: number | null; job_id: string; created_at: string }
  type AiEvalRow = { score: number; job_id: string }
  type JobRow    = { id: string }

  const { data: company } = await auth.adminClient
    .from('companies')
    .select('quality_weight_ai, quality_weight_customer')
    .eq('id', auth.companyId)
    .single() as { data: CompanyQW | null; error: unknown }

  const weights = company
    ? { ai: Number(company.quality_weight_ai), customer: Number(company.quality_weight_customer) }
    : DEFAULT_WEIGHTS

  // 期間内のアンケート一覧取得
  const { data: surveys } = await auth.adminClient
    .from('satisfaction_surveys' as never)
    .select('rating, ai_score, job_id, created_at')
    .eq('company_id', auth.companyId)
    .gte('created_at', dateFrom ?? '2020-01-01')
    .lte('created_at', dateTo ?? '2099-12-31') as { data: SurveyRow[] | null; error: unknown }

  // AI評価スコアの取得
  const { data: jobRows } = await auth.adminClient
    .from('jobs')
    .select('id')
    .eq('company_id', auth.companyId)
    .gte('work_date', dateFrom ?? '2020-01-01')
    .lte('work_date', dateTo ?? '2099-12-31') as { data: JobRow[] | null; error: unknown }

  const { data: aiEvals } = await auth.adminClient
    .from('ai_evaluations')
    .select('score, job_id')
    .in('job_id', jobRows?.map(j => j.id) ?? []) as { data: AiEvalRow[] | null; error: unknown }

  const ratings   = (surveys ?? []).map(s => s.rating)
  const aiScores  = (aiEvals ?? []).map(e => e.score as number)
  const dist      = calcRatingDistribution(ratings)
  const avgRating = calcAverage(ratings)
  const avgAi     = calcAverage(aiScores)
  const avgCustomerScore = avgRating ? ratingToScore(avgRating) : null
  const avgHqs    = calculateHikaruQualityScore(avgAi, avgRating ? avgRating : null, weights)

  const totalJobs = (await auth.adminClient
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', auth.companyId)
    .eq('status', 'completed')
    .gte('work_date', dateFrom ?? '2020-01-01')
  ).count ?? 0

  const responseCount = surveys?.length ?? 0
  const responseRate  = totalJobs > 0 ? Math.round((responseCount / totalJobs) * 100) : 0

  const lowRatingCount    = ratings.filter(isLowRating).length
  const fiveStarCount     = ratings.filter(r => r === 5).length
  const lowRatingRate     = responseCount > 0 ? Math.round((lowRatingCount / responseCount) * 100) : 0
  const fiveStarRate      = responseCount > 0 ? Math.round((fiveStarCount  / responseCount) * 100) : 0

  // 品質ギャップ統計
  const gaps = (surveys ?? [])
    .filter(s => s.ai_score != null)
    .map(s => s.ai_score! - ratingToScore(s.rating))
  const avgGap = calcAverage(gaps)

  // 高優先度アラート件数
  const highPriorityCount = (surveys ?? []).filter(s =>
    isHighPriorityAlert(s.ai_score, s.rating)
  ).length

  return NextResponse.json({
    period: { from: dateFrom, to: dateTo },
    weights,
    kpi: {
      response_count:     responseCount,
      total_completed:    totalJobs,
      response_rate:      responseRate,
      avg_rating:         avgRating,
      avg_ai_score:       avgAi,
      avg_hqs:            avgHqs,
      avg_quality_gap:    avgGap,
      low_rating_count:   lowRatingCount,
      low_rating_rate:    lowRatingRate,
      five_star_count:    fiveStarCount,
      five_star_rate:     fiveStarRate,
      high_priority_count: highPriorityCount,
    },
    distribution: dist,
  })
}
