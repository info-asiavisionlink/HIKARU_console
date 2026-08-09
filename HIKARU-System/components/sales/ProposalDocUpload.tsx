'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, FileText, ImageIcon, Plus } from 'lucide-react'

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

// 画像をリサイズ・JPEG圧縮（最大1280px、品質75%）
async function compressImage(file: File, maxPx = 1280, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', quality
      )
    }
    img.src = url
  })
}

interface Props {
  value: UploadedDoc[]
  onChange: (docs: UploadedDoc[]) => void
}

export function ProposalDocUpload({ value, onChange }: Props) {
  const [progress, setProgress] = React.useState<{ type: DocType; pct: number } | null>(null)
  const [areaLabel, setAreaLabel] = React.useState('')
  const refs = {
    exterior:  React.useRef<HTMLInputElement>(null),
    work_area: React.useRef<HTMLInputElement>(null),
    brochure:  React.useRef<HTMLInputElement>(null),
    contract:  React.useRef<HTMLInputElement>(null),
  }

  async function upload(file: File, docType: DocType, spotName?: string) {
    setProgress({ type: docType, pct: 0 })

    // 画像なら圧縮
    let uploadFile = file
    if (file.type.startsWith('image/')) {
      setProgress({ type: docType, pct: 10 })
      uploadFile = await compressImage(file)
    }

    setProgress({ type: docType, pct: 40 })

    const supabase = createClient()
    const ext  = uploadFile.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `proposals/${Date.now()}_${docType}.${ext}`

    // 進捗アニメーション（40→85% をアップロード中に流す）
    const tick = setInterval(() => {
      setProgress(p => p && p.pct < 85 ? { ...p, pct: p.pct + 5 } : p)
    }, 200)

    const { error } = await supabase.storage.from('documents').upload(path, uploadFile, { upsert: true })
    clearInterval(tick)

    if (error) {
      setProgress(null)
      alert('アップロード失敗: ' + error.message)
      return
    }

    setProgress({ type: docType, pct: 100 })
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    onChange([...value, { doc_type: docType, name: file.name, url: publicUrl, storage_path: path, spot_name: spotName }])

    setTimeout(() => setProgress(null), 400)
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
                : <FileText  className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
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
        progress={progress?.type === 'exterior' ? progress.pct : null}
        inputRef={refs.exterior}
        onSelect={f => upload(f, 'exterior')}
      />

      {/* 作業箇所写真 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-foreground)]">作業箇所写真（複数可）</label>
        <input
          value={areaLabel}
          onChange={e => setAreaLabel(e.target.value)}
          placeholder="箇所名（例：浴室、トイレ）"
          className="w-full h-9 rounded-[var(--radius)] px-3 text-xs border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-foreground)] outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        <UploadBtn
          label={`作業箇所写真を追加${areaLabel ? ` (${areaLabel})` : ''}`}
          accept="image/*"
          progress={progress?.type === 'work_area' ? progress.pct : null}
          inputRef={refs.work_area}
          onSelect={f => upload(f, 'work_area', areaLabel || undefined)}
          small
        />
      </div>

      {/* パンフレット */}
      <UploadBtn
        label="パンフレット (PDF/画像)"
        accept="application/pdf,image/*"
        progress={progress?.type === 'brochure' ? progress.pct : null}
        inputRef={refs.brochure}
        onSelect={f => upload(f, 'brochure')}
      />

      {/* 契約書 */}
      <UploadBtn
        label="契約書 (PDF)"
        accept="application/pdf"
        progress={progress?.type === 'contract' ? progress.pct : null}
        inputRef={refs.contract}
        onSelect={f => upload(f, 'contract')}
      />
    </div>
  )
}

function UploadBtn({ label, accept, progress, inputRef, onSelect, small }: {
  label: string
  accept: string
  progress: number | null
  inputRef: React.RefObject<HTMLInputElement>
  onSelect: (f: File) => void
  small?: boolean
}) {
  const loading = progress !== null
  const GOLD = 'oklch(0.73 0.12 78)'

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f); e.target.value = '' }} />
      <button
        type="button"
        onClick={() => !loading && inputRef.current?.click()}
        disabled={loading}
        className={`w-full rounded-[var(--radius-lg)] border-dashed transition-all disabled:opacity-60 overflow-hidden ${small ? 'py-2' : 'py-3'}`}
        style={{ border: '1.5px dashed var(--color-border)', color: 'var(--color-muted-foreground)', position: 'relative' }}
      >
        {/* プログレスバー背景 */}
        {loading && (
          <div
            className="absolute inset-0 transition-all duration-200"
            style={{
              width: `${progress}%`,
              background: `${GOLD}18`,
              borderRight: progress! < 100 ? `1px solid ${GOLD}40` : 'none',
            }}
          />
        )}
        <span className="relative flex items-center justify-center gap-2 text-xs">
          {loading ? (
            <>
              <span style={{ color: GOLD }}>
                {progress! < 20 ? '圧縮中...' : progress! < 90 ? 'アップロード中...' : '完了'}
              </span>
              <span className="font-bold tabular-nums" style={{ color: GOLD }}>{progress}%</span>
            </>
          ) : (
            <><Plus className="h-4 w-4" />{label}</>
          )}
        </span>
      </button>
    </div>
  )
}
