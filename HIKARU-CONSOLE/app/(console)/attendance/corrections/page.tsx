'use client'

import * as React from 'react'
import Link from 'next/link'
import { PageHeader, Badge, Skeleton } from '@hikaru/ui'
import { FilePen, ChevronRight } from 'lucide-react'

type Status = 'submitted' | 'approved' | 'rejected' | 'withdrawn'

const STATUS_LABEL: Record<Status, string> = {
  submitted: '申請中',
  approved:  '承認済み',
  rejected:  '却下',
  withdrawn: '取り下げ',
}
const STATUS_VARIANT: Record<Status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  submitted: 'default',
  approved:  'secondary',
  rejected:  'destructive',
  withdrawn: 'outline',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
}
function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Correction = any

export default function CorrectionListPage() {
  const [corrections, setCorrections] = React.useState<Correction[]>([])
  const [loading, setLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState<string>('all')

  React.useEffect(() => {
    setLoading(true)
    const url = statusFilter === 'all'
      ? '/api/attendance/corrections'
      : `/api/attendance/corrections?status=${statusFilter}`
    fetch(url)
      .then(r => r.json())
      .then(json => { setCorrections(json.corrections ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [statusFilter])

  const filters: { value: string; label: string }[] = [
    { value: 'all',       label: 'すべて' },
    { value: 'submitted', label: '申請中' },
    { value: 'approved',  label: '承認済み' },
    { value: 'rejected',  label: '却下' },
    { value: 'withdrawn', label: '取り下げ' },
  ]

  return (
    <div>
      <PageHeader
        title="修正申請管理"
        description="従業員からの勤怠修正申請を確認・承認・却下します"
      />

      {/* フィルター */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              statusFilter === f.value
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] border-[var(--color-primary)]'
                : 'border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : corrections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--color-muted-foreground)]">
          <FilePen className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">修正申請がありません</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          {/* ヘッダー行 */}
          <div className="grid grid-cols-[1.5fr_1fr_1fr_2fr_1fr_1.5fr_auto] gap-4 px-4 py-2.5 text-xs font-medium text-[var(--color-muted-foreground)] bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)]">
            <span>申請者</span>
            <span>勤務日</span>
            <span>申請日時</span>
            <span>修正内容</span>
            <span>理由</span>
            <span>ステータス</span>
            <span />
          </div>

          {corrections.map((c: Correction, i: number) => {
            const status = c.status as Status
            const workDate = c.attendance_record?.work_date ?? null

            // 変更のある項目を抽出
            const changes: string[] = []
            if (c.requested_clock_in)    changes.push(`出勤 → ${fmtTime(c.requested_clock_in)}`)
            if (c.requested_break_start) changes.push(`休憩開始 → ${fmtTime(c.requested_break_start)}`)
            if (c.requested_break_end)   changes.push(`休憩終了 → ${fmtTime(c.requested_break_end)}`)
            if (c.requested_clock_out)   changes.push(`退勤 → ${fmtTime(c.requested_clock_out)}`)

            return (
              <Link
                key={c.id}
                href={`/attendance/corrections/${c.id}`}
                className={`grid grid-cols-[1.5fr_1fr_1fr_2fr_1fr_1.5fr_auto] gap-4 px-4 py-3 items-center text-sm hover:bg-[var(--color-bg-elevated)] transition-colors ${i > 0 ? 'border-t border-[var(--color-border)]' : ''} ${status === 'submitted' ? 'bg-[var(--color-primary-muted)/30]' : ''}`}
              >
                <span className="font-medium truncate">{c.worker?.name ?? '—'}</span>
                <span>{fmtDate(workDate)}</span>
                <span className="text-[var(--color-muted-foreground)] text-xs">{fmtDatetime(c.created_at)}</span>
                <span className="text-xs text-[var(--color-muted-foreground)] truncate">
                  {changes.length > 0 ? changes.join(' / ') : '—'}
                </span>
                <span className="text-xs text-[var(--color-muted-foreground)] truncate">{c.reason}</span>
                <span>
                  <Badge variant={STATUS_VARIANT[status]} size="sm">
                    {STATUS_LABEL[status]}
                  </Badge>
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
