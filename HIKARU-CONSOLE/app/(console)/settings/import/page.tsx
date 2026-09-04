'use client'

// ============================================================
// Data Migration Center
//
// 目的:
//   管理者が「HIKARU で何を移行できるか / 今どのデータをどこから登録するか」を
//   1 画面で理解できるハブ画面。
//
// 構成:
//   1. 業務基本データ  — 顧客 / 店舗 / 従業員 / 案件
//   2. 過去データ      — 経費履歴 / 勤怠履歴 / シフト履歴
//   3. 移行履歴        — 過去のデータ移行セッション一覧
//
// クリックすると entity 別 preview screen (/settings/import/preview/[entity])
// に遷移し、そこで「移行を開始」ボタンから Wizard に入る。
// ============================================================

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, Skeleton,
} from '@hikaru/ui'
import {
  Plus, ChevronRight, AlertCircle, CheckCircle2, Clock, FileX,
  ArrowRight, Ban,
} from 'lucide-react'
import { EmptyState } from '@/components/console/EmptyState'
import {
  BASIC_ENTITIES, HISTORICAL_ENTITIES, statusLabel,
  type EntityMetadata, type EntityStatus,
} from '@/lib/import/entity-metadata'

// ---- Constants ----

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
  client:     '顧客',
  store:      '店舗',
  employee:   '従業員',
  project:    '案件',
  expense:    '経費履歴',
  attendance: '勤怠履歴',
  shift:      'シフト履歴',
  invoice:    '請求書',
}

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
  scan_status: string
  created_at: string
  updated_at: string
}

// ---- Session list helpers ----

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed')       return <CheckCircle2 className="h-4 w-4" style={{ color: 'oklch(0.72 0.18 150)' }} />
  if (status === 'failed')          return <FileX className="h-4 w-4" style={{ color: 'oklch(0.65 0.18 30)' }} />
  if (status === 'review_required') return <AlertCircle className="h-4 w-4" style={{ color: 'oklch(0.80 0.14 80)' }} />
  return <Clock className="h-4 w-4 text-[var(--color-muted-foreground)]" />
}

function StatusBadgeLocal({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status
  let style: React.CSSProperties = {}
  if (status === 'completed') {
    style = { background: 'oklch(0.72 0.18 150 / 0.12)', color: 'oklch(0.72 0.18 150)', border: '1px solid oklch(0.72 0.18 150 / 0.30)' }
  } else if (status === 'failed') {
    style = { background: 'oklch(0.65 0.18 30 / 0.12)', color: 'oklch(0.75 0.18 30)', border: '1px solid oklch(0.65 0.18 30 / 0.30)' }
  } else if (status === 'review_required') {
    style = { background: 'oklch(0.80 0.14 80 / 0.12)', color: 'oklch(0.80 0.14 80)', border: '1px solid oklch(0.80 0.14 80 / 0.30)' }
  } else {
    style = { background: 'var(--color-muted)', color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={style}>
      {label}
    </span>
  )
}

// ---- Entity availability badge ----

function EntityStatusBadge({ status }: { status: EntityStatus }) {
  const label = statusLabel(status)
  let style: React.CSSProperties = {}
  if (status === 'enabled') {
    style = {
      background: 'oklch(0.72 0.18 150 / 0.12)',
      color:      'oklch(0.72 0.18 150)',
      border:     '1px solid oklch(0.72 0.18 150 / 0.30)',
    }
  } else if (status === 'preview_only') {
    style = {
      background: 'oklch(0.80 0.14 80 / 0.12)',
      color:      'oklch(0.80 0.14 80)',
      border:     '1px solid oklch(0.80 0.14 80 / 0.30)',
    }
  } else {
    style = {
      background: 'var(--color-muted)',
      color:      'var(--color-muted-foreground)',
      border:     '1px solid var(--color-border)',
    }
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={style}
    >
      {label}
    </span>
  )
}

// ---- Entity card ----

function EntityMigrationCard({ meta }: { meta: EntityMetadata }) {
  const Icon = meta.icon
  const href = `/settings/import/preview/${meta.key}`
  return (
    <Link href={href} className="block">
      <Card className="hover:border-[var(--color-primary)] transition-colors cursor-pointer h-full">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
              style={{
                background: 'oklch(0.73 0.12 78 / 0.10)',
                border:     '1px solid oklch(0.73 0.12 78 / 0.20)',
              }}
            >
              <Icon className="h-5 w-5" style={{ color: 'oklch(0.73 0.12 78)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[var(--color-foreground)]">
                  {meta.label}
                </span>
                <EntityStatusBadge status={meta.status} />
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1 leading-relaxed line-clamp-2">
                {meta.shortDesc}
              </p>
            </div>
            <div className="shrink-0 self-center">
              <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ---- Section header helper ----

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-8 mb-3">
      <h2 className="text-sm font-bold tracking-wider text-[var(--color-foreground)] uppercase">
        {title}
      </h2>
      <p className="text-xs text-[var(--color-muted-foreground)] mt-1 leading-relaxed">
        {description}
      </p>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function ImportCenterPage() {
  const router = useRouter()
  const [sessions, setSessions] = React.useState<ImportSession[]>([])
  const [loading, setLoading]   = React.useState(true)

  React.useEffect(() => {
    fetch('/api/import/sessions', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setSessions(d.data) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader
        title="データ移行センター"
        description="既存の CSV / Excel データを HIKARU へ安全に移行できます。何を移行するかを選んで進んでください。"
      />

      <div className="max-w-4xl">

        {/* Section 1: Basic Data */}
        <SectionHeader
          title="業務基本データ"
          description="HIKARU を使い始めるために必要な基本データ (顧客・店舗・従業員・案件) を CSV / Excel から一括登録できます。"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {BASIC_ENTITIES.map(meta => (
            <EntityMigrationCard key={meta.key} meta={meta} />
          ))}
        </div>

        {/* Section 2: Historical Data */}
        <SectionHeader
          title="過去データ"
          description="以前のシステムや Excel で管理していた過去の業務データを HIKARU へ引き継げます (任意)。"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {HISTORICAL_ENTITIES.map(meta => (
            <EntityMigrationCard key={meta.key} meta={meta} />
          ))}
        </div>

        {/* Section 3: Session History */}
        <div className="mt-8 mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold tracking-wider text-[var(--color-foreground)] uppercase">
              移行履歴
            </h2>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-1 leading-relaxed">
              過去に実行したデータ移行の結果を確認できます。
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/settings/import/new')}
            aria-label="新しいデータ移行を開始"
          >
            <Plus className="h-3.5 w-3.5" />
            新しい移行
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-12 w-12" />}
            title="まだ移行履歴がありません"
            description="上のカードから対象のデータを選ぶと、移行を開始できます。"
          />
        ) : (
          <div className="space-y-3">
            {sessions.map(session => (
              <Link key={session.id} href={`/settings/import/${session.id}`}>
                <Card className="hover:border-[var(--color-primary)] transition-colors cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <StatusIcon status={session.status} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[var(--color-foreground)] truncate">
                            {session.label ?? `${ENTITY_LABELS[session.entity_type] ?? session.entity_type}データ移行`}
                          </span>
                          <span className="text-xs text-[var(--color-muted-foreground)] uppercase">
                            {session.source_type}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-[var(--color-muted-foreground)]">
                          <span>{ENTITY_LABELS[session.entity_type] ?? session.entity_type}</span>
                          {session.total_rows != null && (
                            <span>総件数 {session.total_rows.toLocaleString()}</span>
                          )}
                          {session.duplicate_rows != null && session.duplicate_rows > 0 && (
                            <span style={{ color: 'oklch(0.80 0.14 80)' }}>
                              要確認 {session.duplicate_rows.toLocaleString()}
                            </span>
                          )}
                          {session.invalid_rows != null && session.invalid_rows > 0 && (
                            <span style={{ color: 'oklch(0.75 0.18 30)' }}>
                              エラー {session.invalid_rows.toLocaleString()}
                            </span>
                          )}
                          <span>{new Date(session.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <StatusBadgeLocal status={session.status} />
                        <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
