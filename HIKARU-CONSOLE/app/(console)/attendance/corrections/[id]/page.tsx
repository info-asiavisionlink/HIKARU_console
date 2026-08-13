'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader, Badge } from '@hikaru/ui'
import { ChevronLeft, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'

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

function fmtTime(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(date: string | null | undefined) {
  if (!date) return '—'
  return new Date(date + 'T00:00:00').toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
}
function fmtDatetime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type FieldDef = { key: string; label: string; currentKey: string; reqKey: string }

const FIELDS: FieldDef[] = [
  { key: 'clock_in',    label: '出勤',    currentKey: 'clock_in',    reqKey: 'requested_clock_in' },
  { key: 'break_start', label: '休憩開始', currentKey: 'break_start', reqKey: 'requested_break_start' },
  { key: 'break_end',   label: '休憩終了', currentKey: 'break_end',   reqKey: 'requested_break_end' },
  { key: 'clock_out',   label: '退勤',    currentKey: 'clock_out',   reqKey: 'requested_clock_out' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Correction = any

export default function CorrectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [correction, setCorrection] = React.useState<Correction | null>(null)
  const [loading, setLoading]       = React.useState(true)
  const [acting, setActing]         = React.useState<'approve' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = React.useState('')
  const [showRejectForm, setShowRejectForm] = React.useState(false)
  const [error, setError]           = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`/api/attendance/corrections/${id}`)
      .then(r => r.json())
      .then(json => { setCorrection(json.correction ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function handleApprove() {
    if (!confirm('この修正申請を承認しますか？\n勤怠記録が更新されます。')) return
    setActing('approve')
    setError(null)
    const res  = await fetch(`/api/attendance/corrections/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const json = await res.json()
    if (res.ok) {
      router.push('/attendance/corrections')
    } else {
      setError(json.error ?? '承認に失敗しました')
      setActing(null)
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { setError('却下理由を入力してください'); return }
    setActing('reject')
    setError(null)
    const res  = await fetch(`/api/attendance/corrections/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reject_reason: rejectReason }),
    })
    const json = await res.json()
    if (res.ok) {
      router.push('/attendance/corrections')
    } else {
      setError(json.error ?? '却下に失敗しました')
      setActing(null)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="修正申請詳細" />
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[var(--color-muted-foreground)]" /></div>
      </div>
    )
  }

  if (!correction) {
    return (
      <div>
        <PageHeader title="修正申請詳細" />
        <div className="text-center py-20 text-[var(--color-muted-foreground)]">申請が見つかりません</div>
      </div>
    )
  }

  const status   = correction.status as Status
  const rec      = correction.attendance_record
  const workDate = rec?.work_date ?? null

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/attendance/corrections" className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title="修正申請詳細"
          description={`${correction.worker?.name ?? '—'} / ${fmtDate(workDate)}`}
        />
        <div className="ml-auto">
          <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
      </div>

      {/* エラー */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--color-destructive)/40] bg-[var(--color-destructive)/8] px-4 py-3 text-sm text-[var(--color-destructive)]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* 基本情報 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] mb-4 overflow-hidden">
        <div className="px-4 py-2.5 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
          基本情報
        </div>
        <div className="grid grid-cols-2 gap-0 divide-y divide-[var(--color-border)]">
          {[
            ['申請者',   correction.worker?.name ?? '—'],
            ['勤務日',   fmtDate(workDate)],
            ['申請日時', fmtDatetime(correction.created_at)],
            ['申請理由', correction.reason],
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-3 flex gap-4 col-span-1">
              <span className="text-xs text-[var(--color-muted-foreground)] w-20 shrink-0">{label}</span>
              <span className="text-sm">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 打刻比較 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] mb-4 overflow-hidden">
        <div className="px-4 py-2.5 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
          打刻内容の比較
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {FIELDS.map(({ label, currentKey, reqKey }) => {
            const currentVal = rec?.[currentKey] ?? null
            const reqVal     = correction[reqKey]  ?? null
            const changed    = reqVal !== null

            return (
              <div key={label} className="px-4 py-3 grid grid-cols-[80px_1fr_40px_1fr] items-center gap-2 text-sm">
                <span className="text-xs text-[var(--color-muted-foreground)]">{label}</span>
                <span className={changed ? 'line-through text-[var(--color-muted-foreground)]' : ''}>
                  {fmtTime(currentVal) ?? '—'}
                </span>
                <span className="text-center text-[var(--color-muted-foreground)]">
                  {changed ? '→' : ''}
                </span>
                <span>
                  {changed
                    ? <strong className="text-[var(--color-primary)]">{fmtTime(reqVal)}</strong>
                    : <span className="text-xs text-[var(--color-muted-foreground)]">変更なし</span>
                  }
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 審査情報（承認・却下済み） */}
      {(status === 'approved' || status === 'rejected') && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] mb-4 overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
            審査結果
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {[
              ['審査者',   correction.reviewer?.name ?? '—'],
              ['審査日時', fmtDatetime(correction.reviewed_at)],
              ...(correction.review_comment ? [['コメント', correction.review_comment]] : []),
            ].map(([label, value]) => (
              <div key={label} className="px-4 py-3 flex gap-4">
                <span className="text-xs text-[var(--color-muted-foreground)] w-20 shrink-0">{label}</span>
                <span className="text-sm">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 承認・却下ボタン（submitted のみ） */}
      {status === 'submitted' && (
        <div className="space-y-3">
          {!showRejectForm ? (
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={acting !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {acting === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                承認する
              </button>
              <button
                onClick={() => { setShowRejectForm(true); setError(null) }}
                disabled={acting !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-[var(--color-destructive)] text-[var(--color-destructive)] hover:bg-[var(--color-destructive)/8] disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-4 w-4" />
                却下する
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-3">
              <p className="text-sm font-semibold">却下理由 <span className="text-[var(--color-destructive)]">*</span></p>
              <textarea
                value={rejectReason}
                onChange={e => { setRejectReason(e.target.value); setError(null) }}
                placeholder="却下理由を入力してください"
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={acting !== null}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-destructive)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {acting === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  却下を確定
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setRejectReason(''); setError(null) }}
                  disabled={acting !== null}
                  className="px-4 py-2.5 rounded-lg text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)] disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
