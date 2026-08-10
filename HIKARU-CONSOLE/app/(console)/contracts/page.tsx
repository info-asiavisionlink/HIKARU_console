'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton, toast, Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { FileSignature, Plus, RefreshCw, AlertTriangle, Search, Clock, Filter } from 'lucide-react'
import {
  CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS, COUNTERPARTY_LABELS,
  calculateDeadlineInfo, URGENCY_CONFIG, formatContractDate,
  type ContractStatus, type DeadlineUrgency,
} from '@/lib/contracts/service'
import { cn } from '@hikaru/ui'

interface ContractItem {
  id: string
  title: string
  contract_number: string | null
  counterparty_type: string
  contract_type: string
  status: ContractStatus
  start_date: string | null
  end_date: string | null
  renewal_date: string | null
  auto_renewal: boolean
  clients:   { id: string; name: string } | null
  partners:  { id: string; company_name: string } | null
  projects:  { id: string; name: string } | null
  deadline:  { daysUntilExpiry: number | null; urgency: DeadlineUrgency; label: string }
}

interface Kpi {
  total: number; active: number; expiring30d: number
  expired: number; auto_renewal: number; client_count: number; partner_count: number
}

const GOLD = 'oklch(0.73 0.12 78)'

function KpiCard({ label, value, sub, urgent }: { label: string; value: number; sub?: string; urgent?: boolean }) {
  return (
    <Card style={{ background: 'oklch(0.08 0.002 260)', border: `1px solid ${GOLD}22` }}>
      <CardContent className="p-4">
        <p className="text-xs font-medium mb-1" style={{ color: `${GOLD}80` }}>{label}</p>
        <p className="text-2xl font-black" style={{
          color: urgent && value > 0 ? 'oklch(0.65 0.25 27)' : GOLD,
        }}>{value}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: `${GOLD}59` }}>{sub}</p>}
      </CardContent>
    </Card>
  )
}

function DeadlineBadge({ urgency, label }: { urgency: DeadlineUrgency; label: string }) {
  const cfg = URGENCY_CONFIG[urgency]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
      style={{ color: cfg.textColor, background: cfg.bgColor, border: `1px solid ${cfg.borderColor}` }}
    >
      {(urgency === 'expired' || urgency === 'critical' || urgency === 'warning') && (
        <AlertTriangle className="h-2.5 w-2.5" />
      )}
      {urgency === 'caution' && <Clock className="h-2.5 w-2.5" />}
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const colorMap: Record<ContractStatus, string> = {
    draft:      'oklch(0.55 0.008 75)',
    sent:       'oklch(0.65 0.15 220)',
    reviewing:  'oklch(0.73 0.12 78)',
    signed:     'oklch(0.65 0.15 160)',
    active:     'oklch(0.68 0.18 160)',
    expired:    'oklch(0.65 0.25 27)',
    terminated: 'oklch(0.50 0.005 75)',
  }
  const color = colorMap[status] ?? 'oklch(0.55 0.008 75)'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
      style={{ color, background: `${color}22`, border: `1px solid ${color}44` }}
    >
      {CONTRACT_STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default function ContractsPage() {
  const [contracts, setContracts] = React.useState<ContractItem[]>([])
  const [kpi,       setKpi]       = React.useState<Kpi | null>(null)
  const [loading,   setLoading]   = React.useState(true)

  const [search,      setSearch]      = React.useState('')
  const [statusFilter,setStatusFilter]= React.useState('all')
  const [typeFilter,  setTypeFilter]  = React.useState('all')
  const [counterFilter, setCounterFilter] = React.useState('all')
  const [expiringFilter, setExpiringFilter] = React.useState('all')

  const [checking, setChecking] = React.useState(false)

  React.useEffect(() => { load() }, [statusFilter, typeFilter, counterFilter, expiringFilter])

  async function load() {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (statusFilter  !== 'all') p.set('status',          statusFilter)
      if (typeFilter    !== 'all') p.set('contract_type',   typeFilter)
      if (counterFilter !== 'all') p.set('counterparty_type', counterFilter)
      if (expiringFilter !== 'all') p.set('expiring_days',  expiringFilter)
      const res = await fetch(`/api/contracts?${p}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setContracts(data.contracts ?? [])
      setKpi(data.kpi)
    } catch { toast.error('取得に失敗しました') }
    finally { setLoading(false) }
  }

  async function handleExpiryCheck() {
    setChecking(true)
    try {
      const res = await fetch('/api/contracts/expiry-check', {
        method: 'POST', credentials: 'include',
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`期限チェック完了: ${data.notified}件通知, ${data.skipped}件スキップ`)
    } catch { toast.error('期限チェックに失敗しました') }
    finally { setChecking(false) }
  }

  const filtered = contracts.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = (c.clients?.name ?? c.partners?.company_name ?? '').toLowerCase()
    return (
      c.title.toLowerCase().includes(q) ||
      (c.contract_number ?? '').toLowerCase().includes(q) ||
      name.includes(q)
    )
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="契約管理"
        description="顧客・協力業者との契約書を一元管理"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={handleExpiryCheck}
              disabled={checking}
              style={{ borderColor: `${GOLD}44`, color: GOLD }}
            >
              <Clock className="h-4 w-4 mr-1.5" />
              {checking ? '確認中...' : '期限チェック'}
            </Button>
            <Button variant="outline" size="sm" onClick={load} style={{ borderColor: `${GOLD}44`, color: GOLD }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link href="/contracts/new">
              <Button size="sm" style={{ background: `linear-gradient(135deg, oklch(0.52 0.10 75), ${GOLD})`, color: 'oklch(0.06 0.003 260)' }}>
                <Plus className="h-4 w-4 mr-1.5" />
                新規契約
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPIカード */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiCard label="総契約数"       value={kpi.total}        />
          <KpiCard label="有効契約"        value={kpi.active}       />
          <KpiCard label="30日以内に期限"  value={kpi.expiring30d}  urgent />
          <KpiCard label="期限切れ"        value={kpi.expired}      urgent />
          <KpiCard label="自動更新契約"    value={kpi.auto_renewal} />
          <KpiCard label="顧客契約"        value={kpi.client_count} />
          <KpiCard label="協力業者契約"    value={kpi.partner_count}/>
        </div>
      )}

      {/* フィルター */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: `${GOLD}66` }} />
          <Input
            placeholder="契約名・相手・番号で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            style={{ background: 'oklch(0.08 0.002 260)', borderColor: `${GOLD}33` }}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-32" style={{ background: 'oklch(0.08 0.002 260)', borderColor: `${GOLD}33` }}>
            <Filter className="h-3 w-3 mr-1.5" style={{ color: `${GOLD}66` }} />
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 text-xs w-36" style={{ background: 'oklch(0.08 0.002 260)', borderColor: `${GOLD}33` }}>
            <SelectValue placeholder="契約種類" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての種類</SelectItem>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={counterFilter} onValueChange={setCounterFilter}>
          <SelectTrigger className="h-8 text-xs w-32" style={{ background: 'oklch(0.08 0.002 260)', borderColor: `${GOLD}33` }}>
            <SelectValue placeholder="契約相手" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">顧客・協力業者</SelectItem>
            <SelectItem value="client">顧客のみ</SelectItem>
            <SelectItem value="partner">協力業者のみ</SelectItem>
          </SelectContent>
        </Select>
        <Select value={expiringFilter} onValueChange={setExpiringFilter}>
          <SelectTrigger className="h-8 text-xs w-36" style={{ background: 'oklch(0.08 0.002 260)', borderColor: `${GOLD}33` }}>
            <SelectValue placeholder="期限" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">期限すべて</SelectItem>
            <SelectItem value="7">7日以内</SelectItem>
            <SelectItem value="30">30日以内</SelectItem>
            <SelectItem value="60">60日以内</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* テーブル */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="h-8 w-8" />}
          title="契約がありません"
          description="「新規契約」から契約を登録してください"
        />
      ) : (
        <div
          className="rounded-[var(--radius)] overflow-hidden"
          style={{ border: `1px solid ${GOLD}22`, background: 'oklch(0.06 0.002 260)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${GOLD}22`, background: 'oklch(0.08 0.002 260)' }}>
                {['契約名', '契約相手', '種類', '関連案件', '開始日', '終了日', '更新日', 'ステータス', '期限'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: `${GOLD}80` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const counterpartyName = c.clients?.name ?? c.partners?.company_name ?? '—'
                return (
                  <tr
                    key={c.id}
                    className="transition-colors hover:bg-[oklch(0.08_0.002_260/0.6)] cursor-pointer"
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${GOLD}11` : 'none' }}
                    onClick={() => window.location.href = `/contracts/${c.id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: GOLD }}>{c.title}</div>
                      {c.contract_number && (
                        <div className="text-[10px] mt-0.5" style={{ color: `${GOLD}59` }}>
                          #{c.contract_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div style={{ color: 'oklch(0.85 0.005 75)' }}>{counterpartyName}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: `${GOLD}59` }}>
                        {COUNTERPARTY_LABELS[c.counterparty_type as 'client' | 'partner'] ?? c.counterparty_type}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'oklch(0.75 0.005 75)' }}>
                      {CONTRACT_TYPE_LABELS[c.contract_type as keyof typeof CONTRACT_TYPE_LABELS] ?? c.contract_type}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'oklch(0.65 0.005 75)' }}>
                      {c.projects?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'oklch(0.65 0.005 75)' }}>
                      {formatContractDate(c.start_date)}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'oklch(0.65 0.005 75)' }}>
                      {formatContractDate(c.end_date)}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'oklch(0.65 0.005 75)' }}>
                      {formatContractDate(c.renewal_date)}
                      {c.auto_renewal && (
                        <span className="ml-1 text-[9px] px-1 py-0.5 rounded" style={{ background: `${GOLD}22`, color: GOLD }}>自動</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      {c.end_date
                        ? <DeadlineBadge urgency={c.deadline.urgency} label={c.deadline.label} />
                        : <span style={{ color: `${GOLD}40`, fontSize: 10 }}>—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
