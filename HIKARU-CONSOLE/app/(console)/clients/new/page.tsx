'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClientRecord } from '@/services/clients.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, toast, Breadcrumb,
} from '@hikaru/ui'
import { ArrowLeft, UserPlus, Lock, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'

export default function NewClientPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [showPortal, setShowPortal] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  const [form, setForm] = React.useState({
    name: '', code: '', email: '', phone: '', address: '', contact_name: '', notes: '',
  })

  const [portal, setPortal] = React.useState({
    loginId: '', password: '', contactName: '',
  })

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
    // 担当者名をポータルの担当者名に自動反映
    if (key === 'contact_name') {
      setPortal((p) => ({ ...p, contactName: value }))
    }
  }

  function updatePortal(key: string, value: string) {
    setPortal((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('顧客名を入力してください'); return }

    // ポータルアカウント入力チェック
    if (showPortal) {
      if (!portal.loginId.trim()) { toast.error('ログインIDを入力してください'); return }
      if (!portal.contactName.trim()) { toast.error('ポータル担当者名を入力してください'); return }
      if (portal.password.length < 8) { toast.error('パスワードは8文字以上で入力してください'); return }
    }

    setLoading(true)

    // ① 顧客作成
    const { data: client, error } = await createClientRecord({
      name:         form.name.trim(),
      code:         form.code.trim()         || null,
      email:        form.email.trim()        || null,
      phone:        form.phone.trim()        || null,
      address:      form.address.trim()      || null,
      contact_name: form.contact_name.trim() || null,
      notes:        form.notes.trim()        || null,
    }) as any

    if (error || !client?.id) {
      toast.error('顧客の保存に失敗しました')
      setLoading(false)
      return
    }

    // ② ポータルアカウント作成（任意）
    if (showPortal) {
      const loginId = portal.loginId.toUpperCase()

      const res = await fetch('/api/client-accounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId,
          password:    portal.password,
          contactName: portal.contactName,
          clientId:    client.id,
          projectIds:  [],
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error('ポータルアカウントの作成に失敗しました: ' + (data.error ?? ''))
        // 顧客は作成済みなので詳細ページへ遷移
        router.push('/clients')
        setLoading(false)
        return
      }

      toast.success('顧客とポータルアカウントを作成しました')
    } else {
      toast.success('顧客を作成しました')
    }

    router.push('/clients')
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="新規顧客"
        breadcrumb={<Breadcrumb items={[{ label: '顧客管理', href: '/clients' }, { label: '新規顧客' }]} />}
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* 基本情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">基本情報</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="顧客名 *" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="株式会社○○" required />
                  <Input label="顧客コード" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="CLI-001" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="担当者名" value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} placeholder="山田 太郎" />
                  <Input label="電話番号" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="03-xxxx-xxxx" />
                </div>
                <Input label="メールアドレス" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="info@example.com" />
                <Input label="住所" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="東京都渋谷区..." />
                <Textarea label="備考" value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="特記事項があれば入力" rows={3} />
              </CardContent>
            </Card>

            {/* ポータルアカウント（折りたたみ） */}
            <div
              className="rounded-[var(--radius-xl)] overflow-hidden"
              style={{
                border: `1px solid ${showPortal ? 'oklch(0.73 0.12 78 / 0.40)' : 'oklch(0.73 0.12 78 / 0.20)'}`,
                background: showPortal ? 'oklch(0.09 0.005 255 / 0.85)' : 'oklch(0.08 0.004 255 / 0.60)',
                transition: 'all 0.2s ease',
              }}
            >
              {/* トグルヘッダー */}
              <button
                type="button"
                onClick={() => setShowPortal((p) => !p)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: showPortal ? 'oklch(0.73 0.12 78 / 0.15)' : 'oklch(0.73 0.12 78 / 0.08)',
                      border: `1px solid oklch(0.73 0.12 78 / ${showPortal ? '0.40' : '0.20'})`,
                    }}
                  >
                    <UserPlus className="h-4 w-4" style={{ color: 'oklch(0.73 0.12 78)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'oklch(0.88 0.008 75)' }}>
                      ポータルアカウントも同時に発行する
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'oklch(0.52 0.008 60)' }}>
                      {showPortal ? 'ログインID・パスワードを設定してください' : '顧客がポータルにログインできるようになります（任意）'}
                    </p>
                  </div>
                </div>
                {showPortal
                  ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.73 0.12 78)' }} />
                  : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.52 0.008 60)' }} />
                }
              </button>

              {/* 展開コンテンツ */}
              {showPortal && (
                <div className="px-6 pb-6 space-y-4 border-t" style={{ borderColor: 'oklch(0.73 0.12 78 / 0.18)' }}>
                  <div className="pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Input
                        label="ログインID *"
                        value={portal.loginId}
                        onChange={(e) => updatePortal('loginId', e.target.value)}
                        placeholder="例: ACME-001"
                        hint="半角英数字・記号（@不可）"
                      />
                    </div>
                    <Input
                      label="ポータル担当者名 *"
                      value={portal.contactName}
                      onChange={(e) => updatePortal('contactName', e.target.value)}
                      placeholder="山田 太郎"
                    />
                  </div>

                  <div className="relative">
                    <Input
                      label="初期パスワード *"
                      type={showPassword ? 'text' : 'password'}
                      value={portal.password}
                      onChange={(e) => updatePortal('password', e.target.value)}
                      placeholder="8文字以上"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-8 p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <p className="text-xs" style={{ color: 'oklch(0.50 0.007 60)' }}>
                    ※ 案件は後からポータルアカウント管理で追加できます
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* 右サイドバー */}
          <div className="flex flex-col gap-3">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '保存中...' : showPortal ? '顧客とアカウントを作成' : '顧客を作成'}
            </Button>
            <Link href="/clients">
              <Button type="button" variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4" /> キャンセル
              </Button>
            </Link>

            {showPortal && (
              <div
                className="rounded-xl p-4 text-xs space-y-1.5"
                style={{
                  background: 'oklch(0.73 0.12 78 / 0.06)',
                  border: '1px solid oklch(0.73 0.12 78 / 0.20)',
                }}
              >
                <p className="font-semibold" style={{ color: 'oklch(0.73 0.12 78)' }}>ポータルログイン情報</p>
                <p style={{ color: 'oklch(0.55 0.008 60)' }}>URL: hikari-customer-portal.vercel.app</p>
                <p style={{ color: 'oklch(0.55 0.008 60)' }}>ID: {portal.loginId ? portal.loginId.toUpperCase() : '—'}</p>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
