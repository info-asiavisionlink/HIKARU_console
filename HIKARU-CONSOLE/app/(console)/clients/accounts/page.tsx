'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  PageHeader, Button, Badge, toast,
  Breadcrumb,
} from '@hikaru/ui'
import { UserCog, Plus, Power, PowerOff, Trash2, ChevronRight, Calendar } from 'lucide-react'

interface PortalAccount {
  id: string
  login_id: string
  contact_name: string
  is_active: boolean
  last_login_at: string | null
  created_at: string
  clients: { id: string; name: string } | null
  client_project_permissions: { project_id: string; projects: { name: string } | null }[]
}

export default function ClientAccountsPage() {
  const [accounts, setAccounts] = React.useState<PortalAccount[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/client-accounts')
      .then((r) => r.json())
      .then((r) => { setAccounts(r.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/client-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    if (res.ok) {
      setAccounts((prev) =>
        prev.map((a) => a.id === id ? { ...a, is_active: !current } : a)
      )
      toast.success(!current ? 'アカウントを有効化しました' : 'アカウントを停止しました')
    } else {
      toast.error('更新に失敗しました')
    }
  }

  async function deleteAccount(id: string, name: string) {
    if (!confirm(`「${name}」のアカウントを完全に削除しますか？\nこの操作は元に戻せません。`)) return

    const res = await fetch(`/api/client-accounts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAccounts((prev) => prev.filter((a) => a.id !== id))
      toast.success('アカウントを削除しました')
    } else {
      toast.error('削除に失敗しました')
    }
  }

  return (
    <div>
      <PageHeader
        title="顧客ポータルアカウント"
        description="クライアントポータルのログインアカウントを管理します"
        breadcrumb={
          <Breadcrumb items={[{ label: '顧客管理', href: '/clients' }, { label: 'ポータルアカウント' }]} />
        }
        action={
          <Link href="/clients/accounts/new">
            <Button>
              <Plus className="h-4 w-4" />
              新規発行
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-[var(--color-muted-foreground)]">
          <UserCog className="h-14 w-14 opacity-20" />
          <p className="text-sm">ポータルアカウントがありません</p>
          <Link href="/clients/accounts/new">
            <Button variant="outline" size="sm">最初のアカウントを発行する</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center gap-4 p-4 rounded-[var(--radius-xl)] transition-all hover:scale-[1.005]"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              {/* ステータスドット */}
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{
                  background: account.is_active ? 'var(--color-success)' : 'var(--color-muted-foreground)',
                  boxShadow: account.is_active ? '0 0 6px var(--color-success)' : 'none',
                }}
              />

              {/* アバター */}
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 text-sm font-bold"
                style={{
                  background: 'var(--color-primary-muted)',
                  border: '1px solid var(--color-primary-glow)',
                  color: 'var(--color-primary)',
                }}
              >
                {account.contact_name[0]}
              </div>

              {/* 情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">
                    {account.contact_name}
                  </p>
                  <code className="text-xs px-1.5 py-0.5 rounded-md bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                    {account.login_id}
                  </code>
                  {!account.is_active && (
                    <Badge variant="error" size="sm">停止中</Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                  {(account.clients as any)?.name ?? '—'}
                  {' / '}
                  閲覧案件: {account.client_project_permissions?.length ?? 0}件
                </p>
                {account.last_login_at && (
                  <p className="text-[10px] text-[var(--color-subtle)] mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    最終ログイン: {new Date(account.last_login_at).toLocaleString('ja-JP')}
                  </p>
                )}
              </div>

              {/* アクション */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(account.id, account.is_active)}
                  title={account.is_active ? 'アカウントを停止' : 'アカウントを有効化'}
                  className="p-2 rounded-lg transition-all hover:opacity-80"
                  style={{
                    background: account.is_active ? 'var(--color-error-muted)' : 'var(--color-success-muted)',
                    border: account.is_active ? '1px solid var(--color-error-foreground)26' : '1px solid var(--color-success-foreground)26',
                  }}
                >
                  {account.is_active
                    ? <PowerOff className="h-4 w-4 text-[var(--color-error-foreground)]" />
                    : <Power className="h-4 w-4 text-[var(--color-success-foreground)]" />
                  }
                </button>

                <Link
                  href={`/clients/accounts/${account.id}`}
                  className="p-2 rounded-lg transition-all hover:opacity-80"
                  style={{
                    background: 'var(--color-primary-muted)',
                    border: '1px solid var(--color-primary-glow)40',
                  }}
                >
                  <ChevronRight className="h-4 w-4 text-[var(--color-primary)]" />
                </Link>

                <button
                  onClick={() => deleteAccount(account.id, account.contact_name)}
                  className="p-2 rounded-lg transition-all hover:opacity-80"
                  style={{
                    background: 'var(--color-error-muted)',
                    border: '1px solid var(--color-error-foreground)26',
                  }}
                >
                  <Trash2 className="h-4 w-4 text-[var(--color-error-foreground)]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
