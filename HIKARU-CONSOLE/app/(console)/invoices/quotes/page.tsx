'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { Plus, FileSpreadsheet, Filter, RefreshCw } from 'lucide-react'
import {
  listInvoices, fmtDate, fmtMoney, QUOTE_STATUS_LABEL, STATUS_VARIANT,
  type InvoiceRow, type InvoiceKpi,
} from '@/services/invoices.service'

export default function QuotesPage() {
  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([])
  const [kpi,      setKpi]      = React.useState<InvoiceKpi | null>(null)
  const [loading,  setLoading]  = React.useState(true)
  const [status,   setStatus]   = React.useState('all')

  React.useEffect(() => { load() }, [status])

  async function load() {
    setLoading(true)
    try {
      const res = await listInvoices({
        invoice_type: 'quote',
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
        title="見積書"
        description={`${invoices.length}件`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link href="/invoices/new?type=quote">
              <Button size="sm"><Plus className="h-4 w-4" /> 見積書を作成</Button>
            </Link>
          </div>
        }
      />

      {/* KPIサマリ */}
      {kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: '下書き',   value: kpi.quotes_draft,  color: 'text-[var(--color-muted-foreground)]' },
            { label: '発行済み', value: kpi.quotes_issued, color: 'text-[var(--color-primary)]' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* フィルター */}
      <div className="flex gap-3 mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {Object.entries(QUOTE_STATUS_LABEL).map(([k, v]) => (
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
            icon={<FileSpreadsheet className="h-12 w-12" />}
            title="見積書がありません"
            description="案件から見積書を作成できます"
            action={<Link href="/invoices/new?type=quote"><Button size="sm"><Plus className="h-4 w-4" /> 作成</Button></Link>}
          />
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Link key={inv.id} href={`/invoices/${inv.id}`}>
              <Card className="hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-medium">{inv.invoice_number}</span>
                        <Badge variant={STATUS_VARIANT[inv.status] as any} size="sm">
                          {QUOTE_STATUS_LABEL[inv.status] ?? inv.status}
                        </Badge>
                        {inv.published_to_portal && (
                          <Badge variant="outline" size="sm">公開中</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {inv.clients?.name ?? '—'}
                        </span>
                        {inv.title && (
                          <span className="text-xs text-[var(--color-muted-foreground)]">
                            {inv.title}
                          </span>
                        )}
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          発行: {fmtDate(inv.issue_date)}
                        </span>
                        {inv.due_date && (
                          <span className="text-xs text-[var(--color-muted-foreground)]">
                            有効期限: {fmtDate(inv.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{fmtMoney(inv.total_amount)}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        税抜 {fmtMoney(inv.subtotal)}
                      </p>
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
