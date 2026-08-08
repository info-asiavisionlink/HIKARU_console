'use client'

import * as React from 'react'
import Link from 'next/link'
import { listReports, getReportStats, type ReportListItem } from '@/services/reports.service'
import {
  PageHeader, Skeleton, Pagination,
  TableWrapper, Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
  ScoreBadge,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import {
  FileText, Eye, CalendarDays, BarChart3,
  Radio, Clock, Camera, User, Building2,
  CheckCircle2, ImageOff,
} from 'lucide-react'
import { cn } from '@hikaru/ui'

const PAGE_SIZE = 20

// ─── Helpers ──────────────────────────────────────────────

function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return <span className="text-[var(--color-muted-foreground)]">—</span>
  return <ScoreBadge score={score} showLabel={false} size="sm" />
}

function StatCard({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string | number
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 flex items-center gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-muted)]">
        <Icon className="h-5 w-5 text-[var(--color-primary)]" />
      </div>
      <div>
        <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
        <p className="text-xl font-bold text-[var(--color-foreground)]">{value}</p>
      </div>
    </div>
  )
}

function elapsed(startedAt: string): string {
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
  if (diff < 60) return `${diff}分`
  const h = Math.floor(diff / 60), m = diff % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

type Tab = 'live' | 'reports'

// ─── Live Job Card ────────────────────────────────────────

function LiveJobCard({ job }: { job: any }) {
  const beforePhotos = (job.photos as any[]).filter((p) => p.photo_type === 'before')
  const afterPhotos  = (job.photos as any[]).filter((p) => p.photo_type === 'after')

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-2 w-2 rounded-full bg-[var(--color-success)] animate-pulse shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{(job.projects as any)?.name ?? '—'}</p>
            <p className="text-xs text-[var(--color-muted-foreground)] flex items-center gap-1 mt-0.5">
              <User className="h-3 w-3" />
              {(job.profiles as any)?.name ?? '—'}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] justify-end">
            <Clock className="h-3 w-3" />
            {elapsed(job.started_at)}経過
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
            <Camera className="h-3 w-3 inline mr-0.5" />{job.photo_count}枚
          </p>
        </div>
      </div>

      {/* 写真グリッド */}
      <div className="p-3">
        {job.photos.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[var(--color-muted-foreground)]">
            <div className="text-center">
              <ImageOff className="h-6 w-6 mx-auto mb-1 opacity-40" />
              <p className="text-xs">撮影待ち</p>
            </div>
          </div>
        ) : (
          <div>
            {/* Before */}
            {beforePhotos.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-semibold text-[var(--color-muted-foreground)] uppercase mb-1.5">
                  Before（{beforePhotos.length}枚）
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {beforePhotos.map((p: any) => (
                    <div key={p.id} className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.photo_spots?.name ?? 'before'}
                        className="h-20 w-20 object-cover rounded-lg border border-[var(--color-border)]"
                      />
                      {p.photo_spots?.name && (
                        <p className="absolute bottom-0 left-0 right-0 text-[9px] text-white text-center bg-black/50 rounded-b-lg px-0.5 truncate">
                          {p.photo_spots.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* After */}
            {afterPhotos.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--color-success-foreground)] uppercase mb-1.5">
                  After（{afterPhotos.length}枚）
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {afterPhotos.map((p: any) => (
                    <div key={p.id} className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.photo_spots?.name ?? 'after'}
                        className="h-20 w-20 object-cover rounded-lg border border-[var(--color-success)]/40"
                      />
                      {p.photo_spots?.name && (
                        <p className="absolute bottom-0 left-0 right-0 text-[9px] text-white text-center bg-black/50 rounded-b-lg px-0.5 truncate">
                          {p.photo_spots.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Live Tab ─────────────────────────────────────────────

function LiveTab() {
  const [jobs, setJobs]       = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)

  const fetch10s = React.useCallback(async () => {
    const res  = await fetch('/api/jobs/live')
    const json = await res.json()
    setJobs(json.data ?? [])
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  React.useEffect(() => {
    fetch10s()
    const interval = setInterval(fetch10s, 10_000)
    return () => clearInterval(interval)
  }, [fetch10s])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[var(--color-success)] animate-pulse" />
          <span className="text-sm font-medium">
            {jobs.length > 0 ? `${jobs.length}件が作業中` : '現在作業中の案件はありません'}
          </span>
        </div>
        {lastUpdated && (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            最終更新: {lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            　（10秒ごと自動更新）
          </p>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--color-muted-foreground)]">
          <CheckCircle2 className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">本日は全案件が完了しています</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => <LiveJobCard key={job.id} job={job} />)}
        </div>
      )}
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────

function ReportsTab() {
  const [items, setItems]   = React.useState<ReportListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage]     = React.useState(1)
  const [total, setTotal]   = React.useState(0)
  const [stats, setStats]   = React.useState({ totalReports: 0, avgScore: null as number | null, thisMonthCount: 0 })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  React.useEffect(() => {
    setLoading(true)
    listReports({ page, pageSize: PAGE_SIZE }).then(({ data, count }) => {
      setItems(data)
      setTotal(count)
      setLoading(false)
    })
  }, [page])

  React.useEffect(() => {
    getReportStats().then(setStats)
  }, [])

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={FileText}    label="総報告書数"    value={`${stats.totalReports}件`} />
        <StatCard icon={BarChart3}   label="平均品質スコア" value={stats.avgScore != null ? `${stats.avgScore}点` : '—'} />
        <StatCard icon={CalendarDays} label="今月の報告書"  value={`${stats.thisMonthCount}件`} />
      </div>

      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>作業日</TableHead>
              <TableHead>案件名</TableHead>
              <TableHead>店舗</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead className="text-center">スコア</TableHead>
              <TableHead className="text-center">Ver.</TableHead>
              <TableHead>生成日時</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12">
                  <EmptyState
                    icon={<FileText className="h-10 w-10" />}
                    title="報告書がありません"
                    description="作業者が作業完了すると、AIが自動で報告書を生成します"
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="hover:bg-[var(--color-muted)]/40">
                  <TableCell className="whitespace-nowrap text-sm">
                    {item.jobs?.work_date
                      ? new Date(item.jobs.work_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm truncate max-w-[160px]">
                        {(item.projects as any)?.name ?? '—'}
                      </p>
                      {(item.projects as any)?.code && (
                        <p className="text-xs text-[var(--color-muted-foreground)]">{(item.projects as any).code}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-[var(--color-muted-foreground)] truncate max-w-[120px]">
                    {(item.projects as any)?.stores?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                    {(item.profiles as any)?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <ScoreChip score={item.overall_score} />
                  </TableCell>
                  <TableCell className="text-center text-sm text-[var(--color-muted-foreground)]">
                    v{item.version}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--color-muted-foreground)] whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString('ja-JP', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/reports/${item.id}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5',
                        'text-xs font-medium text-[var(--color-primary)]',
                        'border border-[var(--color-primary)]/30 bg-[var(--color-primary-muted)]',
                        'hover:bg-[var(--color-primary)]/15 transition-colors'
                      )}
                    >
                      <Eye className="h-3.5 w-3.5" /> 表示
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableWrapper>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = React.useState<Tab>('live')

  return (
    <div>
      <PageHeader
        title="報告書管理"
        description="作業のリアルタイム監視と完了済み報告書の管理"
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        <TabButton active={tab === 'live'} onClick={() => setTab('live')}>
          <Radio className="h-4 w-4" />
          ライブモニタリング
        </TabButton>
        <TabButton active={tab === 'reports'} onClick={() => setTab('reports')}>
          <FileText className="h-4 w-4" />
          完了報告書
        </TabButton>
      </div>

      {tab === 'live' ? <LiveTab /> : <ReportsTab />}
    </div>
  )
}

function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
          : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
      }`}
    >
      {children}
    </button>
  )
}
