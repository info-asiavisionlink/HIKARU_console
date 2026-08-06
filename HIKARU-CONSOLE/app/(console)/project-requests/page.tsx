'use client'

import * as React from 'react'
import { PageHeader, Button, toast, Breadcrumb } from '@hikaru/ui'
import { InboxIcon, CheckCircle2, XCircle, Clock, Building2, CalendarDays, MapPin, Tag } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'
const GREEN = 'oklch(0.72 0.18 150)'
const RED   = 'oklch(0.65 0.25 27)'
const BLUE  = 'oklch(0.68 0.20 230)'
const TEXT_MUTED = 'oklch(0.55 0.008 60)'

const STATUS_MAP = {
  pending:  { label: '未対応', color: GOLD,  icon: Clock },
  approved: { label: '承認済み', color: GREEN, icon: CheckCircle2 },
  rejected: { label: '不承認', color: RED,   icon: XCircle },
}

const TYPE_MAP: Record<string, string> = {
  spot:      '単発案件',
  recurring: '定期案件',
  hotel:     'ホテル案件',
  other:     'その他',
}

interface ProjectRequest {
  id: string
  title: string
  description: string | null
  desired_date: string | null
  location: string | null
  project_type: string
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  clients: { id: string; name: string } | null
  client_portal_accounts: { contact_name: string } | null
}

export default function ProjectRequestsPage() {
  const [requests, setRequests] = React.useState<ProjectRequest[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [actionTarget, setActionTarget] = React.useState<ProjectRequest | null>(null)
  const [actionType, setActionType] = React.useState<'approved' | 'rejected' | null>(null)
  const [adminNote, setAdminNote] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  async function fetchRequests() {
    setLoading(true)
    const qs = filter === 'all' ? '' : `?status=${filter}`
    const res = await fetch(`/api/project-requests${qs}`)
    const data = await res.json()
    setRequests(data.data ?? [])
    setLoading(false)
  }

  React.useEffect(() => { fetchRequests() }, [filter]) // eslint-disable-line

  async function handleAction() {
    if (!actionTarget || !actionType) return
    setSubmitting(true)
    const res = await fetch(`/api/project-requests/${actionTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: actionType, adminNote: adminNote.trim() || null }),
    })
    if (res.ok) {
      toast.success(actionType === 'approved' ? '承認しました' : '不承認にしました')
      setActionTarget(null)
      setActionType(null)
      setAdminNote('')
      fetchRequests()
    } else {
      toast.error('処理に失敗しました')
    }
    setSubmitting(false)
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div>
      <PageHeader
        title="案件依頼"
        description="顧客ポータルから送られた案件依頼を確認・承認します"
        breadcrumb={<Breadcrumb items={[{ label: '案件依頼' }]} />}
      />

      {/* フィルタータブ */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: 'oklch(0.08 0.004 255 / 0.80)' }}>
        {(['pending', 'all', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: filter === f ? `${GOLD}18` : 'transparent',
              color: filter === f ? GOLD : TEXT_MUTED,
              border: filter === f ? `1px solid ${GOLD}30` : '1px solid transparent',
            }}
          >
            {f === 'pending' ? `未対応${pendingCount > 0 ? ` (${pendingCount})` : ''}` : f === 'all' ? 'すべて' : f === 'approved' ? '承認済み' : '不承認'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${GOLD} transparent transparent transparent` }} />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: TEXT_MUTED }}>
          <InboxIcon className="h-14 w-14 opacity-20" />
          <p className="text-sm">案件依頼はありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const st = STATUS_MAP[req.status]
            const Icon = st.icon
            const isExpanded = actionTarget?.id === req.id

            return (
              <div
                key={req.id}
                className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  background: 'oklch(0.09 0.005 255 / 0.90)',
                  border: `1px solid ${req.status === 'pending' ? GOLD + '30' : 'oklch(0.73 0.12 78 / 0.12)'}`,
                }}
              >
                <div className="p-5">
                  {/* ヘッダー */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${st.color}18`, border: `1px solid ${st.color}35`, color: st.color }}
                        >
                          <Icon className="h-3 w-3" />
                          {st.label}
                        </span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: `${BLUE}14`, border: `1px solid ${BLUE}25`, color: BLUE }}
                        >
                          {TYPE_MAP[req.project_type] ?? req.project_type}
                        </span>
                        <span className="text-[10px]" style={{ color: 'oklch(0.40 0.006 60)' }}>
                          {new Date(req.created_at).toLocaleString('ja-JP')}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold" style={{ color: 'oklch(0.90 0.008 75)' }}>
                        {req.title}
                      </h3>
                    </div>
                  </div>

                  {/* 顧客・場所・日程 */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}>
                      <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                      <span>{(req.clients as any)?.name ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}>
                      <Tag className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                      <span>{(req.client_portal_accounts as any)?.contact_name ?? '—'}</span>
                    </div>
                    {req.desired_date && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}>
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                        <span>希望日: {req.desired_date}</span>
                      </div>
                    )}
                    {req.location && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}>
                        <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                        <span>{req.location}</span>
                      </div>
                    )}
                  </div>

                  {/* 依頼内容 */}
                  {req.description && (
                    <div
                      className="p-3 rounded-xl text-sm mb-4"
                      style={{
                        background: 'oklch(0.12 0.006 255 / 0.60)',
                        border: `1px solid ${GOLD}12`,
                        color: 'oklch(0.75 0.008 60)',
                      }}
                    >
                      {req.description}
                    </div>
                  )}

                  {/* 管理者コメント（承認済み/不承認時） */}
                  {req.admin_note && req.status !== 'pending' && (
                    <div
                      className="p-3 rounded-xl text-xs mb-4"
                      style={{
                        background: `${req.status === 'approved' ? GREEN : RED}0d`,
                        border: `1px solid ${req.status === 'approved' ? GREEN : RED}25`,
                        color: req.status === 'approved' ? GREEN : RED,
                      }}
                    >
                      管理者コメント: {req.admin_note}
                    </div>
                  )}

                  {/* 承認/不承認ボタン（未対応のみ） */}
                  {req.status === 'pending' && !isExpanded && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setActionTarget(req); setActionType('approved'); setAdminNote('') }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                        style={{ background: `${GREEN}18`, border: `1px solid ${GREEN}35`, color: GREEN }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        承認する
                      </button>
                      <button
                        onClick={() => { setActionTarget(req); setActionType('rejected'); setAdminNote('') }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                        style={{ background: `${RED}18`, border: `1px solid ${RED}35`, color: RED }}
                      >
                        <XCircle className="h-4 w-4" />
                        不承認
                      </button>
                    </div>
                  )}
                </div>

                {/* 承認/不承認パネル（展開時） */}
                {isExpanded && (
                  <div
                    className="px-5 pb-5 pt-4 border-t space-y-4"
                    style={{ borderColor: `${actionType === 'approved' ? GREEN : RED}25` }}
                  >
                    <p
                      className="text-sm font-semibold"
                      style={{ color: actionType === 'approved' ? GREEN : RED }}
                    >
                      {actionType === 'approved' ? '✓ 承認する' : '✗ 不承認にする'}
                    </p>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="顧客へのコメント（任意）—承認後の対応予定や不承認の理由など"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
                      style={{
                        background: 'oklch(0.12 0.006 255 / 0.70)',
                        border: `1px solid ${GOLD}20`,
                        color: 'oklch(0.85 0.007 60)',
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAction}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                        style={{
                          background: actionType === 'approved' ? `${GREEN}22` : `${RED}22`,
                          border: `1px solid ${actionType === 'approved' ? GREEN : RED}50`,
                          color: actionType === 'approved' ? GREEN : RED,
                        }}
                      >
                        {submitting ? '処理中...' : (actionType === 'approved' ? '承認を確定' : '不承認を確定')}
                      </button>
                      <button
                        onClick={() => { setActionTarget(null); setActionType(null) }}
                        className="px-4 py-2 rounded-xl text-sm transition-all"
                        style={{ color: TEXT_MUTED, border: `1px solid oklch(0.30 0.004 60)` }}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
