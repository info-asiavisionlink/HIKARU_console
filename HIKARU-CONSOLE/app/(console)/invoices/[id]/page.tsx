'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton, toast, Breadcrumb,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Input, Textarea, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import {
  ArrowLeft, FileText, Download, Send, CheckCircle, XCircle, Eye, Trash2,
  CreditCard, Globe, RefreshCw, FilePlus, AlertCircle, Edit3, Save, X as XIcon,
} from 'lucide-react'
import {
  getInvoice, changeInvoiceStatus, generatePdf, publishInvoice, convertToInvoice,
  recordPayment, deleteInvoice, updateInvoice,
  fmtDate, fmtMoney, QUOTE_STATUS_LABEL, INVOICE_STATUS_LABEL, STATUS_VARIANT, isOverdue,
  type InvoiceRow,
} from '@/services/invoices.service'
import { calcInvoice } from '@/lib/billing/calculator'
import { cn } from '@hikaru/ui'

export default function InvoiceDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const [inv,      setInv]      = React.useState<InvoiceRow | null>(null)
  const [loading,  setLoading]  = React.useState(true)
  const [acting,   setActing]   = React.useState(false)

  // 編集モード
  const [editing,  setEditing]  = React.useState(false)
  const [editNotes, setEditNotes] = React.useState('')
  const [editTitle, setEditTitle] = React.useState('')
  const [editDue,   setEditDue]   = React.useState('')

  // 入金ダイアログ
  const [payOpen,   setPayOpen]   = React.useState(false)
  const [payAmount, setPayAmount] = React.useState('')
  const [payDate,   setPayDate]   = React.useState(new Date().toISOString().split('T')[0])
  const [payMethod, setPayMethod] = React.useState('bank_transfer')
  const [payNotes,  setPayNotes]  = React.useState('')

  // 請求書変換ダイアログ
  const [convOpen,  setConvOpen]  = React.useState(false)
  const [convDate,  setConvDate]  = React.useState(new Date().toISOString().split('T')[0])
  const [convDue,   setConvDue]   = React.useState('')

  // キャンセルダイアログ
  const [cancelOpen,   setCancelOpen]   = React.useState(false)
  const [cancelReason, setCancelReason] = React.useState('')

  // PDF
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)

  React.useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    try {
      const data = await getInvoice(id)
      setInv(data)
      setEditNotes(data.notes ?? '')
      setEditTitle(data.title ?? '')
      setEditDue(data.due_date ?? '')
    } catch { toast.error('取得に失敗しました') }
    finally { setLoading(false) }
  }

  async function act(fn: () => Promise<void>) {
    setActing(true)
    try { await fn() } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'エラー') }
    finally { setActing(false) }
  }

  async function handleStatus(status: string) {
    await act(async () => {
      await changeInvoiceStatus(id, status)
      toast.success('ステータスを変更しました')
      await load()
    })
  }

  async function handleCancel() {
    if (!cancelReason.trim()) { toast.error('キャンセル理由を入力してください'); return }
    await act(async () => {
      await changeInvoiceStatus(id, 'cancelled', cancelReason)
      toast.success('キャンセルしました')
      setCancelOpen(false)
      await load()
    })
  }

  async function handlePdf() {
    await act(async () => {
      const res = await generatePdf(id)
      setPdfUrl(res.signed_url)
      toast.success('PDFを生成しました')
      await load()
    })
  }

  async function handlePublish() {
    await act(async () => {
      await publishInvoice(id)
      toast.success('顧客ポータルへ公開しました')
      await load()
    })
  }

  async function handleConvert() {
    await act(async () => {
      const invoice = await convertToInvoice(id, { issue_date: convDate, due_date: convDue || undefined })
      toast.success('請求書に変換しました')
      setConvOpen(false)
      router.push(`/invoices/${invoice.id}`)
    })
  }

  async function handlePayment() {
    const amount = Number(payAmount)
    if (!amount || amount <= 0) { toast.error('金額を入力してください'); return }
    await act(async () => {
      await recordPayment(id, {
        amount,
        paid_at: payDate,
        payment_method: payMethod,
        notes: payNotes || undefined,
      })
      toast.success('入金を記録しました')
      setPayOpen(false)
      setPayAmount('')
      setPayNotes('')
      await load()
    })
  }

  async function handleSaveEdit() {
    await act(async () => {
      await updateInvoice(id, {
        title:    editTitle || null,
        notes:    editNotes || null,
        due_date: editDue   || null,
      })
      toast.success('保存しました')
      setEditing(false)
      await load()
    })
  }

  async function handleDelete() {
    if (!confirm('この見積書/請求書を削除しますか？')) return
    await act(async () => {
      await deleteInvoice(id)
      toast.success('削除しました')
      router.back()
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (!inv) return <div className="text-sm text-[var(--color-muted-foreground)]">見つかりません</div>

  const isQuote    = inv.invoice_type === 'quote'
  const statusLbl  = isQuote ? QUOTE_STATUS_LABEL : INVOICE_STATUS_LABEL
  const over       = isOverdue(inv.due_date, inv.status)
  const isDraft    = inv.status === 'draft'
  const isIssued   = inv.status === 'issued'
  const isCancelled = inv.status === 'cancelled'
  const remaining  = inv.total_amount - inv.paid_amount
  const items      = (inv.invoice_items ?? []).sort((a, b) => a.order_num - b.order_num)

  return (
    <div>
      <Breadcrumb items={[
        { label: isQuote ? '見積書' : '請求書', href: isQuote ? '/invoices/quotes' : '/invoices/bills' },
        { label: inv.invoice_number },
      ]} />

      <PageHeader
        title={inv.invoice_number}
        description={inv.title ?? (isQuote ? '見積書' : '請求書')}
        actions={
          <div className="flex gap-2 flex-wrap">
            {/* 編集 */}
            {!isCancelled && (
              editing ? (
                <>
                  <Button size="sm" onClick={handleSaveEdit} loading={acting}><Save className="h-4 w-4" /> 保存</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}><XIcon className="h-4 w-4" /></Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit3 className="h-4 w-4" /> 編集</Button>
              )
            )}

            {/* PDF生成 */}
            <Button size="sm" variant="outline" onClick={handlePdf} loading={acting} disabled={acting}>
              <FileText className="h-4 w-4" /> PDF生成
            </Button>
            {(inv.pdf_path || pdfUrl) && (
              <a href={pdfUrl ?? '#'} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline"><Download className="h-4 w-4" /> PDF</Button>
              </a>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* メイン */}
        <div className="lg:col-span-2 space-y-4">

          {/* ステータス帯 */}
          <Card className={cn(over && 'border-[var(--color-error)]/40')}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={STATUS_VARIANT[inv.status] as any}>
                  {statusLbl[inv.status] ?? inv.status}
                </Badge>
                {over && (
                  <span className="flex items-center gap-1 text-sm text-[var(--color-error)] font-medium">
                    <AlertCircle className="h-4 w-4" /> 支払期限超過
                  </span>
                )}
                {inv.published_to_portal && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Globe className="h-3 w-3" /> 顧客ポータル公開中
                  </Badge>
                )}
              </div>

              {/* アクションボタン群 */}
              <div className="flex gap-2 flex-wrap mt-3">
                {isDraft && (
                  <Button size="sm" onClick={() => handleStatus('issued')} loading={acting}>
                    <Send className="h-4 w-4" /> 発行する
                  </Button>
                )}
                {isQuote && isIssued && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleStatus('accepted')} loading={acting}>
                      <CheckCircle className="h-4 w-4" /> 承認
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleStatus('rejected')} loading={acting}>
                      <XCircle className="h-4 w-4" /> 却下
                    </Button>
                    <Button size="sm" onClick={() => setConvOpen(true)}>
                      <FilePlus className="h-4 w-4" /> 請求書に変換
                    </Button>
                  </>
                )}
                {isQuote && inv.status === 'accepted' && (
                  <Button size="sm" onClick={() => setConvOpen(true)}>
                    <FilePlus className="h-4 w-4" /> 請求書に変換
                  </Button>
                )}
                {!isQuote && isIssued && (
                  <Button size="sm" variant="outline" onClick={() => handleStatus('sent')} loading={acting}>
                    <Send className="h-4 w-4" /> 送付済みにする
                  </Button>
                )}
                {!isQuote && ['sent','awaiting_payment','overdue'].includes(inv.status) && (
                  <Button size="sm" onClick={() => {
                    setPayAmount(String(remaining))
                    setPayOpen(true)
                  }}>
                    <CreditCard className="h-4 w-4" /> 入金登録
                  </Button>
                )}
                {!inv.published_to_portal && !isDraft && !isCancelled && (
                  <Button size="sm" variant="outline" onClick={handlePublish} loading={acting}>
                    <Globe className="h-4 w-4" /> 顧客へ公開
                  </Button>
                )}
                {!isCancelled && (
                  <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)} className="text-[var(--color-error)]">
                    <XCircle className="h-4 w-4" /> キャンセル
                  </Button>
                )}
                {isDraft && (
                  <Button size="sm" variant="outline" onClick={handleDelete} className="text-[var(--color-error)]">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ヘッダー情報 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">書類情報</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <DRow label="書類番号"   value={inv.invoice_number} />
                <DRow label="種別"       value={isQuote ? '見積書' : '請求書'} />
                <DRow label="発行日"     value={fmtDate(inv.issue_date)} />
                <DRow label={isQuote ? '有効期限' : '支払期限'} value={fmtDate(inv.due_date)} highlight={over} />
                {inv.billing_period_from && (
                  <DRow label="請求対象期間" value={`${fmtDate(inv.billing_period_from)} 〜 ${fmtDate(inv.billing_period_to)}`} />
                )}
                {inv.converted_from_id && (
                  <DRow label="元の見積書" value="見積書から変換" />
                )}
              </div>
              {editing && (
                <div className="space-y-3 border-t pt-3">
                  <Input label="タイトル" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                  <Input label={isQuote ? '有効期限' : '支払期限'} type="date" value={editDue} onChange={e => setEditDue(e.target.value)} />
                  <Textarea label="備考（顧客に表示）" value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} />
                </div>
              )}
              {!editing && inv.notes && (
                <div className="border-t pt-3">
                  <p className="text-xs text-[var(--color-muted-foreground)] mb-1">備考</p>
                  <p className="text-sm whitespace-pre-wrap">{inv.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 明細 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-4">明細</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="text-left py-2 px-2 text-xs font-medium text-[var(--color-muted-foreground)]">内容</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-[var(--color-muted-foreground)]">数量</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-[var(--color-muted-foreground)]">単価</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-[var(--color-muted-foreground)]">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={item.id} className="border-b border-[var(--color-border)]/50 last:border-0">
                        <td className="py-2.5 px-2">{item.description}</td>
                        <td className="py-2.5 px-2 text-right text-[var(--color-muted-foreground)]">
                          {item.quantity}{item.unit ?? ''}
                        </td>
                        <td className="py-2.5 px-2 text-right">{fmtMoney(item.unit_price)}</td>
                        <td className="py-2.5 px-2 text-right font-medium">{fmtMoney(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 合計 */}
              <div className="flex flex-col items-end gap-1.5 mt-4 pt-4 border-t border-[var(--color-border)]">
                <TotalRow label="税抜合計" value={fmtMoney(inv.subtotal)} />
                <TotalRow label={`消費税 (${Math.round(inv.tax_rate * 100)}%)`} value={fmtMoney(inv.tax_amount)} />
                <div className="flex items-center justify-between w-48 bg-[var(--color-muted)] rounded px-3 py-2 mt-1">
                  <span className="text-sm font-bold">税込合計</span>
                  <span className="text-lg font-bold">{fmtMoney(inv.total_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 入金履歴 */}
          {!isQuote && (inv.invoice_payments?.length ?? 0) > 0 && (
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-4">入金履歴</h2>
                <div className="space-y-2">
                  {inv.invoice_payments!.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)]/50 last:border-0">
                      <div>
                        <p className="text-sm">{fmtDate(p.paid_at)}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {p.payment_method === 'bank_transfer' ? '銀行振込' :
                           p.payment_method === 'cash'          ? '現金'     :
                           p.payment_method === 'credit_card'   ? 'カード'   : p.payment_method ?? '—'}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-[var(--color-success)]">{fmtMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between mt-3 pt-3 border-t">
                    <span className="text-sm text-[var(--color-muted-foreground)]">未収残高</span>
                    <span className="text-sm font-bold text-[var(--color-warning)]">{fmtMoney(remaining)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* サイドバー */}
        <div className="space-y-4">
          {/* 顧客情報 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">請求先</h2>
              <DRow label="会社名" value={inv.clients?.name} />
              <DRow label="担当者" value={inv.clients?.contact_name} />
              <DRow label="電話"   value={inv.clients?.phone} />
              <DRow label="メール" value={inv.clients?.email} />
              {inv.clients?.id && (
                <Link href={`/clients/${inv.clients.id}`}>
                  <Button variant="ghost" size="sm" className="mt-2">顧客詳細を見る</Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* 案件情報 */}
          {inv.projects && (
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">関連案件</h2>
                <DRow label="案件名" value={inv.projects.name} />
                <DRow label="種別"   value={
                  inv.projects.project_type === 'spot' ? '単発' :
                  inv.projects.project_type === 'recurring' ? '定期' : 'ホテル'
                } />
                <DRow label="場所"   value={inv.projects.location_name} />
                <Link href={`/projects/${inv.project_id}`}>
                  <Button variant="ghost" size="sm" className="mt-2">案件詳細を見る</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* 監査 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">監査情報</h2>
              <DRow label="作成者"   value={inv.creator?.name} />
              <DRow label="作成日時" value={inv.created_at ? new Date(inv.created_at).toLocaleString('ja-JP') : undefined} />
              {inv.issuer && <DRow label="発行者" value={inv.issuer.name} />}
              {inv.issued_at && <DRow label="発行日時" value={new Date(inv.issued_at).toLocaleString('ja-JP')} />}
              {inv.published_by && <DRow label="公開者" value={(inv as any).publisher?.name} />}
              {inv.cancelled_by && (
                <>
                  <DRow label="キャンセル" value={(inv as any).canceller?.name} />
                  {inv.cancel_reason && <DRow label="理由" value={inv.cancel_reason} />}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 入金ダイアログ */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>入金登録</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <Input
              label="入金額 (円)"
              type="number"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              placeholder="0"
            />
            <Input
              label="入金日"
              type="date"
              value={payDate}
              onChange={e => setPayDate(e.target.value)}
            />
            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">銀行振込</SelectItem>
                <SelectItem value="cash">現金</SelectItem>
                <SelectItem value="credit_card">クレジットカード</SelectItem>
                <SelectItem value="other">その他</SelectItem>
              </SelectContent>
            </Select>
            <Input label="メモ（任意）" value={payNotes} onChange={e => setPayNotes(e.target.value)} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>キャンセル</Button>
            <Button onClick={handlePayment} loading={acting}>登録する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 請求書変換ダイアログ */}
      <Dialog open={convOpen} onOpenChange={setConvOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>請求書に変換</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              見積書の金額をそのまま引き継いだ請求書を作成します。
            </p>
            <Input
              label="請求書発行日"
              type="date"
              value={convDate}
              onChange={e => setConvDate(e.target.value)}
            />
            <Input
              label="支払期限"
              type="date"
              value={convDue}
              onChange={e => setConvDue(e.target.value)}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvOpen(false)}>キャンセル</Button>
            <Button onClick={handleConvert} loading={acting}>変換する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* キャンセルダイアログ */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>キャンセル</DialogTitle></DialogHeader>
          <DialogBody>
            <Textarea
              label="キャンセル理由"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              placeholder="キャンセル理由を入力してください"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>戻る</Button>
            <Button onClick={handleCancel} loading={acting} className="bg-[var(--color-error)]">キャンセルする</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DRow({ label, value, highlight = false }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <div className="py-1.5 border-b border-[var(--color-border)]/50 last:border-0">
      <dt className="text-xs text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={cn('text-sm mt-0.5', highlight && 'text-[var(--color-error)] font-medium')}>{value || '—'}</dd>
    </div>
  )
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between w-48 gap-4">
      <span className="text-xs text-[var(--color-muted-foreground)]">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}
