'use client'

import * as React from 'react'
import Link from 'next/link'
import { manualTypeLabel, type ManualType } from '@/services/manuals.service'
import {
  PageHeader, Button, Badge, Skeleton, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Input, Textarea,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { ConfirmDeleteDialog } from '@/components/console/ConfirmDeleteDialog'
import {
  BookOpen, FileText, Image, Video, HelpCircle, AlertTriangle,
  ArrowRight, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Search, X, Layers, FolderOpen,
} from 'lucide-react'

const TYPE_OPTIONS: { value: ManualType | ''; label: string }[] = [
  { value: '',      label: 'すべての種別' },
  { value: 'text',  label: '文章' },
  { value: 'faq',   label: 'FAQ' },
  { value: 'note',  label: '注意事項' },
  { value: 'pdf',   label: 'PDF' },
  { value: 'image', label: '画像' },
  { value: 'video', label: '動画' },
]

const typeIcon: Record<ManualType, React.ElementType> = {
  text:  FileText,
  faq:   HelpCircle,
  note:  AlertTriangle,
  pdf:   FileText,
  image: Image,
  video: Video,
}

const typeVariant: Record<ManualType, string> = {
  text:  'secondary',
  faq:   'info',
  note:  'warning',
  pdf:   'default',
  image: 'success',
  video: 'error',
}

type ManualItem = {
  id: string
  title: string
  type: ManualType
  content: string | null
  category: string | null
  is_template: boolean
  project_id: string | null
  order_num: number
  created_at: string
  projects?: { id: string; name: string } | null
}

type Tab = 'template' | 'project'

const FORM_DEFAULT = { title: '', type: 'text' as ManualType, content: '', category: '', is_template: true }

export default function ManualsPage() {
  const [tab, setTab]         = React.useState<Tab>('template')
  const [items, setItems]     = React.useState<ManualItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch]   = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [typeFilter, setTypeFilter]     = React.useState<ManualType | ''>('')
  const [categoryFilter, setCategoryFilter] = React.useState('')
  const [categories, setCategories]     = React.useState<string[]>([])
  const [expanded, setExpanded]         = React.useState<Set<string>>(new Set())
  const [viewItem, setViewItem]         = React.useState<ManualItem | null>(null)
  const [editItem, setEditItem]         = React.useState<ManualItem | null>(null)
  const [deleteItem, setDeleteItem]     = React.useState<ManualItem | null>(null)
  const [showCreate, setShowCreate]     = React.useState(false)
  const [form, setForm]                 = React.useState(FORM_DEFAULT)
  const [saving, setSaving]             = React.useState(false)

  // debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  React.useEffect(() => {
    fetchItems()
  }, [tab, debouncedSearch, typeFilter, categoryFilter]) // eslint-disable-line

  async function fetchItems() {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (typeFilter)      params.set('type', typeFilter)
    if (categoryFilter)  params.set('category', categoryFilter)
    params.set('template', tab === 'template' ? 'true' : 'false')

    const res  = await fetch(`/api/manuals?${params}`)
    const json = await res.json()
    const data: ManualItem[] = json.data ?? []
    setItems(data)

    // update category list from template data
    if (tab === 'template') {
      const cats = Array.from(new Set(data.map((d) => d.category ?? '').filter(Boolean))).sort()
      setCategories(cats)
      // expand all by default
      setExpanded(new Set(cats))
    }
    setLoading(false)
  }

  // group by category for template tab
  const grouped = React.useMemo(() => {
    const map: Record<string, ManualItem[]> = {}
    for (const item of items) {
      const cat = item.category ?? '未分類'
      if (!map[cat]) map[cat] = []
      map[cat].push(item)
    }
    return map
  }, [items])

  function toggleCategory(cat: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  // ── Create ──
  async function handleCreate() {
    if (!form.title.trim()) return
    setSaving(true)
    const res = await fetch('/api/manuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, is_template: tab === 'template' }),
    })
    if (res.ok) {
      toast.success('マニュアルを作成しました')
      setShowCreate(false)
      setForm(FORM_DEFAULT)
      fetchItems()
    } else {
      const j = await res.json()
      toast.error(j.error ?? '作成に失敗しました')
    }
    setSaving(false)
  }

  // ── Update ──
  async function handleUpdate() {
    if (!editItem) return
    setSaving(true)
    const res = await fetch(`/api/manuals/${editItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:    editItem.title,
        type:     editItem.type,
        content:  editItem.content,
        category: editItem.category,
      }),
    })
    if (res.ok) {
      toast.success('更新しました')
      setEditItem(null)
      fetchItems()
    } else {
      toast.error('更新に失敗しました')
    }
    setSaving(false)
  }

  // ── Delete ──
  async function handleDelete() {
    if (!deleteItem) return
    const res = await fetch(`/api/manuals/${deleteItem.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('削除しました')
      setDeleteItem(null)
      fetchItems()
    } else {
      toast.error('削除に失敗しました')
    }
  }

  return (
    <div>
      <PageHeader
        title="マニュアル管理"
        description="SOP テンプレートと案件別マニュアルを管理します"
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            新規作成
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-[var(--color-border)]">
        <TabButton active={tab === 'template'} onClick={() => { setTab('template'); setCategoryFilter('') }}>
          <Layers className="h-4 w-4" />
          テンプレートSOP
          <span className="ml-1.5 text-xs opacity-60">{tab === 'template' ? `(${items.length})` : ''}</span>
        </TabButton>
        <TabButton active={tab === 'project'} onClick={() => { setTab('project'); setCategoryFilter('') }}>
          <FolderOpen className="h-4 w-4" />
          案件別マニュアル
          <span className="ml-1.5 text-xs opacity-60">{tab === 'project' ? `(${items.length})` : ''}</span>
        </TabButton>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted-foreground)]" />
          <input
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="タイトル・内容で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
            </button>
          )}
        </div>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ManualType | '')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="種別" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {tab === 'template' && categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="カテゴリで絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">すべてのカテゴリ</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {tab === 'template' && (
          <div className="flex gap-1 ml-auto">
            <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set(Object.keys(grouped)))}>すべて開く</Button>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set())}>すべて閉じる</Button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-[var(--color-muted-foreground)]">
          <div className="text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">マニュアルが見つかりません</p>
          </div>
        </div>
      ) : tab === 'template' ? (
        /* Template accordion */
        <div className="space-y-2">
          {Object.entries(grouped).map(([cat, manuals]) => (
            <div key={cat} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                onClick={() => toggleCategory(cat)}
              >
                {expanded.has(cat)
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
                }
                <span className="font-medium text-sm flex-1">{cat}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">{manuals.length}件</span>
              </button>

              {expanded.has(cat) && (
                <div className="divide-y divide-[var(--color-border)]">
                  {manuals.map((m) => {
                    const Icon = typeIcon[m.type] ?? FileText
                    return (
                      <div
                        key={m.id}
                        className="flex items-start gap-3 px-4 py-3 bg-[var(--color-bg)] hover:bg-[var(--color-bg-surface)] transition-colors group"
                      >
                        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-muted-foreground)]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              className="font-medium text-sm hover:text-[var(--color-primary)] text-left"
                              onClick={() => setViewItem(m)}
                            >
                              {m.title}
                            </button>
                            <Badge variant={typeVariant[m.type] as any} size="sm">
                              {manualTypeLabel[m.type]}
                            </Badge>
                          </div>
                          {m.content && (
                            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)] line-clamp-1">{m.content}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditItem({ ...m })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-[var(--color-destructive)]" onClick={() => setDeleteItem(m)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Project manuals grid */
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => {
            const Icon = typeIcon[m.type] ?? FileText
            return (
              <div
                key={m.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 hover:shadow-[var(--shadow-md)] transition-shadow group"
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-muted-foreground)]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        className="font-medium text-sm hover:text-[var(--color-primary)] text-left truncate"
                        onClick={() => setViewItem(m)}
                      >
                        {m.title}
                      </button>
                      <Badge variant={typeVariant[m.type] as any} size="sm">
                        {manualTypeLabel[m.type]}
                      </Badge>
                    </div>
                    {m.content && (
                      <p className="mt-1 text-xs text-[var(--color-muted-foreground)] line-clamp-2">{m.content}</p>
                    )}
                    {m.projects && (
                      <Link
                        href={`/projects/${m.project_id}/manuals`}
                        className="mt-2 flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                      >
                        {m.projects.name}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditItem({ ...m })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-[var(--color-destructive)]" onClick={() => setDeleteItem(m)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── View Modal ── */}
      <Dialog open={!!viewItem} onOpenChange={(o) => !o && setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewItem && (() => { const Icon = typeIcon[viewItem.type] ?? FileText; return <Icon className="h-5 w-5 shrink-0" /> })()}
              {viewItem?.title}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="overflow-y-auto flex-1">
            {viewItem?.category && (
              <p className="text-xs text-[var(--color-muted-foreground)] mb-3">カテゴリ: {viewItem.category}</p>
            )}
            {viewItem?.content ? (
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{viewItem.content}</div>
            ) : (
              <p className="text-sm text-[var(--color-muted-foreground)]">内容がありません</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditItem({ ...viewItem! }); setViewItem(null) }}>
              <Pencil className="h-4 w-4 mr-1" />編集
            </Button>
            <Button variant="ghost" onClick={() => setViewItem(null)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Modal ── */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setForm(FORM_DEFAULT) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>マニュアルを新規作成</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">タイトル *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="マニュアルタイトル" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">種別 *</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ManualType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.filter(t => t.value).map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">カテゴリ</label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="例：浴室清掃" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">内容</label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="マニュアルの内容を入力"
                rows={8}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowCreate(false); setForm(FORM_DEFAULT) }}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title.trim()}>
              {saving ? '作成中...' : '作成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ── */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>マニュアルを編集</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">タイトル *</label>
              <Input
                value={editItem?.title ?? ''}
                onChange={(e) => setEditItem((prev) => prev ? { ...prev, title: e.target.value } : prev)}
                placeholder="マニュアルタイトル"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">種別 *</label>
                <Select
                  value={editItem?.type ?? 'text'}
                  onValueChange={(v) => setEditItem((prev) => prev ? { ...prev, type: v as ManualType } : prev)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.filter(t => t.value).map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">カテゴリ</label>
                <Input
                  value={editItem?.category ?? ''}
                  onChange={(e) => setEditItem((prev) => prev ? { ...prev, category: e.target.value } : prev)}
                  placeholder="例：浴室清掃"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">内容</label>
              <Textarea
                value={editItem?.content ?? ''}
                onChange={(e) => setEditItem((prev) => prev ? { ...prev, content: e.target.value } : prev)}
                rows={10}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditItem(null)}>キャンセル</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <ConfirmDeleteDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title={`「${deleteItem?.title}」を削除`}
        description="この操作は取り消せません。"
        onConfirm={handleDelete}
      />
    </div>
  )
}

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
          : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
      }`}
    >
      {children}
    </button>
  )
}
