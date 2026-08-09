'use client'

import * as React from 'react'
import { PageHeader, Button, Card, CardContent, Badge, Skeleton, toast } from '@hikaru/ui'
import { Star, AlertTriangle, Zap, MessageCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import {
  calculateHikaruQualityScore, calculateQualityGap, isHighPriorityAlert, DEFAULT_WEIGHTS
} from '@/lib/quality/service'
import { cn } from '@hikaru/ui'

interface Survey {
  id: string
  rating: number
  comment: string | null
  rating_quality: number | null
  rating_speed: number | null
  rating_attitude: number | null
  ai_score: number | null
  ai_summary: string | null
  ai_positive_points: string[] | null
  ai_improvement_points: string[] | null
  ai_analyzed_at: string | null
  created_at: string
  jobs: {
    work_date: string
    projects: { name: string; project_type: string } | null
    worker: { name: string } | null
  } | null
  portal_accounts: {
    contact_name: string
    clients: { name: string } | null
  } | null
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} style={{
          width: size, height: size,
          fill: n <= rating ? 'oklch(0.73 0.12 78)' : 'none',
          color: n <= rating ? 'oklch(0.73 0.12 78)' : 'var(--color-muted-foreground)',
        }} />
      ))}
    </span>
  )
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP')
}

function SurveyCard({ survey }: { survey: Survey }) {
  const [expanded, setExpanded] = React.useState(false)
  const [analyzing, setAnalyzing] = React.useState(false)

  const hqs     = calculateHikaruQualityScore(survey.ai_score, survey.rating, DEFAULT_WEIGHTS)
  const gap     = calculateQualityGap(survey.ai_score, survey.rating)
  const highPri = isHighPriorityAlert(survey.ai_score, survey.rating)

  async function handleAnalyze() {
    setAnalyzing(true)
    try {
      const res = await fetch(`/api/surveys/${survey.id}/analyze`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('AI分析が完了しました')
      window.location.reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'AI分析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <Card className={cn(
      'transition-colors',
      highPri && 'border-[var(--color-error)]/40',
      survey.rating <= 2 && !highPri && 'border-[var(--color-warning)]/30'
    )}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* ヘッダー行 */}
            <div className="flex items-center gap-2 flex-wrap">
              {highPri && (
                <Badge variant="error" size="sm" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> 高優先度
                </Badge>
              )}
              <StarDisplay rating={survey.rating} />
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {survey.jobs?.projects?.name ?? '—'}
              </span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {fmtDate(survey.jobs?.work_date)}
              </span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {survey.portal_accounts?.clients?.name ?? '—'}
              </span>
            </div>

            {/* スコア行 */}
            <div className="flex gap-4 mt-1.5 flex-wrap">
              {survey.ai_score != null && (
                <span className="text-xs">
                  AI: <strong>{survey.ai_score}</strong>/100
                </span>
              )}
              {hqs != null && (
                <span className="text-xs">
                  HQS: <strong className={hqs >= 80 ? 'text-[var(--color-success)]' : hqs >= 60 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'}>{hqs}</strong>/100
                </span>
              )}
              {gap && Math.abs(gap.gap) >= 15 && (
                <span className="text-xs text-[var(--color-warning)]">
                  ギャップ: {gap.gap > 0 ? '+' : ''}{gap.gap}
                </span>
              )}
              <span className="text-xs text-[var(--color-muted-foreground)]">
                担当: {survey.jobs?.worker?.name ?? '—'}
              </span>
            </div>

            {/* コメント */}
            {survey.comment && (
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1.5 italic">
                「{survey.comment}」
              </p>
            )}

            {/* 展開: AI分析・詳細評価 */}
            {expanded && (
              <div className="mt-3 space-y-3 border-t border-[var(--color-border)] pt-3">
                {/* 詳細評価 */}
                {(survey.rating_quality || survey.rating_speed || survey.rating_attitude) && (
                  <div className="space-y-1">
                    {survey.rating_quality  && <div className="flex justify-between text-xs"><span className="text-[var(--color-muted-foreground)]">清掃品質</span><StarDisplay rating={survey.rating_quality} size={12} /></div>}
                    {survey.rating_speed    && <div className="flex justify-between text-xs"><span className="text-[var(--color-muted-foreground)]">作業スピード</span><StarDisplay rating={survey.rating_speed} size={12} /></div>}
                    {survey.rating_attitude && <div className="flex justify-between text-xs"><span className="text-[var(--color-muted-foreground)]">スタッフ対応</span><StarDisplay rating={survey.rating_attitude} size={12} /></div>}
                  </div>
                )}

                {/* AI分析結果 */}
                {survey.ai_summary ? (
                  <div className="bg-[var(--color-muted)] rounded p-3 space-y-2">
                    <p className="text-xs font-medium text-[var(--color-muted-foreground)] flex items-center gap-1">
                      <Zap className="h-3 w-3" /> AI分析結果
                      <span className="text-[10px] ml-auto">{fmtDate(survey.ai_analyzed_at)}</span>
                    </p>
                    <p className="text-xs">{survey.ai_summary}</p>
                    {(survey.ai_positive_points?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] text-[var(--color-success)] font-medium mb-1">良い点</p>
                        <ul className="space-y-0.5">
                          {survey.ai_positive_points!.map((p, i) => (
                            <li key={i} className="text-xs text-[var(--color-muted-foreground)]">・{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(survey.ai_improvement_points?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] text-[var(--color-warning)] font-medium mb-1">改善点</p>
                        <ul className="space-y-0.5">
                          {survey.ai_improvement_points!.map((p, i) => (
                            <li key={i} className="text-xs text-[var(--color-muted-foreground)]">・{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : survey.comment ? (
                  <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={analyzing}>
                    <Zap className="h-3.5 w-3.5" />
                    {analyzing ? 'AI分析中...' : 'AIでコメントを分析'}
                  </Button>
                ) : null}

                {/* ギャップ分析 */}
                {gap && (
                  <div className="text-xs text-[var(--color-muted-foreground)] bg-[var(--color-muted)] rounded p-2">
                    {gap.message}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 展開ボタン */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] shrink-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SurveysListPage() {
  const [surveys, setSurveys] = React.useState<Survey[]>([])
  const [total,   setTotal]   = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/surveys?limit=100', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSurveys(data.surveys ?? [])
      setTotal(data.total ?? 0)
    } catch { toast.error('取得に失敗しました') }
    finally { setLoading(false) }
  }

  const highPriority = surveys.filter(s => isHighPriorityAlert(s.ai_score, s.rating))
  const lowRating    = surveys.filter(s => s.rating <= 2 && !isHighPriorityAlert(s.ai_score, s.rating))
  const normal       = surveys.filter(s => s.rating >= 3 && !isHighPriorityAlert(s.ai_score, s.rating))

  return (
    <div>
      <PageHeader
        title="アンケート一覧"
        description={`全 ${total}件`}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : surveys.length === 0 ? (
        <Card><CardContent>
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 text-[var(--color-muted-foreground)]" />
            <p className="text-sm text-[var(--color-muted-foreground)]">アンケートがありません</p>
          </div>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {highPriority.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-error)] uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" /> 高優先度 ({highPriority.length})
              </h3>
              <div className="space-y-2">{highPriority.map(s => <SurveyCard key={s.id} survey={s} />)}</div>
            </section>
          )}
          {lowRating.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wider mb-2">
                低評価 ({lowRating.length})
              </h3>
              <div className="space-y-2">{lowRating.map(s => <SurveyCard key={s.id} survey={s} />)}</div>
            </section>
          )}
          {normal.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-2">
                通常 ({normal.length})
              </h3>
              <div className="space-y-2">{normal.map(s => <SurveyCard key={s.id} survey={s} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
