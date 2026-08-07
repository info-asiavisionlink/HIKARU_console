'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent,
  Badge, Skeleton, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { AssigneeSelector, type Assignee } from '@/components/console/AssigneeSelector'
import {
  SinglePriceCard, BillingInfoCard, emptyBilling, emptyPrice,
  BILLING_STATUSES, type PriceEntry, type BillingEntry,
} from '@/components/console/PricingCard'
import { ArrowLeft, Edit2, Save, Trash2, Zap, MapPin, Users, Building2, Plus } from 'lucide-react'
import { SPOT_RECURRING_STATUSES, srStatusLabel, srStatusVariant } from '@/lib/project-status'
import { ConfirmDeleteDialog } from '@/components/console/ConfirmDeleteDialog'

const statusVariant = srStatusVariant
const statusLabel   = srStatusLabel

export default function SpotProjectDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const [project,    setProject]    = React.useState<any>(null)
  const [loading,    setLoading]    = React.useState(true)
  const [editing,    setEditing]    = React.useState(false)
  const [saving,     setSaving]     = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [form,      setForm]      = React.useState<any>({})
  const [assignees, setAssignees] = React.useState<Assignee[]>([])
  const [price,     setPrice]     = React.useState<PriceEntry>(emptyPrice())
  const [billing,   setBilling]   = React.useState<BillingEntry>(emptyBilling())
  const [spots,     setSpots]     = React.useState<string[]>([''])
  const [keys,      setKeys]      = React.useState<{model: string; usage: string}[]>([{model: '', usage: ''}])
  const [clients,   setClients]   = React.useState<{ id: string; name: string }[]>([])
  const [empMap,    setEmpMap]    = React.useState<Record<string, string>>({})
  const [parMap,    setParMap]    = React.useState<Record<string, string>>({})

  React.useEffect(() => { loadData() }, [id]) // eslint-disable-line
  React.useEffect(() => {
    fetch('/api/clients?pageSize=100').then(r => r.json()).then(r => setClients(r.clients ?? []))
    Promise.all([
      fetch('/api/employees?pageSize=200&status=active', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/partners?pageSize=200&status=active',  { credentials: 'include' }).then(r => r.json()),
    ]).then(([empData, parData]) => {
      setEmpMap(Object.fromEntries((empData.data ?? []).map((e: any) => [e.id, `${e.name}${e.employee_number ? ` (${e.employee_number})` : ''}`])))
      setParMap(Object.fromEntries((parData.data ?? []).map((p: any) => [p.id, p.company_name])))
    })
  }, [])

  async function loadData() {
    setLoading(true)
    const [projRes, pricingRes] = await Promise.all([
      fetch(`/api/projects/spot/${id}`, { credentials: 'include', cache: 'no-store' }),
      fetch(`/api/projects/${id}/pricing`, { credentials: 'include', cache: 'no-store' }),
    ])

    if (projRes.ok) {
      const { data } = await projRes.json()
      setProject(data)
      const d = data.spot_project_details
      setForm({
        name:              data.name              ?? '',
        code:              data.code              ?? '',
        status:            data.status            ?? 'active',
        client_id:         data.client_id         ?? '',
        start_date:        data.start_date        ?? '',
        end_date:          data.end_date          ?? '',
        work_start_time:   data.work_start_time   ?? '',
        work_end_time:     data.work_end_time     ?? '',
        location_name:     data.location_name     ?? '',
        address:           data.address           ?? '',
        phone:             data.phone             ?? '',
        emergency_contact: data.emergency_contact ?? '',
        business_hours:    data.business_hours    ?? '',
        work_content:      d?.work_content        ?? '',
        required_staff:    String(d?.required_staff  ?? 1),
        estimated_hours:   String(d?.estimated_hours ?? ''),
        entry_route:   data.entry_route ?? '',
        key_borrowing: data.key_borrowing ? 'true' : 'false',
        notes:             data.notes             ?? '',
      })
      const keysData: {model: string; usage: string}[] = data.keys_info ?? []
      setKeys(keysData.length > 0 ? keysData.map((k: any) => ({model: k.model ?? '', usage: k.usage ?? ''})) : [{model: '', usage: ''}])
      const spotsRes = await fetch(`/api/projects/${id}/spots`, { credentials: 'include' })
      if (spotsRes.ok) {
        const { data: sd } = await spotsRes.json()
        setSpots(sd?.length > 0 ? sd.map((s: any) => s.name) : [''])
      }
      setAssignees(
        (data.project_assignments ?? []).map((a: any) => ({
          assignee_type: a.assignee_type, assignee_id: a.assignee_id, label: a.assignee_id,
        }))
      )
    }

    if (pricingRes.ok) {
      const { billing: b, prices: ps } = await pricingRes.json()
      if (b) setBilling({
        billing_status: b.billing_status ?? 'unbilled', quote_number: b.quote_number ?? '',
        contract_date: b.contract_date ?? '', billing_date: b.billing_date ?? '',
        payment_due_date: b.payment_due_date ?? '', actual_payment_date: b.actual_payment_date ?? '',
        notes: b.notes ?? '',
      })
      if (ps?.[0]) {
        const p = ps[0]
        setPrice({ amount_ex_tax: Number(p.amount_ex_tax), tax_rate: Number(p.tax_rate), tax_amount: Number(p.tax_amount), amount_inc_tax: Number(p.amount_inc_tax) })
      }
    }
    setLoading(false)
  }

  async function handleDelete() {
    const res = await fetch(`/api/projects/spot/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success('案件を削除しました'); router.push('/projects/spot') }
    else toast.error('削除に失敗しました')
  }

  function upd(k: string, v: string) { setForm((p: any) => ({ ...p, [k]: v })) }
  function addKey() { setKeys(p => [...p, {model: '', usage: ''}]) }
  function updKey(i: number, f: 'model' | 'usage', v: string) { setKeys(p => p.map((k, idx) => idx === i ? {...k, [f]: v} : k)) }
  function rmKey(i: number) { setKeys(p => p.length <= 1 ? [{model: '', usage: ''}] : p.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    if (!form.name?.trim()) { toast.error('案件名を入力してください'); return }
    setSaving(true)
    try {
      const work_datetime = form.start_date && form.work_start_time
        ? `${form.start_date}T${form.work_start_time}`
        : form.start_date ? `${form.start_date}T00:00` : null

      const [projRes, pricingRes] = await Promise.all([
        fetch(`/api/projects/spot/${id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:              form.name.trim(),
            code:              form.code.trim()         || null,
            status:            form.status,
            client_id:         form.client_id           || null,
            start_date:        form.start_date          || null,
            end_date:          form.end_date            || null,
            work_start_time:   form.work_start_time     || null,
            work_end_time:     form.work_end_time       || null,
            location_name:     form.location_name       || null,
            address:           form.address             || null,
            phone:             form.phone               || null,
            emergency_contact: form.emergency_contact   || null,
            business_hours:    form.business_hours      || null,
            notes:             form.notes               || null,
            entry_route:   form.entry_route || null,
            key_borrowing: form.key_borrowing === 'true',
            keys_info:     form.key_borrowing === 'true'
              ? keys.filter(k => k.model || k.usage).map(k => ({model: k.model, usage: k.usage}))
              : [],
            spot_details: {
              work_datetime,
              work_content:    form.work_content    || null,
              required_staff:  parseInt(form.required_staff) || 1,
              estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
            },
            assignments: assignees,
          }),
        }),
        fetch(`/api/projects/${id}/pricing`, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billing, prices: [{ ...price, period_month: null }] }),
        }),
      ])

      await fetch(`/api/projects/${id}/spots`, { method: 'DELETE', credentials: 'include' })
      const valid = spots.filter(s => s.trim())
      if (valid.length > 0) {
        await fetch(`/api/projects/${id}/spots`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spots: valid.map(name => ({ name })) }),
        })
      }

      if (projRes.ok && pricingRes.ok) {
        toast.success('保存しました')
        setEditing(false)
        await loadData()
      } else {
        const e1 = projRes.ok   ? '' : await projRes.json().then((r: any) => r.error).catch(() => 'エラー')
        const e2 = pricingRes.ok ? '' : await pricingRes.json().then((r: any) => r.error).catch(() => 'エラー')
        toast.error('保存に失敗しました: ' + [e1, e2].filter(Boolean).join(' / '))
      }
    } catch (err) {
      console.error('handleSave error:', err)
      toast.error('予期しないエラーが発生しました')
    }
    setSaving(false)
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>
  if (!project) return <div className="text-center py-20 text-[var(--color-muted-foreground)]">案件が見つかりません</div>

  const clientName = clients.find(c => c.id === project.client_id)?.name

  return (
    <div>
      <PageHeader
        title={project.name}
        breadcrumb={<Breadcrumb items={[{ label: '案件管理', href: '/projects' }, { label: '単発案件', href: '/projects/spot' }, { label: project.name }]} />}
        actions={
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); loadData() }}>キャンセル</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-4 w-4" /> {saving ? '保存中...' : '保存'}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit2 className="h-4 w-4" /> 編集</Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> 削除</Button>
              </>
            )}
          </div>
        }
      />

      {editing ? (
        /* ══ 編集モード：新規ページと同じレイアウト ══ */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* 基本情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Zap className="h-4 w-4" /> 基本情報
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="案件名 *" value={form.name} onChange={e => upd('name', e.target.value)} placeholder="例: ○○マンション 退去後清掃" required />
                  <Input label="案件コード" value={form.code} onChange={e => upd('code', e.target.value)} placeholder="例: SPT-001" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="開始日" type="date" value={form.start_date} onChange={e => upd('start_date', e.target.value)} />
                  <Input label="終了日" type="date" value={form.end_date} onChange={e => upd('end_date', e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="作業開始時間" type="time" value={form.work_start_time} onChange={e => upd('work_start_time', e.target.value)} />
                  <Input label="作業終了時間" type="time" value={form.work_end_time} onChange={e => upd('work_end_time', e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* 作業場所 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> 作業場所
                </h2>
                <Input label="作業場所名" value={form.location_name} onChange={e => upd('location_name', e.target.value)} placeholder="例: ○○マンション 301号室" />
                <Input label="住所" value={form.address} onChange={e => upd('address', e.target.value)} placeholder="例: 東京都渋谷区○○1-2-3" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="電話番号" value={form.phone} onChange={e => upd('phone', e.target.value)} placeholder="現場の電話番号" />
                  <Input label="緊急連絡先" value={form.emergency_contact} onChange={e => upd('emergency_contact', e.target.value)} placeholder="緊急時の連絡先" />
                </div>
                <Input label="作業可能時間帯" value={form.business_hours} onChange={e => upd('business_hours', e.target.value)} placeholder="例: 平日 9:00〜18:00" />
              </CardContent>
            </Card>

            {/* 作業箇所 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業箇所</h2>
                  <button type="button" onClick={() => setSpots(p => [...p, ''])}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--radius)] transition-all"
                    style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                    <Plus className="h-3.5 w-3.5" /> 箇所を追加
                  </button>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">清掃・点検する箇所を追加してください（例: エアコン清掃、床清掃）。</p>
                <div className="space-y-2">
                  {spots.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-[10px] font-bold"
                        style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                        {i + 1}
                      </div>
                      <Input value={s} onChange={e => setSpots(p => p.map((x, j) => j === i ? e.target.value : x))}
                        placeholder={i === 0 ? '例: エアコン清掃' : i === 1 ? '例: 床清掃' : '例: トイレ清掃...'}
                        className="flex-1" />
                      <button type="button" onClick={() => setSpots(p => p.length <= 1 ? [''] : p.filter((_, j) => j !== i))}
                        className="p-1.5 rounded-[var(--radius)] hover:opacity-80 shrink-0"
                        style={{ color: 'var(--color-error-foreground)' }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setSpots(p => [...p, ''])}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-lg)] text-sm border-dashed hover:opacity-80"
                  style={{ border: '1.5px dashed var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                  <Plus className="h-4 w-4" /> 箇所を追加する
                </button>
              </CardContent>
            </Card>

            {/* 作業詳細 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業詳細</h2>
                <Textarea label="作業内容" value={form.work_content} onChange={e => upd('work_content', e.target.value)} placeholder="床洗浄・ワックス施工、ガラス清掃..." rows={3} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="必要人数" type="number" min="1" value={form.required_staff} onChange={e => upd('required_staff', e.target.value)} />
                  <Input label="予定時間（時間）" type="number" step="0.5" min="0" value={form.estimated_hours} onChange={e => upd('estimated_hours', e.target.value)} placeholder="3.5" />
                </div>
              </CardContent>
            </Card>

            {/* 入館・鍵情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">入館・鍵情報</h2>
                <Textarea label="入館経路・入室経路" value={form.entry_route} onChange={e => upd('entry_route', e.target.value)} placeholder="例: 1Fエントランス→エレベーター→3F右" rows={2} />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">鍵の借用</label>
                  <Select value={form.key_borrowing} onValueChange={v => upd('key_borrowing', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">なし</SelectItem>
                      <SelectItem value="true">あり</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.key_borrowing === 'true' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--color-muted-foreground)]">鍵ごとに型番と使用箇所を入力してください。</p>
                    {keys.map((k, i) => (
                      <div key={i} className="rounded-[var(--radius)] border border-[var(--color-border)] p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold" style={{color: 'var(--color-primary)'}}>鍵 {i + 1}</span>
                          {keys.length > 1 && (
                            <button type="button" onClick={() => rmKey(i)}
                              className="p-1 rounded hover:opacity-80"
                              style={{color: 'var(--color-error-foreground)'}}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Input label="型番" value={k.model} onChange={e => updKey(i, 'model', e.target.value)} placeholder="例: MIWA LA" />
                          <Input label="使用箇所" value={k.usage} onChange={e => updKey(i, 'usage', e.target.value)} placeholder="例: 玄関" />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addKey}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius)] text-sm border-dashed hover:opacity-80"
                      style={{border: '1.5px dashed var(--color-border)', color: 'var(--color-muted-foreground)'}}>
                      <Plus className="h-4 w-4" /> 鍵を追加する
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 担当者 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4" /> 担当者
                </h2>
                <AssigneeSelector value={assignees} onChange={setAssignees} />
              </CardContent>
            </Card>

            {/* 契約金額 */}
            <SinglePriceCard value={price} onChange={setPrice} title="契約金額" />

            {/* 請求情報 */}
            <BillingInfoCard value={billing} onChange={setBilling} />

            {/* 備考 */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">備考</h2>
                <Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={3} />
              </CardContent>
            </Card>
          </div>

          {/* 右カラム */}
          <div className="flex flex-col gap-4 h-fit">
            {/* 顧客 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> 顧客
                </h2>
                <Select value={form.client_id} onValueChange={v => upd('client_id', v)}>
                  <SelectTrigger><SelectValue placeholder="顧客を選択（任意）" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">選択なし</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* ステータス */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">ステータス</h2>
                <Select value={form.status} onValueChange={v => upd('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPOT_RECURRING_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* 作業箇所プレビュー */}
            {spots.some(s => s.trim()) && (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                    作業箇所 ({spots.filter(s => s.trim()).length})
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {spots.filter(s => s.trim()).map((s, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-[var(--radius)]"
                        style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4" /> {saving ? '保存中...' : '保存する'}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { setEditing(false); loadData() }}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        /* ══ 閲覧モード ══ */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* 基本情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Zap className="h-4 w-4" /> 基本情報
                </h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {([
                    ['案件名',     project.name],
                    ['案件コード', project.code ?? '—'],
                    ['開始日',     project.start_date ? new Date(project.start_date).toLocaleDateString('ja-JP') : '—'],
                    ['終了日',     project.end_date   ? new Date(project.end_date).toLocaleDateString('ja-JP')   : '—'],
                    ['作業開始時間', project.work_start_time?.slice(0,5) ?? '—'],
                    ['作業終了時間', project.work_end_time?.slice(0,5)   ?? '—'],
                  ] as [string,string][]).map(([l, v]) => (
                    <div key={l}><dt className="text-[var(--color-muted-foreground)]">{l}</dt><dd className="font-medium mt-0.5">{v}</dd></div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* 作業場所 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> 作業場所
                </h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {([
                    ['作業場所名',     project.location_name     ?? '—'],
                    ['住所',           project.address           ?? '—'],
                    ['電話番号',       project.phone             ?? '—'],
                    ['緊急連絡先',     project.emergency_contact ?? '—'],
                    ['作業可能時間帯', project.business_hours    ?? '—'],
                  ] as [string,string][]).map(([l, v]) => (
                    <div key={l}><dt className="text-[var(--color-muted-foreground)]">{l}</dt><dd className="font-medium mt-0.5">{v}</dd></div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* 作業箇所 */}
            {spots.filter(s => s).length > 0 && (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業箇所</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {spots.filter(s => s).map((s, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-[var(--radius)]"
                        style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 作業詳細 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業詳細</h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {([
                    ['作業内容', project.spot_project_details?.work_content ?? '—'],
                    ['必要人数', `${project.spot_project_details?.required_staff ?? '—'}名`],
                    ['予定時間', project.spot_project_details?.estimated_hours ? `${project.spot_project_details.estimated_hours}h` : '—'],
                  ] as [string,string][]).map(([l, v]) => (
                    <div key={l}><dt className="text-[var(--color-muted-foreground)]">{l}</dt><dd className="font-medium mt-0.5">{v}</dd></div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* 入館・鍵情報（閲覧） */}
            {(project.entry_route || project.key_borrowing) && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">入館・鍵情報</h2>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {project.entry_route && (
                      <div className="col-span-2"><dt className="text-[var(--color-muted-foreground)]">入館経路・入室経路</dt><dd className="font-medium mt-0.5 whitespace-pre-wrap">{project.entry_route}</dd></div>
                    )}
                    <div><dt className="text-[var(--color-muted-foreground)]">鍵の借用</dt><dd className="font-medium mt-0.5">{project.key_borrowing ? `あり（${(project.keys_info ?? []).length}本）` : 'なし'}</dd></div>
                    {project.key_borrowing && (project.keys_info ?? []).length > 0 && (
                      <div className="col-span-2 space-y-1.5">
                        {(project.keys_info as {model: string; usage: string}[]).map((k, i) => (
                          <div key={i} className="flex items-center gap-4 text-xs rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2">
                            <span className="font-bold shrink-0" style={{color: 'var(--color-primary)'}}>鍵{i + 1}</span>
                            <span>型番: <span className="font-medium">{k.model || '—'}</span></span>
                            <span>使用箇所: <span className="font-medium">{k.usage || '—'}</span></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* 担当者 */}
            {assignees.length > 0 && (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-4 w-4" /> 担当者
                  </h2>
                  <ul className="space-y-1.5">
                    {assignees.map((a, i) => {
                      const name = a.assignee_type === 'employee' ? (empMap[a.assignee_id] ?? a.label) : (parMap[a.assignee_id] ?? a.label)
                      return (
                        <li key={i} className="flex items-center gap-2 text-sm rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2">
                          <span className="text-[var(--color-muted-foreground)] text-xs">{a.assignee_type === 'employee' ? '従業員' : '協力業者'}</span>
                          <span className="font-medium">{name}</span>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* 契約金額 */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">契約金額</h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {([
                    ['税抜金額', price.amount_ex_tax  > 0 ? price.amount_ex_tax.toLocaleString('ja-JP')  + '円' : '—'],
                    ['消費税',   price.tax_amount     > 0 ? price.tax_amount.toLocaleString('ja-JP')     + '円' : '—'],
                    ['税込合計', price.amount_inc_tax > 0 ? price.amount_inc_tax.toLocaleString('ja-JP') + '円' : '—'],
                  ] as [string,string][]).map(([l, v]) => (
                    <div key={l}><dt className="text-[var(--color-muted-foreground)]">{l}</dt><dd className="font-bold mt-0.5" style={{ color: 'oklch(0.73 0.12 78)' }}>{v}</dd></div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* 請求情報 */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">請求情報</h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {([
                    ['請求状況',   BILLING_STATUSES.find(b => b.value === billing.billing_status)?.label ?? '—'],
                    ['見積番号',   billing.quote_number        || '—'],
                    ['契約日',     billing.contract_date       || '—'],
                    ['請求予定日', billing.billing_date        || '—'],
                    ['入金予定日', billing.payment_due_date    || '—'],
                    ['入金日',     billing.actual_payment_date || '—'],
                  ] as [string,string][]).map(([l, v]) => (
                    <div key={l}><dt className="text-[var(--color-muted-foreground)]">{l}</dt><dd className="font-medium mt-0.5">{v}</dd></div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* 備考 */}
            {project.notes && (
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">備考</h2>
                  <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右カラム（閲覧） */}
          <div className="flex flex-col gap-4 h-fit">
            {/* 顧客 */}
            <Card>
              <CardContent className="pt-6 space-y-2">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> 顧客
                </h2>
                <p className="text-sm font-medium">{clientName ?? '—'}</p>
              </CardContent>
            </Card>

            {/* ステータス */}
            <Card>
              <CardContent className="pt-6 space-y-2">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">ステータス</h2>
                <Badge variant={statusVariant[project.status] as any}>{statusLabel[project.status]}</Badge>
              </CardContent>
            </Card>

            <Link href="/projects/spot">
              <Button variant="outline" className="w-full"><ArrowLeft className="h-4 w-4" /> 一覧へ</Button>
            </Link>
            <Button variant="destructive" className="w-full" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> この案件を削除
            </Button>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="単発案件を削除しますか？"
        description={`「${project?.name}」を削除します。この操作は取り消せません。`}
      />
    </div>
  )
}
