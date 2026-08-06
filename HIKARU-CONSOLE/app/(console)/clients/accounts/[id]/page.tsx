'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  PageHeader, Button, Input, Card, CardContent, toast, Breadcrumb, Badge,
} from '@hikaru/ui'
import { ArrowLeft, Save, Check, Power, PowerOff, Trash2, RefreshCw } from 'lucide-react'

interface PortalAccount {
  id: string
  login_id: string
  contact_name: string
  is_active: boolean
  last_login_at: string | null
  profile_id: string
  clients: { id: string; name: string } | null
  client_project_permissions: {
    id: string
    project_id: string
    can_view_reports: boolean
    can_view_photos: boolean
    can_view_timeline: boolean
    can_download_pdf: boolean
    projects: { id: string; name: string } | null
  }[]
}

export default function ClientAccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [account, setAccount] = React.useState<PortalAccount | null>(null)
  const [contactName, setContactName] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [allProjects, setAllProjects] = React.useState<{ id: string; name: string }[]>([])
  const [selectedProjects, setSelectedProjects] = React.useState<string[]>([])

  React.useEffect(() => {
    fetch(`/api/client-accounts/${id}`)
      .then((r) => r.json())
      .then((r) => {
        const acc = r.data as PortalAccount
        setAccount(acc)
        setContactName(acc.contact_name)
        setSelectedProjects(acc.client_project_permissions?.map((p) => p.project_id) ?? [])
        setLoading(false)

        // 顧客に紐づく案件を取得
        const clientId = (acc.clients as any)?.id
        if (clientId) {
          fetch(`/api/projects?clientId=${clientId}&pageSize=100`)
            .then((r2) => r2.json())
            .then((r2) => setAllProjects(r2.data ?? []))
        }
      })
      .catch(() => setLoading(false))
  }, [id])

  function toggleProject(pid: string) {
    setSelectedProjects((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]
    )
  }

  async function handleSave() {
    if (!contactName.trim()) { toast.error('担当者名を入力してください'); return }
    if (newPassword && newPassword.length < 8) { toast.error('パスワードは8文字以上で入力してください'); return }

    setSaving(true)
    const res = await fetch(`/api/client-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName,
        ...(newPassword ? { password: newPassword } : {}),
        projectIds: selectedProjects,
      }),
    })

    if (res.ok) {
      toast.success('更新しました')
      setNewPassword('')
    } else {
      const data = await res.json()
      toast.error(data.error ?? '更新に失敗しました')
    }
    setSaving(false)
  }

  async function toggleActive() {
    if (!account) return
    const res = await fetch(`/api/client-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !account.is_active }),
    })
    if (res.ok) {
      setAccount((prev) => prev ? { ...prev, is_active: !prev.is_active } : prev)
      toast.success(!account.is_active ? 'アカウントを有効化しました' : 'アカウントを停止しました')
    }
  }

  async function handleDelete() {
    if (!account || !confirm(`「${account.contact_name}」のアカウントを完全に削除しますか？`)) return
    const res = await fetch(`/api/client-accounts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('削除しました')
      router.push('/clients/accounts')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!account) {
    return <p className="text-center py-20 text-[var(--color-muted-foreground)]">アカウントが見つかりません</p>
  }

  return (
    <div>
      <PageHeader
        title={account.contact_name}
        description={`ログインID: ${account.login_id} / ${(account.clients as any)?.name ?? ''}`}
        breadcrumb={
          <Breadcrumb items={[
            { label: '顧客管理', href: '/clients' },
            { label: 'ポータルアカウント', href: '/clients/accounts' },
            { label: account.contact_name },
          ]} />
        }
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={toggleActive}>
              {account.is_active
                ? <><PowerOff className="h-4 w-4" /> 停止</>
                : <><Power className="h-4 w-4" /> 有効化</>
              }
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-[var(--color-error-foreground)]">
              <Trash2 className="h-4 w-4" /> 削除
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* 基本情報 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                  基本情報
                </h2>
                <Badge variant={account.is_active ? 'success' : 'error'}>
                  {account.is_active ? '有効' : '停止中'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="ログインID" value={account.login_id} disabled />
                <Input
                  label="担当者名"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              {account.last_login_at && (
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  最終ログイン: {new Date(account.last_login_at).toLocaleString('ja-JP')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* パスワード変更 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> パスワード変更
              </h2>
              <Input
                label="新しいパスワード（変更する場合のみ）"
                type="password"
                placeholder="8文字以上"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* 閲覧案件 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                閲覧可能案件
              </h2>
              {allProjects.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)] py-4">
                  顧客に紐づく案件がありません
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {allProjects.map((p) => {
                    const selected = selectedProjects.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProject(p.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-lg)] text-left transition-all"
                        style={{
                          background: selected ? 'var(--color-primary-muted)' : 'var(--color-muted)',
                          border: selected ? '1px solid var(--color-primary-glow)' : '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded shrink-0"
                          style={{
                            background: selected ? 'var(--color-primary)' : 'transparent',
                            border: selected ? 'none' : '1px solid var(--color-border)',
                          }}
                        >
                          {selected && <Check className="h-3 w-3 text-[var(--color-primary-foreground)]" />}
                        </div>
                        <span className="text-sm" style={{ color: selected ? 'var(--color-primary)' : 'var(--color-foreground)' }}>
                          {p.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="text-xs text-[var(--color-muted-foreground)]">選択中: {selectedProjects.length}件</p>
            </CardContent>
          </Card>
        </div>

        {/* サイドバー */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button onClick={handleSave} loading={saving} className="w-full">
              <Save className="h-4 w-4" />
              変更を保存
            </Button>
            <Link href="/clients/accounts">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="h-4 w-4" />
                一覧に戻る
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
