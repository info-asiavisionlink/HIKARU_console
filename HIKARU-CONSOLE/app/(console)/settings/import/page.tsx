'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton,
} from '@hikaru/ui'
import { Upload, Plus, ChevronRight, AlertCircle, CheckCircle2, Clock, FileX } from 'lucide-react'
import { EmptyState } from '@/components/console/EmptyState'

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
  client:   '顧客',
  store:    '店舗',
  employee: '従業員',
  project:  '案件',
  invoice:  '請求書',
  expense:  '経費',
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
        title="データ移行"
        description="既存システムのCSV / Excelデータを HIKARUへ安全に移行できます。"
        action={
          <Button onClick={() => router.push('/settings/import/new')}>
            <Plus className="h-4 w-4" />
            新しいデータ移行を開始
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3 max-w-4xl">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="max-w-4xl">
          <EmptyState
            icon={<Upload className="h-12 w-12" />}
            title="移行データがありません"
            description="CSV や Excel ファイルから顧客・店舗データをインポートできます。"
            action={
              <Button onClick={() => router.push('/settings/import/new')}>
                <Plus className="h-4 w-4" />
                最初のデータ移行を開始
              </Button>
            }
          />
        </div>
      ) : (
        <div className="max-w-4xl space-y-3">
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
  )
}
