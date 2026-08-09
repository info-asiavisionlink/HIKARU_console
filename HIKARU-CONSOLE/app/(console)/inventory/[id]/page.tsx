'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton, toast, Breadcrumb, Input, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import {
  ArrowLeft, Edit3, Save, X as XIcon, TrendingUp, TrendingDown, SlidersHorizontal,
  History, RefreshCw, Package, AlertTriangle,
} from 'lucide-react'
import {
  calculateStockStatus, CATEGORY_LABELS, STATUS_CONFIG, fmtQty, fmtMoney, fmtDate, TRANSACTION_TYPE_LABELS,
  type StockStatus,
} from '@/lib/inventory/service'
import { cn } from '@hikaru/ui'

interface InventoryItem {
  id: string; name: string; category: string; unit: string
  unit_price: number | null; stock_quantity: number; min_stock: number
  storage_location: string | null; supplier_name: string | null
  supplier_contact: string | null; supplier_email: string | null
  barcode: string | null; notes: string | null; is_active: boolean
  created_at: string; updated_at: string
}

interface TxRow {
  id: string; transaction_type: string; quantity: number; reason: string | null
  supplier_name: string | null; notes: string | null; performed_at: string
  performer:  { id: string; name: string } | null
  projects:   { id: string; name: string } | null
  shifts:     { id: string; shift_date: string } | null
  jobs:       { id: string; work_date: string } | null
}

export default function InventoryItemPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [item,   setItem]   = React.useState<InventoryItem | null>(null)
  const [txs,    setTxs]    = React.useState<TxRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [acting,  setActing]  = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [form,    setForm]    = React.useState<Partial<InventoryItem>>({})

  // 入庫ダイアログ
  const [inOpen,   setInOpen]   = React.useState(false)
  const [inQty,    setInQty]    = React.useState('')
  const [inSupplier, setInSupplier] = React.useState('')
  const [inNotes,  setInNotes]  = React.useState('')

  // 出庫ダイアログ
  const [outOpen,   setOutOpen]   = React.useState(false)
  const [outQty,    setOutQty]    = React.useState('')
  const [outReason, setOutReason] = React.useState('')
  const [outProject, setOutProject] = React.useState('')
  const [outNotes,  setOutNotes]  = React.useState('')

  // 調整ダイアログ
  const [adjOpen,   setAdjOpen]   = React.useState(false)
  const [adjQty,    setAdjQty]    = React.useState('')
  const [adjReason, setAdjReason] = React.useState('')

  React.useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    try {
      const [itemRes, txRes] = await Promise.all([
        fetch(`/api/inventory/${id}`, { credentials: 'include' }),
        fetch(`/api/inventory/${id}/transactions?limit=30`, { credentials: 'include' }),
      ])
      if (itemRes.ok) {
        const data = await itemRes.json()
        setItem(data.item)
        setForm(data.item)
      }
      if (txRes.ok) {
        const data = await txRes.json()
        setTxs(data.transactions ?? [])
      }
    } catch { toast.error('取得に失敗しました') }
    finally { setLoading(false) }
  }

  async function act(fn: () => Promise<void>) {
    setActing(true)
    try { await fn() } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'エラー') }
    finally { setActing(false) }
  }

  async function handleSaveEdit() {
    await act(async () => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('保存しました')
      setEditing(false)
      load()
    })
  }

  async function handleIn() {
    if (!inQty || Number(inQty) <= 0) { toast.error('数量を入力してください'); return }
    await act(async () => {
      const res = await fetch(`/api/inventory/${id}/in`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(inQty), supplier_name: inSupplier || undefined, notes: inNotes || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('入庫しました')
      setInOpen(false); setInQty(''); setInSupplier(''); setInNotes('')
      load()
    })
  }

  async function handleOut() {
    if (!outQty || Number(outQty) <= 0) { toast.error('数量を入力してください'); return }
    await act(async () => {
      const res = await fetch(`/api/inventory/${id}/out`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(outQty), reason: outReason || undefined, project_id: outProject || undefined, notes: outNotes || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('出庫しました')
      setOutOpen(false); setOutQty(''); setOutReason(''); setOutProject(''); setOutNotes('')
      load()
    })
  }

  async function handleAdj() {
    if (!adjQty || Number(adjQty) === 0) { toast.error('調整量を入力してください（例: -2 または 3）'); return }
    if (!adjReason.trim()) { toast.error('調整理由は必須です'); return }
    await act(async () => {
      const res = await fetch(`/api/inventory/${id}/adjust`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment_quantity: Number(adjQty), reason: adjReason.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('在庫調整しました')
      setAdjOpen(false); setAdjQty(''); setAdjReason('')
      load()
    })
  }

  async function handleDeactivate() {
    if (!confirm('この商品を無効化しますか？')) return
    await act(async () => {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('無効化しました')
      router.push('/inventory')
    })
  }

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
  if (!item)   return <div className="text-sm text-[var(--color-muted-foreground)]">商品が見つかりません</div>

  const status   = calculateStockStatus(item.stock_quantity, item.min_stock, item.is_active)
  const cfg      = STATUS_CONFIG[status]
  const invValue = item.unit_price != null ? item.stock_quantity * item.unit_price : null

  return (
    <div>
      <Breadcrumb items={[{ label: '在庫管理', href: '/inventory' }, { label: item.name }]} />

      <PageHeader
        title={item.name}
        description={CATEGORY_LABELS[item.category] ?? item.category}
        actions={
          <div className="flex gap-2 flex-wrap">
            {item.is_active && (
              <>
                {editing ? (
                  <>
                    <Button size="sm" onClick={handleSaveEdit} loading={acting}><Save className="h-4 w-4" /> 保存</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}><XIcon className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit3 className="h-4 w-4" /> 編集</Button>
                )}
                <Button size="sm" onClick={() => setInOpen(true)}>
                  <TrendingUp className="h-4 w-4" /> 入庫
                </Button>
                <Button size="sm" variant="outline" onClick={() => setOutOpen(true)}>
                  <TrendingDown className="h-4 w-4" /> 出庫
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAdjOpen(true)}>
                  <SlidersHorizontal className="h-4 w-4" /> 調整
                </Button>
                <Button size="sm" variant="outline" onClick={handleDeactivate} className="text-[var(--color-error)]">
                  無効化
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          {/* 在庫ステータス */}
          <Card className={cn(
            status === 'out_of_stock' && 'border-[var(--color-error)]/40',
            status === 'low_stock'    && 'border-[var(--color-warning)]/30',
          )}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-center">
                  <p className="text-xs text-[var(--color-muted-foreground)]">現在在庫</p>
                  <p className="text-3xl font-bold mt-1">{fmtQty(item.stock_quantity, item.unit)}</p>
                </div>
                {item.min_stock > 0 && (
                  <div className="text-center">
                    <p className="text-xs text-[var(--color-muted-foreground)]">最低在庫</p>
                    <p className="text-lg font-medium mt-1 text-[var(--color-muted-foreground)]">{fmtQty(item.min_stock, item.unit)}</p>
                  </div>
                )}
                {invValue != null && (
                  <div className="text-center">
                    <p className="text-xs text-[var(--color-muted-foreground)]">在庫金額（参考）</p>
                    <p className="text-lg font-medium mt-1">{fmtMoney(invValue)}</p>
                  </div>
                )}
                <Badge variant={cfg.variant as any}>{cfg.label}</Badge>
                {(status === 'low_stock' || status === 'out_of_stock') && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
                    <span className="text-[var(--color-warning)]">補充を検討してください</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 商品情報（編集可能） */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">商品情報</h2>
              {editing ? (
                <div className="space-y-3">
                  <Input label="商品名" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[var(--color-muted-foreground)] mb-1 block">カテゴリ</label>
                      <Select value={form.category ?? 'other'} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Input label="単位" value={form.unit ?? ''} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="単価（円）" type="number" value={form.unit_price ?? ''} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value ? Number(e.target.value) : null }))} />
                    <Input label="最低在庫" type="number" value={form.min_stock ?? ''} onChange={e => setForm(f => ({ ...f, min_stock: Number(e.target.value) }))} />
                  </div>
                  <Input label="保管場所" value={form.storage_location ?? ''} onChange={e => setForm(f => ({ ...f, storage_location: e.target.value }))} />
                  <Input label="バーコード" value={form.barcode ?? ''} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="仕入先" value={form.supplier_name ?? ''} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} />
                    <Input label="仕入先電話" value={form.supplier_contact ?? ''} onChange={e => setForm(f => ({ ...f, supplier_contact: e.target.value }))} />
                  </div>
                  <Input label="仕入先メール" value={form.supplier_email ?? ''} onChange={e => setForm(f => ({ ...f, supplier_email: e.target.value }))} />
                  <Textarea label="備考" value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
              ) : (
                <dl className="space-y-2">
                  {[
                    ['単価',     item.unit_price ? fmtMoney(item.unit_price) : '—'],
                    ['保管場所', item.storage_location],
                    ['バーコード', item.barcode],
                    ['仕入先',   item.supplier_name],
                    ['仕入先電話', item.supplier_contact],
                    ['仕入先メール', item.supplier_email],
                    ['備考',     item.notes],
                    ['登録日',   fmtDate(item.created_at)],
                  ].map(([label, value]) => value ? (
                    <div key={label} className="flex justify-between py-1.5 border-b border-[var(--color-border)]/50 last:border-0">
                      <dt className="text-xs text-[var(--color-muted-foreground)]">{label}</dt>
                      <dd className="text-sm">{value}</dd>
                    </div>
                  ) : null)}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* 在庫履歴 */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <History className="h-4 w-4" /> 在庫履歴（直近30件）
              </h2>
              {txs.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">履歴がありません</p>
              ) : (
                <div className="space-y-1">
                  {txs.map(tx => {
                    const isPlus = tx.quantity > 0
                    return (
                      <div key={tx.id} className="flex items-start gap-3 py-2 border-b border-[var(--color-border)]/50 last:border-0">
                        <div className={cn(
                          'text-sm font-bold w-16 shrink-0',
                          isPlus ? 'text-[var(--color-success)]' : tx.transaction_type === 'adjustment' ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'
                        )}>
                          {isPlus ? '+' : ''}{tx.quantity}{item.unit}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" size="sm">{TRANSACTION_TYPE_LABELS[tx.transaction_type]}</Badge>
                            <span className="text-xs text-[var(--color-muted-foreground)]">
                              {new Date(tx.performed_at).toLocaleDateString('ja-JP')}
                            </span>
                            {tx.performer && (
                              <span className="text-xs text-[var(--color-muted-foreground)]">{tx.performer.name}</span>
                            )}
                          </div>
                          {(tx.reason || tx.supplier_name || tx.projects?.name) && (
                            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                              {tx.supplier_name && `仕入: ${tx.supplier_name}`}
                              {tx.projects?.name && `案件: ${tx.projects.name}`}
                              {tx.reason && `理由: ${tx.reason}`}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* サイドバー */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">クイック操作</h2>
              <div className="space-y-2">
                <Button className="w-full" onClick={() => setInOpen(true)} disabled={!item.is_active}>
                  <TrendingUp className="h-4 w-4" /> 入庫登録
                </Button>
                <Button className="w-full" variant="outline" onClick={() => setOutOpen(true)} disabled={!item.is_active}>
                  <TrendingDown className="h-4 w-4" /> 出庫登録
                </Button>
                <Button className="w-full" variant="outline" onClick={() => setAdjOpen(true)} disabled={!item.is_active}>
                  <SlidersHorizontal className="h-4 w-4" /> 在庫調整
                </Button>
              </div>
            </CardContent>
          </Card>
          {item.supplier_name && (
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">仕入先情報</h2>
                <dl className="space-y-2">
                  {[['仕入先', item.supplier_name], ['電話', item.supplier_contact], ['メール', item.supplier_email]].map(([l, v]) => v ? (
                    <div key={l} className="py-1.5 border-b border-[var(--color-border)]/50 last:border-0">
                      <dt className="text-xs text-[var(--color-muted-foreground)]">{l}</dt>
                      <dd className="text-sm mt-0.5">{v}</dd>
                    </div>
                  ) : null)}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 入庫ダイアログ */}
      <Dialog open={inOpen} onOpenChange={setInOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>入庫登録</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">現在在庫: {fmtQty(item.stock_quantity, item.unit)}</p>
            <Input label={`数量（${item.unit}）`} type="number" value={inQty} onChange={e => setInQty(e.target.value)} placeholder="0" />
            <Input label="仕入先（任意）" value={inSupplier} onChange={e => setInSupplier(e.target.value)} />
            <Input label="備考（任意）" value={inNotes} onChange={e => setInNotes(e.target.value)} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInOpen(false)}>キャンセル</Button>
            <Button onClick={handleIn} loading={acting}>入庫する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 出庫ダイアログ */}
      <Dialog open={outOpen} onOpenChange={setOutOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>出庫登録</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">現在在庫: {fmtQty(item.stock_quantity, item.unit)}</p>
            <Input label={`数量（${item.unit}）`} type="number" value={outQty} onChange={e => setOutQty(e.target.value)} placeholder="0" />
            <Input label="出庫理由" value={outReason} onChange={e => setOutReason(e.target.value)} placeholder="現場使用・配布 等" />
            <Input label="備考（任意）" value={outNotes} onChange={e => setOutNotes(e.target.value)} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutOpen(false)}>キャンセル</Button>
            <Button onClick={handleOut} loading={acting}>出庫する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 在庫調整ダイアログ */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>在庫調整</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">現在在庫: {fmtQty(item.stock_quantity, item.unit)}</p>
            <Input
              label={`調整量（${item.unit}）例: -2 または 3`}
              type="number"
              value={adjQty}
              onChange={e => setAdjQty(e.target.value)}
              placeholder="-2 または 3"
            />
            <Textarea
              label="調整理由 *"
              value={adjReason}
              onChange={e => setAdjReason(e.target.value)}
              rows={2}
              placeholder="棚卸しで2個不足 等"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>キャンセル</Button>
            <Button onClick={handleAdj} loading={acting}>調整する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
