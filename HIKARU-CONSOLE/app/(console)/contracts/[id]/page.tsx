'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  PageHeader, Button, Card, CardContent, CardHeader, CardTitle,
  Badge, Skeleton, toast, Input, Textarea, Select,
  SelectTrigger, SelectValue, SelectContent, SelectItem,
  Switch, Breadcrumb,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@hikaru/ui'
import {
  CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS, COUNTERPARTY_LABELS,
  SIGN_PROVIDER_LABELS, URGENCY_CONFIG, formatContractDate,
  type ContractStatus,
} from '@/lib/contracts/service'
import {
  Pencil, Save, X, Upload, FileText, Download, Eye, Globe, GlobeLock,
  CheckCircle2, AlertTriangle, Clock, History, Plus, Trash2,
} from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b last:border-0" style={{ borderColor: `${GOLD}18` }}>
      <dt className="text-[10px] font-medium mb-0.5 uppercase tracking-wider" style={{ color: `${GOLD}66` }}>{label}</dt>
      <dd className="text-sm" style={{ color: 'oklch(0.85 0.005 75)' }}>{value ?? '—'}</dd>
    </div>
  )
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const colorMap: Record<ContractStatus, string> = {
    draft: 'oklch(0.55 0.008 75)', sent: 'oklch(0.65 0.15 220)', reviewing: 'oklch(0.73 0.12 78)',
    signed: 'oklch(0.65 0.15 160)', active: 'oklch(0.68 0.18 160)', expired: 'oklch(0.65 0.25 27)', terminated: 'oklch(0.50 0.005 75)',
  }
  const color = colorMap[status] ?? 'oklch(0.55 0.008 75)'
  return (
    <span className="inline-block px-2.5 py-1 rounded text-xs font-bold"
      style={{ color, background: `${color}22`, border: `1px solid ${color}44` }}>
      {CONTRACT_STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [contract,    setContract]   = React.useState<any>(null)
  const [currentFile, setCurrentFile]= React.useState<any>(null)
  const [allFiles,    setAllFiles]   = React.useState<any[]>([])
  const [events,      setEvents]     = React.useState<any[]>([])
  const [loading,     setLoading]    = React.useState(true)

  const [editing,  setEditing]  = React.useState(false)
  const [saving,   setSaving]   = React.useState(false)
  const [form,     setForm]     = React.useState<any>({})

  const [uploading,    setUploading]    = React.useState(false)
  const [signDialogOpen, setSignDialogOpen] = React.useState(false)
  const [signProvider, setSignProvider]   = React.useState('manual')
  const [signing,      setSigning]        = React.useState(false)

  const [clients,  setClients]  = React.useState<any[]>([])
  const [partners, setPartners] = React.useState<any[]>([])
  const [projects, setProjects] = React.useState<any[]>([])

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const [contractRes, eventsRes] = await Promise.all([
        fetch(`/api/contracts/${id}`,         { credentials: 'include' }),
        fetch(`/api/contracts/${id}/events`,   { credentials: 'include' }),
      ])
      if (!contractRes.ok) { toast.error('契約が見つかりません'); router.push('/contracts'); return }
      const cd = await contractRes.json()
      const ed = eventsRes.ok ? await eventsRes.json() : { events: [] }

      setContract(cd.contract)
      setCurrentFile(cd.current_file)
      setAllFiles(cd.files ?? [])
      setEvents(ed.events ?? [])
      setForm({
        title:            cd.contract.title,
        contract_number:  cd.contract.contract_number ?? '',
        counterparty_type:cd.contract.counterparty_type,
        client_id:        cd.contract.client_id ?? '',
        partner_id:       cd.contract.partner_id ?? '',
        project_id:       cd.contract.project_id ?? '',
        contract_type:    cd.contract.contract_type,
        start_date:       cd.contract.start_date ?? '',
        end_date:         cd.contract.end_date   ?? '',
        renewal_date:     cd.contract.renewal_date ?? '',
        auto_renewal:     cd.contract.auto_renewal,
        status:           cd.contract.status,
        notes:            cd.contract.notes ?? '',
        internal_memo:    cd.contract.internal_memo ?? '',
      })
    } catch { toast.error('データの取得に失敗しました') }
    finally { setLoading(false) }
  }

  React.useEffect(() => {
    if (!editing) return
    Promise.all([
      fetch('/api/clients?active=true',  { credentials: 'include' }).then(r => r.json()),
      fetch('/api/partners?active=true', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/projects',             { credentials: 'include' }).then(r => r.json()),
    ]).then(([c, p, pr]) => {
      setClients( c.clients  ?? [])
      setPartners(p.partners ?? [])
      setProjects(pr.projects ?? pr.data ?? [])
    }).catch(() => {})
  }, [editing])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: 'PUT',
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
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('保存しました')
      setEditing(false)
      loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存に失敗しました')
    } finally { setSaving(false) }
  }

  async function handlePublishToggle() {
    try {
      const res = await fetch(`/api/contracts/${id}/publish`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !contract.published_to_portal }),
      })
      if (!res.ok) throw new Error()
      toast.success(contract.published_to_portal ? '公開を取り消しました' : 'ポータルへ公開しました')
      loadAll()
    } catch { toast.error('操作に失敗しました') }
  }

  async function handleSign() {
    setSigning(true)
    try {
      const res = await fetch(`/api/contracts/${id}/sign`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_provider: signProvider }),
      })
      if (!res.ok) throw new Error()
      toast.success('契約を締結しました')
      setSignDialogOpen(false)
      loadAll()
    } catch { toast.error('締結処理に失敗しました') }
    finally { setSigning(false) }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/contracts/${id}/upload`, {
        method: 'POST', credentials: 'include', body: fd,
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('契約書をアップロードしました')
      loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'アップロードに失敗しました')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(version?: number) {
    try {
      const url = version
        ? `/api/contracts/${id}/file?version=${version}`
        : `/api/contracts/${id}/file`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const { url: signedUrl, file_name } = await res.json()
      const a = document.createElement('a')
      a.href = signedUrl
      a.download = file_name
      a.click()
    } catch { toast.error('ダウンロードに失敗しました') }
  }

  async function handleDelete() {
    if (!confirm('この契約を解約（削除）しますか？\n監査ログは保持されます。')) return
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      toast.success('契約を解約しました')
      router.push('/contracts')
    } catch { toast.error('操作に失敗しました') }
  }

  const eventTypeLabels: Record<string, string> = {
    created:       '作成',
    updated:       '更新',
    status_changed:'ステータス変更',
    period_changed:'期間変更',
    file_uploaded: 'ファイルアップロード',
    file_replaced: 'ファイル差し替え',
    published:     'ポータル公開設定',
    signed:        '締結',
    terminated:    '解約',
  }

  if (loading) return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64" />
    </div>
  )

  if (!contract) return null

  const deadline = contract.deadline as { daysUntilExpiry: number | null; urgency: import('@/lib/contracts/service').DeadlineUrgency; label: string } | null
  const urgencyCfg = deadline ? URGENCY_CONFIG[deadline.urgency] : null

  return (
    <div className="flex flex-col gap-6 p-6">
      <Breadcrumb items={[
        { label: '契約管理', href: '/contracts' },
        { label: contract.title },
      ]} />

      <PageHeader
        title={contract.title}
        description={`${COUNTERPARTY_LABELS[contract.counterparty_type as 'client' | 'partner'] ?? contract.counterparty_type} • ${CONTRACT_TYPE_LABELS[contract.contract_type as keyof typeof CONTRACT_TYPE_LABELS] ?? contract.contract_type}`}
        actions={
          <div className="flex items-center gap-2">
            {!editing && contract.status !== 'signed' && contract.status !== 'active' && (
              <Button size="sm" variant="outline" onClick={() => setSignDialogOpen(true)}
                style={{ borderColor: `oklch(0.65 0.15 160)44`, color: 'oklch(0.65 0.15 160)' }}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />締結
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handlePublishToggle}
              style={{ borderColor: `${GOLD}44`, color: GOLD }}>
              {contract.published_to_portal
                ? <><GlobeLock className="h-4 w-4 mr-1.5" />公開取消</>
                : <><Globe className="h-4 w-4 mr-1.5" />ポータル公開</>
              }
            </Button>
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} style={{ borderColor: `${GOLD}44`, color: GOLD }}>
                  <X className="h-4 w-4 mr-1.5" />キャンセル
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}
                  style={{ background: `linear-gradient(135deg, oklch(0.52 0.10 75), ${GOLD})`, color: 'oklch(0.06 0.003 260)' }}>
                  <Save className="h-4 w-4 mr-1.5" />{saving ? '保存中...' : '保存'}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} style={{ borderColor: `${GOLD}44`, color: GOLD }}>
                  <Pencil className="h-4 w-4 mr-1.5" />編集
                </Button>
                {contract.status !== 'terminated' && (
                  <Button size="sm" variant="outline" onClick={handleDelete}
                    style={{ borderColor: 'oklch(0.65 0.25 27 / 0.4)', color: 'oklch(0.65 0.25 27)' }}>
                    <Trash2 className="h-4 w-4 mr-1.5" />解約
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* 期限アラートバナー */}
      {urgencyCfg && deadline && (deadline.urgency === 'expired' || deadline.urgency === 'critical' || deadline.urgency === 'warning') && (
        <div className="rounded-[var(--radius)] px-4 py-3 flex items-center gap-3"
          style={{ background: urgencyCfg.bgColor, border: `1px solid ${urgencyCfg.borderColor}` }}>
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: urgencyCfg.textColor }} />
          <p className="text-sm font-medium" style={{ color: urgencyCfg.textColor }}>
            {deadline.urgency === 'expired'
              ? `契約終了日を${Math.abs(deadline.daysUntilExpiry ?? 0)}日超過しています（${formatContractDate(contract.end_date)}）`
              : `契約終了まで${deadline.label}です（${formatContractDate(contract.end_date)}）`
            }
            {contract.auto_renewal && ' ※ 自動更新契約'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 左: 契約詳細 */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {editing ? (
            /* 編集フォーム */
            <Card style={{ background: 'oklch(0.08 0.002 260)', border: `1px solid ${GOLD}22` }}>
              <CardHeader>
                <CardTitle style={{ color: GOLD, fontSize: 14 }}>契約情報を編集</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>契約名</label>
                  <Input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
                    style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>契約番号</label>
                    <Input value={form.contract_number} onChange={e => setForm((f: any) => ({ ...f, contract_number: e.target.value }))}
                      style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>契約種類</label>
                    <Select value={form.contract_type} onValueChange={v => setForm((f: any) => ({ ...f, contract_type: v }))}>
                      <SelectTrigger style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>ステータス</label>
                  <Select value={form.status} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))}>
                    <SelectTrigger style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['start_date', 'end_date', 'renewal_date'] as const).map(field => (
                    <div key={field}>
                      <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>
                        {field === 'start_date' ? '開始日' : field === 'end_date' ? '終了日' : '更新日'}
                      </label>
                      <Input type="date" value={(form as any)[field]} onChange={e => setForm((f: any) => ({ ...f, [field]: e.target.value }))}
                        style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.auto_renewal} onCheckedChange={v => setForm((f: any) => ({ ...f, auto_renewal: v }))} />
                  <span className="text-sm" style={{ color: 'oklch(0.75 0.005 75)' }}>自動更新</span>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>関連案件</label>
                  <Select value={form.project_id} onValueChange={v => setForm((f: any) => ({ ...f, project_id: v }))}>
                    <SelectTrigger style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }}>
                      <SelectValue placeholder="案件（任意）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">なし</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>備考</label>
                  <Textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3}
                    style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: `${GOLD}cc` }}>
                    内部メモ <span className="text-[10px]" style={{ color: `${GOLD}59` }}>（管理者のみ）</span>
                  </label>
                  <Textarea value={form.internal_memo} onChange={e => setForm((f: any) => ({ ...f, internal_memo: e.target.value }))} rows={2}
                    style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }} />
                </div>
              </CardContent>
            </Card>
          ) : (
            /* 表示モード */
            <Card style={{ background: 'oklch(0.08 0.002 260)', border: `1px solid ${GOLD}22` }}>
              <CardHeader>
                <CardTitle style={{ color: GOLD, fontSize: 14 }}>契約詳細</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6">
                  <InfoRow label="ステータス" value={<StatusBadge status={contract.status} />} />
                  <InfoRow label="契約種類" value={CONTRACT_TYPE_LABELS[contract.contract_type as keyof typeof CONTRACT_TYPE_LABELS]} />
                  <InfoRow label="契約番号" value={contract.contract_number} />
                  <InfoRow label="契約相手" value={
                    <span>
                      {contract.clients?.name ?? contract.partners?.company_name}
                      <span className="text-[10px] ml-1.5 px-1 py-0.5 rounded" style={{ background: `${GOLD}22`, color: GOLD }}>
                        {COUNTERPARTY_LABELS[contract.counterparty_type as 'client' | 'partner']}
                      </span>
                    </span>
                  } />
                  <InfoRow label="契約開始日"   value={formatContractDate(contract.start_date)} />
                  <InfoRow label="契約終了日"    value={
                    <span className="flex items-center gap-2">
                      {formatContractDate(contract.end_date)}
                      {deadline && contract.end_date && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                          style={{ color: urgencyCfg?.textColor, background: urgencyCfg?.bgColor }}>
                          {deadline.label}
                        </span>
                      )}
                    </span>
                  } />
                  <InfoRow label="更新日" value={
                    <span className="flex items-center gap-2">
                      {formatContractDate(contract.renewal_date)}
                      {contract.auto_renewal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${GOLD}22`, color: GOLD }}>
                          自動更新
                        </span>
                      )}
                    </span>
                  } />
                  <InfoRow label="関連案件" value={
                    contract.projects
                      ? <Link href={`/projects/${contract.projects.id}`}
                          className="hover:underline" style={{ color: GOLD }}>
                          {contract.projects.name}
                        </Link>
                      : '—'
                  } />
                  {contract.signed_at && (
                    <>
                      <InfoRow label="締結日時" value={new Date(contract.signed_at).toLocaleString('ja-JP')} />
                      <InfoRow label="署名方法" value={SIGN_PROVIDER_LABELS[contract.sign_provider as keyof typeof SIGN_PROVIDER_LABELS] ?? contract.sign_provider} />
                    </>
                  )}
                  <InfoRow label="ポータル公開" value={
                    <span className="flex items-center gap-1.5">
                      {contract.published_to_portal
                        ? <><Globe className="h-3.5 w-3.5 inline" style={{ color: 'oklch(0.65 0.15 160)' }} /> 公開中</>
                        : <><GlobeLock className="h-3.5 w-3.5 inline" style={{ color: `${GOLD}66` }} /> 非公開</>
                      }
                    </span>
                  } />
                  {contract.notes && <div className="col-span-2"><InfoRow label="備考" value={contract.notes} /></div>}
                  {contract.internal_memo && <div className="col-span-2"><InfoRow label="内部メモ" value={contract.internal_memo} /></div>}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* 契約書ファイル */}
          <Card style={{ background: 'oklch(0.08 0.002 260)', border: `1px solid ${GOLD}22` }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle style={{ color: GOLD, fontSize: 14 }}>契約書ファイル</CardTitle>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button size="sm" variant="outline" disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    style={{ borderColor: `${GOLD}44`, color: GOLD }}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {uploading ? 'アップロード中...' : currentFile ? '差し替え' : 'アップロード'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allFiles.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: `${GOLD}59` }}>
                  契約書ファイルがありません
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {allFiles.map(f => (
                    <div key={f.id}
                      className="flex items-center justify-between p-3 rounded-[var(--radius)]"
                      style={{ background: f.is_current ? `${GOLD}11` : 'oklch(0.06 0.001 260)', border: `1px solid ${f.is_current ? GOLD + '33' : GOLD + '11'}` }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 shrink-0" style={{ color: f.is_current ? GOLD : `${GOLD}66` }} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: f.is_current ? GOLD : 'oklch(0.65 0.005 75)' }}>
                            v{f.version}: {f.file_name}
                          </div>
                          <div className="text-[10px]" style={{ color: `${GOLD}59` }}>
                            {f.file_size ? `${(f.file_size / 1024).toFixed(0)}KB` : ''} •{' '}
                            {new Date(f.created_at).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {f.is_current && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                            style={{ background: `${GOLD}22`, color: GOLD }}>最新</span>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleDownload(f.version)}
                          style={{ borderColor: `${GOLD}33`, color: GOLD, height: 28, padding: '0 8px' }}>
                          <Download className="h-3 w-3 mr-1" />DL
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] mt-3" style={{ color: `${GOLD}44` }}>
                ※ 対応形式: PDF・画像（JPG/PNG）・Word文書（.docx）/ 最大20MB
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 右: 履歴・リンク */}
        <div className="flex flex-col gap-4">

          {/* 関連リンク */}
          <Card style={{ background: 'oklch(0.08 0.002 260)', border: `1px solid ${GOLD}22` }}>
            <CardHeader>
              <CardTitle style={{ color: GOLD, fontSize: 14 }}>関連情報</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {contract.clients && (
                <Link href={`/clients/${contract.clients.id}`}
                  className="flex items-center gap-2 p-2 rounded-[var(--radius)] transition-colors hover:bg-[oklch(0.10_0.002_260)]"
                  style={{ border: `1px solid ${GOLD}22` }}>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${GOLD}22`, color: GOLD }}>顧客</span>
                  <span className="text-sm" style={{ color: 'oklch(0.85 0.005 75)' }}>{contract.clients.name}</span>
                </Link>
              )}
              {contract.partners && (
                <Link href={`/partners/${contract.partners.id}`}
                  className="flex items-center gap-2 p-2 rounded-[var(--radius)] transition-colors hover:bg-[oklch(0.10_0.002_260)]"
                  style={{ border: `1px solid ${GOLD}22` }}>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${GOLD}22`, color: GOLD }}>協力業者</span>
                  <span className="text-sm" style={{ color: 'oklch(0.85 0.005 75)' }}>{contract.partners.company_name}</span>
                </Link>
              )}
              {contract.projects && (
                <Link href={`/projects/${contract.projects.id}`}
                  className="flex items-center gap-2 p-2 rounded-[var(--radius)] transition-colors hover:bg-[oklch(0.10_0.002_260)]"
                  style={{ border: `1px solid ${GOLD}22` }}>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${GOLD}22`, color: GOLD }}>案件</span>
                  <span className="text-sm" style={{ color: 'oklch(0.85 0.005 75)' }}>{contract.projects.name}</span>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* 契約履歴 */}
          <Card style={{ background: 'oklch(0.08 0.002 260)', border: `1px solid ${GOLD}22` }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: GOLD, fontSize: 14 }}>
                <History className="h-4 w-4" />契約履歴
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-xs" style={{ color: `${GOLD}59` }}>履歴がありません</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {events.map(e => (
                    <div key={e.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ background: GOLD, boxShadow: `0 0 4px ${GOLD}` }} />
                        <div className="w-px flex-1 mt-1" style={{ background: `${GOLD}22` }} />
                      </div>
                      <div className="pb-3 min-w-0">
                        <p className="text-xs font-medium" style={{ color: 'oklch(0.85 0.005 75)' }}>
                          {e.description ?? eventTypeLabels[e.event_type] ?? e.event_type}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: `${GOLD}59` }}>
                          {e.actor?.name ?? '不明'} • {new Date(e.created_at).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 締結ダイアログ */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent style={{ background: 'oklch(0.08 0.002 260)', border: `1px solid ${GOLD}33` }}>
          <DialogHeader>
            <DialogTitle style={{ color: GOLD }}>契約を締結する</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm mb-4" style={{ color: 'oklch(0.75 0.005 75)' }}>
              締結方法を選択してください。<br />
              <span className="text-[11px]" style={{ color: `${GOLD}66` }}>
                ※ CloudSign / DocuSign は将来のAPI連携用です。現在は手動締結のみ有効です。
              </span>
            </p>
            <Select value={signProvider} onValueChange={setSignProvider}>
              <SelectTrigger style={{ background: 'oklch(0.06 0.001 260)', borderColor: `${GOLD}33` }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SIGN_PROVIDER_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignDialogOpen(false)}
              style={{ borderColor: `${GOLD}44`, color: GOLD }}>キャンセル</Button>
            <Button onClick={handleSign} disabled={signing}
              style={{ background: `linear-gradient(135deg, oklch(0.52 0.10 75), ${GOLD})`, color: 'oklch(0.06 0.003 260)' }}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {signing ? '処理中...' : '締結する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
