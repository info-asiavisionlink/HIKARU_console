'use client'

import * as React from 'react'
import {
  PageHeader, Button, Input, Card, CardContent, CardHeader, CardTitle, toast, Skeleton,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { Save, Building2, Info, CreditCard, Stamp, Upload, Trash2, Mail } from 'lucide-react'

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [company, setCompany] = React.useState<any>(null)
  const [hasSeal, setHasSeal] = React.useState(false)
  const [uploadingSeal, setUploadingSeal] = React.useState(false)
  const [deletingSeal, setDeletingSeal] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [form, setForm] = React.useState({
    name: '', address: '', phone: '', email: '',
    postal_code: '', invoice_registration_number: '',
    bank_name: '', bank_branch_name: '', bank_account_type: '',
    bank_account_number: '', bank_account_holder: '', bank_account_holder_kana: '',
    corporate_number: '',
  })

  // ── メール設定 ────────────────────────────────────────────────
  const [emailForm, setEmailForm] = React.useState({
    mail_reply_to:     '',
    invoice_auto_send: false,
    report_auto_send:  false,
  })
  const [savingEmail, setSavingEmail] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/settings', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.data) {
          setCompany(d.data)
          setHasSeal(d.data.has_seal ?? false)
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
            corporate_number:            d.data.corporate_number            ?? '',
          })
        }
      })
      .finally(() => setLoading(false))

    // メール設定を並行ロード
    fetch('/api/settings/email', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setEmailForm({
            mail_reply_to:     d.mail_reply_to     ?? '',
            invoice_auto_send: d.invoice_auto_send ?? false,
            report_auto_send:  d.report_auto_send  ?? false,
          })
        }
      })
      .catch(() => {})
  }, [])

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return

    // 法人番号 client validation
    const corpNum = form.corporate_number.trim()
    if (corpNum && !/^\d{13}$/.test(corpNum)) {
      toast.error('法人番号は13桁の数字で入力してください（ハイフンなし）')
      return
    }

    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, corporate_number: corpNum || null }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setCompany(data)
      setHasSeal(data.has_seal ?? false)
      toast.success('設定を保存しました')
    } else {
      const { error } = await res.json().catch(() => ({ error: '保存に失敗しました' }))
      toast.error(error ?? '保存に失敗しました')
    }
    setSaving(false)
  }

  async function handleSealUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Client validation
    if (file.type !== 'image/png') {
      toast.error('PNG形式のファイルのみアップロードできます')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > 1024 * 1024) {
      toast.error('ファイルサイズは1MB以下にしてください')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setUploadingSeal(true)
    try {
      const res = await fetch('/api/settings/seal', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (res.ok) {
        setHasSeal(true)
        toast.success('電子印を登録しました')
      } else {
        const { error } = await res.json().catch(() => ({ error: 'アップロードに失敗しました' }))
        toast.error(error ?? 'アップロードに失敗しました')
      }
    } catch {
      toast.error('アップロードに失敗しました')
    } finally {
      setUploadingSeal(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSealDelete() {
    setDeletingSeal(true)
    try {
      const res = await fetch('/api/settings/seal', {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setHasSeal(false)
        toast.success('電子印を削除しました')
      } else {
        const { error } = await res.json().catch(() => ({ error: '削除に失敗しました' }))
        toast.error(error ?? '削除に失敗しました')
      }
    } catch {
      toast.error('削除に失敗しました')
    } finally {
      setDeletingSeal(false)
    }
  }

  async function handleEmailSave() {
    setSavingEmail(true)
    const res = await fetch('/api/settings/email', {
      method:      'PATCH',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({
        mail_reply_to:     emailForm.mail_reply_to || null,
        invoice_auto_send: emailForm.invoice_auto_send,
        report_auto_send:  emailForm.report_auto_send,
      }),
    })
    if (res.ok) {
      const d = await res.json()
      setEmailForm({
        mail_reply_to:     d.mail_reply_to     ?? '',
        invoice_auto_send: d.invoice_auto_send ?? false,
        report_auto_send:  d.report_auto_send  ?? false,
      })
      toast.success('メール設定を保存しました')
    } else {
      const { error } = await res.json().catch(() => ({ error: '保存に失敗しました' }))
      toast.error(error ?? '保存に失敗しました')
    }
    setSavingEmail(false)
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
              <Input
                label="法人番号"
                value={form.corporate_number}
                onChange={(e) => upd('corporate_number', e.target.value)}
                placeholder="1234567890123"
                inputMode="numeric"
                maxLength={13}
                hint="13桁の数字で入力してください（ハイフンなし）"
              />
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

          {/* 電子印 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Stamp className="h-4 w-4" /> 電子印
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {hasSeal ? (
                  <span className="text-sm font-medium" style={{ color: 'oklch(0.72 0.18 150)' }}>
                    ✓ 電子印登録済み
                  </span>
                ) : (
                  <span className="text-sm text-[var(--color-muted-foreground)]">未登録</span>
                )}
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                PNG形式・1MB以下
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingSeal || deletingSeal}
                >
                  <Upload className="h-4 w-4" />
                  {uploadingSeal ? 'アップロード中...' : hasSeal ? '電子印を変更' : '電子印をアップロード'}
                </Button>
                {hasSeal && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleSealDelete}
                    disabled={deletingSeal || uploadingSeal}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingSeal ? '削除中...' : '電子印を削除'}
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                className="hidden"
                onChange={handleSealUpload}
              />
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

      {/* ── メール設定（メインフォームと独立）────────────────────── */}
      {!loading && (
        <div className="max-w-2xl mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" /> メール設定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* 返信先 */}
              <div>
                <Input
                  label="返信先メールアドレス（Reply-To）"
                  type="email"
                  value={emailForm.mail_reply_to}
                  onChange={e => setEmailForm(p => ({ ...p, mail_reply_to: e.target.value }))}
                  placeholder="info@your-company.co.jp"
                />
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  顧客がメールに返信した際の送り先です。空欄の場合は会社情報のメールアドレスを使用します。
                </p>
              </div>

              {/* 自動送信設定 */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-foreground)]">自動送信設定</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  ONにすると、発行・PDF生成完了時に登録済みメールアドレスへ自動的に送信されます。送信設定（返信先・Resend）が完了している必要があります。
                </p>
                <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm">請求書自動送信</p>
                      {emailForm.invoice_auto_send && (
                        <p className="text-xs text-orange-500 mt-0.5">発行時に顧客へ自動送信されます</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmailForm(p => ({ ...p, invoice_auto_send: !p.invoice_auto_send }))}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        emailForm.invoice_auto_send ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-muted)]'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        emailForm.invoice_auto_send ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm">報告書自動送信</p>
                      {emailForm.report_auto_send && (
                        <p className="text-xs text-orange-500 mt-0.5">PDF生成完了時に顧客へ自動送信されます</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmailForm(p => ({ ...p, report_auto_send: !p.report_auto_send }))}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        emailForm.report_auto_send ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-muted)]'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        emailForm.report_auto_send ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              <Button type="button" onClick={handleEmailSave} disabled={savingEmail}>
                <Save className="h-4 w-4" /> {savingEmail ? '保存中...' : 'メール設定を保存'}
              </Button>

            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
