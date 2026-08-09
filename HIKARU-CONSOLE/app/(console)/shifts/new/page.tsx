'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
  PageHeader, Breadcrumb, Button, Input, Card, CardContent, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { ArrowLeft, AlertTriangle, User, Building2 } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'
const WARN = 'oklch(0.75 0.20 60)'

interface Project { id: string; name: string; location_name: string | null; project_type: string }
interface Employee { id: string; name: string; name_kana: string | null }
interface Partner  { id: string; company_name: string; contact_person_name: string | null }
interface Overlap  { shift_id: string; project_name: string; start_time: string; end_time: string }

function NewShiftForm() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const [saving, setSaving] = React.useState(false)

  const [projects,   setProjects]   = React.useState<Project[]>([])
  const [employees,  setEmployees]  = React.useState<Employee[]>([])
  const [partners,   setPartners]   = React.useState<Partner[]>([])
  const [overlaps,   setOverlaps]   = React.useState<Overlap[]>([])
  const [overlapChecking, setOverlapChecking] = React.useState(false)

  const [form, setForm] = React.useState({
    project_id:    '',
    assignee_type: 'employee' as 'employee' | 'partner',
    assignee_id:   '',
    shift_date:    searchParams?.get('date') ?? new Date().toISOString().split('T')[0],
    start_time:    '09:00',
    end_time:      '17:00',
    notes:         '',
    status:        'scheduled',
  })

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  // マスタデータ取得
  React.useEffect(() => {
    fetch('/api/projects?pageSize=200&status=active', { credentials: 'include' })
      .then(r => r.json()).then(d => setProjects(d.projects ?? []))
    fetch('/api/employees?pageSize=200', { credentials: 'include' })
      .then(r => r.json()).then(d => setEmployees(d.employees ?? []))
    fetch('/api/partners?pageSize=200', { credentials: 'include' })
      .then(r => r.json()).then(d => setPartners(d.partners ?? []))
  }, [])

  // 重複チェック（担当者・日時が揃ったら）
  React.useEffect(() => {
    if (!form.assignee_id || !form.shift_date || !form.start_time || !form.end_time) {
      setOverlaps([]); return
    }
    setOverlapChecking(true)
    fetch(
      `/api/shifts/overlap?assignee_type=${form.assignee_type}&assignee_id=${form.assignee_id}` +
      `&date=${form.shift_date}&start=${form.start_time}&end=${form.end_time}`,
      { credentials: 'include' }
    )
      .then(r => r.json())
      .then(d => setOverlaps(d.overlaps ?? []))
      .finally(() => setOverlapChecking(false))
  }, [form.assignee_id, form.assignee_type, form.shift_date, form.start_time, form.end_time])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id)  { toast.error('案件を選択してください');  return }
    if (!form.assignee_id) { toast.error('担当者を選択してください'); return }
    if (form.start_time >= form.end_time) { toast.error('開始時間は終了時間より前にしてください'); return }

    setSaving(true)
    const body = {
      project_id:   form.project_id,
      assignee_type: form.assignee_type,
      employee_id:  form.assignee_type === 'employee' ? form.assignee_id : undefined,
      partner_id:   form.assignee_type === 'partner'  ? form.assignee_id : undefined,
      shift_date:   form.shift_date,
      start_time:   form.start_time,
      end_time:     form.end_time,
      notes:        form.notes || null,
      status:       form.status,
    }

    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    if (res.ok) {
      toast.success('シフトを登録しました')
      router.push('/shifts')
    } else {
      const j = await res.json()
      toast.error(j.error ?? '登録に失敗しました')
      setSaving(false)
    }
  }

  const selectedProject  = projects.find(p => p.id === form.project_id)
  const assigneeOptions  = form.assignee_type === 'employee' ? employees : partners
  const assigneeLabel    = form.assignee_type === 'employee' ? '従業員' : '協力業者'

  return (
    <div>
      <PageHeader
        title="シフト追加"
        breadcrumb={
          <Breadcrumb items={[
            { label: 'シフト管理', href: '/shifts' },
            { label: 'シフト追加' },
          ]} />
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* 案件選択 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: `${GOLD}85` }}>
                  案件
                </h2>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">
                    案件 *
                  </label>
                  <Select value={form.project_id} onValueChange={v => upd('project_id', v)}>
                    <SelectTrigger><SelectValue placeholder="案件を選択" /></SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 案件プレビュー */}
                {selectedProject && (
                  <div className="rounded-[var(--radius)] p-3 space-y-1"
                    style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}22` }}>
                    <p className="text-xs font-semibold" style={{ color: GOLD }}>{selectedProject.name}</p>
                    {selectedProject.location_name && (
                      <p className="text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>
                        {selectedProject.location_name}
                      </p>
                    )}
                    <p className="text-[10px]" style={{ color: 'oklch(0.45 0.005 75)' }}>
                      {{ spot:'単発', recurring:'定期', hotel:'ホテル' }[selectedProject.project_type] ?? ''}案件
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 担当者 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: `${GOLD}85` }}>
                  担当者
                </h2>

                {/* 担当種別 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">担当種別 *</label>
                  <div className="flex gap-2">
                    {(['employee', 'partner'] as const).map(type => (
                      <button key={type} type="button"
                        onClick={() => { upd('assignee_type', type); upd('assignee_id', '') }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius)] text-sm font-medium transition-all"
                        style={form.assignee_type === type
                          ? { background: `${GOLD}22`, border: `1px solid ${GOLD}60`, color: GOLD }
                          : { background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        {type === 'employee' ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                        {type === 'employee' ? '従業員' : '協力業者'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 担当者選択 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">
                    {assigneeLabel} *
                  </label>
                  <Select value={form.assignee_id} onValueChange={v => upd('assignee_id', v)}>
                    <SelectTrigger><SelectValue placeholder={`${assigneeLabel}を選択`} /></SelectTrigger>
                    <SelectContent>
                      {form.assignee_type === 'employee'
                        ? employees.map(e => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name}{e.name_kana ? ` (${e.name_kana})` : ''}
                            </SelectItem>
                          ))
                        : partners.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.company_name}{p.contact_person_name ? ` / ${p.contact_person_name}` : ''}
                            </SelectItem>
                          ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                {/* 重複警告 */}
                {overlaps.length > 0 && (
                  <div className="rounded-[var(--radius)] p-3 space-y-2"
                    style={{ background: `${WARN}10`, border: `1px solid ${WARN}40` }}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: WARN }} />
                      <p className="text-xs font-bold" style={{ color: WARN }}>
                        この時間帯に別のシフトが存在します
                      </p>
                    </div>
                    {overlaps.map(o => (
                      <p key={o.shift_id} className="text-xs ml-6" style={{ color: 'oklch(0.70 0.010 75)' }}>
                        {o.project_name} {o.start_time.slice(0,5)}〜{o.end_time.slice(0,5)}
                      </p>
                    ))}
                    <p className="text-[10px] ml-6" style={{ color: 'oklch(0.55 0.007 75)' }}>
                      管理者権限で上書き登録できます。
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 日時 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: `${GOLD}85` }}>
                  日時（予定）
                </h2>
                <Input
                  label="日付 *"
                  type="date"
                  value={form.shift_date}
                  onChange={e => upd('shift_date', e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="開始時間 *"
                    type="time"
                    value={form.start_time}
                    onChange={e => upd('start_time', e.target.value)}
                    required
                  />
                  <Input
                    label="終了時間 *"
                    type="time"
                    value={form.end_time}
                    onChange={e => upd('end_time', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">
                    ステータス
                  </label>
                  <Select value={form.status} onValueChange={v => upd('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">予定</SelectItem>
                      <SelectItem value="confirmed">確定</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* 備考 */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: `${GOLD}85` }}>
                  備考
                </h2>
                <textarea
                  value={form.notes}
                  onChange={e => upd('notes', e.target.value)}
                  rows={3}
                  placeholder="特記事項があれば記入"
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:ring-1 resize-none"
                  style={{ focusRingColor: GOLD } as React.CSSProperties}
                />
              </CardContent>
            </Card>
          </div>

          {/* 右カラム */}
          <div className="flex flex-col gap-4 h-fit lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
            <Card>
              <CardContent className="pt-6 space-y-2 text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>
                <p className="font-semibold text-sm" style={{ color: 'oklch(0.90 0.008 75)' }}>
                  SHIFT と JOB の違い
                </p>
                <p className="font-medium" style={{ color: GOLD }}>SHIFT = 予定</p>
                <p>誰をどの案件に何時から配置するかの計画。</p>
                <p className="font-medium mt-2" style={{ color: 'oklch(0.75 0.20 145)' }}>JOB = 実績</p>
                <p>実際に作業した記録。作業者がアプリで記録。</p>
              </CardContent>
            </Card>

            <Button type="submit" disabled={saving || overlapChecking} className="w-full">
              {saving ? '登録中...' : 'シフトを登録'}
            </Button>
            <Link href="/shifts">
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

export default function NewShiftPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48"><div className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'oklch(0.73 0.12 78 / 0.6)', borderTopColor: 'transparent' }} /></div>}>
      <NewShiftForm />
    </Suspense>
  )
}
