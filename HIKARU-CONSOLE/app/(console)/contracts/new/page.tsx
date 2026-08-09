'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, Input, Textarea, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Switch, Breadcrumb,
} from '@hikaru/ui'
import { CONTRACT_TYPE_LABELS } from '@/lib/contracts/service'
import { ArrowLeft, Save } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

interface ClientOption  { id: string; name: string }
interface PartnerOption { id: string; name: string }
interface ProjectOption { id: string; title: string }

export default function NewContractPage() {
  const router = useRouter()

  const [clients,  setClients]  = React.useState<ClientOption[]>([])
  const [partners, setPartners] = React.useState<PartnerOption[]>([])
  const [projects, setProjects] = React.useState<ProjectOption[]>([])

  const [form, setForm] = React.useState({
    title:            '',
    contract_number:  '',
    counterparty_type:'client' as 'client' | 'partner',
    client_id:        '',
    partner_id:       '',
    project_id:       '',
    contract_type:    'service',
    start_date:       '',
    end_date:         '',
    renewal_date:     '',
    auto_renewal:     false,
    notes:            '',
    internal_memo:    '',
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    Promise.all([
      fetch('/api/clients?active=true', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/partners?active=true', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/projects',            { credentials: 'include' }).then(r => r.json()),
    ]).then(([c, p, pr]) => {
      setClients( c.clients  ?? [])
      setPartners(p.partners ?? [])
      setProjects(pr.projects ?? pr.data ?? [])
    }).catch(() => {})
  }, [])

  function set(key: string, value: unknown) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('契約名を入力してください'); return }
    if (form.counterparty_type === 'client'  && !form.client_id)  { toast.error('顧客を選択してください'); return }
    if (form.counterparty_type === 'partner' && !form.partner_id) { toast.error('協力業者を選択してください'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          start_date:   form.start_date   || null,
          end_date:     form.end_date     || null,
          renewal_date: form.renewal_date || null,
          project_id:   form.project_id   || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      const { contract } = await res.json()
      toast.success('契約を登録しました')
      router.push(`/contracts/${contract.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <Breadcrumb items={[{ label: '契約管理', href: '/contracts' }, { label: '新規契約' }]} />
      <PageHeader
        title="新規契約登録"
        description="契約情報を入力してください"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.back()} style={{ borderColor: `${GOLD}44`, color: GOLD }}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />戻る
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}
              style={{ background: `linear-gradient(135deg, oklch(0.52 0.10 75), ${GOLD})`, color: 'oklch(0.06 0.003 260)' }}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        }
      />

      <Card style={{ background: 'oklch(0.08 0.002 260)', border: `1px solid ${GOLD}22` }}>
        <CardContent className="p-6 flex flex-col gap-5">

          {/* 基本情報 */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: `${GOLD}80` }}>基本情報</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>
                  契約名 <span style={{ color: 'oklch(0.65 0.25 27)' }}>*</span>
                </label>
                <Input value={form.title} onChange={e => set('title', e.target.value)}
                  placeholder="例: ○○ビル定期清掃業務委託契約"
                  style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>契約番号</label>
                  <Input value={form.contract_number} onChange={e => set('contract_number', e.target.value)}
                    placeholder="例: CON-2026-001"
                    style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>契約種類</label>
                  <Select value={form.contract_type} onValueChange={v => set('contract_type', v)}>
                    <SelectTrigger style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>

          <div style={{ borderTop: `1px solid ${GOLD}18` }} />

          {/* 契約相手 */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: `${GOLD}80` }}>契約相手</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>
                  契約相手種別 <span style={{ color: 'oklch(0.65 0.25 27)' }}>*</span>
                </label>
                <div className="flex gap-2">
                  {(['client', 'partner'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => set('counterparty_type', t)}
                      className="flex-1 py-2 rounded-[var(--radius)] text-sm font-medium transition-all"
                      style={form.counterparty_type === t ? {
                        background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}66`,
                      } : {
                        background: 'oklch(0.06 0.001 260)', color: 'oklch(0.55 0.008 75)', border: `1px solid ${GOLD}22`,
                      }}
                    >
                      {t === 'client' ? '顧客' : '協力業者'}
                    </button>
                  ))}
                </div>
              </div>
              {form.counterparty_type === 'client' && (
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>
                    顧客 <span style={{ color: 'oklch(0.65 0.25 27)' }}>*</span>
                  </label>
                  <Select value={form.client_id} onValueChange={v => set('client_id', v)}>
                    <SelectTrigger style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }}>
                      <SelectValue placeholder="顧客を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.counterparty_type === 'partner' && (
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>
                    協力業者 <span style={{ color: 'oklch(0.65 0.25 27)' }}>*</span>
                  </label>
                  <Select value={form.partner_id} onValueChange={v => set('partner_id', v)}>
                    <SelectTrigger style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }}>
                      <SelectValue placeholder="協力業者を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>関連案件（任意）</label>
                <Select value={form.project_id} onValueChange={v => set('project_id', v)}>
                  <SelectTrigger style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }}>
                    <SelectValue placeholder="案件を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">紐付けなし</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <div style={{ borderTop: `1px solid ${GOLD}18` }} />

          {/* 契約期間 */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: `${GOLD}80` }}>契約期間</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>契約開始日</label>
                <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                  style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>契約終了日</label>
                <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                  style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>更新日</label>
                <Input type="date" value={form.renewal_date} onChange={e => set('renewal_date', e.target.value)}
                  style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <Switch
                checked={form.auto_renewal}
                onCheckedChange={v => set('auto_renewal', v)}
                id="auto_renewal"
              />
              <label htmlFor="auto_renewal" className="text-sm cursor-pointer" style={{ color: 'oklch(0.75 0.005 75)' }}>
                自動更新契約
                <span className="text-[10px] ml-1.5" style={{ color: `${GOLD}66` }}>
                  ※ ONにすると期限前に更新確認通知が送られます
                </span>
              </label>
            </div>
          </section>

          <div style={{ borderTop: `1px solid ${GOLD}18` }} />

          {/* 備考 */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: `${GOLD}80` }}>備考・内部メモ</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>備考</label>
                <Textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                  placeholder="契約に関するメモ"
                  rows={3}
                  style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>
                  内部メモ
                  <span className="text-[10px] ml-1.5" style={{ color: `${GOLD}59` }}>（管理者のみ閲覧）</span>
                </label>
                <Textarea value={form.internal_memo} onChange={e => set('internal_memo', e.target.value)}
                  placeholder="社内向けのメモ（顧客・協力業者には非公開）"
                  rows={2}
                  style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
              </div>
            </div>
          </section>

        </CardContent>
      </Card>
    </div>
  )
}
