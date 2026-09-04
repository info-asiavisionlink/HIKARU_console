'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  PageHeader, Button, Card, CardContent, Skeleton,
} from '@hikaru/ui'
import {
  CheckCircle2, Circle, Building2, Users, Store, FolderOpen,
  ChevronRight, AlertCircle, RefreshCw, Plus, Upload, Ban,
  Receipt, Clock, CalendarDays,
} from 'lucide-react'

// ---- Types ----

interface SetupStatusData {
  company:  { name: string | null; ready: boolean }
  counts:   { clients: number; stores: number; employees: number; projects: number }
  readiness: {
    companyReady:   boolean
    clientReady:    boolean
    storeReady:     boolean
    employeeReady:  boolean
    projectReady:   boolean
    accountReady:   boolean
    businessReady:  boolean
    operationReady: boolean
  }
}

// ---- Status indicator helpers ----

function StatusIcon({ ready }: { ready: boolean }) {
  if (ready) {
    return <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.72 0.18 150)' }} />
  }
  return <Circle className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
}

function ReadinessBadge({ ready, label }: { ready: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
      style={ready
        ? { background: 'oklch(0.72 0.18 150 / 0.12)', color: 'oklch(0.72 0.18 150)' }
        : { background: 'var(--color-muted)', color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }
      }
    >
      {label}
    </span>
  )
}

function OptionalBadge() {
  return (
    <span
      className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
    >
      任意
    </span>
  )
}

function RequiredBadge() {
  return (
    <span
      className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{ background: 'oklch(0.73 0.12 78 / 0.10)', color: 'oklch(0.73 0.12 78)', border: '1px solid oklch(0.73 0.12 78 / 0.25)' }}
    >
      必須
    </span>
  )
}

function ComingSoonBadge() {
  return (
    <span
      className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
    >
      準備中
    </span>
  )
}

// ---- Section helpers ----

function SectionHeader({ step, title, note }: { step: string; title: string; note?: '必須' | '任意' }) {
  return (
    <div className="mt-8 mb-2 flex items-baseline gap-2 flex-wrap">
      {step && (
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'oklch(0.73 0.12 78 / 0.85)' }}>
          {step}
        </span>
      )}
      <h2 className="text-sm font-bold tracking-wider text-[var(--color-foreground)] uppercase">
        {title}
      </h2>
      {note === '必須' && <RequiredBadge />}
      {note === '任意' && <OptionalBadge />}
    </div>
  )
}

function SectionIntro({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-[var(--color-muted-foreground)] mb-3 leading-relaxed">
      {children}
    </p>
  )
}

// ---- Progress Summary ----

function ProgressSummary({ status }: { status: SetupStatusData }) {
  const { readiness, counts } = status
  const items = [
    { ready: readiness.companyReady,  label: '会社情報',                required: true  },
    { ready: readiness.clientReady,   label: `顧客 ${counts.clients}件`, required: true  },
    { ready: readiness.employeeReady, label: `従業員 ${counts.employees}名`, required: true },
    { ready: readiness.storeReady,    label: `店舗 ${counts.stores}件`, required: false },
  ]

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-4 flex-wrap">
          {items.map(item => (
            <div key={item.label} className="flex items-center gap-1.5 text-sm">
              <StatusIcon ready={item.ready} />
              <span
                style={{
                  color: item.ready
                    ? 'oklch(0.72 0.18 150)'
                    : item.required
                      ? 'var(--color-foreground)'
                      : 'var(--color-muted-foreground)',
                  fontWeight: item.ready ? 500 : 400,
                }}
              >
                {item.label}
              </span>
              {!item.required && !item.ready && (
                <span className="text-xs text-[var(--color-muted-foreground)]">（任意）</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          {readiness.businessReady ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.72 0.18 150)' }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'oklch(0.72 0.18 150)' }}>
                    業務開始の準備が整いました
                  </p>
                  <p className="text-[11px] text-[var(--color-muted-foreground)] mt-0.5">
                    （会社情報・顧客・従業員が完了。店舗・案件は任意です）
                  </p>
                </div>
              </div>
              <Link href="/dashboard" className="shrink-0">
                <Button size="sm" aria-label="HIKARUを使い始める">
                  HIKARUを使い始める <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[var(--color-muted-foreground)] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  業務開始の準備が整っていません
                </p>
                <p className="text-[11px] text-[var(--color-muted-foreground)] mt-0.5">
                  会社情報・顧客・従業員の登録が完了すると、HIKARUを使い始められます。
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Basic data card layout helper ----
//
// 統一パターン:
//   Icon + タイトル + 状態 badge + 説明文
//   右側に [1件ずつ登録] [まとめて移行] 2 button
//   まとめて移行が backend 未完成なら disabled 「準備中」表示
//
// Backend が完成している entity のみ bulk enabled にする。
// 現時点で本番実運用可能な bulk import は client のみ。

function EntityCard({
  icon: Icon,
  title,
  countLabel,
  ready,
  description,
  manualHref,
  manualLabel,
  bulkHref,
  bulkAvailable,
  bulkComingSoonTitle,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
  countLabel: string
  ready: boolean
  description: string
  manualHref: string
  manualLabel: string
  bulkHref: string
  bulkAvailable: boolean
  bulkComingSoonTitle: string
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-0.5"><StatusIcon ready={ready} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                <span className="text-sm font-medium text-[var(--color-foreground)]">{title}</span>
                <ReadinessBadge ready={ready} label={countLabel} />
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end sm:justify-end">
            <Link href={manualHref}>
              <Button size="sm" aria-label={`${title}を1件ずつ登録`}>
                <Plus className="h-3.5 w-3.5" /> {manualLabel}
              </Button>
            </Link>
            {bulkAvailable ? (
              <Link href={bulkHref}>
                <Button variant="outline" size="sm" aria-label={`${title}をまとめて移行`}>
                  <Upload className="h-3.5 w-3.5" /> まとめて移行
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled
                aria-label="まとめて移行（準備中）"
                title={bulkComingSoonTitle}
              >
                <Ban className="h-3.5 w-3.5" /> 準備中
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Individual setup cards ----

function CompanyCard({ status }: { status: SetupStatusData }) {
  const ready = status.readiness.companyReady
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5"><StatusIcon ready={ready} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              <span className="text-sm font-medium text-[var(--color-foreground)]">会社情報</span>
              <ReadinessBadge ready={ready} label={ready ? '完了' : '未設定'} />
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
              {ready
                ? status.company.name ?? '設定済み'
                : '会社名など、HIKARUの基本情報を設定してください。'
              }
            </p>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" aria-label="会社情報を確認・設定">
              確認・設定 <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function ClientCard({ status }: { status: SetupStatusData }) {
  const { counts, readiness } = status
  const label = readiness.clientReady ? `${counts.clients}件 登録済み` : '未登録'
  return (
    <EntityCard
      icon={Building2}
      title="顧客"
      countLabel={label}
      ready={readiness.clientReady}
      description="取引先・契約先となる顧客情報を登録します。店舗登録や請求機能を利用する前に必要です。"
      manualHref="/clients/new?return=/setup"
      manualLabel="1件ずつ登録"
      bulkHref="/settings/import/new?entity_type=client&return=/setup"
      bulkAvailable={true}
      bulkComingSoonTitle=""
    />
  )
}

function StoreCard({ status }: { status: SetupStatusData }) {
  const { counts, readiness } = status
  const noClients = counts.clients === 0
  const label = readiness.storeReady ? `${counts.stores}件 登録済み` : '未登録'

  // noClients 時: 先に顧客登録を促す専用 UI
  if (noClients) {
    return (
      <Card style={{ opacity: 0.7 }}>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="mt-0.5"><StatusIcon ready={readiness.storeReady} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Store className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  <span className="text-sm font-medium text-[var(--color-foreground)]">店舗</span>
                  <ReadinessBadge ready={false} label="未登録" />
                  <OptionalBadge />
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                  先に顧客を登録してください。顧客なしで店舗を作成することはできません。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
              <Link href="/clients/new?return=/setup">
                <Button size="sm" aria-label="先に顧客を登録">
                  先に顧客を登録
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-0.5"><StatusIcon ready={readiness.storeReady} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Store className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                <span className="text-sm font-medium text-[var(--color-foreground)]">店舗</span>
                <ReadinessBadge ready={readiness.storeReady} label={label} />
                <OptionalBadge />
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1 leading-relaxed">
                案件の作業場所として登録できます（案件に住所を直接入力することも可能です）。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
            <Link href="/stores/new?return=/setup">
              <Button size="sm" aria-label="店舗を1件ずつ登録">
                <Plus className="h-3.5 w-3.5" /> 1件ずつ登録
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              disabled
              aria-label="まとめて移行（準備中）"
              title="店舗の一括移行は現在準備中です。顧客との紐付け機能を整備後に提供予定です。"
            >
              <Ban className="h-3.5 w-3.5" /> 準備中
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmployeeCard({ status }: { status: SetupStatusData }) {
  const { counts, readiness } = status
  const label = readiness.employeeReady ? `${counts.employees}名 登録済み` : '未登録'
  return (
    <EntityCard
      icon={Users}
      title="従業員"
      countLabel={label}
      ready={readiness.employeeReady}
      description="従業員を登録すると、案件への配置やシフト管理を開始できます。"
      manualHref="/employees/new?return=/setup"
      manualLabel="1件ずつ登録"
      bulkHref=""
      bulkAvailable={false}
      bulkComingSoonTitle="従業員の一括移行は現在準備中です。近日提供予定です。"
    />
  )
}

function ProjectCard({ status }: { status: SetupStatusData }) {
  const { counts, readiness } = status
  const label = readiness.projectReady ? `${counts.projects}件 登録済み` : '未登録'
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-0.5"><StatusIcon ready={readiness.projectReady} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <FolderOpen className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                <span className="text-sm font-medium text-[var(--color-foreground)]">案件</span>
                <ReadinessBadge ready={readiness.projectReady} label={label} />
                <OptionalBadge />
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1 leading-relaxed">
                {readiness.projectReady
                  ? '案件が登録されています。シフト・作業管理を開始できます。'
                  : '基本設定が終わったら最初の案件を登録しましょう（業務開始後でも登録できます）。'
                }
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
            {readiness.projectReady ? (
              <Link href="/projects">
                <Button variant="outline" size="sm" aria-label="案件管理を見る">
                  案件管理 <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <Link href="/projects/new?return=/setup">
                <Button size="sm" aria-label="案件を登録">
                  <Plus className="h-3.5 w-3.5" /> 1件ずつ登録
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled
              aria-label="まとめて移行（準備中）"
              title="案件の一括移行は現在準備中です。近日提供予定です。"
            >
              <Ban className="h-3.5 w-3.5" /> 準備中
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Past Data Migration Card (all disabled 準備中) ----

function PastDataCard({
  icon: Icon,
  title,
  description,
  comingSoonTitle,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
  description: string
  comingSoonTitle: string
}) {
  return (
    <Card style={{ opacity: 0.85 }}>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                <span className="text-sm font-medium text-[var(--color-foreground)]">{title}</span>
                <ComingSoonBadge />
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled
              aria-label="データを移行（準備中）"
              title={comingSoonTitle}
            >
              <Ban className="h-3.5 w-3.5" /> データを移行
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Group C: Optional settings ----

function OtherSettings() {
  const items = [
    { label: '請求関連設定', description: '振込先・適格請求書番号など', href: '/settings' },
    { label: 'メール送信設定', description: 'Reply-To・自動送信設定', href: '/settings' },
    { label: '協力業者管理', description: '外部協力業者の登録', href: '/partners' },
  ]

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        {items.map(item => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors">
                {item.label}
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{item.description}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--color-muted-foreground)] shrink-0" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

// ---- Skeleton loading ----

function SetupSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

// ---- Error state ----

function SetupError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-4 max-w-lg"
      style={{ background: 'oklch(0.65 0.18 30 / 0.08)', border: '1px solid oklch(0.65 0.18 30 / 0.20)' }}
      role="alert"
    >
      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'oklch(0.75 0.18 30)' }} />
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: 'oklch(0.75 0.18 30)' }}>
          初期設定情報を取得できませんでした
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
          ページを再読み込みしてください。
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={onRetry}
          aria-label="再読み込み"
        >
          <RefreshCw className="h-3.5 w-3.5" /> 再読み込み
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function SetupPage() {
  const [status, setStatus]   = React.useState<SetupStatusData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError]     = React.useState(false)

  function load() {
    setLoading(true)
    setError(false)
    // Single fetch — no polling, no Realtime, no setInterval
    fetch('/api/setup-status', { credentials: 'include', cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => setStatus(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        title="初期設定"
        description="HIKARUを使い始めるための基本情報を設定します。既にExcelやCSVでデータを管理している場合は、まとめて移行することもできます。"
      />

      <div className="max-w-2xl space-y-1">

        {/* Loading */}
        {loading && <SetupSkeleton />}

        {/* Error */}
        {!loading && error && <SetupError onRetry={load} />}

        {/* Loaded */}
        {!loading && !error && status && (
          <>
            {/* Progress summary + completion CTA */}
            <ProgressSummary status={status} />

            {/* STEP 1: 基本設定 */}
            <SectionHeader step="STEP 1" title="基本設定" />
            <CompanyCard status={status} />

            {/* STEP 2: 業務開始の準備 */}
            <SectionHeader step="STEP 2" title="業務開始の準備" note="必須" />
            <SectionIntro>
              日常業務で使用する基本データを登録します。
              件数が少ない場合は「1件ずつ登録」、既存のExcel / CSVがある場合は「まとめて移行」を選べます。
            </SectionIntro>
            <div className="space-y-1">
              <ClientCard   status={status} />
              <StoreCard    status={status} />
              <EmployeeCard status={status} />
              <ProjectCard  status={status} />
            </div>

            {/* STEP 3: 過去データの移行 (任意) */}
            <SectionHeader step="STEP 3" title="過去データの移行" note="任意" />
            <SectionIntro>
              以前のシステムやExcelで管理していた過去のデータをHIKARUへ引き継ぐことができます。
              新しくHIKARUで管理を始める場合は、この設定は必要ありません。業務開始後でもいつでも実行できます。
            </SectionIntro>
            <div className="space-y-1">
              <PastDataCard
                icon={Receipt}
                title="経費履歴"
                description="過去の経費申請・精算履歴を移行します。"
                comingSoonTitle="経費履歴の移行は現在準備中です。近日提供予定です。"
              />
              <PastDataCard
                icon={Clock}
                title="勤怠履歴"
                description="過去の出退勤・勤怠履歴を移行します。"
                comingSoonTitle="勤怠履歴の移行は現在準備中です。近日提供予定です。"
              />
              <PastDataCard
                icon={CalendarDays}
                title="シフト履歴"
                description="過去のシフト履歴を移行します。"
                comingSoonTitle="シフト履歴の移行は現在準備中です。近日提供予定です。"
              />
            </div>

            {/* 後から設定可能 */}
            <SectionHeader step="" title="後から設定可能" />
            <OtherSettings />
          </>
        )}

      </div>
    </div>
  )
}
