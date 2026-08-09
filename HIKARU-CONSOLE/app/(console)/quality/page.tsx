'use client'

import * as React from 'react'
import { PageHeader, Card, CardContent, Badge, Skeleton, toast, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@hikaru/ui'
import { Star, TrendingUp, AlertTriangle, BarChart3, Users, RefreshCw } from 'lucide-react'
import { calculateQualityGap, ratingToScore } from '@/lib/quality/service'
import Link from 'next/link'

type Period = '7d' | '30d' | '90d' | 'ytd'

interface QualityKpi {
  response_count:     number
  total_completed:    number
  response_rate:      number
  avg_rating:         number | null
  avg_ai_score:       number | null
  avg_hqs:            number | null
  avg_quality_gap:    number | null
  low_rating_count:   number
  low_rating_rate:    number
  five_star_count:    number
  five_star_rate:     number
  high_priority_count: number
}

interface Distribution {
  [key: number]: { count: number; percent: number }
}

export default function QualityDashboard() {
  const [kpi,  setKpi]  = React.useState<QualityKpi | null>(null)
  const [dist, setDist] = React.useState<Distribution | null>(null)
  const [period, setPeriod] = React.useState<Period>('30d')
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/quality?period=${period}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setKpi(data.kpi)
      setDist(data.distribution)
    } catch { toast.error('データ取得に失敗しました') }
    finally { setLoading(false) }
  }

  const gapInfo = kpi?.avg_quality_gap != null ? calculateQualityGap(
    (kpi.avg_ai_score ?? 0) + (kpi.avg_quality_gap ?? 0),
    kpi.avg_rating ?? 3
  ) : null

  return (
    <div>
      <PageHeader
        title="品質・満足度ダッシュボード"
        description="AI品質スコアと顧客満足度の統合分析"
        actions={
          <div className="flex gap-2">
            <Select value={period} onValueChange={v => setPeriod(v as Period)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7日間</SelectItem>
                <SelectItem value="30d">30日間</SelectItem>
                <SelectItem value="90d">90日間</SelectItem>
                <SelectItem value="ytd">今年</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : kpi ? (
        <>
          {/* 高優先度アラート */}
          {kpi.high_priority_count > 0 && (
            <div className="mb-4 flex items-center gap-3 p-4 rounded-[var(--radius-lg)] border border-[var(--color-error)]/40 bg-[var(--color-error)]/5">
              <AlertTriangle className="h-5 w-5 text-[var(--color-error)] shrink-0" />
              <div>
                <p className="text-sm font-bold text-[var(--color-error)]">
                  高優先度アラート: {kpi.high_priority_count}件
                </p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  AI評価と顧客満足度が両方低い案件があります
                </p>
              </div>
              <Link href="/quality/surveys?filter=high_priority" className="ml-auto">
                <Button size="sm" variant="outline">確認する</Button>
              </Link>
            </div>
          )}

          {/* KPIカード */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KpiCard
              label="平均顧客満足度"
              value={kpi.avg_rating != null ? `${kpi.avg_rating.toFixed(1)} / 5` : '—'}
              sub={<StarDisplay rating={kpi.avg_rating ?? 0} />}
              color="gold"
            />
            <KpiCard
              label="平均AI品質"
              value={kpi.avg_ai_score != null ? `${kpi.avg_ai_score.toFixed(0)}` : '—'}
              sub="/100"
              color={kpi.avg_ai_score != null ? (kpi.avg_ai_score >= 80 ? 'success' : kpi.avg_ai_score >= 60 ? 'warning' : 'error') : 'muted'}
            />
            <KpiCard
              label="HIKARU Quality Score"
              value={kpi.avg_hqs != null ? `${kpi.avg_hqs}` : '—'}
              sub="/100"
              color={kpi.avg_hqs != null ? (kpi.avg_hqs >= 80 ? 'success' : kpi.avg_hqs >= 60 ? 'warning' : 'error') : 'muted'}
            />
            <KpiCard
              label="回答率"
              value={`${kpi.response_rate}%`}
              sub={`${kpi.response_count} / ${kpi.total_completed}件`}
              color="primary"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KpiCard label="5つ星率"     value={`${kpi.five_star_rate}%`}   sub={`${kpi.five_star_count}件`}   color="success" />
            <KpiCard label="低評価率"    value={`${kpi.low_rating_rate}%`}  sub={`${kpi.low_rating_count}件`}  color={kpi.low_rating_count > 0 ? 'error' : 'muted'} />
            <KpiCard label="平均ギャップ" value={kpi.avg_quality_gap != null ? `${kpi.avg_quality_gap > 0 ? '+' : ''}${kpi.avg_quality_gap.toFixed(0)}` : '—'} sub="AI - 顧客(0-100)" color="muted" />
            <KpiCard label="回答数"      value={`${kpi.response_count}`}   sub="件" color="muted" />
          </div>

          {/* 評価分布 */}
          {dist && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <Card>
                <CardContent className="pt-5 pb-4 px-5">
                  <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-4">
                    評価分布
                  </h3>
                  <div className="space-y-2">
                    {[5,4,3,2,1].map(n => (
                      <div key={n} className="flex items-center gap-3">
                        <span className="text-xs text-[var(--color-muted-foreground)] w-12 shrink-0 flex items-center gap-1">
                          <Star className="h-3 w-3" style={{ fill: 'currentColor', color: 'oklch(0.73 0.12 78)' }} />
                          {n}
                        </span>
                        <div className="flex-1 bg-[var(--color-muted)] rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${dist[n]?.percent ?? 0}%`,
                              background: n >= 4 ? 'oklch(0.72 0.18 150)' : n === 3 ? 'oklch(0.82 0.17 83)' : 'oklch(0.65 0.25 27)',
                            }}
                          />
                        </div>
                        <span className="text-xs w-16 text-right shrink-0">
                          {dist[n]?.percent ?? 0}% ({dist[n]?.count ?? 0})
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 品質ギャップ説明 */}
              <Card>
                <CardContent className="pt-5 pb-4 px-5">
                  <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-4">
                    品質ギャップ分析
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-muted-foreground)]">平均AI品質</span>
                      <span className="font-bold">{kpi.avg_ai_score?.toFixed(0) ?? '—'} / 100</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-muted-foreground)]">平均顧客スコア</span>
                      <span className="font-bold">
                        {kpi.avg_rating ? ratingToScore(kpi.avg_rating) : '—'} / 100
                      </span>
                    </div>
                    <div className="border-t border-[var(--color-border)] pt-3">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-[var(--color-muted-foreground)]">ギャップ</span>
                        <span className={`font-bold ${kpi.avg_quality_gap != null && Math.abs(kpi.avg_quality_gap) >= 15 ? 'text-[var(--color-warning)]' : ''}`}>
                          {kpi.avg_quality_gap != null
                            ? `${kpi.avg_quality_gap > 0 ? '+' : ''}${kpi.avg_quality_gap.toFixed(0)}`
                            : '—'}
                        </span>
                      </div>
                      {gapInfo && (
                        <p className="text-xs text-[var(--color-muted-foreground)]">{gapInfo.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ナビゲーション */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: '/quality/surveys',  label: 'アンケート一覧', icon: Star,       desc: '全回答の確認・コメント閲覧' },
              { href: '/quality/workers',  label: '作業者別分析',   icon: Users,      desc: '従業員・協力業者の品質比較' },
              { href: '/analytics',        label: '時系列分析',     icon: TrendingUp, desc: '過去データとの比較' },
            ].map(({ href, label, icon: Icon, desc }) => (
              <Link key={href} href={href}>
                <Card className="hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer h-full">
                  <CardContent className="pt-5 pb-4 px-5">
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 text-[var(--color-primary)] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <Card><CardContent>
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 text-[var(--color-muted-foreground)]" />
            <p className="text-sm text-[var(--color-muted-foreground)]">データがありません</p>
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub: React.ReactNode; color: string
}) {
  const colorMap: Record<string, string> = {
    gold:    'oklch(0.73 0.12 78)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error:   'var(--color-error)',
    primary: 'var(--color-primary)',
    muted:   'var(--color-muted-foreground)',
  }
  return (
    <Card>
      <CardContent className="py-4 px-4">
        <p className="text-xs text-[var(--color-muted-foreground)] mb-1">{label}</p>
        <p className="text-2xl font-bold" style={{ color: colorMap[color] ?? 'inherit' }}>{value}</p>
        <div className="text-xs text-[var(--color-muted-foreground)] mt-1">{sub}</div>
      </CardContent>
    </Card>
  )
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} className="h-3.5 w-3.5" style={{
          fill: n <= Math.round(rating) ? 'oklch(0.73 0.12 78)' : 'none',
          color: n <= Math.round(rating) ? 'oklch(0.73 0.12 78)' : 'var(--color-muted-foreground)',
        }} />
      ))}
    </span>
  )
}
