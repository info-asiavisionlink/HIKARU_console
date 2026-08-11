'use client'

import * as React from 'react'
import { PageHeader, Button, toast, Breadcrumb, Badge } from '@hikaru/ui'
import { InboxIcon, CheckCircle2, XCircle, Clock, Building2, CalendarDays, MapPin, Tag, TrendingUp, User, FileText, Image as ImageIcon, Banknote, ExternalLink } from 'lucide-react'

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
}

export default function ProjectRequestsPage() {
  const [tab, setTab] = React.useState<'client' | 'worker'>('worker')
  const [requests, setRequests] = React.useState<ProjectRequest[]>([])
  const [proposals, setProposals] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [actionTarget, setActionTarget] = React.useState<ProjectRequest | null>(null)
  const [propTarget, setPropTarget] = React.useState<any | null>(null)
  const [actionType, setActionType] = React.useState<'approved' | 'rejected' | null>(null)
  const [adminNote, setAdminNote] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  async function fetchRequests() {
    setLoading(true)
    if (tab === 'client') {
      const qs = filter === 'all' ? '' : `?status=${filter}`
      const res = await fetch(`/api/project-requests${qs}`)
      const data = await res.json()
      setRequests(data.data ?? [])
    } else {
      const qs = filter === 'all' ? '' : `?status=${filter}`
      const res = await fetch(`/api/proposals${qs}`)
      const data = await res.json()
      setProposals(data.data ?? [])
    }
    setLoading(false)
  }

  React.useEffect(() => { fetchRequests() }, [filter, tab]) // eslint-disable-line

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
      setActionTarget(null); setActionType(null); setAdminNote('')
      fetchRequests()
    } else { toast.error('処理に失敗しました') }
    setSubmitting(false)
  }

  async function handleProposalAction() {
    if (!propTarget || !actionType) return
    setSubmitting(true)
    const res = await fetch('/api/proposals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: propTarget.id, status: actionType, admin_note: adminNote.trim() || null }),
    })
    if (res.ok) {
      toast.success(actionType === 'approved' ? '承認しました。案件管理に登録されました。' : '不承認にしました')
      setPropTarget(null); setActionType(null); setAdminNote('')
      fetchRequests()
    } else { toast.error('処理に失敗しました') }
    setSubmitting(false)
  }

  const pendingCount  = requests.filter((r) => r.status === 'pending').length
  const propPending   = proposals.filter((p) => p.status === 'pending').length

  return (
    <div>
      <PageHeader
        title="案件依頼"
        description="顧客からの依頼・スタッフからの提案を確認・承認します"
        breadcrumb={<Breadcrumb items={[{ label: '案件依頼' }]} />}
      />

      {/* メインタブ */}
      <div className="flex gap-1 border-b border-[var(--color-border)] mb-5">
        <button onClick={() => { setTab('worker'); setFilter('pending') }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'worker' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-muted-foreground)]'}`}>
          <TrendingUp className="h-4 w-4" />スタッフ提案
          {propPending > 0 && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold animate-pulse" style={{ background: 'oklch(0.65 0.25 27)', color: 'white' }}>{propPending}</span>}
        </button>
        <button onClick={() => { setTab('client'); setFilter('pending') }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'client' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-muted-foreground)]'}`}>
          <InboxIcon className="h-4 w-4" />顧客依頼
          {pendingCount > 0 && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold animate-pulse" style={{ background: 'oklch(0.65 0.25 27)', color: 'white' }}>{pendingCount}</span>}
        </button>
      </div>

      {/* フィルタータブ */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: 'oklch(0.08 0.004 255 / 0.80)' }}>
        {(['pending', 'all', 'approved', 'rejected'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{ background: filter === f ? `${GOLD}18` : 'transparent', color: filter === f ? GOLD : TEXT_MUTED, border: filter === f ? `1px solid ${GOLD}30` : '1px solid transparent' }}>
            {f === 'pending' ? `未対応` : f === 'all' ? 'すべて' : f === 'approved' ? '承認済み' : '不承認'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${GOLD} transparent transparent transparent` }} />
        </div>
      ) : tab === 'worker' ? (
        /* ─── スタッフ提案タブ ─── */
        proposals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20" style={{ color: TEXT_MUTED }}>
            <TrendingUp className="h-14 w-14 opacity-20" />
            <p className="text-sm">提案はありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((p: any) => {
              const st = STATUS_MAP[p.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.pending
              const Icon = st.icon
              const isActive = propTarget?.id === p.id
              const docs: any[] = p.project_documents ?? []
              return (
                <div key={p.id} className="rounded-2xl overflow-hidden" style={{ background: 'oklch(0.09 0.005 255 / 0.90)', border: `1px solid ${p.status === 'pending' ? GOLD + '30' : 'oklch(0.73 0.12 78 / 0.12)'}` }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${st.color}18`, border: `1px solid ${st.color}35`, color: st.color }}>
                            <Icon className="h-3 w-3" />{st.label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${BLUE}14`, border: `1px solid ${BLUE}25`, color: BLUE }}>
                            {TYPE_MAP[p.project_type] ?? p.project_type}
                          </span>
                          <span className="text-[10px]" style={{ color: 'oklch(0.40 0.006 60)' }}>{new Date(p.created_at).toLocaleString('ja-JP')}</span>
                        </div>
                        <h3 className="text-base font-semibold" style={{ color: 'oklch(0.90 0.008 75)' }}>{p.project_name}</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                      {p.profiles?.name && <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}><User className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} /><span>{p.profiles.name}</span></div>}
                      {p.client_name && <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}><Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} /><span>{p.client_name}</span></div>}
                      {p.location_name && <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}><MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} /><span>{p.location_name}</span></div>}
                      {p.estimated_amount && <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}><Banknote className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} /><span>¥{p.estimated_amount.toLocaleString()}</span></div>}
                      {p.start_date && <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}><CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} /><span>{p.start_date} 〜 {p.end_date ?? '未定'}</span></div>}
                    </div>
                    {p.work_description && (
                      <div className="p-3 rounded-xl text-sm mb-3" style={{ background: 'oklch(0.12 0.006 255 / 0.60)', border: `1px solid ${GOLD}12`, color: 'oklch(0.75 0.008 60)' }}>
                        {p.work_description}
                      </div>
                    )}
                    {/* 添付ファイル */}
                    {docs.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {docs.map((d: any) => (
                          <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                            style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}25`, color: GOLD }}>
                            {d.doc_type === 'exterior' || d.doc_type === 'work_area' ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                            {d.spot_name ? `${d.spot_name}` : d.doc_type === 'exterior' ? '外観' : d.doc_type === 'brochure' ? 'パンフ' : '契約書'}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ))}
                      </div>
                    )}
                    {p.status === 'pending' && !isActive && (
                      <div className="flex gap-2">
                        <button onClick={() => { setPropTarget(p); setActionType('approved'); setAdminNote('') }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: `${GREEN}18`, border: `1px solid ${GREEN}35`, color: GREEN }}>
                          <CheckCircle2 className="h-4 w-4" />承認して案件登録
                        </button>
                        <button onClick={() => { setPropTarget(p); setActionType('rejected'); setAdminNote('') }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: `${RED}18`, border: `1px solid ${RED}35`, color: RED }}>
                          <XCircle className="h-4 w-4" />不承認
                        </button>
                      </div>
                    )}
                    {p.admin_note && p.status !== 'pending' && (
                      <div className="p-3 rounded-xl text-xs mt-2" style={{ background: `${p.status === 'approved' ? GREEN : RED}0d`, border: `1px solid ${p.status === 'approved' ? GREEN : RED}25`, color: p.status === 'approved' ? GREEN : RED }}>
                        管理者コメント: {p.admin_note}
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <div className="px-5 pb-5 pt-4 border-t space-y-4" style={{ borderColor: `${actionType === 'approved' ? GREEN : RED}25` }}>
                      <p className="text-sm font-semibold" style={{ color: actionType === 'approved' ? GREEN : RED }}>
                        {actionType === 'approved' ? '✓ 承認する（案件管理に自動登録されます）' : '✗ 不承認にする'}
                      </p>
                      <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="スタッフへのコメント（任意）"
                        rows={3} className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
                        style={{ background: 'oklch(0.12 0.006 255 / 0.70)', border: `1px solid ${GOLD}20`, color: 'oklch(0.85 0.007 60)' }} />
                      <div className="flex gap-2">
                        <button onClick={handleProposalAction} disabled={submitting}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                          style={{ background: actionType === 'approved' ? `${GREEN}22` : `${RED}22`, border: `1px solid ${actionType === 'approved' ? GREEN : RED}50`, color: actionType === 'approved' ? GREEN : RED }}>
                          {submitting ? '処理中...' : (actionType === 'approved' ? '承認を確定' : '不承認を確定')}
                        </button>
                        <button onClick={() => { setPropTarget(null); setActionType(null) }}
                          className="px-4 py-2 rounded-xl text-sm" style={{ color: TEXT_MUTED, border: `1px solid oklch(0.30 0.004 60)` }}>
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
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
                      <span>{(req.clients as any)?.name ?? '—'}</span>
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
