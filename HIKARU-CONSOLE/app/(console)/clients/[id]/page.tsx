'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getClient, updateClient } from '@/services/clients.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, CardHeader, CardTitle,
  Badge, Skeleton, toast, Breadcrumb, Switch,
} from '@hikaru/ui'
import { Pencil, Store, Save, X, UserCog, Key, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp, UserPlus } from 'lucide-react'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-2.5 border-b border-[var(--color-border)] last:border-0">
      <dt className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">{label}</dt>
      <dd className="text-sm text-[var(--color-foreground)]">{value || '—'}</dd>
    </div>
  )
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    name: '', code: '', email: '', phone: '', address: '', contact_name: '', notes: '', is_active: true,
  })

  // ポータルアカウント
  const [portalAccount, setPortalAccount] = React.useState<any>(null)
  const [showPortalSection, setShowPortalSection] = React.useState(false)

  // 既存アカウント操作
  const [showResetPassword, setShowResetPassword] = React.useState(false)
  const [showResetId, setShowResetId] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState('')
  const [showNewPassword, setShowNewPassword] = React.useState(false)
  const [newLoginId, setNewLoginId] = React.useState('')
  const [resetting, setResetting] = React.useState(false)

  // 新規発行フォーム
  const [newPortal, setNewPortal] = React.useState({ loginId: '', password: '', contactName: '' })
  const [showPortalPassword, setShowPortalPassword] = React.useState(false)
  const [creatingPortal, setCreatingPortal] = React.useState(false)

  React.useEffect(() => {
    getClient(id).then(({ data }) => {
      setClient(data)
      if (data) {
        setForm({
          name:         data.name ?? '',
          code:         data.code ?? '',
          email:        data.email ?? '',
          phone:        data.phone ?? '',
          address:      data.address ?? '',
          contact_name: data.contact_name ?? '',
          notes:        data.notes ?? '',
          is_active:    data.is_active ?? true,
        })
        setNewPortal((p) => ({ ...p, contactName: data.contact_name ?? '' }))
      }
      setLoading(false)
    })
    fetch(`/api/client-accounts?clientId=${id}`)
      .then((r) => r.json())
      .then((r) => {
        const acc = (r.data ?? [])[0] ?? null
        setPortalAccount(acc)
        if (acc) setShowPortalSection(true)
      })
  }, [id])

  function update(key: string, value: any) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('顧客名を入力してください'); return }
    setSaving(true)
    const { error } = await updateClient(id, {
      name:         form.name.trim(),
      code:         form.code.trim()         || null,
      email:        form.email.trim()        || null,
      phone:        form.phone.trim()        || null,
      address:      form.address.trim()      || null,
      contact_name: form.contact_name.trim() || null,
      notes:        form.notes.trim()        || null,
      is_active:    form.is_active,
    })
    if (error) {
      toast.error('保存に失敗しました')
    } else {
      toast.success('顧客情報を更新しました')
      const { data } = await getClient(id)
      setClient(data)
      setEditing(false)
    }
    setSaving(false)
  }

  async function handleCreatePortal() {
    if (!newPortal.loginId.trim()) { toast.error('ログインIDを入力してください'); return }
    if (!newPortal.contactName.trim()) { toast.error('担当者名を入力してください'); return }
    if (newPortal.password.length < 8) { toast.error('パスワードは8文字以上で入力してください'); return }
    setCreatingPortal(true)
    const loginId = newPortal.loginId.toUpperCase()
    const res = await fetch('/api/client-accounts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password: newPortal.password, contactName: newPortal.contactName, clientId: id, projectIds: [] }),
    })
    if (res.ok) {
      const data = await res.json()
      setPortalAccount(data.data)
      toast.success('ポータルアカウントを発行しました')
      setNewPortal({ loginId: '', password: '', contactName: '' })
    } else {
      const data = await res.json()
      toast.error(data.error ?? '発行に失敗しました')
    }
    setCreatingPortal(false)
  }

  async function handleResetPassword() {
    if (!portalAccount) return
    if (newPassword.length < 8) { toast.error('パスワードは8文字以上で入力してください'); return }
    setResetting(true)
    const res = await fetch(`/api/client-accounts/${portalAccount.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    if (res.ok) {
      toast.success('パスワードを変更しました')
      setNewPassword('')
      setShowResetPassword(false)
    } else {
      toast.error('変更に失敗しました')
    }
    setResetting(false)
  }

  async function handleResetLoginId() {
    if (!portalAccount || !newLoginId.trim()) { toast.error('新しいログインIDを入力してください'); return }
    setResetting(true)
    const res = await fetch(`/api/client-accounts/${portalAccount.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: newLoginId }),
    })
    if (res.ok) {
      const normalized = newLoginId.toUpperCase()
      setPortalAccount((p: any) => ({ ...p, login_id: normalized }))
      toast.success('ログインIDを変更しました')
      setNewLoginId('')
      setShowResetId(false)
    } else {
      const data = await res.json()
      toast.error(data.error ?? '変更に失敗しました')
    }
    setResetting(false)
  }

  const previewLoginId = newPortal.loginId
    ? newPortal.loginId.toUpperCase()
    : '—'

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-muted-foreground)]">顧客が見つかりませんでした</p>
        <Link href="/clients"><Button variant="outline" className="mt-4">一覧に戻る</Button></Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={client.name}
        breadcrumb={<Breadcrumb items={[{ label: '顧客管理', href: '/clients' }, { label: client.name }]} />}
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4" /> {saving ? '保存中...' : '保存'}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}><X className="h-4 w-4" /> キャンセル</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> 編集</Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左カラム */}
        <div className="lg:col-span-2 space-y-6">
          {/* 顧客情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">顧客情報</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="顧客名 *" value={form.name} onChange={(e) => update('name', e.target.value)} required />
                    <Input label="顧客コード" value={form.code} onChange={(e) => update('code', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="担当者名" value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} />
                    <Input label="電話番号" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                  </div>
                  <Input label="メール" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
                  <Input label="住所" value={form.address} onChange={(e) => update('address', e.target.value)} />
                  <Textarea label="備考" value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} />
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium">有効</span>
                    <Switch checked={form.is_active} onCheckedChange={(v) => update('is_active', v)} />
                  </div>
                </div>
              ) : (
                <dl>
                  <InfoRow label="顧客名" value={client.name} />
                  <InfoRow label="顧客コード" value={client.code} />
                  <InfoRow label="担当者名" value={client.contact_name} />
                  <InfoRow label="電話番号" value={client.phone} />
                  <InfoRow label="メールアドレス" value={client.email} />
                  <InfoRow label="住所" value={client.address} />
                  <InfoRow label="備考" value={client.notes} />
                </dl>
              )}
            </CardContent>
          </Card>

          {/* ポータルアカウント（新規顧客ページと同スタイル） */}
          <div
            className="rounded-[var(--radius-xl)] overflow-hidden"
            style={{
              border: `1px solid ${showPortalSection ? 'oklch(0.73 0.12 78 / 0.40)' : 'oklch(0.73 0.12 78 / 0.20)'}`,
              background: showPortalSection ? 'oklch(0.09 0.005 255 / 0.85)' : 'oklch(0.08 0.004 255 / 0.60)',
              transition: 'all 0.2s ease',
            }}
          >
            {/* トグルヘッダー */}
            <button
              type="button"
              onClick={() => setShowPortalSection((p) => !p)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    background: showPortalSection ? 'oklch(0.73 0.12 78 / 0.15)' : 'oklch(0.73 0.12 78 / 0.08)',
                    border: `1px solid oklch(0.73 0.12 78 / ${showPortalSection ? '0.40' : '0.20'})`,
                  }}
                >
                  <UserCog className="h-4 w-4" style={{ color: 'oklch(0.73 0.12 78)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'oklch(0.88 0.008 75)' }}>
                    ポータルアカウント
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'oklch(0.52 0.008 60)' }}>
                    {portalAccount
                      ? `${portalAccount.login_id} · ${portalAccount.is_active ? '有効' : '停止中'}`
                      : showPortalSection ? 'ログインID・パスワードを設定してください' : '未発行 — 顧客がポータルにログインできるようになります'}
                  </p>
                </div>
              </div>
              {showPortalSection
                ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.73 0.12 78)' }} />
                : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.52 0.008 60)' }} />
              }
            </button>

            {/* 展開コンテンツ */}
            {showPortalSection && (
              <div className="px-6 pb-6 border-t" style={{ borderColor: 'oklch(0.73 0.12 78 / 0.18)' }}>
                {portalAccount ? (
                  /* 既存アカウント */
                  <div className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium mb-1.5" style={{ color: 'oklch(0.60 0.008 60)' }}>ログインID</p>
                        <div
                          className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-lg)] text-sm font-mono"
                          style={{ background: 'oklch(0.12 0.004 255)', border: '1px solid oklch(0.73 0.12 78 / 0.25)', color: 'oklch(0.88 0.008 75)' }}
                        >
                          {portalAccount.login_id}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-1.5" style={{ color: 'oklch(0.60 0.008 60)' }}>担当者名</p>
                        <div
                          className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-lg)] text-sm"
                          style={{ background: 'oklch(0.12 0.004 255)', border: '1px solid oklch(0.73 0.12 78 / 0.25)', color: 'oklch(0.88 0.008 75)' }}
                        >
                          {portalAccount.contact_name}
                        </div>
                      </div>
                    </div>

                    {portalAccount.last_login_at && (
                      <p className="text-xs" style={{ color: 'oklch(0.50 0.007 60)' }}>
                        最終ログイン: {new Date(portalAccount.last_login_at).toLocaleString('ja-JP')}
                      </p>
                    )}

                    {/* パスワード変更 */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => { setShowResetPassword((v) => !v); setShowResetId(false) }}
                        className="text-xs flex items-center gap-1.5 transition-opacity hover:opacity-80"
                        style={{ color: 'oklch(0.73 0.12 78)' }}
                      >
                        <RefreshCw className="h-3 w-3" />
                        {showResetPassword ? 'パスワード変更をキャンセル' : 'パスワードを変更する'}
                      </button>
                      {showResetPassword && (
                        <div className="space-y-3">
                          <div className="relative">
                            <Input
                              label="新しいパスワード"
                              type={showNewPassword ? 'text' : 'password'}
                              placeholder="8文字以上"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword((p) => !p)}
                              className="absolute right-3 top-8 p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                              style={{ color: 'var(--color-muted-foreground)' }}
                            >
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <Button size="sm" onClick={handleResetPassword} loading={resetting}>
                            変更する
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* ログインID変更 */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => { setShowResetId((v) => !v); setShowResetPassword(false) }}
                        className="text-xs flex items-center gap-1.5 transition-opacity hover:opacity-80"
                        style={{ color: 'oklch(0.73 0.12 78)' }}
                      >
                        <Key className="h-3 w-3" />
                        {showResetId ? 'ログインID変更をキャンセル' : 'ログインIDを変更する'}
                      </button>
                      {showResetId && (
                        <div className="space-y-3">
                          <Input
                            label="新しいログインID"
                            placeholder="例: ACME-002"
                            value={newLoginId}
                            onChange={(e) => setNewLoginId(e.target.value)}
                            hint="半角英数字・記号（@不可）"
                          />
                          <Button size="sm" onClick={handleResetLoginId} loading={resetting}>
                            変更する
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* 新規発行フォーム */
                  <div className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input
                        label="ログインID *"
                        value={newPortal.loginId}
                        onChange={(e) => setNewPortal((p) => ({ ...p, loginId: e.target.value }))}
                        placeholder="例: ACME-001"
                        hint="半角英数字・記号（@不可）"
                      />
                      <Input
                        label="ポータル担当者名 *"
                        value={newPortal.contactName}
                        onChange={(e) => setNewPortal((p) => ({ ...p, contactName: e.target.value }))}
                        placeholder="山田 太郎"
                      />
                    </div>
                    <div className="relative">
                      <Input
                        label="初期パスワード *"
                        type={showPortalPassword ? 'text' : 'password'}
                        value={newPortal.password}
                        onChange={(e) => setNewPortal((p) => ({ ...p, password: e.target.value }))}
                        placeholder="8文字以上"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPortalPassword((p) => !p)}
                        className="absolute right-3 top-8 p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--color-muted-foreground)' }}
                      >
                        {showPortalPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleCreatePortal} loading={creatingPortal}>
                        <UserPlus className="h-4 w-4" /> アカウントを発行する
                      </Button>
                    </div>
                    <p className="text-xs" style={{ color: 'oklch(0.50 0.007 60)' }}>
                      ※ 案件の閲覧権限は発行後に設定できます
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 右サイドバー */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">ステータス</span>
                <Badge variant={client.is_active ? 'success' : 'secondary'}>
                  {client.is_active ? '有効' : '無効'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">登録日</span>
                <span className="text-sm">{new Date(client.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
            </CardContent>
          </Card>

          {/* ポータルログイン情報プレビュー（アカウントあり or 新規発行フォーム展開中） */}
          {(portalAccount || (showPortalSection && !portalAccount && newPortal.loginId)) && (
            <div
              className="rounded-xl p-4 text-xs space-y-1.5"
              style={{
                background: 'oklch(0.73 0.12 78 / 0.06)',
                border: '1px solid oklch(0.73 0.12 78 / 0.20)',
              }}
            >
              <p className="font-semibold" style={{ color: 'oklch(0.73 0.12 78)' }}>ポータルログイン情報</p>
              <p style={{ color: 'oklch(0.55 0.008 60)' }}>URL: hikari-customer-portal.vercel.app</p>
              <p style={{ color: 'oklch(0.55 0.008 60)' }}>
                ID: {portalAccount ? portalAccount.login_id : previewLoginId}
              </p>
            </div>
          )}

          {client.stores && client.stores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Store className="h-4 w-4" /> 店舗 ({client.stores.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.stores.map((store: any) => (
                  <Link
                    key={store.id}
                    href={`/stores/${store.id}`}
                    className="flex items-center justify-between rounded-[var(--radius)] p-2 hover:bg-[var(--color-muted)] transition-colors"
                  >
                    <span className="text-sm">{store.name}</span>
                    <Badge variant={store.is_active ? 'success' : 'secondary'} size="sm">
                      {store.is_active ? '有効' : '無効'}
                    </Badge>
                  </Link>
                ))}
                <Link href={`/stores/new?client_id=${id}`} className="mt-2 block">
                  <Button variant="outline" size="sm" className="w-full">店舗を追加</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
