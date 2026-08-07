'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { AssigneeSelector, type Assignee } from '@/components/console/AssigneeSelector'
import {
  SinglePriceCard, BillingInfoCard,
  emptyPrice, emptyBilling,
  type PriceEntry, type BillingEntry,
} from '@/components/console/PricingCard'
import { ArrowLeft, Zap, MapPin, Users, Building2, Plus, Trash2 } from 'lucide-react'
import { SPOT_RECURRING_STATUSES } from '@/lib/project-status'

export default function NewSpotProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [assignees, setAssignees] = React.useState<Assignee[]>([])
  const [price,   setPrice]   = React.useState<PriceEntry>(emptyPrice())
  const [billing, setBilling] = React.useState<BillingEntry>(emptyBilling())
  const [clients, setClients] = React.useState<{ id: string; name: string }[]>([])
  const [spots,   setSpots]   = React.useState<string[]>([''])

  const [form, setForm] = React.useState({
    // 基本情報
    name: '', code: '', status: 'active', client_id: '',
    start_date: '', end_date: '',
    work_start_time: '', work_end_time: '',
    // 作業場所
    location_name: '', address: '',
    phone: '', emergency_contact: '', business_hours: '',
    // スポット詳細
    work_content: '',
    required_staff: '1', estimated_hours: '',
    // その他
    notes: '',
  })

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function addSpot() { setSpots(p => [...p, '']) }
  function updSpot(i: number, v: string) { setSpots(p => p.map((s, idx) => idx === i ? v : s)) }
  function rmSpot(i: number) { setSpots(p => p.length <= 1 ? [''] : p.filter((_, idx) => idx !== i)) }

  React.useEffect(() => {
    fetch('/api/clients?pageSize=100')
      .then(r => r.json())
      .then(r => setClients(r.clients ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('案件名を入力してください'); return }
    setLoading(true)

    // 作業日時（開始日 + 開始時間を結合してspot_detailsに渡す）
    const work_datetime = form.start_date && form.work_start_time
      ? `${form.start_date}T${form.work_start_time}`
      : form.start_date ? `${form.start_date}T00:00` : null

    const projRes = await fetch('/api/projects/spot', {
      method: 'POST', credentials: 'include',
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
        spot_details: {
          work_datetime,
          work_content:    form.work_content    || null,
          required_staff:  parseInt(form.required_staff) || 1,
          estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
        },
        assignments: assignees,
      }),
    })

    if (!projRes.ok) {
      const { error } = await projRes.json()
      toast.error('登録に失敗しました: ' + error)
      setLoading(false)
      return
    }

    const { data: project } = await projRes.json()

    const errors: string[] = []

    // 単価・請求情報
    if (price.amount_ex_tax > 0 || billing.billing_status !== 'unbilled') {
      const r = await fetch(`/api/projects/${project.id}/pricing`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing, prices: [{ ...price, period_month: null }] }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); errors.push('金額: ' + (j.error ?? r.status)) }
    }

    // 作業箇所
    const validSpots = spots.filter(s => s.trim())
    if (validSpots.length > 0) {
      const r = await fetch(`/api/projects/${project.id}/spots`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spots: validSpots.map(name => ({ name })) }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); errors.push('作業箇所: ' + (j.error ?? r.status)) }
    }

    if (errors.length > 0) {
      toast.error('一部の保存に失敗しました: ' + errors.join(' / '))
    } else {
      toast.success('単発案件を登録しました')
    }
    router.push(`/projects/spot/${project.id}`)
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="単発案件を登録"
        breadcrumb={
          <Breadcrumb items={[
            { label: '案件管理', href: '/projects' },
            { label: '単発案件', href: '/projects/spot' },
            { label: '新規登録' },
          ]} />
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* 基本情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Zap className="h-4 w-4" /> 基本情報
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="案件名 *"
                    value={form.name}
                    onChange={e => upd('name', e.target.value)}
                    placeholder="例: ○○マンション 退去後清掃"
                    required
                  />
                  <Input
                    label="案件コード"
                    value={form.code}
                    onChange={e => upd('code', e.target.value)}
                    placeholder="例: SPT-001"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="開始日"
                    type="date"
                    value={form.start_date}
                    onChange={e => upd('start_date', e.target.value)}
                  />
                  <Input
                    label="終了日"
                    type="date"
                    value={form.end_date}
                    onChange={e => upd('end_date', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="作業開始時間"
                    type="time"
                    value={form.work_start_time}
                    onChange={e => upd('work_start_time', e.target.value)}
                  />
                  <Input
                    label="作業終了時間"
                    type="time"
                    value={form.work_end_time}
                    onChange={e => upd('work_end_time', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 作業場所 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> 作業場所
                </h2>
                <Input
                  label="作業場所名"
                  value={form.location_name}
                  onChange={e => upd('location_name', e.target.value)}
                  placeholder="例: ○○マンション 301号室"
                />
                <Input
                  label="住所"
                  value={form.address}
                  onChange={e => upd('address', e.target.value)}
                  placeholder="例: 東京都渋谷区○○1-2-3"
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="電話番号"
                    value={form.phone}
                    onChange={e => upd('phone', e.target.value)}
                    placeholder="現場の電話番号"
                  />
                  <Input
                    label="緊急連絡先"
                    value={form.emergency_contact}
                    onChange={e => upd('emergency_contact', e.target.value)}
                    placeholder="緊急時の連絡先"
                  />
                </div>
                <Input
                  label="作業可能時間帯"
                  value={form.business_hours}
                  onChange={e => upd('business_hours', e.target.value)}
                  placeholder="例: 平日 9:00〜18:00"
                />
              </CardContent>
            </Card>

            {/* 作業箇所 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                    作業箇所
                  </h2>
                  <button
                    type="button" onClick={addSpot}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--radius)] transition-all"
                    style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}
                  >
                    <Plus className="h-3.5 w-3.5" /> 箇所を追加
                  </button>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  清掃・点検する箇所を追加してください（例: エアコン清掃、床清掃）。
                </p>
                <div className="space-y-2">
                  {spots.map((spot, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-[10px] font-bold"
                        style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}
                      >
                        {i + 1}
                      </div>
                      <Input
                        value={spot} onChange={e => updSpot(i, e.target.value)}
                        placeholder={i === 0 ? '例: エアコン清掃' : i === 1 ? '例: 床清掃' : '例: トイレ清掃...'}
                        className="flex-1"
                      />
                      <button
                        type="button" onClick={() => rmSpot(i)}
                        className="p-1.5 rounded-[var(--radius)] hover:opacity-80 shrink-0"
                        style={{ color: 'var(--color-error-foreground)' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button" onClick={addSpot}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-lg)] text-sm border-dashed hover:opacity-80"
                  style={{ border: '1.5px dashed var(--color-border)', color: 'var(--color-muted-foreground)' }}
                >
                  <Plus className="h-4 w-4" /> 箇所を追加する
                </button>
              </CardContent>
            </Card>

            {/* 作業詳細（スポット固有） */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業詳細</h2>
                <Textarea
                  label="作業内容"
                  value={form.work_content}
                  onChange={e => upd('work_content', e.target.value)}
                  placeholder="床洗浄・ワックス施工、ガラス清掃..."
                  rows={3}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="必要人数"
                    type="number" min="1"
                    value={form.required_staff}
                    onChange={e => upd('required_staff', e.target.value)}
                  />
                  <Input
                    label="予定時間（時間）"
                    type="number" step="0.5" min="0"
                    value={form.estimated_hours}
                    onChange={e => upd('estimated_hours', e.target.value)}
                    placeholder="3.5"
                  />
                </div>
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
                  <SelectTrigger>
                    <SelectValue placeholder="顧客を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
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
                      <span
                        key={i}
                        className="text-xs px-2 py-1 rounded-[var(--radius)]"
                        style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '登録中...' : '登録する'}
            </Button>
            <Link href="/projects/spot">
              <Button type="button" variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4" /> キャンセル
              </Button>
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
