'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  getPartner,
  updatePartner,
  changePartnerPassword,
  deletePartner,
  partnerStatusLabel,
  partnerStatusOptions,
  type PartnerDetail,
  type PartnerStatus,
} from '@/services/partners.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@hikaru/ui'
import { ArrowLeft, Save, Key, Trash2, FolderOpen, Building2, Lock, Pencil, RefreshCw, Eye, EyeOff, FileSignature } from 'lucide-react'
import { CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS, calculateDeadlineInfo, URGENCY_CONFIG, formatContractDate } from '@/lib/contracts/service'
import { LineStatusCard } from '@/components/console/LineStatusCard'

const statusVariant: Record<PartnerStatus, string> = {
  active:     'success',
  suspended:  'warning',
  terminated: 'secondary',
  deleted:    'secondary',
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-2.5 border-b border-[var(--color-border)] last:border-0">
      <dt className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">{label}</dt>
      <dd className="text-sm text-[var(--color-foreground)]">{value || '—'}</dd>
    </div>
  )
}

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [partner, setPartner]   = React.useState<PartnerDetail | null>(null)
  const [loading, setLoading]   = React.useState(true)
  const [editing, setEditing]   = React.useState(false)
  const [saving, setSaving]     = React.useState(false)
  const [showDelete, setShowDelete] = React.useState(false)
  const [form, setForm] = React.useState<Partial<PartnerDetail>>({})

  // パスワード変更
  const [showPwForm, setShowPwForm] = React.useState(false)
  const [newPw, setNewPw]       = React.useState('')
  const [showPwText, setShowPwText] = React.useState(false)
  const [pwSaving, setPwSaving] = React.useState(false)

  // 契約一覧
  const [contracts, setContracts] = React.useState<any[]>([])

  React.useEffect(() => {
    loadData()
    fetch(`/api/contracts?counterparty_type=partner`, { credentials: 'include' })
      .then(r => r.json())
      .then(r => setContracts((r.contracts ?? []).filter((c: any) => c.partners?.id === id)))
      .catch(() => {})
  }, [id]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    const data = await getPartner(id)
    setPartner(data)
    if (data) {
      setForm({
        company_name:        data.company_name,
        company_name_kana:   data.company_name_kana,
        contact_person_name: data.contact_person_name,
        contact_person_kana: data.contact_person_kana,
        phone:               data.phone,
        email:               data.email,
        address:             data.address,
        contract_start_date: data.contract_start_date,
        contract_end_date:   data.contract_end_date,
        service_areas:       data.service_areas,
        service_types:       data.service_types,
        qualifications:      data.qualifications,
        notes:               data.notes,
        status:              data.status,
      })
    }
    setLoading(false)
  }

  function update(key: string, value: any) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  function splitLines(value: string): string[] {
    return value.split(/[、,\n]/).map((s) => s.trim()).filter(Boolean)
  }

  async function handleSave() {
    if (!form.company_name?.trim()) { toast.error('会社名を入力してください'); return }
    setSaving(true)
    const { error } = await updatePartner(id, form as any)
    if (error) {
      toast.error('更新に失敗しました: ' + error)
    } else {
      toast.success('更新しました')
      setEditing(false)
      await loadData()
    }
    setSaving(false)
  }

  async function handleDelete() {
    const { error } = await deletePartner(id)
    if (error) {
      toast.error('削除に失敗しました: ' + error)
    } else {
      toast.success('協力業者を削除しました')
      router.push('/partners')
    }
  }

  async function handlePasswordChange() {
    if (newPw.length < 8) { toast.error('8文字以上で入力してください'); return }
    setPwSaving(true)
    const { error } = await changePartnerPassword(id, newPw)
    if (error) {
      toast.error('変更に失敗しました: ' + error)
    } else {
      toast.success('パスワードを変更しました')
      setShowPwForm(false)
      setNewPw('')
    }
    setPwSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!partner) {
    return <div className="text-center py-20 text-[var(--color-muted-foreground)]">協力業者が見つかりません</div>
  }

  return (
    <div>
      <PageHeader
        title={partner.company_name}
        breadcrumb={
          <Breadcrumb items={[{ label: '協力業者管理', href: '/partners' }, { label: partner.company_name }]} />
        }
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); loadData() }}>キャンセル</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> 編集
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左カラム */}
        <div className="lg:col-span-2 space-y-6">

          {/* 基本情報 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4" /> 基本情報
              </h2>
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="会社名 *" value={form.company_name ?? ''} onChange={(e) => update('company_name', e.target.value)} />
                    <Input label="会社名カナ" value={form.company_name_kana ?? ''} onChange={(e) => update('company_name_kana', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="担当者名" value={form.contact_person_name ?? ''} onChange={(e) => update('contact_person_name', e.target.value)} />
                    <Input label="担当者カナ" value={form.contact_person_kana ?? ''} onChange={(e) => update('contact_person_kana', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="電話番号" type="tel" value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
                    <Input label="メールアドレス" type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} />
                  </div>
                  <Textarea label="住所" value={form.address ?? ''} onChange={(e) => update('address', e.target.value)} rows={2} />
                </>
              ) : (
                <dl>
                  <InfoRow label="会社名"     value={partner.company_name} />
                  <InfoRow label="会社名カナ"  value={partner.company_name_kana} />
                  <InfoRow label="担当者名"    value={partner.contact_person_name} />
                  <InfoRow label="担当者カナ"  value={partner.contact_person_kana} />
                  <InfoRow label="電話番号"    value={partner.phone} />
                  <InfoRow label="メールアドレス" value={partner.email} />
                  <InfoRow label="住所"       value={partner.address} />
                </dl>
              )}
            </CardContent>
          </Card>

          {/* 契約情報 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">契約情報</h2>
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">ステータス</label>
                      <Select value={form.status ?? 'active'} onValueChange={(v) => update('status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {partnerStatusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="契約開始日" type="date" value={form.contract_start_date ?? ''} onChange={(e) => update('contract_start_date', e.target.value)} />
                    <Input label="契約終了日" type="date" value={form.contract_end_date ?? ''} onChange={(e) => update('contract_end_date', e.target.value)} />
                  </div>
                  <Textarea label="対応可能エリア（改行区切り）" value={(form.service_areas ?? []).join('\n')} onChange={(e) => update('service_areas', splitLines(e.target.value))} rows={3} />
                  <Textarea label="対応可能業務（改行区切り）" value={(form.service_types ?? []).join('\n')} onChange={(e) => update('service_types', splitLines(e.target.value))} rows={3} />
                  <Textarea label="保有資格（改行区切り）" value={(form.qualifications ?? []).join('\n')} onChange={(e) => update('qualifications', splitLines(e.target.value))} rows={3} />
                  <Textarea label="備考" value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} rows={3} />
                </>
              ) : (
                <dl>
                  <InfoRow label="契約開始日"    value={partner.contract_start_date ? new Date(partner.contract_start_date).toLocaleDateString('ja-JP') : null} />
                  <InfoRow label="契約終了日"    value={partner.contract_end_date   ? new Date(partner.contract_end_date).toLocaleDateString('ja-JP')   : null} />
                  <InfoRow label="対応可能エリア" value={partner.service_areas.length ? partner.service_areas.join('、') : null} />
                  <InfoRow label="対応可能業務"   value={partner.service_types.length ? partner.service_types.join('、') : null} />
                  <InfoRow label="保有資格"       value={partner.qualifications.length ? partner.qualifications.join('、') : null} />
                  <InfoRow label="備考"           value={partner.notes} />
                </dl>
              )}
            </CardContent>
          </Card>

          {/* ログイン情報（新規ページと同スタイル） */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Lock className="h-4 w-4" /> ログイン情報
              </h2>
              <InfoRow label="ログインID（メールアドレス）" value={partner.loginEmail} />
              {partner.auth_user_id && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPwForm((v) => !v)}
                    className="text-xs flex items-center gap-1.5 hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {showPwForm ? 'パスワード変更をキャンセル' : 'パスワードを変更する'}
                  </button>
                  {showPwForm && (
                    <div className="space-y-3 pt-1">
                      <div className="relative">
                        <Input
                          label="新しいパスワード（8文字以上）"
                          type={showPwText ? 'text' : 'password'}
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          placeholder="8文字以上"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwText((p) => !p)}
                          className="absolute right-3 top-8 p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--color-muted-foreground)' }}
                        >
                          {showPwText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button size="sm" onClick={handlePasswordChange} loading={pwSaving}>
                        変更する
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* LINE連携 */}
          {partner.auth_user_id && (
            <LineStatusCard entityType="partner" entityId={id} />
          )}

          {/* 担当案件 */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> 担当案件
              </h2>
              {partner.assignments.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">担当案件なし</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {partner.assignments.map((a) => (
                    <li key={a.project_id} className="py-2 flex items-center justify-between">
                      <p className="text-sm font-medium">{a.projects?.name ?? '—'}</p>
                      <Link href={`/projects/${a.project_id}`}>
                        <Button variant="ghost" size="sm">詳細</Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右サイドバー */}
        <div className="space-y-4">
          {/* ステータスカード */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">ステータス</span>
                <Badge variant={statusVariant[partner.status] as any}>{partnerStatusLabel[partner.status]}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">登録日</span>
                <span className="text-sm">{new Date(partner.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
            </CardContent>
          </Card>

          {/* 契約一覧 */}
          {contracts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileSignature className="h-4 w-4" /> 契約 ({contracts.length})
                  </span>
                  <Link href="/contracts/new">
                    <Button variant="outline" size="sm">+ 新規</Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contracts.map((c: any) => {
                  const deadline = calculateDeadlineInfo(c.end_date)
                  const cfg = URGENCY_CONFIG[deadline.urgency]
                  return (
                    <Link key={c.id} href={`/contracts/${c.id}`}
                      className="flex items-center justify-between rounded-[var(--radius)] p-2 hover:bg-[var(--color-muted)] transition-colors">
                      <div>
                        <div className="text-sm font-medium">{c.title}</div>
                        <div className="text-[10px] text-[var(--color-muted-foreground)]">
                          {CONTRACT_TYPE_LABELS[c.contract_type as keyof typeof CONTRACT_TYPE_LABELS] ?? c.contract_type} •{' '}
                          {formatContractDate(c.start_date)} 〜 {formatContractDate(c.end_date)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: cfg.textColor, background: cfg.bgColor }}>{deadline.label}</span>
                        <Badge variant="secondary" size="sm">{CONTRACT_STATUS_LABELS[c.status as keyof typeof CONTRACT_STATUS_LABELS] ?? c.status}</Badge>
                      </div>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          )}

          <Link href="/partners">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4" /> 一覧へ戻る
            </Button>
          </Link>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>協力業者を削除しますか？</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              <span className="font-semibold text-[var(--color-foreground)]">{partner.company_name}</span> を削除します。<br />
              ログインアカウントと全データが完全に削除されます。この操作は取り消せません。
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDelete}>削除する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
