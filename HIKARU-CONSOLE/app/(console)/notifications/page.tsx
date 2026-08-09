'use client'

import * as React from 'react'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { Bell, RefreshCw, Send, CheckCircle, XCircle, Clock, SkipForward, Filter } from 'lucide-react'
import { cn } from '@hikaru/ui'

interface LogRow {
  id: string
  event_type: string
  message: string
  line_user_id: string | null
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  error_message: string | null
  sent_at: string | null
  created_at: string
  profiles: { id: string; name: string; role: string } | null
}

const EVENT_LABELS: Record<string, string> = {
  shift_created:      'シフト作成',
  shift_updated:      'シフト変更',
  shift_cancelled:    'シフトキャンセル',
  shift_confirmed:    'シフト確定',
  project_assigned:   '案件割当',
  job_started:        '作業開始',
  job_completed:      '作業完了',
  ai_evaluation_alert:'AI評価アラート',
  report_ready:       '報告書完成',
  expense_submitted:  '経費申請',
  expense_approved:   '経費承認',
  expense_rejected:   '経費却下',
  quote_published:    '見積書公開',
  invoice_issued:     '請求書発行',
  payment_received:   '入金確認',
  invoice_overdue:    '支払期限超過',
}

const STATUS_CONFIG = {
  sent:    { icon: CheckCircle,  label: '送信済み',  color: 'text-[var(--color-success)]',         badge: 'success'   },
  failed:  { icon: XCircle,      label: '失敗',      color: 'text-[var(--color-error)]',           badge: 'error'     },
  skipped: { icon: SkipForward,  label: 'スキップ',  color: 'text-[var(--color-muted-foreground)]', badge: 'secondary' },
  pending: { icon: Clock,        label: '処理中',    color: 'text-[var(--color-warning)]',         badge: 'warning'   },
} as const

export default function NotificationsPage() {
  const [logs, setLogs]         = React.useState<LogRow[]>([])
  const [total, setTotal]       = React.useState(0)
  const [loading, setLoading]   = React.useState(true)
  const [resending, setResending] = React.useState<string | null>(null)
  const [filterStatus, setFilterStatus] = React.useState<string>('all')
  const [filterEvent, setFilterEvent]   = React.useState<string>('all')
  const [expanded, setExpanded] = React.useState<string | null>(null)

  React.useEffect(() => { fetchLogs() }, [filterStatus, filterEvent])

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterEvent  !== 'all') params.set('event_type', filterEvent)

      const res = await fetch(`/api/notifications?${params}`)
      if (!res.ok) throw new Error('取得失敗')
      const json = await res.json()
      setLogs(json.logs ?? [])
      setTotal(json.total ?? 0)
    } catch {
      toast.error('通知ログの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend(logId: string) {
    setResending(logId)
    try {
      const res = await fetch(`/api/notifications/${logId}/resend`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? '再送に失敗しました')
      } else {
        toast.success('再送しました')
        fetchLogs()
      }
    } catch {
      toast.error('再送に失敗しました')
    } finally {
      setResending(null)
    }
  }

  const failedCount  = logs.filter((l) => l.status === 'failed').length

  return (
    <div>
      <PageHeader
        title="LINE通知ログ"
        description={`合計 ${total}件${failedCount > 0 ? ` · 失敗 ${failedCount}件` : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            更新
          </Button>
        }
      />

      {/* フィルター */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="sent">送信済み</SelectItem>
            <SelectItem value="failed">失敗</SelectItem>
            <SelectItem value="skipped">スキップ</SelectItem>
            <SelectItem value="pending">処理中</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterEvent} onValueChange={setFilterEvent}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="イベント種別" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのイベント</SelectItem>
            {Object.entries(EVENT_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Bell className="h-12 w-12" />}
              title="通知ログはありません"
              description="LINE通知の送信履歴がここに表示されます"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const cfg  = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.pending
            const Icon = cfg.icon
            const isExpanded = expanded === log.id

            return (
              <Card
                key={log.id}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-[var(--color-surface-hover)]',
                  log.status === 'failed' && 'border-[var(--color-error)]/30'
                )}
                onClick={() => setExpanded(isExpanded ? null : log.id)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', cfg.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {EVENT_LABELS[log.event_type] ?? log.event_type}
                        </span>
                        <Badge variant={cfg.badge as 'success' | 'error' | 'secondary' | 'warning'} size="sm">
                          {cfg.label}
                        </Badge>
                        {log.profiles && (
                          <span className="text-xs text-[var(--color-muted-foreground)]">
                            → {log.profiles.name}
                          </span>
                        )}
                        {!log.profiles && log.line_user_id && (
                          <span className="text-xs text-[var(--color-muted-foreground)] font-mono">
                            → {log.line_user_id.slice(0, 8)}…
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {new Date(log.created_at).toLocaleString('ja-JP')}
                        </span>
                        {log.status === 'failed' && log.error_message && (
                          <span className="text-xs text-[var(--color-error)] truncate max-w-xs">
                            {log.error_message}
                          </span>
                        )}
                        {log.status === 'skipped' && log.error_message && (
                          <span className="text-xs text-[var(--color-muted-foreground)]">
                            {log.error_message}
                          </span>
                        )}
                      </div>

                      {/* 展開: メッセージ本文 */}
                      {isExpanded && (
                        <pre className="mt-2 text-xs bg-[var(--color-muted)] rounded p-2 whitespace-pre-wrap break-words text-[var(--color-foreground)] max-h-40 overflow-y-auto">
                          {log.message}
                        </pre>
                      )}
                    </div>

                    {/* 再送ボタン */}
                    {log.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleResend(log.id) }}
                        disabled={resending === log.id}
                        className="shrink-0"
                      >
                        <Send className={cn('h-3.5 w-3.5', resending === log.id && 'animate-pulse')} />
                        再送
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
