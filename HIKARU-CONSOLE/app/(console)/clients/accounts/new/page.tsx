'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  PageHeader, Button, Input, Card, CardContent, toast, Breadcrumb, Badge,
} from '@hikaru/ui'
import { ArrowLeft, UserPlus, Lock, Building2, FolderOpen, Check } from 'lucide-react'

interface Client {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
  status: string
}

export default function NewClientAccountPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [clients, setClients] = React.useState<Client[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [selectedProjects, setSelectedProjects] = React.useState<string[]>([])

  const searchParams = useSearchParams()
  const prefilledClientId = searchParams.get('clientId') ?? ''

  const [form, setForm] = React.useState({
    loginId:     '',
    password:    '',
    contactName: '',
    email:       '',
    clientId:    prefilledClientId,
  })

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  // クライアント一覧取得
  React.useEffect(() => {
    fetch('/api/clients?pageSize=100')
      .then((r) => r.json())
      .then((r) => setClients(r.data ?? []))
  }, [])

  // クライアント選択時に案件一覧取得
  React.useEffect(() => {
    if (!form.clientId) { setProjects([]); return }
    setSelectedProjects([])
    fetch(`/api/projects?clientId=${form.clientId}&pageSize=100`)
      .then((r) => r.json())
      .then((r) => setProjects(r.data ?? []))
  }, [form.clientId])

  function toggleProject(id: string) {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.loginId.trim())     { toast.error('ログインIDを入力してください'); return }
    if (!form.contactName.trim()) { toast.error('担当者名を入力してください'); return }
    if (!form.clientId)           { toast.error('顧客を選択してください'); return }
    if (form.password.length < 8) { toast.error('パスワードは8文字以上で入力してください'); return }

    setLoading(true)
    const res = await fetch('/api/client-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId:     form.loginId.toUpperCase().startsWith('CLT-') ? form.loginId : `CLT-${form.loginId}`,
        password:    form.password,
        contactName: form.contactName,
        email:       form.email || undefined,
        clientId:    form.clientId,
        projectIds:  selectedProjects,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? '登録に失敗しました')
    } else {
      toast.success('ポータルアカウントを発行しました')
      router.push('/clients/accounts')
    }
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="ポータルアカウント発行"
        breadcrumb={
          <Breadcrumb items={[
            { label: '顧客管理', href: '/clients' },
            { label: 'ポータルアカウント', href: '/clients/accounts' },
            { label: '新規発行' },
          ]} />
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* アカウント情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> アカウント情報
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="ログインID"
                    placeholder="CLT-0001"
                    value={form.loginId}
                    onChange={(e) => update('loginId', e.target.value)}
                    required
                    hint="CLT- プレフィックスが自動付与されます"
                  />
                  <Input
                    label="担当者名"
                    placeholder="山田 太郎"
                    value={form.contactName}
                    onChange={(e) => update('contactName', e.target.value)}
                    required
                  />
                </div>
                <Input
                  label="メールアドレス（任意）"
                  type="email"
                  placeholder="yamada@example.com"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </CardContent>
            </Card>

            {/* パスワード */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Lock className="h-4 w-4" /> 初期パスワード
                </h2>
                <Input
                  label="パスワード"
                  type="password"
                  placeholder="8文字以上"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                />
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  初回ログイン後にパスワードを変更するよう顧客へ案内してください。
                </p>
              </CardContent>
            </Card>

            {/* 顧客・案件選択 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> 顧客と閲覧可能案件
                </h2>

                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1">
                    顧客 <span className="text-[var(--color-error-foreground)]">*</span>
                  </label>
                  <select
                    value={form.clientId}
                    onChange={(e) => update('clientId', e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-[var(--radius-lg)] text-sm outline-none transition-all"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-foreground)',
                    }}
                  >
                    <option value="">顧客を選択してください</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {projects.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-2">
                      閲覧可能な案件（複数選択可）
                    </label>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {projects.map((p) => {
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
                            <Badge variant={p.status === 'active' ? 'success' : 'default'} size="sm" className="ml-auto">
                              {p.status === 'active' ? '進行中' : p.status}
                            </Badge>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)] mt-2">
                      選択中: {selectedProjects.length}件
                    </p>
                  </div>
                )}

                {form.clientId && projects.length === 0 && (
                  <p className="text-sm text-[var(--color-muted-foreground)] py-4 text-center">
                    この顧客に関連する案件がありません
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* サイドバー */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                  確認事項
                </h2>
                <ul className="text-xs text-[var(--color-muted-foreground)] space-y-2">
                  <li>• ログインIDは大文字で保存されます</li>
                  <li>• 顧客はHIKARU Client Portal のみアクセス可</li>
                  <li>• 案件を選択しない場合は閲覧できません</li>
                  <li>• アカウントはいつでも停止・再開できます</li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button type="submit" loading={loading} className="w-full">
                <UserPlus className="h-4 w-4" />
                アカウントを発行
              </Button>
              <Link href="/clients/accounts">
                <Button type="button" variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4" />
                  キャンセル
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
