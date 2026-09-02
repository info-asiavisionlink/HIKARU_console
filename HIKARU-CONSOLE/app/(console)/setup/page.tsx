'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, CardHeader, CardTitle, Skeleton,
} from '@hikaru/ui'
import {
  CheckCircle2, Circle, Building2, Users, Store, FolderOpen,
  ChevronRight, AlertCircle, RefreshCw, Plus, Upload, Ban,
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

// ---- Checklist summary bar ----

function ProgressSummary({ status }: { status: SetupStatusData }) {
  const { readiness, counts } = status
  const items = [
    { ready: readiness.companyReady,  label: '会社情報',                optional: false },
    { ready: readiness.clientReady,   label: `顧客 ${counts.clients}件`, optional: false },
    { ready: readiness.employeeReady, label: `従業員 ${counts.employees}名`, optional: false },
    { ready: readiness.storeReady,    label: `店舗 ${counts.stores}件`, optional: true },
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
                    : item.optional
                      ? 'var(--color-muted-foreground)'
                      : 'var(--color-foreground)',
                  fontWeight: item.ready ? 500 : 400,
                }}
              >
                {item.label}
              </span>
              {item.optional && !item.ready && (
                <span className="text-xs text-[var(--color-muted-foreground)]">（任意）</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          {readiness.businessReady ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" style={{ color: 'oklch(0.72 0.18 150)' }} />
              <span className="text-sm font-medium" style={{ color: 'oklch(0.72 0.18 150)' }}>
                業務開始の準備が整いました
              </span>
              {readiness.operationReady && (
                <span className="text-xs text-[var(--color-muted-foreground)]">（案件あり）</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              <span className="text-sm text-[var(--color-muted-foreground)]">
                業務開始の準備が整っていません
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Group section header ----

function GroupHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] mt-6 mb-3">
      {label}
    </p>
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
                : '会社名などの基本情報を設定してください。'
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
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5"><StatusIcon ready={readiness.clientReady} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              <span className="text-sm font-medium text-[var(--color-foreground)]">顧客</span>
              {readiness.clientReady
                ? <ReadinessBadge ready label={`${counts.clients}件 登録済み`} />
                : <ReadinessBadge ready={false} label="未登録" />
              }
            </div>
            {!readiness.clientReady && (
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                顧客を登録すると、店舗登録や請求機能を利用できます。
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/clients/new">
              <Button size="sm" aria-label="顧客を1件ずつ登録">
                <Plus className="h-3.5 w-3.5" /> 1件ずつ
              </Button>
            </Link>
            <Link href="/settings/import?entity_type=client&return=/setup">
              <Button variant="outline" size="sm" aria-label="顧客をまとめて登録">
                <Upload className="h-3.5 w-3.5" /> まとめて
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StoreCard({ status }: { status: SetupStatusData }) {
  const { counts, readiness } = status
  const noClients = counts.clients === 0

  return (
    <Card style={noClients ? { opacity: 0.7 } : {}}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5"><StatusIcon ready={readiness.storeReady} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Store className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              <span className="text-sm font-medium text-[var(--color-foreground)]">店舗</span>
              {readiness.storeReady
                ? <ReadinessBadge ready label={`${counts.stores}件 登録済み`} />
                : <ReadinessBadge ready={false} label="未登録" />
              }
              <span className="text-xs text-[var(--color-muted-foreground)] border border-[var(--color-border)] rounded px-1.5 py-0.5">任意</span>
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
              {noClients
                ? '先に顧客を登録してください。顧客なしで店舗を作成することはできません。'
                : '案件の作業場所として登録できます（案件に住所を直接入力することも可能です）。'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {noClients ? (
              <Link href="/clients/new">
                <Button size="sm" aria-label="先に顧客を登録">
                  先に顧客を登録
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/stores/new">
                  <Button size="sm" aria-label="店舗を1件ずつ登録">
                    <Plus className="h-3.5 w-3.5" /> 1件ずつ
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  aria-label="まとめて登録（準備中）"
                  title="Store Bulk Importは現在準備中です。顧客との紐付け機能を整備後に提供予定です。"
                >
                  <Ban className="h-3.5 w-3.5" /> 準備中
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmployeeCard({ status }: { status: SetupStatusData }) {
  const { counts, readiness } = status
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5"><StatusIcon ready={readiness.employeeReady} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              <span className="text-sm font-medium text-[var(--color-foreground)]">従業員</span>
              {readiness.employeeReady
                ? <ReadinessBadge ready label={`${counts.employees}名 登録済み`} />
                : <ReadinessBadge ready={false} label="未登録" />
              }
            </div>
            {!readiness.employeeReady && (
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                従業員を登録すると、案件への配置やシフト管理を開始できます。
              </p>
            )}
          </div>
          <Link href="/employees/new">
            <Button size="sm" aria-label="従業員を登録">
              <Plus className="h-3.5 w-3.5" /> 従業員を登録
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Project Next Step ----

function ProjectNextStep({ status }: { status: SetupStatusData }) {
  const { counts, readiness } = status
  return (
    <Card style={{ borderColor: 'oklch(0.73 0.12 78 / 0.20)' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider">
          次のステップ
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-4 w-4 text-[var(--color-muted-foreground)] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--color-foreground)]">案件</span>
              {readiness.projectReady && (
                <ReadinessBadge ready label={`${counts.projects}件 登録済み`} />
              )}
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
              {readiness.projectReady
                ? '案件が登録されています。シフト・作業管理を開始できます。'
                : '基本設定が終わったら、最初の案件を登録しましょう。'
              }
            </p>
          </div>
          {readiness.projectReady ? (
            <Link href="/projects">
              <Button variant="outline" size="sm" aria-label="案件管理を見る">
                案件管理 <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
            <Link href="/projects/new">
              <Button size="sm" aria-label="案件を登録">
                <Plus className="h-3.5 w-3.5" /> 案件を登録
              </Button>
            </Link>
          )}
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
        description="業務開始に必要な情報を確認・登録できます。設定は後からいつでも変更できます。"
      />

      <div className="max-w-2xl space-y-1">

        {/* Loading */}
        {loading && <SetupSkeleton />}

        {/* Error */}
        {!loading && error && <SetupError onRetry={load} />}

        {/* Loaded */}
        {!loading && !error && status && (
          <>
            {/* Progress summary */}
            <ProgressSummary status={status} />

            {/* GROUP A */}
            <GroupHeader label="基本設定" />
            <CompanyCard status={status} />

            {/* GROUP B */}
            <GroupHeader label="業務開始の準備" />
            <ClientCard   status={status} />
            <StoreCard    status={status} />
            <EmployeeCard status={status} />

            {/* Next Step */}
            <div className="pt-2">
              <ProjectNextStep status={status} />
            </div>

            {/* GROUP C */}
            <GroupHeader label="後から設定可能" />
            <OtherSettings />
          </>
        )}

      </div>
    </div>
  )
}
