'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, ChevronRight, Upload, X, FileText,
  Image as ImageIcon, Check, Loader2,
} from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

type DocType = 'exterior' | 'work_area' | 'brochure' | 'contract'
interface UploadedDoc { doc_type: DocType; name: string; url: string; storage_path: string; spot_name?: string }

const STEPS = ['基本情報', 'クライアント', '日程・金額', '添付ファイル', '確認']

export default function NewProposalPage() {
  const router = useRouter()
  const [step, setStep] = React.useState(0)
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState<string | null>(null)

  // フォームデータ
  const [form, setForm] = React.useState({
    project_name: '', project_type: 'spot', client_name: '', client_phone: '',
    client_email: '', location_name: '', location_address: '',
    work_description: '', estimated_amount: '', start_date: '', end_date: '', notes: '',
  })
  const [docs, setDocs] = React.useState<UploadedDoc[]>([])
  const [workAreaLabel, setWorkAreaLabel] = React.useState('')

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function uploadFile(file: File, docType: DocType, spotName?: string) {
    setUploading(docType)
    const supabase = createClient()
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `proposals/${Date.now()}_${docType}.${ext}`

    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (upErr) { alert('アップロード失敗: ' + upErr.message); setUploading(null); return }

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

    setDocs(prev => [...prev, {
      doc_type: docType,
      name: file.name,
      url: publicUrl,
      storage_path: path,
      spot_name: spotName,
    }])
    setUploading(null)
  }

  function removeDoc(idx: number) { setDocs(prev => prev.filter((_, i) => i !== idx)) }

  async function handleSubmit() {
    if (!form.project_name.trim()) { alert('案件名を入力してください'); return }
    setSaving(true)

    const res = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...form, estimated_amount: form.estimated_amount ? Number(form.estimated_amount) : null, documents: docs }),
    })

    if (res.ok) {
      router.push('/sales?submitted=1')
    } else {
      const j = await res.json()
      alert(j.error ?? '送信失敗')
      setSaving(false)
    }
  }

  const canNext = [
    !!form.project_name.trim(),
    true,
    true,
    true,
    true,
  ][step]

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
          className="p-1.5 rounded-lg" style={{ color: `${GOLD}80` }}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>案件提案</h1>
          <p className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>{STEPS[step]} ({step + 1}/{STEPS.length})</p>
        </div>
      </div>

      {/* ステップインジケーター */}
      <div className="flex gap-1 mb-6">
        {STEPS.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all"
            style={{ background: i <= step ? GOLD : 'oklch(0.20 0.005 255)' }} />
        ))}
      </div>

      {/* Step 0: 基本情報 */}
      {step === 0 && (
        <div className="space-y-4">
          <Field label="案件名 *">
            <Input value={form.project_name} onChange={v => upd('project_name', v)} placeholder="○○ビル定期清掃" />
          </Field>
          <Field label="案件種別">
            <select value={form.project_type} onChange={e => upd('project_type', e.target.value)}
              className="w-full h-10 rounded-xl px-3 text-sm outline-none"
              style={{ background: 'oklch(0.07 0.004 255 / 0.90)', border: `1px solid ${GOLD}20`, color: 'oklch(0.88 0.008 75)' }}>
              <option value="spot">単発案件</option>
              <option value="recurring">定期案件</option>
              <option value="hotel">ホテル案件</option>
              <option value="other">その他</option>
            </select>
          </Field>
          <Field label="作業場所名">
            <Input value={form.location_name} onChange={v => upd('location_name', v)} placeholder="○○ビル" />
          </Field>
          <Field label="作業場所住所">
            <Input value={form.location_address} onChange={v => upd('location_address', v)} placeholder="東京都渋谷区…" />
          </Field>
          <Field label="作業内容">
            <textarea value={form.work_description} onChange={e => upd('work_description', e.target.value)}
              rows={4} placeholder="清掃箇所・作業内容の詳細"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: 'oklch(0.07 0.004 255 / 0.90)', border: `1px solid ${GOLD}20`, color: 'oklch(0.88 0.008 75)' }} />
          </Field>
        </div>
      )}

      {/* Step 1: クライアント */}
      {step === 1 && (
        <div className="space-y-4">
          <Field label="クライアント名">
            <Input value={form.client_name} onChange={v => upd('client_name', v)} placeholder="株式会社○○" />
          </Field>
          <Field label="電話番号">
            <Input value={form.client_phone} onChange={v => upd('client_phone', v)} placeholder="03-0000-0000" type="tel" />
          </Field>
          <Field label="メールアドレス">
            <Input value={form.client_email} onChange={v => upd('client_email', v)} placeholder="contact@example.com" type="email" />
          </Field>
          <Field label="備考">
            <textarea value={form.notes} onChange={e => upd('notes', e.target.value)}
              rows={4} placeholder="その他の情報・担当者名など"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: 'oklch(0.07 0.004 255 / 0.90)', border: `1px solid ${GOLD}20`, color: 'oklch(0.88 0.008 75)' }} />
          </Field>
        </div>
      )}

      {/* Step 2: 日程・金額 */}
      {step === 2 && (
        <div className="space-y-4">
          <Field label="開始日">
            <Input value={form.start_date} onChange={v => upd('start_date', v)} type="date" />
          </Field>
          <Field label="終了日">
            <Input value={form.end_date} onChange={v => upd('end_date', v)} type="date" />
          </Field>
          <Field label="予定金額（税込・円）">
            <Input value={form.estimated_amount} onChange={v => upd('estimated_amount', v)} type="number" placeholder="150000" />
          </Field>
        </div>
      )}

      {/* Step 3: 添付ファイル */}
      {step === 3 && (
        <div className="space-y-4">
          {/* アップロード済みファイル一覧 */}
          {docs.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${GOLD}18` }}>
              {docs.map((d, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                  style={{ borderColor: `${GOLD}12`, background: 'oklch(0.09 0.005 255 / 0.85)' }}>
                  {d.doc_type === 'exterior' || d.doc_type === 'work_area'
                    ? <ImageIcon className="h-4 w-4 shrink-0" style={{ color: `${GOLD}80` }} />
                    : <FileText className="h-4 w-4 shrink-0" style={{ color: `${GOLD}80` }} />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'oklch(0.88 0.008 75)' }}>{d.name}</p>
                    <p className="text-[10px]" style={{ color: 'oklch(0.50 0.007 75)' }}>
                      {d.doc_type === 'exterior' ? '外観写真' : d.doc_type === 'work_area' ? `作業箇所${d.spot_name ? `: ${d.spot_name}` : ''}` : d.doc_type === 'brochure' ? 'パンフレット' : '契約書'}
                    </p>
                  </div>
                  <button onClick={() => removeDoc(i)}>
                    <X className="h-4 w-4" style={{ color: 'oklch(0.45 0.006 75)' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 外観写真 */}
          <UploadArea
            label="作業場所の外観写真"
            accept="image/*"
            loading={uploading === 'exterior'}
            onSelect={f => uploadFile(f, 'exterior')}
          />

          {/* 作業箇所写真（複数） */}
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: 'oklch(0.75 0.008 75)' }}>作業箇所写真（複数追加可）</label>
            <div className="flex gap-2">
              <input
                value={workAreaLabel}
                onChange={e => setWorkAreaLabel(e.target.value)}
                placeholder="箇所名（例：浴室、トイレ）"
                className="flex-1 h-9 rounded-lg px-3 text-xs outline-none"
                style={{ background: 'oklch(0.07 0.004 255 / 0.90)', border: `1px solid ${GOLD}20`, color: 'oklch(0.88 0.008 75)' }}
              />
            </div>
            <UploadArea
              label={`作業箇所写真を追加${workAreaLabel ? ` (${workAreaLabel})` : ''}`}
              accept="image/*"
              loading={uploading === 'work_area'}
              onSelect={f => uploadFile(f, 'work_area', workAreaLabel || undefined)}
              small
            />
          </div>

          {/* パンフレット */}
          <UploadArea
            label="パンフレット（PDF）"
            accept="application/pdf,image/*"
            loading={uploading === 'brochure'}
            onSelect={f => uploadFile(f, 'brochure')}
          />

          {/* 契約書 */}
          <UploadArea
            label="契約書（PDF）"
            accept="application/pdf"
            loading={uploading === 'contract'}
            onSelect={f => uploadFile(f, 'contract')}
          />
        </div>
      )}

      {/* Step 4: 確認 */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: GOLD }}>提案内容の確認</p>
            {[
              ['案件名', form.project_name],
              ['種別', { spot: '単発', recurring: '定期', hotel: 'ホテル', other: 'その他' }[form.project_type]],
              ['クライアント', form.client_name || '—'],
              ['作業場所', form.location_name || '—'],
              ['住所', form.location_address || '—'],
              ['開始日', form.start_date || '—'],
              ['終了日', form.end_date || '—'],
              ['予定金額', form.estimated_amount ? `¥${Number(form.estimated_amount).toLocaleString()}` : '—'],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between text-sm border-b pb-2" style={{ borderColor: `${GOLD}12` }}>
                <span style={{ color: 'oklch(0.50 0.007 75)' }}>{label}</span>
                <span style={{ color: 'oklch(0.88 0.008 75)' }}>{value}</span>
              </div>
            ))}
            {docs.length > 0 && (
              <div className="text-sm">
                <span style={{ color: 'oklch(0.50 0.007 75)' }}>添付ファイル</span>
                <span className="ml-2" style={{ color: 'oklch(0.88 0.008 75)' }}>{docs.length}件</span>
              </div>
            )}
          </div>
          <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'oklch(0.72 0.18 150 / 0.10)', border: '1px solid oklch(0.72 0.18 150 / 0.25)', color: 'oklch(0.72 0.18 150)' }}>
            送信後、管理者が確認・承認します。承認されると正式な案件として登録されます。
          </div>
        </div>
      )}

      {/* ナビボタン */}
      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex-1 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'oklch(0.12 0.007 255 / 0.70)', color: 'oklch(0.65 0.008 75)', border: `1px solid ${GOLD}18` }}>
            戻る
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: GOLD, color: 'oklch(0.06 0.003 260)' }}>
            次へ <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: GOLD, color: 'oklch(0.06 0.003 260)' }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? '送信中...' : '提案を送信'}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block" style={{ color: 'oklch(0.75 0.008 75)' }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  const GOLD = 'oklch(0.73 0.12 78)'
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-10 rounded-xl px-3 text-sm outline-none"
      style={{ background: 'oklch(0.07 0.004 255 / 0.90)', border: `1px solid ${GOLD}20`, color: 'oklch(0.88 0.008 75)' }} />
  )
}

function UploadArea({ label, accept, loading, onSelect, small }: {
  label: string; accept: string; loading: boolean; onSelect: (f: File) => void; small?: boolean
}) {
  const GOLD = 'oklch(0.73 0.12 78)'
  const ref = React.useRef<HTMLInputElement>(null)
  return (
    <div>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f); e.target.value = '' }} />
      <button onClick={() => ref.current?.click()} disabled={loading}
        className={`w-full flex items-center justify-center gap-2 rounded-xl transition-all disabled:opacity-50 ${small ? 'py-2' : 'py-4'}`}
        style={{ border: `1.5px dashed ${GOLD}40`, color: `${GOLD}80`, background: `${GOLD}06` }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        <span className="text-xs">{loading ? 'アップロード中...' : label}</span>
      </button>
    </div>
  )
}
