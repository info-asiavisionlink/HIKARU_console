'use client'

import * as React from 'react'
import {
  PageHeader, Button, Input, Card, CardContent, CardHeader, CardTitle, toast, Skeleton,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { Save, Building2, Info, CreditCard } from 'lucide-react'

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [company, setCompany] = React.useState<any>(null)
  const [form, setForm] = React.useState({
    name: '', address: '', phone: '', email: '',
    postal_code: '', invoice_registration_number: '',
    bank_name: '', bank_branch_name: '', bank_account_type: '',
    bank_account_number: '', bank_account_holder: '', bank_account_holder_kana: '',
  })

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
            postal_code:                 d.data.postal_code                 ?? '',
            invoice_registration_number: d.data.invoice_registration_number ?? '',
            bank_name:                   d.data.bank_name                   ?? '',
            bank_branch_name:            d.data.bank_branch_name            ?? '',
            bank_account_type:           d.data.bank_account_type           ?? '',
            bank_account_number:         d.data.bank_account_number         ?? '',
            bank_account_holder:         d.data.bank_account_holder         ?? '',
            bank_account_holder_kana:    d.data.bank_account_holder_kana    ?? '',
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const { data } = await res.json()
      setCompany(data)
      toast.success('設定を保存しました')
    } else {
      const { error } = await res.json().catch(() => ({ error: '保存に失敗しました' }))
      toast.error(error ?? '保存に失敗しました')
    }
    setSaving(false)
  }

  return (
    <div>
      <PageHeader title="設定" description="システム設定・会社情報の管理" />

      {loading ? (
        <div className="space-y-4 max-w-2xl">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (
        <form onSubmit={handleSave} className="max-w-2xl space-y-6">

          {/* 会社情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> 会社情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="会社名"
                value={form.name}
                onChange={(e) => upd('name', e.target.value)}
                placeholder="株式会社HIKARU"
              />
              <Input
                label="住所"
                value={form.address}
                onChange={(e) => upd('address', e.target.value)}
                placeholder="東京都渋谷区..."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="電話番号"
                  value={form.phone}
                  onChange={(e) => upd('phone', e.target.value)}
                  placeholder="03-xxxx-xxxx"
                />
                <Input
                  label="メールアドレス"
                  type="email"
                  value={form.email}
                  onChange={(e) => upd('email', e.target.value)}
                  placeholder="info@example.com"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="郵便番号"
                  value={form.postal_code}
                  onChange={(e) => upd('postal_code', e.target.value)}
                  placeholder="150-0001"
                />
                <Input
                  label="適格請求書発行事業者登録番号"
                  value={form.invoice_registration_number}
                  onChange={(e) => upd('invoice_registration_number', e.target.value)}
                  placeholder="T1234567890123"
                />
              </div>
              {company?.created_at && (
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  登録日: {new Date(company.created_at).toLocaleDateString('ja-JP')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 振込先情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" /> 振込先情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="銀行名"
                  value={form.bank_name}
                  onChange={(e) => upd('bank_name', e.target.value)}
                  placeholder="○○銀行"
                />
                <Input
                  label="支店名"
                  value={form.bank_branch_name}
                  onChange={(e) => upd('bank_branch_name', e.target.value)}
                  placeholder="○○支店"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">口座種別</label>
                  <Select value={form.bank_account_type} onValueChange={v => upd('bank_account_type', v)}>
                    <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">選択なし</SelectItem>
                      <SelectItem value="普通">普通</SelectItem>
                      <SelectItem value="当座">当座</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  label="口座番号"
                  type="text"
                  value={form.bank_account_number}
                  onChange={(e) => upd('bank_account_number', e.target.value)}
                  placeholder="1234567"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="口座名義"
                  value={form.bank_account_holder}
                  onChange={(e) => upd('bank_account_holder', e.target.value)}
                  placeholder="株式会社HIKARU"
                />
                <Input
                  label="口座名義カナ"
                  value={form.bank_account_holder_kana}
                  onChange={(e) => upd('bank_account_holder_kana', e.target.value)}
                  placeholder="カ）ヒカル"
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? '保存中...' : '変更を保存'}
          </Button>

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

        </form>
      )}
    </div>
  )
}
