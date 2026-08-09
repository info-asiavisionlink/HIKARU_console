'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { Plus, FileText, Filter, RefreshCw, AlertCircle } from 'lucide-react'
import {
  listInvoices, fmtDate, fmtMoney, INVOICE_STATUS_LABEL, STATUS_VARIANT, isOverdue,
  type InvoiceRow, type InvoiceKpi,
} from '@/services/invoices.service'
import { cn } from '@hikaru/ui'

export default function BillsPage() {
  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([])
  const [kpi,      setKpi]      = React.useState<InvoiceKpi | null>(null)
  const [loading,  setLoading]  = React.useState(true)
  const [status,   setStatus]   = React.useState('all')

  React.useEffect(() => { load() }, [status])

  async function load() {
    setLoading(true)
    try {
      const res = await listInvoices({
        invoice_type: 'invoice',
        status: status === 'all' ? undefined : status,
      })
      setInvoices(res.invoices)
      setKpi(res.kpi)
    } catch { toast.error('取得に失敗しました') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <PageHeader
        title="請求書"
        description={`${invoices.length}件`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link href="/invoices/new?type=invoice">
              <Button size="sm"><Plus className="h-4 w-4" /> 請求書を作成</Button>
            </Link>
          </div>
        }
      />

      {/* KPIサマリ */}
      {kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: '今月請求',   value: fmtMoney(kpi.total_billed),  color: '' },
            { label: '入金済み',   value: fmtMoney(kpi.total_paid),    color: 'text-[var(--color-success)]' },
            { label: '未収',       value: fmtMoney(kpi.total_unpaid),  color: 'text-[var(--color-warning)]' },
            { label: '期限超過',   value: `${kpi.invoices_overdue}件`, color: kpi.invoices_overdue > 0 ? 'text-[var(--color-error)]' : '' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
                <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* フィルター */}
      <div className="flex gap-3 mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {Object.entries(INVOICE_STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 一覧 */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : invoices.length === 0 ? (
        <Card><CardContent>
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            title="請求書がありません"
            description="見積書から請求書を作成できます"
          />
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const overdue = isOverdue(inv.due_date, inv.status)
            return (
              <Link key={inv.id} href={`/invoices/${inv.id}`}>
                <Card className={cn(
                  'hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer',
                  overdue && 'border-[var(--color-error)]/30'
                )}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-mono font-medium">{inv.invoice_number}</span>
                          <Badge variant={STATUS_VARIANT[inv.status] as any} size="sm">
                            {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                          </Badge>
                          {overdue && (
                            <span className="flex items-center gap-1 text-xs text-[var(--color-error)]">
                              <AlertCircle className="h-3 w-3" /> 期限超過
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-[var(--color-muted-foreground)]">
                            {inv.clients?.name ?? '—'}
                          </span>
                          {inv.title && (
                            <span className="text-xs text-[var(--color-muted-foreground)]">{inv.title}</span>
                          )}
                          <span className="text-xs text-[var(--color-muted-foreground)]">
                            発行: {fmtDate(inv.issue_date)}
                          </span>
                          {inv.due_date && (
                            <span className={cn(
                              'text-xs',
                              overdue ? 'text-[var(--color-error)]' : 'text-[var(--color-muted-foreground)]'
                            )}>
                              期限: {fmtDate(inv.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{fmtMoney(inv.total_amount)}</p>
                        {inv.paid_amount > 0 && (
                          <p className="text-xs text-[var(--color-success)]">
                            入金 {fmtMoney(inv.paid_amount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
