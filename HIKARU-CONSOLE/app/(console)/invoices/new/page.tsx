'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, Input, Textarea, Breadcrumb, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { calcInvoice, type LineItem } from '@/lib/billing/calculator'
import { createInvoice, fmtMoney } from '@/services/invoices.service'
import { cn } from '@hikaru/ui'

// 月名ラベル
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

interface ProjectPrice {
  id:            string
  period_month:  number | null
  amount_ex_tax: number
  unit_price:    number | null
  quantity:      number | null
  unit_label?:   string | null
}

interface ProjectOption {
  id:           string
  name:         string
  project_type: 'spot' | 'recurring' | 'hotel'
  client_id:    string
}

interface ClientOption { id: string; name: string }

function NewInvoiceContent() {
  const router     = useRouter()
  const sp         = useSearchParams()
  const initType   = (sp.get('type') ?? 'quote') as 'quote' | 'invoice'
  const initProject = sp.get('project_id') ?? ''

  const [invoiceType, setInvoiceType] = React.useState<'quote' | 'invoice'>(initType)
  const [clients,     setClients]     = React.useState<ClientOption[]>([])
  const [projects,    setProjects]    = React.useState<ProjectOption[]>([])
  const [prices,      setPrices]      = React.useState<ProjectPrice[]>([])

  const [clientId,   setClientId]   = React.useState('')
  const [projectId,  setProjectId]  = React.useState(initProject)
  const [projectType, setProjectType] = React.useState<'spot'|'recurring'|'hotel'>('spot')
  const [periodMonth, setPeriodMonth] = React.useState<string>('')
  const [issueDate,   setIssueDate]   = React.useState(new Date().toISOString().split('T')[0])
  const [dueDate,     setDueDate]     = React.useState('')
  const [title,       setTitle]       = React.useState('')
  const [notes,       setNotes]       = React.useState('')
  const [taxRate,     setTaxRate]     = React.useState(10)
  const [items,       setItems]       = React.useState<LineItem[]>([
    { description: '', quantity: 1, unit: '式', unit_price: 0, order_num: 0 },
  ])
  const [saving,    setSaving]    = React.useState(false)
  const [autoFilled, setAutoFilled] = React.useState(false)

  React.useEffect(() => { fetchClients() }, [])
  React.useEffect(() => {
    if (clientId) fetchProjects(clientId)
    else { setProjects([]); setProjectId(''); setPrices([]) }
  }, [clientId])
  React.useEffect(() => {
    if (projectId) fetchPrices(projectId)
    else { setPrices([]); setAutoFilled(false) }
  }, [projectId])

  async function fetchClients() {
    const res = await fetch('/api/clients', { credentials: 'include' })
    if (res.ok) setClients((await res.json()).clients ?? [])
  }
  async function fetchProjects(cId: string) {
    const res = await fetch(`/api/projects?client_id=${cId}&pageSize=100`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setProjects(data.projects ?? [])
    }
  }
  async function fetchPrices(pId: string) {
    const proj = projects.find(p => p.id === pId)
    if (proj) {
      setProjectType(proj.project_type)
      setClientId(proj.client_id)
    }
    const res = await fetch(`/api/projects/${pId}/pricing`, { credentials: 'include' }).catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      setPrices(data.prices ?? [])
    }
  }

  // 案件単価から自動入力
  function autoFillFromPrice(price: ProjectPrice) {
    const proj  = projects.find(p => p.id === projectId)
    const pName = proj?.name ?? ''
    const pType = proj?.project_type ?? 'spot'

    let desc = `清掃費 ${pName}`
    if (price.period_month) {
      const year = new Date(issueDate).getFullYear()
      desc += ` ${year}年${price.period_month}月分`
    }

    if (pType === 'hotel' && price.unit_price && price.quantity) {
      setItems([{
        description: desc,
        quantity:    price.quantity,
        unit:        price.unit_label?.trim() || '室',
        unit_price:  price.unit_price,
        source_type: 'project_price',
        source_id:   price.id,
        order_num:   0,
      }])
    } else {
      setItems([{
        description: desc,
        quantity:    1,
        unit:        '式',
        unit_price:  price.amount_ex_tax,
        source_type: 'project_price',
        source_id:   price.id,
        order_num:   0,
      }])
    }
    if (!title) setTitle(desc)
    setAutoFilled(true)
  }

  function addItem() {
    setItems(prev => [...prev, {
      description: '', quantity: 1, unit: '式', unit_price: 0,
      order_num: prev.length,
    }])
  }
  function updateItem(idx: number, key: keyof LineItem, val: unknown) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  }
  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const calc = calcInvoice(items.filter(i => i.description), taxRate / 100)

  async function handleSubmit() {
    if (!clientId) { toast.error('顧客を選択してください'); return }
    if (items.filter(i => i.description).length === 0) { toast.error('明細を1件以上入力してください'); return }

    setSaving(true)
    try {
      const invoice = await createInvoice({
        invoice_type:     invoiceType,
        client_id:        clientId,
        project_id:       projectId || null,
        project_type:     projectType,
        tax_rate:         taxRate / 100,
        issue_date:       issueDate,
        due_date:         dueDate || null,
        title:            title || null,
        notes:            notes || null,
        period_month:     periodMonth ? Number(periodMonth) : null,
        items:            items.filter(i => i.description).map((it, i) => ({
          ...it, order_num: i,
        })),
      })
      toast.success(`${invoiceType === 'quote' ? '見積書' : '請求書'}を作成しました`)
      router.push(`/invoices/${invoice.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const filteredPrices = React.useMemo(() => {
    if (!periodMonth) return prices
    return prices.filter(p => p.period_month == null || p.period_month === Number(periodMonth))
  }, [prices, periodMonth])

  return (
    <div className="p-6">
      <Breadcrumb items={[
        { label: invoiceType === 'quote' ? '見積書' : '請求書', href: invoiceType === 'quote' ? '/invoices/quotes' : '/invoices/bills' },
        { label: '新規作成' },
      ]} />

      <PageHeader
        title={`${invoiceType === 'quote' ? '見積書' : '請求書'}を作成`}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> 戻る
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          {/* 基本情報 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">基本情報</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--color-muted-foreground)] mb-1 block">種別</label>
                  <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quote">見積書</SelectItem>
                      <SelectItem value="invoice">請求書</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-muted-foreground)] mb-1 block">消費税率 (%)</label>
                  <Select value={String(taxRate)} onValueChange={(v) => setTaxRate(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="8">8%（軽減税率）</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="発行日" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                <Input
                  label={invoiceType === 'quote' ? '有効期限' : '支払期限'}
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>

              <Input label="タイトル（任意）" value={title} onChange={e => setTitle(e.target.value)} placeholder="例: 定期清掃 2026年8月分" />
            </CardContent>
          </Card>

          {/* 顧客・案件 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">顧客・案件</h2>

              <div>
                <label className="text-xs text-[var(--color-muted-foreground)] mb-1 block">顧客 *</label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="顧客を選択" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {clientId && (
                <div>
                  <label className="text-xs text-[var(--color-muted-foreground)] mb-1 block">案件（任意）</label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger><SelectValue placeholder="案件を選択（任意）" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">選択しない</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.project_type === 'spot' ? '単発' : p.project_type === 'recurring' ? '定期' : 'ホテル'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 定期案件の対象月 */}
              {projectType === 'recurring' && projectId && (
                <div>
                  <label className="text-xs text-[var(--color-muted-foreground)] mb-1 block">請求対象月</label>
                  <Select value={periodMonth} onValueChange={setPeriodMonth}>
                    <SelectTrigger><SelectValue placeholder="月を選択" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">指定なし</SelectItem>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 案件単価から自動入力 */}
              {filteredPrices.length > 0 && (
                <div className="border rounded-[var(--radius-md)] p-3 bg-[var(--color-muted)]/30">
                  <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-2">案件単価から明細を自動入力</p>
                  <div className="flex flex-wrap gap-2">
                    {filteredPrices.map((price) => (
                      <Button
                        key={price.id}
                        size="sm"
                        variant="outline"
                        onClick={() => autoFillFromPrice(price)}
                      >
                        {price.period_month ? `${price.period_month}月: ` : ''}
                        {fmtMoney(price.amount_ex_tax)} (税抜)
                        {price.unit_price && price.quantity ? ` / ${price.quantity}${price.unit_label?.trim() || '室'}×${fmtMoney(price.unit_price)}` : ''}
                      </Button>
                    ))}
                  </div>
                  {autoFilled && (
                    <p className="text-xs text-[var(--color-success)] mt-2">✓ 案件単価から明細を入力しました（手動で編集できます）</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 明細 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">明細</h2>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4" /> 行を追加
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      {idx === 0 && <label className="text-xs text-[var(--color-muted-foreground)] block mb-1">内容</label>}
                      <Input
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                        placeholder="清掃費"
                      />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <label className="text-xs text-[var(--color-muted-foreground)] block mb-1">数量</label>}
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                      />
                    </div>
                    <div className="col-span-1">
                      {idx === 0 && <label className="text-xs text-[var(--color-muted-foreground)] block mb-1">単位</label>}
                      <Input
                        value={item.unit ?? ''}
                        onChange={e => updateItem(idx, 'unit', e.target.value)}
                        placeholder="式"
                      />
                    </div>
                    <div className="col-span-3">
                      {idx === 0 && <label className="text-xs text-[var(--color-muted-foreground)] block mb-1">単価 (税抜)</label>}
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end pb-0.5">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="p-1.5 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 合計プレビュー */}
              <div className="flex flex-col items-end gap-1 mt-4 pt-4 border-t border-[var(--color-border)]">
                <div className="flex justify-between w-44 text-sm">
                  <span className="text-[var(--color-muted-foreground)]">税抜合計</span>
                  <span>{fmtMoney(calc.subtotal)}</span>
                </div>
                <div className="flex justify-between w-44 text-sm">
                  <span className="text-[var(--color-muted-foreground)]">消費税 ({taxRate}%)</span>
                  <span>{fmtMoney(calc.tax_amount)}</span>
                </div>
                <div className="flex justify-between w-44 bg-[var(--color-muted)] rounded px-3 py-2 mt-1">
                  <span className="font-bold">税込合計</span>
                  <span className="font-bold text-lg">{fmtMoney(calc.total_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 備考 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <Textarea
                label="備考（顧客に表示）"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="お支払い方法: 銀行振込&#10;振込先: ○○銀行 ○○支店 普通 1234567"
              />
            </CardContent>
          </Card>

          <Button onClick={handleSubmit} loading={saving} className="w-full">
            {invoiceType === 'quote' ? '見積書を作成' : '請求書を作成'}
          </Button>
        </div>

        {/* サイドプレビュー */}
        <div>
          <Card className="sticky top-20">
            <CardContent className="pt-5 pb-4 px-5">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-4">プレビュー</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted-foreground)]">種別</span>
                  <span>{invoiceType === 'quote' ? '見積書' : '請求書'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted-foreground)]">顧客</span>
                  <span>{clients.find(c => c.id === clientId)?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted-foreground)]">案件</span>
                  <span className="text-right max-w-[60%] truncate">{projects.find(p => p.id === projectId)?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted-foreground)]">発行日</span>
                  <span>{issueDate}</span>
                </div>
                <div className="border-t pt-2 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted-foreground)]">税抜</span>
                    <span>{fmtMoney(calc.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted-foreground)]">税額</span>
                    <span>{fmtMoney(calc.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>合計</span>
                    <span>{fmtMoney(calc.total_amount)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function NewInvoicePage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-[var(--color-muted-foreground)]">読み込み中...</div>}>
      <NewInvoiceContent />
    </React.Suspense>
  )
}
