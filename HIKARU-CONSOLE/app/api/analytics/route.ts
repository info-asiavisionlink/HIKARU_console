import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// ============================================================
// ヘルパー（analytics.service.ts と同一ロジック）
// ============================================================

function monthLabel(ym: string): string {
  const [, m] = ym.split('-')
  return `${parseInt(m)}月`
}

function getLast12Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

// ============================================================
// GET /api/analytics
// analytics page が必要とする全データを一括返却
// ============================================================

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now            = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const months         = getLast12Months()
    const trendStartDate = months[0] + '-01'

    // ================================================================
    // Round 1: company_id で直接絞れるテーブルを並列取得
    //   + jobs（後続クエリの job_id フィルタ用）
    //   + projects（chat_messages の project_id フィルタ用）
    // ================================================================
    const [
      jobsRes,
      projectIdsRes,
      reportsRes,
      projectsCountRes,
      storesRes,
      monthJobsRes,
    ] = await Promise.all([
      // jobs: company_id 直接フィルタ + ランキング用ネスト情報
      auth.adminClient
        .from('jobs')
        .select('id, status, work_date, worker_id, projects(store_id, stores(id, name)), profiles(name)')
        .eq('company_id', auth.companyId),
      // 全 project_id（chat_messages フィルタ用）
      auth.adminClient
        .from('projects')
        .select('id')
        .eq('company_id', auth.companyId),
      // reports: company_id 直接フィルタ（件数のみ）
      auth.adminClient
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', auth.companyId),
      // projects: company_id 直接フィルタ（件数のみ）
      auth.adminClient
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', auth.companyId),
      // stores: company_id 直接フィルタ（件数のみ）
      auth.adminClient
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', auth.companyId),
      // 今月の jobs 件数
      auth.adminClient
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', auth.companyId)
        .gte('created_at', thisMonthStart),
    ])

    if (jobsRes.error) {
      console.error('[analytics] jobs:', jobsRes.error.message)
      return NextResponse.json({ error: 'DB error: jobs' }, { status: 500 })
    }
    if (reportsRes.error) {
      console.error('[analytics] reports:', reportsRes.error.message)
      return NextResponse.json({ error: 'DB error: reports' }, { status: 500 })
    }
    if (projectsCountRes.error) {
      console.error('[analytics] projects count:', projectsCountRes.error.message)
      return NextResponse.json({ error: 'DB error: projects' }, { status: 500 })
    }
    if (storesRes.error) {
      console.error('[analytics] stores:', storesRes.error.message)
      return NextResponse.json({ error: 'DB error: stores' }, { status: 500 })
    }
    if (monthJobsRes.error) {
      console.error('[analytics] month_jobs:', monthJobsRes.error.message)
      return NextResponse.json({ error: 'DB error: month_jobs' }, { status: 500 })
    }

    type JobRow = {
      id: string
      status: string
      work_date: string
      worker_id: string | null
      projects: { store_id: string | null; stores: { id: string; name: string } | null } | null
      profiles: { name: string } | null
    }
    const allJobs      = (jobsRes.data ?? []) as JobRow[]
    const jobIds       = allJobs.map(j => j.id)
    const allProjectIds = (projectIdsRes.data ?? []).map(p => p.id)

    // ================================================================
    // Round 2: job_id / project_id 経由フィルタが必要なテーブル（並列）
    //   photos         → job_id IN jobIds
    //   ai_evaluations → job_id IN jobIds
    //   chat_messages  → project_id IN allProjectIds（非クリティカル）
    // ================================================================
    let photosCount = 0
    let evals: Array<{ job_id: string; score: number | null; recommendation: string; photo_spots: { name: string } | null }> = []
    let chatCount = 0

    if (jobIds.length > 0 || allProjectIds.length > 0) {
      const [photosRes, evalsRes, chatsRes] = await Promise.all([
        jobIds.length > 0
          ? auth.adminClient
              .from('photos')
              .select('id', { count: 'exact', head: true })
              .in('job_id', jobIds)
          : Promise.resolve({ count: 0 as number | null, error: null }),
        jobIds.length > 0
          ? auth.adminClient
              .from('ai_evaluations')
              .select('job_id, score, recommendation, photo_spots(name)')
              .in('job_id', jobIds)
          : Promise.resolve({ data: [] as unknown[], error: null }),
        allProjectIds.length > 0
          ? auth.adminClient
              .from('chat_messages')
              .select('id', { count: 'exact', head: true })
              .in('project_id', allProjectIds)
          : Promise.resolve({ count: 0 as number | null, error: null }),
      ])

      if (photosRes.error) {
        console.error('[analytics] photos:', photosRes.error.message)
        return NextResponse.json({ error: 'DB error: photos' }, { status: 500 })
      }
      if (evalsRes.error) {
        console.error('[analytics] ai_evaluations:', evalsRes.error.message)
        return NextResponse.json({ error: 'DB error: evaluations' }, { status: 500 })
      }
      if (chatsRes.error) {
        // chat_messages は非クリティカル（エラー時は 0 として続行）
        console.error('[analytics] chat_messages:', chatsRes.error.message)
      } else {
        chatCount = chatsRes.count ?? 0
      }

      photosCount = photosRes.count ?? 0
      evals = (evalsRes.data ?? []) as typeof evals
    }

    // ================================================================
    // 集計（analytics.service.ts と同一ロジック）
    // ================================================================

    // --- Overview ---
    const scored     = evals.filter(e => e.score != null)
    const avgScore   = scored.length > 0
      ? Math.round(scored.reduce((a, e) => a + (e.score ?? 0), 0) / scored.length)
      : null
    const passCount  = evals.filter(e => e.recommendation === 'pass').length
    const checkCount = evals.filter(e => e.recommendation === 'check').length
    const redoCount  = evals.filter(e => e.recommendation === 'redo').length
    const evalTotal  = evals.length

    const overview = {
      totalJobs:        allJobs.length,
      activeJobs:       allJobs.filter(j => j.status === 'in_progress').length,
      completedJobs:    allJobs.filter(j => j.status === 'completed').length,
      totalPhotos:      photosCount,
      avgQualityScore:  avgScore,
      totalReports:     reportsRes.count        ?? 0,
      totalEvaluations: evalTotal,
      redoCount,
      passCount,
      checkCount,
      passRate:         evalTotal > 0 ? Math.round((passCount  / evalTotal) * 100) : 0,
      redoRate:         evalTotal > 0 ? Math.round((redoCount  / evalTotal) * 100) : 0,
      thisMonthJobs:    monthJobsRes.count       ?? 0,
      chatCount,
      totalProjects:    projectsCountRes.count   ?? 0,
      totalStores:      storesRes.count          ?? 0,
    }

    // --- Monthly Trends ---
    const trendJobs       = allJobs.filter(j => j.work_date >= trendStartDate)
    const trendJobIdSet   = new Set(trendJobs.map(j => j.id))
    const jobMonthMap: Record<string, string> = {}
    for (const job of trendJobs) {
      jobMonthMap[job.id] = job.work_date.substring(0, 7)
    }

    const monthScores:   Record<string, number[]>    = {}
    const monthJobSet:   Record<string, Set<string>> = {}
    for (const ev of evals) {
      if (!trendJobIdSet.has(ev.job_id)) continue
      const month = jobMonthMap[ev.job_id]
      if (!month) continue
      if (!monthScores[month]) monthScores[month] = []
      if (!monthJobSet[month]) monthJobSet[month] = new Set()
      if (ev.score != null) monthScores[month].push(ev.score)
      monthJobSet[month].add(ev.job_id)
    }

    const trends = months.map(m => {
      const sc = monthScores[m] ?? []
      return {
        month:    m,
        label:    monthLabel(m),
        avgScore: sc.length > 0 ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null,
        jobCount: monthJobSet[m]?.size ?? 0,
      }
    })

    // --- Quality Distribution ---
    const allScores = evals.map(e => e.score).filter((s): s is number => s != null)
    const distTotal = allScores.length
    const distribution = [
      { range: '90-100', label: '90〜100点（優秀）', min: 90, max: 100 },
      { range: '75-89',  label: '75〜89点（良好）',  min: 75, max:  89 },
      { range: '60-74',  label: '60〜74点（普通）',  min: 60, max:  74 },
      { range: '45-59',  label: '45〜59点（要改善）', min: 45, max:  59 },
      { range: '0-44',   label: '0〜44点（不合格）',  min:  0, max:  44 },
    ].map(r => {
      const count = allScores.filter(s => s >= r.min && s <= r.max).length
      return { range: r.range, label: r.label, count, pct: distTotal > 0 ? Math.round((count / distTotal) * 100) : 0 }
    })

    // --- Spot Rankings ---
    const spotData: Record<string, { scores: number[]; redoCount: number; total: number }> = {}
    for (const ev of evals) {
      const name = ev.photo_spots?.name
      if (!name) continue
      if (!spotData[name]) spotData[name] = { scores: [], redoCount: 0, total: 0 }
      spotData[name].total++
      if (ev.score != null) spotData[name].scores.push(ev.score)
      if (ev.recommendation === 'redo') spotData[name].redoCount++
    }
    const spotRankings = Object.entries(spotData)
      .map(([spotName, d]) => ({
        spotName,
        avgScore:  d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
        evalCount: d.total,
        redoRate:  d.total > 0 ? Math.round((d.redoCount / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)

    // --- Store Rankings ---
    const storeData: Record<string, { name: string; scores: number[]; lastDate: string }> = {}
    const jobStoreMap: Record<string, string> = {}
    for (const job of allJobs) {
      const storeId   = job.projects?.store_id
      const storeName = job.projects?.stores?.name
      if (!storeId || !storeName) continue
      if (!storeData[storeId]) storeData[storeId] = { name: storeName, scores: [], lastDate: '' }
      if (job.work_date > (storeData[storeId].lastDate ?? '')) {
        storeData[storeId].lastDate = job.work_date
      }
      jobStoreMap[job.id] = storeId
    }
    for (const ev of evals) {
      const storeId = jobStoreMap[ev.job_id]
      if (!storeId || !storeData[storeId]) continue
      if (ev.score != null) storeData[storeId].scores.push(ev.score)
    }
    const jobCountByStore: Record<string, number> = {}
    for (const job of allJobs) {
      const storeId = jobStoreMap[job.id]
      if (storeId) jobCountByStore[storeId] = (jobCountByStore[storeId] ?? 0) + 1
    }
    const storeRankings = Object.entries(storeData)
      .map(([storeId, d]) => ({
        storeId,
        storeName:   d.name,
        avgScore:    d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null,
        jobCount:    jobCountByStore[storeId] ?? 0,
        lastJobDate: d.lastDate || null,
      }))
      .filter(r => r.avgScore != null)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))

    // --- Worker Rankings ---
    const workerData: Record<string, { name: string; scores: number[]; redoCount: number; passCount: number; totalEvals: number }> = {}
    const jobWorkerMap: Record<string, string> = {}
    for (const job of allJobs) {
      if (!job.worker_id) continue
      const name = job.profiles?.name ?? '不明'
      if (!workerData[job.worker_id]) {
        workerData[job.worker_id] = { name, scores: [], redoCount: 0, passCount: 0, totalEvals: 0 }
      }
      jobWorkerMap[job.id] = job.worker_id
    }
    for (const ev of evals) {
      const wid = jobWorkerMap[ev.job_id]
      if (!wid || !workerData[wid]) continue
      workerData[wid].totalEvals++
      if (ev.score != null) workerData[wid].scores.push(ev.score)
      if (ev.recommendation === 'redo') workerData[wid].redoCount++
      if (ev.recommendation === 'pass') workerData[wid].passCount++
    }
    const jobCountByWorker: Record<string, number> = {}
    for (const job of allJobs) {
      if (job.worker_id) jobCountByWorker[job.worker_id] = (jobCountByWorker[job.worker_id] ?? 0) + 1
    }
    const workerRankings = Object.entries(workerData)
      .map(([workerId, d]) => ({
        workerId,
        workerName: d.name,
        avgScore:   d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null,
        jobCount:   jobCountByWorker[workerId] ?? 0,
        redoCount:  d.redoCount,
        passRate:   d.totalEvals > 0 ? Math.round((d.passCount / d.totalEvals) * 100) : 0,
      }))
      .filter(r => r.avgScore != null)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))

    return NextResponse.json({
      overview,
      trends,
      storeRankings,
      workerRankings,
      distribution,
      spotRankings,
    })
  } catch (err) {
    console.error('[analytics] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
