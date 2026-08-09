'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton, toast,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { CreditCard, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import {
  listInvoices, fmtDate, fmtMoney, INVOICE_STATUS_LABEL, STATUS_VARIANT, isOverdue,
  type InvoiceRow,
} from '@/services/invoices.service'
import { cn } from '@hikaru/ui'

export default function PaymentsPage() {
  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([])
  const [loading,  setLoading]  = React.useState(true)

  React.useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // 入金関係のステータスのみ（awaiting_payment, overdue, paid）
      const results = await Promise.all([
        listInvoices({ invoice_type: 'invoice', status: 'awaiting_payment' }),
        listInvoices({ invoice_type: 'invoice', status: 'overdue' }),
        listInvoices({ invoice_type: 'invoice', status: 'paid' }),
      ])
      // 未払い優先、次に入金済み
      const all = [
        ...results[0].invoices,
        ...results[1].invoices,
        ...results[2].invoices,
      ]
      setInvoices(all)
    } catch { toast.error('取得に失敗しました') }
    finally { setLoading(false) }
  }

  const unpaid  = invoices.filter(i => ['awaiting_payment','overdue'].includes(i.status))
  const paid    = invoices.filter(i => i.status === 'paid')
  const overdue = unpaid.filter(i => isOverdue(i.due_date, i.status))

  const totalUnpaid = unpaid.reduce((s, i) => s + (i.total_amount - i.paid_amount), 0)
  const totalPaid   = paid.reduce((s, i) => s + i.total_amount, 0)

  return (
    <div>
      <PageHeader
        title="入金管理"
        description="請求書の入金状況を管理します"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      {/* サマリ */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Card><CardContent className="py-3 px-4">
            <p className="text-xs text-[var(--color-muted-foreground)]">未収</p>
            <p className="text-lg font-bold text-[var(--color-warning)]">{fmtMoney(totalUnpaid)}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4">
            <p className="text-xs text-[var(--color-muted-foreground)]">期限超過</p>
            <p className={cn('text-lg font-bold', overdue.length > 0 ? 'text-[var(--color-error)]' : '')}>
              {overdue.length}件
            </p>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4">
            <p className="text-xs text-[var(--color-muted-foreground)]">入金済み</p>
            <p className="text-lg font-bold text-[var(--color-success)]">{fmtMoney(totalPaid)}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4">
            <p className="text-xs text-[var(--color-muted-foreground)]">件数</p>
            <p className="text-lg font-bold">{unpaid.length}件</p>
          </CardContent></Card>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : invoices.length === 0 ? (
        <Card><CardContent>
          <EmptyState
            icon={<CreditCard className="h-12 w-12" />}
            title="入金管理対象の請求書がありません"
            description="請求書を発行すると入金管理できます"
          />
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {/* 未払い */}
          {unpaid.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[var(--color-warning)]" /> 未収 ({unpaid.length}件)
              </h3>
              <div className="space-y-2">
                {unpaid.map((inv) => {
                  const over = isOverdue(inv.due_date, inv.status)
                  const remaining = inv.total_amount - inv.paid_amount
                  return (
                    <Link key={inv.id} href={`/invoices/${inv.id}`}>
                      <Card className={cn(
                        'hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer',
                        over && 'border-[var(--color-error)]/30'
                      )}>
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-mono">{inv.invoice_number}</span>
                                <Badge variant={STATUS_VARIANT[inv.status] as any} size="sm">
                                  {INVOICE_STATUS_LABEL[inv.status]}
                                </Badge>
                                {over && <span className="text-xs text-[var(--color-error)] font-medium">期限超過</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-xs text-[var(--color-muted-foreground)]">
                                  {inv.clients?.name ?? '—'}
                                </span>
                                <span className={cn(
                                  'text-xs',
                                  over ? 'text-[var(--color-error)]' : 'text-[var(--color-muted-foreground)]'
                                )}>
                                  期限: {fmtDate(inv.due_date)}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold">{fmtMoney(remaining)}</p>
                              <p className="text-xs text-[var(--color-muted-foreground)]">
                                請求 {fmtMoney(inv.total_amount)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* 入金済み */}
          {paid.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[var(--color-success)]" /> 入金済み ({paid.length}件)
              </h3>
              <div className="space-y-2">
                {paid.map((inv) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`}>
                    <Card className="hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer opacity-70">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono">{inv.invoice_number}</span>
                              <Badge variant="success" size="sm">入金済み</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-[var(--color-muted-foreground)]">{inv.clients?.name ?? '—'}</span>
                              <span className="text-xs text-[var(--color-muted-foreground)]">
                                入金: {fmtDate(inv.paid_at)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-[var(--color-success)] shrink-0">
                            {fmtMoney(inv.total_amount)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
