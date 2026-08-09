'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton, toast, Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, Textarea,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { Package, Plus, RefreshCw, AlertTriangle, Filter, Search } from 'lucide-react'
import {
  calculateStockStatus, calculateInventoryValue,
  CATEGORY_LABELS, STATUS_CONFIG, fmtQty, fmtMoney,
  type StockStatus,
} from '@/lib/inventory/service'
import { cn } from '@hikaru/ui'

interface InventoryItem {
  id: string; name: string; category: string; unit: string
  unit_price: number | null; stock_quantity: number; min_stock: number
  storage_location: string | null; supplier_name: string | null
  is_active: boolean; barcode: string | null; notes: string | null
  stock_status: StockStatus; inventory_value: number | null
}

interface Kpi { total: number; low_stock: number; out_of_stock: number; total_value: number }

export default function InventoryPage() {
  const [items,    setItems]    = React.useState<InventoryItem[]>([])
  const [kpi,      setKpi]      = React.useState<Kpi | null>(null)
  const [loading,  setLoading]  = React.useState(true)
  const [search,   setSearch]   = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [status,   setStatus]   = React.useState('all')

  // 商品追加ダイアログ
  const [addOpen,  setAddOpen]  = React.useState(false)
  const [form,     setForm]     = React.useState({ name: '', category: 'consumable', unit: '個', unit_price: '', min_stock: '0', storage_location: '', supplier_name: '', supplier_contact: '', notes: '' })
  const [saving,   setSaving]   = React.useState(false)

  React.useEffect(() => { load() }, [category, status])

  async function load() {
    setLoading(true)
    try {
      const p = new URLSearchParams({ active: 'true' })
      if (category !== 'all') p.set('category', category)
      if (status   !== 'all') p.set('status',   status)
      const res = await fetch(`/api/inventory?${p}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(data.items ?? [])
      setKpi(data.kpi)
    } catch { toast.error('取得に失敗しました') }
    finally { setLoading(false) }
  }

  async function handleAdd() {
    if (!form.name.trim()) { toast.error('商品名を入力してください'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          unit_price: form.unit_price ? Number(form.unit_price) : null,
          min_stock:  Number(form.min_stock),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('商品を登録しました')
      setAddOpen(false)
      setForm({ name: '', category: 'consumable', unit: '個', unit_price: '', min_stock: '0', storage_location: '', supplier_name: '', supplier_contact: '', notes: '' })
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const filtered = items.filter(i =>
    !search || i.name.includes(search) || i.barcode?.includes(search)
  )

  return (
    <div>
      <PageHeader
        title="在庫管理"
        description={`${items.length}件の商品`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> 商品を追加
            </Button>
          </div>
        }
      />

      {/* KPIカード */}
      {kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Card><CardContent className="py-3 px-4">
            <p className="text-xs text-[var(--color-muted-foreground)]">総商品数</p>
            <p className="text-2xl font-bold">{kpi.total}</p>
          </CardContent></Card>
          <Card className={kpi.low_stock > 0 ? 'border-[var(--color-warning)]/40' : ''}>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-[var(--color-muted-foreground)]">在庫不足</p>
              <p className={`text-2xl font-bold ${kpi.low_stock > 0 ? 'text-[var(--color-warning)]' : ''}`}>{kpi.low_stock}</p>
            </CardContent>
          </Card>
          <Card className={kpi.out_of_stock > 0 ? 'border-[var(--color-error)]/40' : ''}>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-[var(--color-muted-foreground)]">在庫切れ</p>
              <p className={`text-2xl font-bold ${kpi.out_of_stock > 0 ? 'text-[var(--color-error)]' : ''}`}>{kpi.out_of_stock}</p>
            </CardContent>
          </Card>
          <Card><CardContent className="py-3 px-4">
            <p className="text-xs text-[var(--color-muted-foreground)]">在庫金額（参考）</p>
            <p className="text-lg font-bold">{fmtMoney(kpi.total_value)}</p>
          </CardContent></Card>
        </div>
      )}

      {/* フィルター */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted-foreground)]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="商品名・バーコードで検索"
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全カテゴリ</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            <SelectItem value="out_of_stock">在庫切れ</SelectItem>
            <SelectItem value="low_stock">在庫不足</SelectItem>
            <SelectItem value="normal">正常</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 商品一覧 */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent>
          <EmptyState
            icon={<Package className="h-12 w-12" />}
            title="在庫商品がありません"
            description="「商品を追加」から在庫商品を登録してください"
            action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> 追加</Button>}
          />
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const cfg = STATUS_CONFIG[item.stock_status]
            return (
              <Link key={item.id} href={`/inventory/${item.id}`}>
                <Card className={cn(
                  'hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer',
                  item.stock_status === 'out_of_stock' && 'border-[var(--color-error)]/40',
                  item.stock_status === 'low_stock'    && 'border-[var(--color-warning)]/30',
                )}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{item.name}</span>
                          <Badge variant="secondary" size="sm">{CATEGORY_LABELS[item.category] ?? item.category}</Badge>
                          <Badge variant={cfg.variant as any} size="sm">{cfg.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-[var(--color-muted-foreground)]">
                          <span>現在: <strong className="text-[var(--color-foreground)]">{fmtQty(item.stock_quantity, item.unit)}</strong></span>
                          {item.min_stock > 0 && (
                            <span>最低: {fmtQty(item.min_stock, item.unit)}</span>
                          )}
                          {item.storage_location && <span>📍 {item.storage_location}</span>}
                          {item.supplier_name && <span>仕入: {item.supplier_name}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {item.inventory_value != null && (
                          <p className="text-sm font-medium">{fmtMoney(item.inventory_value)}</p>
                        )}
                        {item.unit_price != null && (
                          <p className="text-xs text-[var(--color-muted-foreground)]">{fmtMoney(item.unit_price)}/{item.unit}</p>
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

      {/* 商品追加ダイアログ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>商品を追加</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <Input label="商品名 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例: 洗剤A" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-muted-foreground)] mb-1 block">カテゴリ</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input label="単位" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="個/L/袋 等" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="単価（円）" type="number" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="任意" />
              <Input label="最低在庫" type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} />
            </div>
            <Input label="保管場所" value={form.storage_location} onChange={e => setForm(f => ({ ...f, storage_location: e.target.value }))} placeholder="例: 倉庫A棚" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="仕入先" value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} />
              <Input label="仕入先電話" value={form.supplier_contact} onChange={e => setForm(f => ({ ...f, supplier_contact: e.target.value }))} />
            </div>
            <Textarea label="備考" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>キャンセル</Button>
            <Button onClick={handleAdd} loading={saving}>登録する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
