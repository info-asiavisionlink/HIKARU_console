'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, CardHeader, CardTitle, toast,
} from '@hikaru/ui'
import { safeSetupReturn } from '@/lib/setup/return-to'
import { Building2, Store, ChevronRight, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

// ---- Types ----

type EntityType = 'client' | 'store'
type Step       = 1 | 2

interface ProcessStep {
  key:    string
  label:  string
  status: 'pending' | 'running' | 'done' | 'error'
}

// ---- Constants ----

const ENTITY_OPTIONS = [
  {
    type:        'client' as EntityType,
    label:       '顧客',
    description: '顧客企業のデータ（会社名、電話番号、メール、住所など）',
    icon:        Building2,
    available:   true,
  },
  {
    type:        'store' as EntityType,
    label:       '店舗',
    description: '店舗データ（店舗名、住所、電話番号、営業時間など）',
    icon:        Store,
    available:   true,
  },
]

const INITIAL_PROCESS_STEPS: ProcessStep[] = [
  { key: 'session',    label: 'セッション作成',   status: 'pending' },
  { key: 'upload',     label: 'アップロード',      status: 'pending' },
  { key: 'extract',    label: 'データ解析',        status: 'pending' },
  { key: 'map',        label: '項目変換',          status: 'pending' },
  { key: 'duplicate',  label: '重複確認',          status: 'pending' },
]

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

const VALID_ENTITY_TYPES: readonly EntityType[] = ['client', 'store'] as const

function parsePreselectedEntityType(raw: string | null): EntityType | null {
  if (!raw) return null
  return (VALID_ENTITY_TYPES as readonly string[]).includes(raw)
    ? (raw as EntityType)
    : null
}

// ---- Main Component ----

function NewImportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL preselect: ?entity_type=client|store で entity Step をスキップ
  const preselectedEntity = parsePreselectedEntityType(searchParams.get('entity_type'))
  // Setup Center から呼ばれた場合の戻り先 (allowlist)
  const returnTo = safeSetupReturn(searchParams.get('return'))
  // Review page への遷移時に return を保持するための query suffix
  const returnQuery = returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''

  const [step, setStep]           = React.useState<Step>(preselectedEntity ? 2 : 1)
  const [entityType, setEntityType] = React.useState<EntityType | null>(preselectedEntity)
  const [file, setFile]           = React.useState<File | null>(null)
  const [dragOver, setDragOver]   = React.useState(false)
  const [processing, setProcessing] = React.useState(false)
  const [processSteps, setProcessSteps] = React.useState<ProcessStep[]>(INITIAL_PROCESS_STEPS)
  const [errorMsg, setErrorMsg]   = React.useState<string>('')
  const fileInputRef              = React.useRef<HTMLInputElement>(null)

  function updateStep(key: string, status: ProcessStep['status']) {
    setProcessSteps(prev => prev.map(s => s.key === key ? { ...s, status } : s))
  }

  function validateFile(f: File): string | null {
    if (f.size === 0)               return 'ファイルが空です。'
    if (f.size > MAX_FILE_BYTES)    return 'ファイルサイズが10MBを超えています。'
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv' && ext !== 'xlsx') return 'CSV または XLSX ファイルのみアップロードできます。'
    return null
  }

  function handleFileSelect(f: File) {
    const err = validateFile(f)
    if (err) { toast.error(err); return }
    setFile(f)
    setErrorMsg('')
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }

  async function startImport() {
    if (!entityType || !file) return
    setProcessing(true)
    setErrorMsg('')
    setProcessSteps(INITIAL_PROCESS_STEPS)

    let sessionId = ''

    try {
      // 1. Create session
      updateStep('session', 'running')
      const sessionRes = await fetch('/api/import/sessions', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({
          entity_type: entityType,
          source_type: file.name.endsWith('.csv') ? 'csv' : 'xlsx',
        }),
      })
      if (!sessionRes.ok) {
        const { message } = await sessionRes.json().catch(() => ({ message: 'セッションの作成に失敗しました。' }))
        throw new Error(message ?? 'セッションの作成に失敗しました。')
      }
      const { data: session } = await sessionRes.json()
      sessionId = session.id
      updateStep('session', 'done')

      // 2. Upload file
      updateStep('upload', 'running')
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch(`/api/import/sessions/${sessionId}/files`, {
        method:      'POST',
        credentials: 'include',
        body:        formData,
      })
      if (!uploadRes.ok) {
        const { message } = await uploadRes.json().catch(() => ({ message: 'アップロードに失敗しました。' }))
        throw new Error(message ?? 'アップロードに失敗しました。')
      }
      updateStep('upload', 'done')

      // 3. Extract
      updateStep('extract', 'running')
      const extractRes = await fetch(`/api/import/sessions/${sessionId}/extract`, {
        method:      'POST',
        credentials: 'include',
      })
      if (!extractRes.ok) {
        const { message } = await extractRes.json().catch(() => ({ message: 'データの解析に失敗しました。' }))
        throw new Error(message ?? 'データの解析に失敗しました。')
      }
      updateStep('extract', 'done')

      // 4. Map
      updateStep('map', 'running')
      const mapRes = await fetch(`/api/import/sessions/${sessionId}/map`, {
        method:      'POST',
        credentials: 'include',
      })
      if (!mapRes.ok) {
        const { message } = await mapRes.json().catch(() => ({ message: '項目の変換に失敗しました。' }))
        throw new Error(message ?? '項目の変換に失敗しました。')
      }
      updateStep('map', 'done')

      // 5. Duplicate detection
      updateStep('duplicate', 'running')
      const dupRes = await fetch(`/api/import/sessions/${sessionId}/duplicates`, {
        method:      'POST',
        credentials: 'include',
      })
      if (!dupRes.ok) {
        const { message } = await dupRes.json().catch(() => ({ message: '重複チェックに失敗しました。' }))
        throw new Error(message ?? '重複チェックに失敗しました。')
      }
      updateStep('duplicate', 'done')

      // All done — redirect to review (return は保持して Review ページから /setup へ戻れるように)
      toast.success('解析が完了しました。内容を確認してください。')
      router.push(`/settings/import/${sessionId}${returnQuery}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '予期しないエラーが発生しました。'
      setErrorMsg(msg)
      // Mark current running step as error
      setProcessSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s))
      setProcessing(false)
    }
  }

  // ---- Render: Step 1 — Entity Type ----

  if (step === 1) {
    return (
      <div>
        <PageHeader
          title="データ移行 — 対象を選択"
          description="どのデータを移行しますか？"
          action={
            <Button variant="outline" onClick={() => router.back()}>戻る</Button>
          }
        />

        <div className="max-w-2xl space-y-4">
          {ENTITY_OPTIONS.map(opt => {
            const Icon     = opt.icon
            const selected = entityType === opt.type
            return (
              <button
                key={opt.type}
                className="w-full text-left"
                onClick={() => { setEntityType(opt.type); setStep(2) }}
              >
                <Card className={`transition-all cursor-pointer ${selected ? 'ring-2 ring-[var(--color-primary)]' : 'hover:border-[var(--color-primary)]'}`}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                      style={{ background: 'var(--color-muted)', color: 'var(--color-foreground)' }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[var(--color-foreground)]">{opt.label}</p>
                      <p className="text-sm text-[var(--color-muted-foreground)]">{opt.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)] shrink-0" />
                  </CardContent>
                </Card>
              </button>
            )
          })}

          {/* Unavailable entity types */}
          {['従業員', '案件', '請求書', '経費'].map(label => (
            <Card key={label} className="opacity-40">
              <CardContent className="flex items-center gap-4 py-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'var(--color-muted)' }}
                />
                <div className="flex-1">
                  <p className="font-medium text-[var(--color-foreground)]">{label}</p>
                  <p className="text-sm text-[var(--color-muted-foreground)]">準備中</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ---- Render: Step 2 — File Upload ----

  if (step === 2 && !processing) {
    const entityLabel = ENTITY_OPTIONS.find(o => o.type === entityType)?.label ?? ''

    return (
      <div>
        <PageHeader
          title={`データ移行 — ファイルをアップロード`}
          description={`${entityLabel}データ（CSV / XLSX）を選択してください。`}
          action={
            <Button variant="outline" onClick={() => { setStep(1); setFile(null) }}>戻る</Button>
          }
        />

        <div className="max-w-2xl space-y-6">

          {/* File dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-12 px-8 text-center cursor-pointer transition-colors"
            style={{
              borderColor: dragOver ? 'var(--color-primary)' : 'var(--color-border)',
              background:  dragOver ? 'oklch(0.73 0.12 78 / 0.05)' : 'transparent',
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="ファイルを選択"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            {file ? (
              <>
                <FileSpreadsheet className="h-10 w-10 mb-3" style={{ color: 'var(--color-primary)' }} />
                <p className="font-medium text-[var(--color-foreground)]">{file.name}</p>
                <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <p className="text-xs text-[var(--color-muted-foreground)] mt-3">クリックして変更</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 mb-3 text-[var(--color-muted-foreground)]" />
                <p className="font-medium text-[var(--color-foreground)]">ファイルをドラッグ＆ドロップ</p>
                <p className="text-sm text-[var(--color-muted-foreground)] mt-1">または クリックして選択</p>
                <p className="text-xs text-[var(--color-muted-foreground)] mt-3">CSV / XLSX · 最大 10MB</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              aria-label="ファイル選択"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
            />
          </div>

          {errorMsg && (
            <div
              className="flex items-start gap-3 rounded-xl p-4"
              style={{ background: 'oklch(0.65 0.18 30 / 0.10)', border: '1px solid oklch(0.65 0.18 30 / 0.30)' }}
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'oklch(0.75 0.18 30)' }} />
              <p className="text-sm" style={{ color: 'oklch(0.75 0.18 30)' }}>{errorMsg}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={startImport}
              disabled={!file}
            >
              <Upload className="h-4 w-4" />
              移行を開始
            </Button>
          </div>

        </div>
      </div>
    )
  }

  // ---- Render: Processing ----

  return (
    <div>
      <PageHeader
        title="データ移行 — 処理中"
        description="データを解析しています。しばらくお待ちください。"
      />

      <div className="max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">処理状況</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {processSteps.map(ps => (
              <div key={ps.key} className="flex items-center gap-3">
                {ps.status === 'done' && (
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.72 0.18 150)' }} />
                )}
                {ps.status === 'running' && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: 'var(--color-primary)' }} />
                )}
                {ps.status === 'error' && (
                  <AlertCircle className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.75 0.18 30)' }} />
                )}
                {ps.status === 'pending' && (
                  <div className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--color-border)]" />
                )}
                <span
                  className="text-sm"
                  style={{
                    color: ps.status === 'done'    ? 'oklch(0.72 0.18 150)' :
                           ps.status === 'running'  ? 'var(--color-foreground)' :
                           ps.status === 'error'    ? 'oklch(0.75 0.18 30)' :
                           'var(--color-muted-foreground)',
                    fontWeight: ps.status === 'running' ? 500 : 400,
                  }}
                >
                  {ps.label}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {errorMsg && (
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: 'oklch(0.65 0.18 30 / 0.10)', border: '1px solid oklch(0.65 0.18 30 / 0.30)' }}
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'oklch(0.75 0.18 30)' }} />
              <p className="text-sm font-medium" style={{ color: 'oklch(0.75 0.18 30)' }}>処理中にエラーが発生しました</p>
            </div>
            <p className="text-sm text-[var(--color-muted-foreground)]">{errorMsg}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setProcessing(false); setStep(2) }}
            >
              やり直す
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NewImportPage() {
  return (
    <React.Suspense fallback={<div />}>
      <NewImportContent />
    </React.Suspense>
  )
}
