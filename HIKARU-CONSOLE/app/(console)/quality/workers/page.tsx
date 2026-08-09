'use client'

import * as React from 'react'
import { PageHeader, Button, Card, CardContent, Badge, Skeleton, toast } from '@hikaru/ui'
import { Users, Star, RefreshCw, AlertTriangle } from 'lucide-react'
import { cn } from '@hikaru/ui'

interface WorkerQuality {
  worker_id:           string
  name:                string
  entity_type:         string | null
  job_count:           number
  avg_ai_score:        number | null
  avg_rating:          number | null
  avg_customer_score:  number | null
  avg_hqs:             number | null
  low_rating_count:    number
  survey_count:        number
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
  const color = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error'
  return <Badge variant={color as any} size="sm">{score}</Badge>
}

export default function WorkersQualityPage() {
  const [workers, setWorkers] = React.useState<WorkerQuality[]>([])
  const [loading, setLoading] = React.useState(true)
  const [days,    setDays]    = React.useState(30)

  React.useEffect(() => { load() }, [days])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/quality/workers?days=${days}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setWorkers(data.workers ?? [])
    } catch { toast.error('取得に失敗しました') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <PageHeader
        title="作業者別品質分析"
        description="従業員・協力業者の品質スコア比較"
        actions={
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? 'default' : 'outline'}
                onClick={() => setDays(d)}
              >
                {d}日
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : workers.length === 0 ? (
        <Card><CardContent>
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-3 text-[var(--color-muted-foreground)]" />
            <p className="text-sm text-[var(--color-muted-foreground)]">データがありません</p>
          </div>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {workers.map((w, idx) => (
            <Card key={w.worker_id} className={cn(
              w.low_rating_count > 0 && 'border-[var(--color-warning)]/30'
            )}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-[var(--color-muted-foreground)] w-6 shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{w.name}</span>
                      <Badge variant="secondary" size="sm">
                        {w.entity_type === 'partner' ? '協力業者' : '従業員'}
                      </Badge>
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        担当 {w.job_count}件 / 回答 {w.survey_count}件
                      </span>
                      {w.low_rating_count > 0 && (
                        <span className="text-xs text-[var(--color-warning)] flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> 低評価 {w.low_rating_count}件
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 shrink-0 text-right">
                    <div>
                      <p className="text-[10px] text-[var(--color-muted-foreground)]">AI品質</p>
                      <ScoreBadge score={w.avg_ai_score != null ? Math.round(w.avg_ai_score) : null} />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-muted-foreground)]">顧客満足</p>
                      {w.avg_rating != null ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3" style={{ fill: 'oklch(0.73 0.12 78)', color: 'oklch(0.73 0.12 78)' }} />
                          <span className="text-sm font-bold">{w.avg_rating.toFixed(1)}</span>
                        </div>
                      ) : <span className="text-xs text-[var(--color-muted-foreground)]">—</span>}
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-muted-foreground)]">HQS</p>
                      <ScoreBadge score={w.avg_hqs} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
