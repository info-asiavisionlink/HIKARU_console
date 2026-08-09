'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, FileText, ImageIcon, Loader2, Plus } from 'lucide-react'

export type DocType = 'exterior' | 'work_area' | 'brochure' | 'contract'
export interface UploadedDoc {
  doc_type: DocType
  name: string
  url: string
  storage_path: string
  spot_name?: string
}

const DOC_LABELS: Record<DocType, string> = {
  exterior:  '外観写真',
  work_area: '作業箇所写真',
  brochure:  'パンフレット',
  contract:  '契約書',
}

interface Props {
  value: UploadedDoc[]
  onChange: (docs: UploadedDoc[]) => void
}

export function ProposalDocUpload({ value, onChange }: Props) {
  const [uploading, setUploading] = React.useState<DocType | null>(null)
  const [areaLabel, setAreaLabel] = React.useState('')
  const refs = {
    exterior: React.useRef<HTMLInputElement>(null),
    work_area: React.useRef<HTMLInputElement>(null),
    brochure: React.useRef<HTMLInputElement>(null),
    contract: React.useRef<HTMLInputElement>(null),
  }

  async function upload(file: File, docType: DocType, spotName?: string) {
    setUploading(docType)
    const supabase = createClient()
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `proposals/${Date.now()}_${docType}.${ext}`
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { alert('アップロード失敗: ' + error.message); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    onChange([...value, { doc_type: docType, name: file.name, url: publicUrl, storage_path: path, spot_name: spotName }])
    setUploading(null)
  }

  function remove(idx: number) { onChange(value.filter((_, i) => i !== idx)) }

  return (
    <div className="space-y-4">
      {/* アップロード済み */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((d, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2">
              {d.doc_type === 'exterior' || d.doc_type === 'work_area'
                ? <ImageIcon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                : <FileText className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{d.name}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">
                  {DOC_LABELS[d.doc_type]}{d.spot_name ? ` (${d.spot_name})` : ''}
                </p>
              </div>
              <button type="button" onClick={() => remove(i)} className="p-1 hover:opacity-70 shrink-0">
                <X className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 外観写真 */}
      <UploadBtn
        label="外観写真を追加"
        accept="image/*"
        loading={uploading === 'exterior'}
        inputRef={refs.exterior}
        onSelect={f => upload(f, 'exterior')}
      />

      {/* 作業箇所写真（複数） */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-foreground)]">作業箇所写真（複数可）</label>
        <div className="flex gap-2">
          <input
            value={areaLabel}
            onChange={e => setAreaLabel(e.target.value)}
            placeholder="箇所名（例：浴室、トイレ）"
            className="flex-1 h-9 rounded-[var(--radius)] px-3 text-xs border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-foreground)] outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
        <UploadBtn
          label={`作業箇所写真を追加${areaLabel ? ` (${areaLabel})` : ''}`}
          accept="image/*"
          loading={uploading === 'work_area'}
          inputRef={refs.work_area}
          onSelect={f => upload(f, 'work_area', areaLabel || undefined)}
          small
        />
      </div>

      {/* パンフレット */}
      <UploadBtn
        label="パンフレット (PDF/画像)"
        accept="application/pdf,image/*"
        loading={uploading === 'brochure'}
        inputRef={refs.brochure}
        onSelect={f => upload(f, 'brochure')}
      />

      {/* 契約書 */}
      <UploadBtn
        label="契約書 (PDF)"
        accept="application/pdf"
        loading={uploading === 'contract'}
        inputRef={refs.contract}
        onSelect={f => upload(f, 'contract')}
      />
    </div>
  )
}

function UploadBtn({ label, accept, loading, inputRef, onSelect, small }: {
  label: string; accept: string; loading: boolean
  inputRef: React.RefObject<HTMLInputElement>; onSelect: (f: File) => void; small?: boolean
}) {
  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f); e.target.value = '' }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}
        className={`w-full flex items-center justify-center gap-2 rounded-[var(--radius-lg)] border-dashed hover:opacity-80 transition-all disabled:opacity-50 ${small ? 'py-2' : 'py-3'}`}
        style={{ border: '1.5px dashed var(--color-border)', color: 'var(--color-muted-foreground)' }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        <span className="text-xs">{loading ? 'アップロード中...' : label}</span>
      </button>
    </div>
  )
}
