import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/portal/surveys - 未回答・回答済みアンケート一覧
export async function GET(_req: NextRequest) {
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_cp_uid')?.value
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('id, client_id, company_id')
    .eq('profile_id', uid)
    .eq('is_active', true)
    .single()

  if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 案件権限のある project_id 一覧
  const { data: perms } = await admin
    .from('client_project_permissions')
    .select('project_id, can_submit_survey, show_ai_score_to_client')
    .eq('portal_account_id', account.id)
    .eq('can_submit_survey', true)

  const permProjectIds = (perms ?? []).map(p => p.project_id)
  if (!permProjectIds.length) return NextResponse.json({ pending: [], answered: [] })

  const showAiMap = new Map((perms ?? []).map(p => [p.project_id, p.show_ai_score_to_client]))

  // 完了済みジョブ（閲覧権限のある案件のみ）
  const { data: jobs } = await admin
    .from('jobs')
    .select(`
      id, work_date, project_id, started_at, completed_at,
      projects:project_id (id, name, project_type, location_name)
    `)
    .in('project_id', permProjectIds)
    .eq('company_id', account.company_id)
    .eq('status', 'completed')
    .order('work_date', { ascending: false })
    .limit(50)

  if (!jobs?.length) return NextResponse.json({ pending: [], answered: [] })

  const jobIds = jobs.map(j => j.id)

  // 回答済み
  const { data: answered } = await admin
    .from('satisfaction_surveys')
    .select('id, job_id, rating, comment, created_at')
    .in('job_id', jobIds)
    .eq('portal_account_id', account.id)

  const answeredJobIds = new Set((answered ?? []).map(s => s.job_id))

  // AI評価スコア取得（ai_score公開設定があるもののみ表示）
  const { data: aiEvals } = await admin
    .from('ai_evaluations')
    .select('job_id, score')
    .in('job_id', jobIds)

  const aiByJob = new Map<string, number[]>()
  for (const ev of aiEvals ?? []) {
    const arr = aiByJob.get(ev.job_id) ?? []
    arr.push(ev.score)
    aiByJob.set(ev.job_id, arr)
  }

  const enrichJobs = jobs.map(j => {
    const scores = aiByJob.get(j.id) ?? []
    const aiAvg  = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null
    const showAi = showAiMap.get(j.project_id) ?? false
    return {
      ...j,
      ai_score: showAi ? aiAvg : null,
      show_ai_score: showAi,
      survey: (answered ?? []).find(s => s.job_id === j.id) ?? null,
    }
  })

  const pending  = enrichJobs.filter(j => !answeredJobIds.has(j.id))
  const answeredList = enrichJobs.filter(j => answeredJobIds.has(j.id))

  return NextResponse.json({ pending, answered: answeredList })
}

// POST /api/portal/surveys - アンケート回答
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_cp_uid')?.value
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await req.json()
  const { job_id, rating, comment, rating_quality, rating_speed, rating_attitude } = body

  if (!job_id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'job_id と rating(1-5) は必須です' }, { status: 400 })
  }

  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('id, client_id, company_id')
    .eq('profile_id', uid)
    .eq('is_active', true)
    .single()

  if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ジョブが自社の完了済み案件に属するか確認（テナント分離）
  const { data: job } = await admin
    .from('jobs')
    .select('id, project_id, company_id, status')
    .eq('id', job_id)
    .eq('company_id', account.company_id)
    .eq('status', 'completed')
    .single()

  if (!job) return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 })

  // 案件閲覧権限かつアンケート送信権限チェック
  const { data: perm } = await admin
    .from('client_project_permissions')
    .select('can_submit_survey')
    .eq('portal_account_id', account.id)
    .eq('project_id', job.project_id)
    .single()

  if (!perm?.can_submit_survey) {
    return NextResponse.json({ error: 'このジョブのアンケート送信権限がありません' }, { status: 403 })
  }

  // AI評価スコアのスナップショット
  const { data: aiEvals } = await admin
    .from('ai_evaluations')
    .select('score')
    .eq('job_id', job_id)

  const aiScoreAvg = (aiEvals?.length ?? 0) > 0
    ? Math.round((aiEvals!.reduce((s, e) => s + e.score, 0)) / aiEvals!.length)
    : null

  // アンケート登録（UNIQUE制約で重複防止）
  const { data: survey, error } = await admin
    .from('satisfaction_surveys')
    .insert({
      company_id:        account.company_id,
      job_id,
      project_id:        job.project_id,
      portal_account_id: account.id,
      rating,
      comment:           comment?.trim() || null,
      rating_quality:    rating_quality || null,
      rating_speed:      rating_speed   || null,
      rating_attitude:   rating_attitude || null,
      ai_score:          aiScoreAvg,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'このジョブはすでに評価済みです' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 低評価アラート通知（Phase 4 通知基盤を使用）
  if (rating <= 2) {
    void triggerLowRatingAlert(survey.id, account.company_id, job, rating, comment)
  }

  return NextResponse.json({ survey }, { status: 201 })
}

async function triggerLowRatingAlert(
  surveyId: string,
  companyId: string,
  job: { id: string; project_id: string },
  rating: number,
  comment?: string
) {
  try {
    const admin = createAdminClient()

    // 案件名を取得
    const { data: project } = await admin
      .from('projects')
      .select('name')
      .eq('id', job.project_id)
      .single()

    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
    const message = [
      '【HIKARU】顧客から低評価が登録されました',
      '',
      `案件: ${project?.name ?? '—'}`,
      `評価: ${stars} (${rating}/5)`,
      comment ? `コメント: ${comment}` : '',
      '',
      'HIKARU-CONSOLEで確認してください。',
    ].filter(Boolean).join('\n')

    // 管理者全員へ通知（lib/line/notification.service のパターンに倣い、CONSOLEのAPIを呼ぶ）
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'admin')

    for (const adm of admins ?? []) {
      await admin.from('line_notification_logs').insert({
        company_id:       companyId,
        profile_id:       adm.id,
        event_type:       'customer_low_rating',
        notification_key: `customer_low_rating:${surveyId}:${adm.id}`,
        message,
        status:           'pending',
      })
    }

    // 実際のLINE送信はCONSOLEのサービスワーカーまたはバックグラウンドで処理
  } catch {
    // 通知失敗は業務処理に影響させない
  }
}
