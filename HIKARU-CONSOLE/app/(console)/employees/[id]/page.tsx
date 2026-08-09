'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  getEmployee, updateEmployee, changeEmployeePassword, changeEmployeeRole,
  deleteEmployee, employeeStatusLabel, employeeStatusOptions,
  type EmployeeDetail, type EmployeeStatus,
} from '@/services/employees.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, Badge, Skeleton, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@hikaru/ui'
import { ArrowLeft, Save, Key, Trash2, FolderOpen, User, Pencil, RefreshCw, Eye, EyeOff, Monitor, Smartphone, MessageCircle } from 'lucide-react'
import { LineStatusCard } from '@/components/console/LineStatusCard'

const statusVariant: Record<EmployeeStatus, string> = {
  active:    'success',
  on_leave:  'warning',
  resigned:  'secondary',
  suspended: 'destructive',
  deleted:   'secondary',
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-2.5 border-b border-[var(--color-border)] last:border-0">
      <dt className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">{label}</dt>
      <dd className="text-sm text-[var(--color-foreground)]">{value || '—'}</dd>
    </div>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [emp, setEmp]     = React.useState<EmployeeDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving]   = React.useState(false)
  const [showDelete, setShowDelete] = React.useState(false)
  const [form, setForm]   = React.useState<Partial<EmployeeDetail>>({})

  // パスワード変更
  const [showPwForm, setShowPwForm] = React.useState(false)
  const [newPw, setNewPw]     = React.useState('')
  const [showPwText, setShowPwText] = React.useState(false)
  const [pwSaving, setPwSaving] = React.useState(false)

  // コンソールアクセストグル
  const [roleChanging, setRoleChanging] = React.useState(false)

  React.useEffect(() => { loadData() }, [id]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    const data = await getEmployee(id)
    setEmp(data)
    if (data) {
      setForm({
        name: data.name, name_kana: data.name_kana, birth_date: data.birth_date,
        gender: data.gender, phone: data.phone, email: data.email,
        address: data.address, emergency_contact: data.emergency_contact,
        hire_date: data.hire_date, department: data.department,
        position: data.position, qualifications: data.qualifications,
        notes: data.notes, status: data.status,
      })
    }
    setLoading(false)
  }

  function update(key: string, value: any) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSave() {
    if (!form.name?.trim()) { toast.error('氏名を入力してください'); return }
    setSaving(true)
    const { error } = await updateEmployee(id, form as any)
    if (error) { toast.error('更新に失敗しました: ' + error) }
    else { toast.success('更新しました'); setEditing(false); await loadData() }
    setSaving(false)
  }

  async function handleDelete() {
    const { error } = await deleteEmployee(id)
    if (error) { toast.error('削除に失敗しました: ' + error) }
    else { toast.success('従業員を削除しました'); router.push('/employees') }
  }

  async function handlePasswordChange() {
    if (newPw.length < 8) { toast.error('8文字以上で入力してください'); return }
    setPwSaving(true)
    const { error } = await changeEmployeePassword(id, newPw)
    if (error) { toast.error('変更に失敗しました: ' + error) }
    else { toast.success('パスワードを変更しました'); setShowPwForm(false); setNewPw('') }
    setPwSaving(false)
  }

  async function handleToggleConsole() {
    if (!emp) return
    const newRole: 'admin' | 'worker' = emp.role === 'admin' ? 'worker' : 'admin'
    setRoleChanging(true)
    const { error } = await changeEmployeeRole(id, newRole)
    if (error) {
      toast.error('変更に失敗しました: ' + error)
    } else {
      setEmp((p) => p ? { ...p, role: newRole } : p)
      toast.success(newRole === 'admin' ? 'コンソールアクセスを許可しました' : 'コンソールアクセスを無効にしました')
    }
    setRoleChanging(false)
  }

  const isConsoleEnabled = emp?.role === 'admin'

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!emp) {
    return <div className="text-center py-20 text-[var(--color-muted-foreground)]">従業員が見つかりません</div>
  }

  return (
    <div>
      <PageHeader
        title={emp.name}
        description={emp.employee_number ?? undefined}
        breadcrumb={<Breadcrumb items={[{ label: '従業員管理', href: '/employees' }, { label: emp.name }]} />}
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
                <User className="h-4 w-4" /> 基本情報
              </h2>
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="氏名 *" value={form.name ?? ''} onChange={(e) => update('name', e.target.value)} />
                    <Input label="フリガナ" value={form.name_kana ?? ''} onChange={(e) => update('name_kana', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="生年月日" type="date" value={form.birth_date ?? ''} onChange={(e) => update('birth_date', e.target.value)} />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">性別</label>
                      <Select value={form.gender ?? ''} onValueChange={(v) => update('gender', v || null)}>
                        <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">—</SelectItem>
                          <SelectItem value="male">男性</SelectItem>
                          <SelectItem value="female">女性</SelectItem>
                          <SelectItem value="other">その他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="電話番号" type="tel" value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
                    <Input label="メールアドレス" type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} />
                  </div>
                  <Textarea label="住所" value={form.address ?? ''} onChange={(e) => update('address', e.target.value)} rows={2} />
                  <Input label="緊急連絡先" value={form.emergency_contact ?? ''} onChange={(e) => update('emergency_contact', e.target.value)} />
                </>
              ) : (
                <dl>
                  <InfoRow label="社員番号"   value={emp.employee_number} />
                  <InfoRow label="フリガナ"   value={emp.name_kana} />
                  <InfoRow label="生年月日"   value={emp.birth_date ? new Date(emp.birth_date).toLocaleDateString('ja-JP') : null} />
                  <InfoRow label="性別"       value={emp.gender === 'male' ? '男性' : emp.gender === 'female' ? '女性' : emp.gender === 'other' ? 'その他' : null} />
                  <InfoRow label="電話番号"   value={emp.phone} />
                  <InfoRow label="メール"     value={emp.email} />
                  <InfoRow label="住所"       value={emp.address} />
                  <InfoRow label="緊急連絡先" value={emp.emergency_contact} />
                </dl>
              )}
            </CardContent>
          </Card>

          {/* 雇用情報 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">雇用情報</h2>
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="入社日" type="date" value={form.hire_date ?? ''} onChange={(e) => update('hire_date', e.target.value)} />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">ステータス</label>
                      <Select value={form.status ?? 'active'} onValueChange={(v) => update('status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {employeeStatusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="所属部署" value={form.department ?? ''} onChange={(e) => update('department', e.target.value)} />
                    <Input label="役職" value={form.position ?? ''} onChange={(e) => update('position', e.target.value)} />
                  </div>
                  <Textarea label="資格（改行・カンマ区切り）"
                    value={(form.qualifications ?? []).join('\n')}
                    onChange={(e) => update('qualifications', e.target.value.split(/[、,\n]/).map((s: string) => s.trim()).filter(Boolean))}
                    rows={3} />
                  <Textarea label="備考" value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} rows={3} />
                </>
              ) : (
                <dl>
                  <InfoRow label="入社日"   value={emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('ja-JP') : null} />
                  <InfoRow label="所属部署" value={emp.department} />
                  <InfoRow label="役職"     value={emp.position} />
                  <InfoRow label="資格"     value={emp.qualifications.length ? emp.qualifications.join('、') : null} />
                  <InfoRow label="備考"     value={emp.notes} />
                </dl>
              )}
            </CardContent>
          </Card>

          {/* ログイン情報 */}
          {emp.auth_user_id && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  ログイン情報
                </h2>
                <InfoRow label="ログインID（社員番号）" value={emp.employee_number} />
                <InfoRow label="ログインID（内部メール）" value={emp.loginEmail} />

                {/* パスワード変更 */}
                <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
                  <button type="button" onClick={() => setShowPwForm((v) => !v)}
                    className="text-xs flex items-center gap-1.5 hover:underline text-[var(--color-primary)]">
                    <RefreshCw className="h-3 w-3" />
                    {showPwForm ? 'パスワード変更をキャンセル' : 'パスワードを変更する'}
                  </button>
                  {showPwForm && (
                    <div className="space-y-3">
                      <div className="relative">
                        <Input label="新しいパスワード（8文字以上）" type={showPwText ? 'text' : 'password'}
                          value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="8文字以上" />
                        <button type="button" onClick={() => setShowPwText((p) => !p)}
                          className="absolute right-3 top-8 p-1 rounded opacity-60 hover:opacity-100 transition-opacity text-[var(--color-muted-foreground)]">
                          {showPwText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button size="sm" onClick={handlePasswordChange} loading={pwSaving}>変更する</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* LINE連携 */}
          {emp.auth_user_id && (
            <LineStatusCard entityType="employee" entityId={id} />
          )}

          {/* 担当案件 */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> 担当案件
              </h2>
              {emp.assignments.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">担当案件なし</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {emp.assignments.map((a) => (
                    <li key={a.project_id} className="py-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{a.projects?.name ?? '—'}</p>
                        {a.projects?.code && <p className="text-xs text-[var(--color-muted-foreground)]">{a.projects.code}</p>}
                      </div>
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
          {/* ステータス */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">ステータス</span>
                <Badge variant={statusVariant[emp.status] as any}>{employeeStatusLabel[emp.status]}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">登録日</span>
                <span className="text-sm">{new Date(emp.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
            </CardContent>
          </Card>

          {/* コンソールアクセストグル */}
          {emp.auth_user_id && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                  システムアクセス
                </h2>

                {/* HIKARU-System（常時ON） */}
                <div className="flex items-center gap-3 rounded-[var(--radius-lg)] p-3"
                  style={{ background: 'var(--color-success-muted)', border: '1px solid var(--color-success-foreground)20' }}>
                  <Smartphone className="h-4 w-4 text-[var(--color-success-foreground)] shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[var(--color-success-foreground)]">HIKARU System</p>
                    <p className="text-[10px] text-[var(--color-success-foreground)] opacity-70">常時アクセス可</p>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
                </div>

                {/* HIKARU-CONSOLE トグル */}
                <div
                  className="flex items-center gap-3 rounded-[var(--radius-lg)] p-3 transition-all"
                  style={{
                    background: isConsoleEnabled ? 'oklch(0.73 0.12 78 / 0.10)' : 'var(--color-muted)',
                    border: `1px solid ${isConsoleEnabled ? 'oklch(0.73 0.12 78 / 0.35)' : 'var(--color-border)'}`,
                  }}
                >
                  <Monitor className="h-4 w-4 shrink-0" style={{ color: isConsoleEnabled ? 'oklch(0.73 0.12 78)' : 'var(--color-muted-foreground)' }} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color: isConsoleEnabled ? 'oklch(0.73 0.12 78)' : 'var(--color-muted-foreground)' }}>
                      HIKARU Console
                    </p>
                    <p className="text-[10px]" style={{ color: isConsoleEnabled ? 'oklch(0.73 0.12 78 / 0.70)' : 'var(--color-subtle)' }}>
                      {isConsoleEnabled ? '同一ID・パスでログイン可' : 'アクセス不可'}
                    </p>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${isConsoleEnabled ? '' : 'opacity-30'}`}
                    style={{ background: isConsoleEnabled ? 'oklch(0.73 0.12 78)' : 'var(--color-muted-foreground)' }} />
                </div>

                {/* 切り替えボタン（CTA） */}
                <Button
                  onClick={handleToggleConsole}
                  loading={roleChanging}
                  variant={isConsoleEnabled ? 'outline' : 'default'}
                  className="w-full"
                >
                  <Monitor className="h-4 w-4" />
                  {isConsoleEnabled
                    ? 'コンソールアクセスを無効にする'
                    : 'コンソールアクセスを許可する'}
                </Button>

                {isConsoleEnabled && (
                  <p className="text-xs text-[var(--color-muted-foreground)] text-center">
                    社員番号 <span className="font-mono font-bold text-[var(--color-foreground)]">{emp.employee_number}</span> と同じパスワードでコンソールにもログインできます
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Link href="/employees">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4" /> 一覧へ戻る
            </Button>
          </Link>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>従業員を削除しますか？</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              <span className="font-semibold text-[var(--color-foreground)]">{emp.name}</span> を削除します。<br />
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
