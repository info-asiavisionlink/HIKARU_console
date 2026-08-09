import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import OpenAI from 'openai'

// POST /api/surveys/[id]/analyze - AIによるコメント分析（原文は変更しない）
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type SurveyFull = {
    id: string; rating: number; comment: string | null
    rating_quality: number | null; rating_speed: number | null; rating_attitude: number | null
    jobs: { project_id: string; work_date: string; projects: { name: string; project_type: string } | null; ai_evaluations: { score: number; recommendation: string; comment: string; remaining_issues: string[] }[] } | null
  }

  const { data: survey } = await auth.adminClient
    .from('satisfaction_surveys' as never)
    .select(`
      *,
      jobs:job_id (
        project_id, work_date,
        projects:project_id (name, project_type),
        ai_evaluations (score, recommendation, comment, remaining_issues)
      )
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: SurveyFull | null; error: unknown }

  if (!survey) return NextResponse.json({ error: 'アンケートが見つかりません' }, { status: 404 })
  if (!survey.comment?.trim()) {
    return NextResponse.json({ error: 'コメントがないためAI分析できません' }, { status: 400 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const job = survey.jobs as any
  const project = job?.projects as any
  const aiEvals = (job?.ai_evaluations ?? []) as any[]
  const avgAiScore = aiEvals.length
    ? Math.round(aiEvals.reduce((s: number, e: any) => s + e.score, 0) / aiEvals.length)
    : null

  const systemPrompt = `あなたは清掃品質管理のアドバイザーです。
顧客の清掃作業に対するフィードバックを分析し、
ポジティブな点と改善点を箇条書きで提示してください。

重要なルール:
- 顧客が実際に書いていない内容を事実として追加しないこと
- 断定的な表現を避け「〜の可能性があります」「〜が考えられます」など適切な表現を使うこと
- コメントから読み取れる範囲でのみ分析すること
- 日本語で回答すること`

  const userPrompt = `案件: ${project?.name ?? '不明'} (${project?.project_type ?? '—'})
作業日: ${job?.work_date ?? '—'}
顧客総合評価: ${survey.rating}/5
${survey.rating_quality ? `清掃品質: ${survey.rating_quality}/5` : ''}
${survey.rating_speed ? `作業スピード: ${survey.rating_speed}/5` : ''}
${survey.rating_attitude ? `スタッフ対応: ${survey.rating_attitude}/5` : ''}
${avgAiScore !== null ? `AI品質スコア: ${avgAiScore}/100` : ''}

顧客コメント（原文）:
${survey.comment}

上記の顧客コメントを分析し、以下のJSON形式で返してください:
{
  "summary": "1〜2文の要約",
  "positive_points": ["ポジティブな点1", "ポジティブな点2"],
  "improvement_points": ["改善が考えられる点1", "改善が考えられる点2"]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const result = JSON.parse(completion.choices[0].message.content ?? '{}')

    // 原文は変更せず、AI分析結果のみ別フィールドに保存
    await auth.adminClient
      .from('satisfaction_surveys' as never)
      .update({
        ai_summary:            result.summary ?? null,
        ai_positive_points:    result.positive_points ?? [],
        ai_improvement_points: result.improvement_points ?? [],
        ai_analyzed_at:        new Date().toISOString(),
      } as never)
      .eq('id', id)

    return NextResponse.json({
      summary:           result.summary,
      positive_points:   result.positive_points,
      improvement_points: result.improvement_points,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
