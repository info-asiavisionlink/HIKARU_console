'use client'

import * as React from 'react'
import {
  PageHeader, Button, Input, Card, CardContent, CardHeader, CardTitle, toast, Skeleton,
} from '@hikaru/ui'
import { Save, Building2, Info } from 'lucide-react'

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', address: '', phone: '', email: '' })
  const [company, setCompany] = React.useState<any>(null)

  React.useEffect(() => {
    fetch('/api/settings', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.data) {
          setCompany(d.data)
          setForm({
            name:    d.data.name    ?? '',
            address: d.data.address ?? '',
            phone:   d.data.phone   ?? '',
            email:   d.data.email   ?? '',
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, address: form.address, phone: form.phone, email: form.email }),
    })
    if (res.ok) {
      toast.success('設定を保存しました')
    } else {
      toast.error('保存に失敗しました')
    }
    setSaving(false)
  }

  return (
    <div>
      <PageHeader title="設定" description="システム設定・会社情報の管理" />

      {loading ? (
        <div className="space-y-4 max-w-2xl">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* 会社情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> 会社情報
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <Input
                  label="会社名"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="株式会社HIKARU"
                />
                <Input
                  label="住所"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="東京都渋谷区..."
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="電話番号"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="03-xxxx-xxxx"
                  />
                  <Input
                    label="メールアドレス"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="info@example.com"
                  />
                </div>
                {company?.created_at && (
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    登録日: {new Date(company.created_at).toLocaleDateString('ja-JP')}
                  </p>
                )}
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4" /> {saving ? '保存中...' : '変更を保存'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* バージョン情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" /> バージョン情報
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-[var(--color-muted-foreground)]">
                {[
                  ['HIKARU-CONSOLE', 'v0.4.0'],
                  ['HIKARU-System', 'v0.4.0'],
                  ['HIKARU Partner', 'v0.1.0'],
                  ['リリース', '2026年8月'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-[var(--color-border)] last:border-0">
                    <span>{label}</span>
                    <span className="font-medium text-[var(--color-foreground)]">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
