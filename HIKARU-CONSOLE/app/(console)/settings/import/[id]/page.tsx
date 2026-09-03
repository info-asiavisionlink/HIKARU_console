'use client'

import * as React from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, CardHeader, CardTitle,
  Skeleton, toast,
} from '@hikaru/ui'
import { safeSetupReturn } from '@/lib/setup/return-to'
import { evaluateCommitEligibility } from '@/lib/import/commit-eligibility'
import {
  ArrowLeft, CheckCircle2, AlertCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, RotateCcw, Upload,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface ImportSession {
  id: string
  status: string
  entity_type: string
  source_type: string
  label: string | null
  total_rows: number | null
  valid_rows: number | null
  invalid_rows: number | null
  duplicate_rows: number | null
  created_at: string
}

interface ReviewSummary {
  total: number
  clean: number
  needs_review: number
  invalid: number
  warning_no_duplicate: number
  reviewed: number
  duplicate_candidates: number
  pending_candidates: number
}

interface DuplicateCandidate {
  id: string
  existing_record_id: string
  existing_record_table: string
  similarity_score: number
  match_reasons: string[] | null
  review_status: string
  resolved_action: string | null
}

interface ReviewRow {
  id: string
  row_index: number
  raw_data: Record<string, string>
  normalized_data: Record<string, string | null>
  mapped_data: Record<string, string | null> | null
  validation_status: string
  validation_errors: Record<string, unknown> | null
  review_status: string
  duplicate_candidates: DuplicateCandidate[]
  recommended_action: 'CREATE' | 'REVIEW' | null
}

// ============================================================
// Constants
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  created:         '準備中',
  uploading:       'アップロード中',
  uploaded:        'アップロード完了',
  extracting:      'データ解析中',
  mapping:         '項目変換中',
  validating:      '検証中',
  review_required: '確認待ち',
  ready_to_commit: '登録準備完了',
  committing:      '登録中',
  completed:       '完了',
  failed:          'エラー',
  cancelled:       'キャンセル済み',
  rolled_back:     'ロールバック済み',
}

const ENTITY_LABELS: Record<string, string> = {
  client: '顧客', store: '店舗', employee: '従業員',
  project: '案件', invoice: '請求書', expense: '経費',
}

const FIELD_LABELS: Record<string, string> = {
  name: '会社名 / 店舗名', code: 'コード', email: 'メール', phone: '電話番号',
  address: '住所', contact_name: '担当者', notes: '備考',
  business_hours: '営業時間', manager_name: '店長名',
  emergency_contact: '緊急連絡先', contract_info: '契約情報',
}

const MATCH_REASON_LABELS: Record<string, string> = {
  email_exact:             'メールアドレス一致',
  phone_normalized:        '電話番号一致',
  name_address_normalized: '会社名・住所一致',
  name_normalized:         '会社名一致',
}

const REVIEW_ACTION_LABELS: Record<string, string> = {
  approved: '新規登録済',
  skipped:  '取り込まない',
}

const FILTER_OPTIONS = [
  { value: 'needs_review', label: '要確認' },
  { value: 'invalid',      label: 'エラー' },
  { value: 'all',          label: 'すべて' },
  { value: 'clean',        label: '問題なし' },
]

const LIMIT = 50

// ============================================================
// Sub-components
// ============================================================

function SummaryCard({
  label, value, color, sub,
}: { label: string; value: number; color?: string; sub?: string }) {
  return (
    <div
      className="rounded-xl p-4 space-y-1"
      style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? 'var(--color-foreground)' }}>
        {value.toLocaleString()}
      </p>
      {sub && <p className="text-xs text-[var(--color-muted-foreground)]">{sub}</p>}
    </div>
  )
}

function ValidationBadge({ status }: { status: string }) {
  if (status === 'valid')   return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'oklch(0.72 0.18 150 / 0.12)', color: 'oklch(0.72 0.18 150)' }}>有効</span>
  if (status === 'invalid') return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'oklch(0.65 0.18 30 / 0.12)', color: 'oklch(0.75 0.18 30)' }}>エラー</span>
  if (status === 'warning') return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'oklch(0.80 0.14 80 / 0.12)', color: 'oklch(0.80 0.14 80)' }}>注意</span>
  return null
}

function ReviewStatusBadge({ status }: { status: string }) {
  const label = REVIEW_ACTION_LABELS[status]
  if (!label) return null
  const color = status === 'skipped'
    ? { bg: 'oklch(0.55 0.01 260 / 0.12)', text: 'oklch(0.65 0.01 260)' }
    : { bg: 'oklch(0.72 0.18 150 / 0.12)', text: 'oklch(0.72 0.18 150)' }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: color.bg, color: color.text }}>
      {label}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct  = Math.round(score * 100)
  const color = pct >= 90 ? 'oklch(0.65 0.18 30)' : pct >= 70 ? 'oklch(0.80 0.14 80)' : 'oklch(0.72 0.18 150)'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-medium" style={{ color }}>{pct}%</span>
    </div>
  )
}

// ============================================================
// Row Card
// ============================================================

function RowCard({
  row,
  saving,
  onAction,
}: {
  row:      ReviewRow
  saving:   boolean
  onAction: (rowId: string, action: 'CREATE' | 'UPDATE' | 'SKIP', candidateId?: string) => Promise<void>
}) {
  const [expanded, setExpanded]   = React.useState(false)
  const isReviewed = row.review_status !== 'pending'
  const hasDups    = row.duplicate_candidates.some(c => c.review_status === 'pending')

  const mapped = row.mapped_data ?? {}
  const primaryFields = ['name', 'email', 'phone', 'address']

  return (
    <div
      className="rounded-xl border transition-colors"
      style={{
        borderColor: hasDups     ? 'oklch(0.80 0.14 80 / 0.40)' :
                     row.validation_status === 'invalid' ? 'oklch(0.65 0.18 30 / 0.30)' :
                     isReviewed  ? 'var(--color-border)' :
                     'var(--color-border)',
        background:  isReviewed  ? 'var(--color-muted)' : 'transparent',
      }}
    >
      {/* Row header */}
      <div className="flex items-start gap-3 p-4">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {isReviewed && row.review_status === 'approved' && <CheckCircle2 className="h-4 w-4" style={{ color: 'oklch(0.72 0.18 150)' }} />}
          {isReviewed && row.review_status === 'skipped'  && <XCircle     className="h-4 w-4 text-[var(--color-muted-foreground)]" />}
          {!isReviewed && hasDups                         && <AlertCircle className="h-4 w-4" style={{ color: 'oklch(0.80 0.14 80)' }} />}
          {!isReviewed && row.validation_status === 'invalid' && <AlertTriangle className="h-4 w-4" style={{ color: 'oklch(0.75 0.18 30)' }} />}
          {!isReviewed && !hasDups && row.validation_status !== 'invalid' && (
            <div className="h-4 w-4 rounded-full border-2 border-[var(--color-border)]" />
          )}
        </div>

        {/* Primary data */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--color-foreground)]">
              {mapped['name'] ?? `行 ${row.row_index}`}
            </span>
            <ValidationBadge status={row.validation_status} />
            <ReviewStatusBadge status={row.review_status} />
          </div>

          {/* Key fields */}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {primaryFields.filter(f => f !== 'name' && mapped[f]).map(f => (
              <span key={f} className="text-xs text-[var(--color-muted-foreground)]">
                {FIELD_LABELS[f] ?? f}: {mapped[f]}
              </span>
            ))}
          </div>

          {/* Validation errors */}
          {row.validation_errors && typeof row.validation_errors === 'object' && (
            <div className="mt-1.5 text-xs" style={{ color: 'oklch(0.75 0.18 30)' }}>
              {Array.isArray((row.validation_errors as any).missing_required) &&
                `必須項目なし: ${((row.validation_errors as any).missing_required as string[]).map((f: string) => FIELD_LABELS[f] ?? f).join(', ')}`
              }
            </div>
          )}

          {/* Duplicate summary */}
          {row.duplicate_candidates.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {row.duplicate_candidates.map(c => (
                <div
                  key={c.id}
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: c.review_status === 'pending' ? 'oklch(0.80 0.14 80 / 0.08)' : 'var(--color-muted)',
                    border: `1px solid ${c.review_status === 'pending' ? 'oklch(0.80 0.14 80 / 0.25)' : 'var(--color-border)'}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span style={{ color: 'oklch(0.80 0.14 80)' }}>
                      {c.review_status === 'pending' ? '重複の可能性あり' : '重複解決済み'}
                    </span>
                    <ScoreBar score={c.similarity_score} />
                  </div>
                  {c.match_reasons && c.match_reasons.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.match_reasons.map(r => (
                        <span
                          key={r}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'oklch(0.80 0.14 80 / 0.12)', color: 'oklch(0.80 0.14 80)' }}
                        >
                          ✓ {MATCH_REASON_LABELS[r] ?? r}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* UPDATE action for this candidate */}
                  {c.review_status === 'pending' && !isReviewed && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => onAction(row.id, 'UPDATE', c.id)}
                        className="text-xs h-7"
                        aria-label="既存データを更新"
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : '既存を更新'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Row actions */}
        <div className="flex items-start gap-2 shrink-0">
          {!isReviewed && row.validation_status !== 'invalid' && (
            <Button
              size="sm"
              disabled={saving}
              onClick={() => onAction(row.id, 'CREATE')}
              aria-label="新規登録として確認"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : '新規登録'}
            </Button>
          )}
          {!isReviewed && (
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => onAction(row.id, 'SKIP')}
              aria-label="取り込まない"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : '取り込まない'}
            </Button>
          )}
          {/* Expand button */}
          <button
            className="p-1.5 rounded-lg text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
            onClick={() => setExpanded(p => !p)}
            aria-label={expanded ? '詳細を閉じる' : '詳細を開く'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded: full field details */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-0"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <div className="pt-3 space-y-3">
            {/* Mapped data */}
            {Object.keys(mapped).length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-2">HIKARU変換後</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {Object.entries(mapped).map(([k, v]) => (
                    <div key={k} className="text-xs">
                      <span className="text-[var(--color-muted-foreground)]">{FIELD_LABELS[k] ?? k}: </span>
                      <span className="text-[var(--color-foreground)]">{v ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw data */}
            <details className="group">
              <summary className="text-xs font-medium text-[var(--color-muted-foreground)] cursor-pointer list-none flex items-center gap-1">
                <span>元データを表示</span>
                <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                {Object.entries(row.raw_data).map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="text-[var(--color-muted-foreground)]">{k}: </span>
                    <span className="text-[var(--color-foreground)]">{v || '—'}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

function ImportSessionContent() {
  const router                = useRouter()
  const { id: sessionId }     = useParams<{ id: string }>()
  const searchParams          = useSearchParams()
  const returnTo              = safeSetupReturn(searchParams.get('return'))
  const backDestination       = returnTo ?? '/settings/import'
  const backLabel             = returnTo === '/setup' ? '初期設定へ戻る' : '一覧へ戻る'

  const [session, setSession]   = React.useState<ImportSession | null>(null)
  const [summary, setSummary]   = React.useState<ReviewSummary | null>(null)
  const [rows, setRows]         = React.useState<ReviewRow[]>([])
  const [total, setTotal]       = React.useState(0)
  const [filter, setFilter]     = React.useState('needs_review')
  const [offset, setOffset]     = React.useState(0)
  const [loading, setLoading]   = React.useState(true)
  const [rowsLoading, setRowsLoading] = React.useState(false)
  const [saving, setSaving]     = React.useState<Record<string, boolean>>({})
  const [commitOpen, setCommitOpen]       = React.useState(false)
  const [committing, setCommitting]       = React.useState(false)
  const [commitResult, setCommitResult]   = React.useState<{
    inserted: number; updated: number; skipped: number
  } | null>(null)

  // Load session
  React.useEffect(() => {
    if (!sessionId) return
    fetch(`/api/import/sessions/${sessionId}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setSession(d.data) })
      .finally(() => setLoading(false))
  }, [sessionId])

  // Load summary
  React.useEffect(() => {
    if (!sessionId || !session) return
    if (session.status !== 'review_required') return
    fetch(`/api/import/sessions/${sessionId}/review/summary`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setSummary(d.data) })
  }, [sessionId, session])

  // Load review rows
  const loadRows = React.useCallback(async (f: string, o: number) => {
    if (!sessionId) return
    setRowsLoading(true)
    try {
      const params = new URLSearchParams({ filter: f, limit: String(LIMIT), offset: String(o) })
      const res = await fetch(`/api/import/sessions/${sessionId}/review?${params}`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setRows(data.data ?? [])
      setTotal(data.meta?.total ?? 0)
    } finally {
      setRowsLoading(false)
    }
  }, [sessionId])

  React.useEffect(() => {
    if (session?.status === 'review_required') {
      setOffset(0)
      loadRows(filter, 0)
    }
  }, [session, filter, loadRows])

  async function handleAction(rowId: string, action: 'CREATE' | 'UPDATE' | 'SKIP', candidateId?: string) {
    setSaving(p => ({ ...p, [rowId]: true }))
    try {
      const res = await fetch(`/api/import/sessions/${sessionId}/review/${rowId}`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ action, candidate_id: candidateId }),
      })
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({ message: '保存に失敗しました。' }))
        toast.error(message ?? '保存に失敗しました。')
        return
      }
      const { data } = await res.json()
      // Update local state
      setRows(prev => prev.map(r =>
        r.id === rowId
          ? { ...r, review_status: data.review_status }
          : r,
      ))
      // Refresh summary counts
      const s = await fetch(`/api/import/sessions/${sessionId}/review/summary`, { credentials: 'include', cache: 'no-store' })
      if (s.ok) {
        const sd = await s.json()
        if (sd?.data) setSummary(sd.data)
      }
    } finally {
      setSaving(p => ({ ...p, [rowId]: false }))
    }
  }

  function handlePageChange(newOffset: number) {
    setOffset(newOffset)
    loadRows(filter, newOffset)
  }

  async function handleCommit() {
    if (committing) return
    setCommitting(true)
    try {
      const res = await fetch(`/api/import/sessions/${sessionId}/commit`, {
        method:      'POST',
        credentials: 'include',
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? '登録に失敗しました。')
        return
      }
      setCommitResult({
        inserted: body.data.inserted_count,
        updated:  body.data.updated_count,
        skipped:  body.data.skipped_count,
      })
      setCommitOpen(false)
      // Refetch session so 「完了」画面 (session.status !== 'review_required' 分岐) が render される
      const fresh = await fetch(`/api/import/sessions/${sessionId}`, { credentials: 'include', cache: 'no-store' })
      if (fresh.ok) {
        const d = await fresh.json()
        if (d?.data) setSession(d.data)
      }
    } catch {
      toast.error('登録に失敗しました。')
    } finally {
      setCommitting(false)
    }
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div>
        <PageHeader title="データ移行" />
        <div className="space-y-4 max-w-4xl">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div>
        <PageHeader title="データ移行" />
        <div className="flex items-center gap-3 p-4 max-w-md rounded-xl" style={{ background: 'oklch(0.65 0.18 30 / 0.08)', border: '1px solid oklch(0.65 0.18 30 / 0.20)' }}>
          <AlertCircle className="h-5 w-5" style={{ color: 'oklch(0.75 0.18 30)' }} />
          <p className="text-sm" style={{ color: 'oklch(0.75 0.18 30)' }}>セッションが見つかりません。</p>
        </div>
      </div>
    )
  }

  const entityLabel = ENTITY_LABELS[session.entity_type] ?? session.entity_type
  const statusLabel = STATUS_LABELS[session.status] ?? session.status

  // ---- Non-review status (processing / completed / error) ----
  if (session.status !== 'review_required') {
    const isCompleted = session.status === 'completed'
    return (
      <div>
        <PageHeader
          title={session.label ?? `${entityLabel}データ移行`}
          action={
            <Button variant="outline" onClick={() => router.push(backDestination)}>
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          }
        />
        <div className="max-w-lg space-y-4">
          <Card>
            <CardContent className="py-6 flex items-center gap-4">
              {session.status === 'failed' ? (
                <AlertCircle className="h-8 w-8 shrink-0" style={{ color: 'oklch(0.75 0.18 30)' }} />
              ) : isCompleted ? (
                <CheckCircle2 className="h-8 w-8 shrink-0" style={{ color: 'oklch(0.72 0.18 150)' }} />
              ) : (
                <Loader2 className="h-8 w-8 shrink-0 animate-spin text-[var(--color-primary)]" />
              )}
              <div>
                <p className="font-medium text-[var(--color-foreground)]">{statusLabel}</p>
                <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
                  {entityLabel} · {session.source_type.toUpperCase()}
                  {session.total_rows != null && ` · ${session.total_rows.toLocaleString()}件`}
                </p>
              </div>
            </CardContent>
          </Card>

          {isCompleted && commitResult && (
            <Card>
              <CardContent className="py-5 space-y-3">
                <p className="text-sm font-semibold text-[var(--color-foreground)]">登録が完了しました</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">新規</p>
                    <p className="text-xl font-bold" style={{ color: 'oklch(0.72 0.18 150)' }}>
                      {commitResult.inserted.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">更新</p>
                    <p className="text-xl font-bold" style={{ color: 'oklch(0.62 0.15 240)' }}>
                      {commitResult.updated.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">スキップ</p>
                    <p className="text-xl font-bold text-[var(--color-muted-foreground)]">
                      {commitResult.skipped.toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button className="w-full" onClick={() => router.push(backDestination)}>
                  {backLabel}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  // ---- Review UI ----

  const totalPages   = Math.ceil(total / LIMIT)
  const currentPage  = Math.floor(offset / LIMIT) + 1

  return (
    <div>
      <PageHeader
        title={session.label ?? `${entityLabel}データ移行 — 確認`}
        description={`${entityLabel} · ${session.source_type.toUpperCase()}${session.total_rows != null ? ` · ${session.total_rows.toLocaleString()}件` : ''}`}
        action={
          <Button variant="outline" onClick={() => router.push(backDestination)}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        }
      />

      <div className="max-w-4xl space-y-6">

        {/* Summary cards */}
        {summary ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCard label="総件数" value={summary.total} />
            <SummaryCard
              label="問題なし"
              value={summary.clean}
              color="oklch(0.72 0.18 150)"
              sub="新規登録可"
            />
            <SummaryCard
              label="要確認"
              value={summary.needs_review}
              color="oklch(0.80 0.14 80)"
              sub="重複候補あり"
            />
            <SummaryCard
              label="エラー"
              value={summary.invalid}
              color="oklch(0.75 0.18 30)"
              sub="必須項目なし"
            />
            <SummaryCard
              label="確認済み"
              value={summary.reviewed}
              color="var(--color-muted-foreground)"
            />
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        )}

        {/* Info banner */}
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-muted-foreground)]" />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            内容を確認し、各行に「新規登録」「既存を更新」「取り込まない」を選択してください。
            この画面での操作では、実際の顧客・店舗データへの書き込みは行われません。
          </p>
        </div>

        {/* Commit CTA (client entity のみ、全行 review 済み時に有効化) */}
        {(() => {
          const gate = summary
            ? evaluateCommitEligibility({
                sessionStatus: session.status,
                entityType:    session.entity_type,
                pendingRows:   summary.total - summary.reviewed,
                pendingCandidates: summary.pending_candidates,
                totalRows:     summary.total,
                invalidRows:   summary.invalid,
              })
            : { canCommit: false, reason: null as null | string }

          if (session.entity_type !== 'client') return null

          const pending = summary ? summary.total - summary.reviewed : 0
          const pendingCands = summary?.pending_candidates ?? 0

          return (
            <div
              className="flex flex-wrap items-center gap-3 rounded-xl p-4"
              style={{
                background: 'oklch(0.73 0.12 78 / 0.08)',
                border:     '1px solid oklch(0.73 0.12 78 / 0.28)',
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-foreground)]">
                  {gate.canCommit
                    ? '登録する準備ができました'
                    : '登録するには全ての行に対して選択を完了してください'}
                </p>
                {!gate.canCommit && (pending > 0 || pendingCands > 0) && (
                  <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                    未確認: {pending.toLocaleString()} 行
                    {pendingCands > 0 && ` / 重複候補 ${pendingCands.toLocaleString()} 件`}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                disabled={!gate.canCommit || committing}
                onClick={() => setCommitOpen(true)}
                aria-label="この内容で登録する"
              >
                <Upload className="h-3.5 w-3.5" />
                登録する
              </Button>
            </div>
          )
        })()}

        {/* Commit Confirmation Modal */}
        {commitOpen && summary && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'oklch(0 0 0 / 0.55)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="commit-modal-title"
          >
            <div
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}
            >
              <h2 id="commit-modal-title" className="text-lg font-bold text-[var(--color-foreground)]">
                この内容で登録しますか？
              </h2>
              <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
                実際の顧客データベースに書き込みます。実行後に取り消すには別途操作が必要です。
              </p>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {(() => {
                  // approved & pending candidate 無し = CREATE、approved & candidate approved(update) = UPDATE
                  // ここでは summary からは細分できないため、reviewed 内訳を rough に見せる
                  const reviewedRows = summary.reviewed
                  const skippedRoughEstimate = Math.max(0, reviewedRows - (summary.total - summary.invalid))
                  // 上記は概算。RPC が最終判定。この modal は「登録する意思確認」フォーカス。
                  return (
                    <>
                      <div>
                        <p className="text-xs text-[var(--color-muted-foreground)]">確認済み行</p>
                        <p className="text-2xl font-bold text-[var(--color-foreground)]">
                          {reviewedRows.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-muted-foreground)]">総件数</p>
                        <p className="text-2xl font-bold text-[var(--color-muted-foreground)]">
                          {summary.total.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-muted-foreground)]">対象外</p>
                        <p className="text-2xl font-bold text-[var(--color-muted-foreground)]">
                          {(summary.invalid + skippedRoughEstimate).toLocaleString()}
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommitOpen(false)}
                  disabled={committing}
                >
                  キャンセル
                </Button>
                <Button
                  size="sm"
                  onClick={handleCommit}
                  disabled={committing}
                  aria-label="登録を確定する"
                >
                  {committing ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 登録中...</>
                  ) : (
                    <>登録する</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setFilter(opt.value); setOffset(0) }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={filter === opt.value ? {
                background: 'var(--color-primary)',
                color: 'var(--color-primary-foreground)',
              } : {
                color: 'var(--color-muted-foreground)',
                border: '1px solid var(--color-border)',
              }}
              aria-pressed={filter === opt.value}
            >
              {opt.label}
              {opt.value === 'needs_review' && summary && summary.needs_review > 0 && (
                <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: 'oklch(0.80 0.14 80)', color: 'white' }}>
                  {summary.needs_review}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Row list */}
        {rowsLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-muted-foreground)]">
            {filter === 'needs_review' ? '要確認の行はありません' :
             filter === 'invalid'      ? 'エラーの行はありません' :
             filter === 'clean'        ? '問題なしの行はありません' :
             'データがありません'}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <RowCard
                key={row.id}
                row={row}
                saving={!!saving[row.id]}
                onAction={handleAction}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {offset + 1}〜{Math.min(offset + LIMIT, total)} 件目 / 全 {total.toLocaleString()} 件
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0 || rowsLoading}
                onClick={() => handlePageChange(Math.max(0, offset - LIMIT))}
                aria-label="前のページ"
              >
                前へ
              </Button>
              <span className="text-sm text-[var(--color-muted-foreground)]">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + LIMIT >= total || rowsLoading}
                onClick={() => handlePageChange(offset + LIMIT)}
                aria-label="次のページ"
              >
                次へ
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function ImportSessionPage() {
  return (
    <React.Suspense fallback={<div />}>
      <ImportSessionContent />
    </React.Suspense>
  )
}
