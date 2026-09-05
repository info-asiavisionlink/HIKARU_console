'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, CardHeader, CardTitle, toast,
} from '@hikaru/ui'
import { safeSetupReturn } from '@/lib/setup/return-to'
import {
  Building2, Store, Users, FolderOpen, Receipt, Clock, CalendarDays, Ban,
  ChevronRight, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'

// ---- Types ----

type EntityType = 'client' | 'store' | 'employee'
type Step       = 1 | 2

interface ProcessStep {
  key:    string
  label:  string
  status: 'pending' | 'running' | 'done' | 'error'
}

interface EntityOption {
  type:        EntityType | null  // null = 準備中 (選択不可)
  label:       string
  description: string
  icon:        React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  available:   boolean
}

// ---- Constants ----

// GROUP 1: 基本データの一括移行 (Setup の「業務開始の準備」と対応)
// 本番稼働中の bulk import: client / store / employee。project は Batch 2 で対応予定。
const BASIC_DATA_OPTIONS: readonly EntityOption[] = [
  {
    type:        'client',
    label:       '顧客',
    description: '顧客企業のデータ（会社名、電話番号、メール、住所など）',
    icon:        Building2,
    available:   true,
  },
  {
    type:        'store',
    label:       '店舗',
    description: '店舗データ（店舗名、住所、電話番号、営業時間など。顧客との紐付けあり）',
    icon:        Store,
    available:   true,
  },
  {
    type:        'employee',
    label:       '従業員',
    description: '従業員データ（氏名、社員番号、連絡先、入社日など）',
    icon:        Users,
    available:   true,
  },
  {
    type:        null,
    label:       '案件',
    description: '案件データ（案件名、顧客・店舗、期間、料金など）',
    icon:        FolderOpen,
    available:   false,
  },
] as const

// GROUP 2: 過去データの移行 (以前のシステム / Excel からの引き継ぎ)
const HISTORICAL_DATA_OPTIONS: readonly EntityOption[] = [
  {
    type:        null,
    label:       '経費履歴',
    description: '過去の経費申請・精算履歴',
    icon:        Receipt,
    available:   false,
  },
  {
    type:        null,
    label:       '勤怠履歴',
    description: '過去の出退勤・勤怠履歴',
    icon:        Clock,
    available:   false,
  },
  {
    type:        null,
    label:       'シフト履歴',
    description: '過去のシフト履歴',
    icon:        CalendarDays,
    available:   false,
  },
] as const

const INITIAL_PROCESS_STEPS: ProcessStep[] = [
  { key: 'session',    label: 'セッション作成',   status: 'pending' },
  { key: 'upload',     label: 'アップロード',      status: 'pending' },
  { key: 'extract',    label: 'データ解析',        status: 'pending' },
  { key: 'map',        label: '項目変換',          status: 'pending' },
  { key: 'duplicate',  label: '重複確認',          status: 'pending' },
]

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

// URL preselect (`?entity_type=xxx`) で auto-skip 可能なのは実際に enabled な entity のみ。
// 未対応 entity で来た場合は Step 1 表示 → 準備中 badge で明示。
const VALID_ENTITY_TYPES: readonly EntityType[] = ['client', 'store', 'employee'] as const

function parsePreselectedEntityType(raw: string | null): EntityType | null {
  if (!raw) return null
  return (VALID_ENTITY_TYPES as readonly string[]).includes(raw)
    ? (raw as EntityType)
    : null
}

// ---- Sub-component: Entity Choice Card ----
// 選択可能な card と 準備中 (disabled) card を統一 UI で表示する。
// disabled の場合 button/click は無効化し、"準備中" badge を明示する。

function EntityChoiceCard({
  option,
  selected,
  onSelect,
}: {
  option: EntityOption
  selected: boolean
  onSelect: (type: EntityType) => void
}) {
  const Icon = option.icon

  if (!option.available || !option.type) {
    // Disabled 「準備中」card — click 不可
    return (
      <Card className="opacity-60" aria-disabled="true">
        <CardContent className="flex items-center gap-4 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-[var(--color-foreground)]">{option.label}</p>
              <span
                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
              >
                準備中
              </span>
            </div>
            <p className="text-sm text-[var(--color-muted-foreground)]">{option.description}</p>
          </div>
          <Ban className="h-4 w-4 text-[var(--color-muted-foreground)] shrink-0" />
        </CardContent>
      </Card>
    )
  }

  return (
    <button
      className="w-full text-left"
      onClick={() => onSelect(option.type as EntityType)}
      aria-label={`${option.label}を選択`}
    >
      <Card className={`transition-all cursor-pointer ${selected ? 'ring-2 ring-[var(--color-primary)]' : 'hover:border-[var(--color-primary)]'}`}>
        <CardContent className="flex items-center gap-4 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'var(--color-muted)', color: 'var(--color-foreground)' }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--color-foreground)]">{option.label}</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">{option.description}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)] shrink-0" />
        </CardContent>
      </Card>
    </button>
  )
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

    // Defensive gate: URL preselect と state の不一致検知。
    // Employee 導線から入ったのに state が client になっている等の routing 事故を
    // Session 作成前に止める。client への silent fallback は行わない。
    // URL に entity_type クエリが有る場合のみ厳格チェック (Step1 選択経路は URL 無しなので免除)。
    const urlEntityRaw = searchParams.get('entity_type')
    if (urlEntityRaw !== null && urlEntityRaw !== entityType) {
      setErrorMsg(
        '移行対象の情報が一致しません。画面を再読み込みして、目的のデータ種別から改めて移行を開始してください。',
      )
      return
    }

    // Defensive gate: VALID_ENTITY_TYPES 外の値では絶対に POST しない。
    if (!(VALID_ENTITY_TYPES as readonly string[]).includes(entityType)) {
      setErrorMsg('選択された移行対象が対応していません。画面を再読み込みしてください。')
      return
    }

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
          // Server-side trace: routing 事故を server audit で追跡可能にする。
          // URL query に含まれていた entity_type を独立に送信し、
          // server 側は body.entity_type と一致することを検証 + audit log に記録。
          requested_entity_type: urlEntityRaw,
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
          description="Excel / CSV から HIKARU へまとめてデータを登録できます。基本データの一括移行、または以前のシステムからの過去データ引き継ぎが可能です。"
          action={
            <Button variant="outline" onClick={() => router.back()}>戻る</Button>
          }
        />

        <div className="max-w-2xl space-y-6">

          {/* GROUP 1: 基本データの一括移行 */}
          <div>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'oklch(0.73 0.12 78 / 0.85)' }}>
                GROUP 1
              </span>
              <h2 className="text-sm font-bold tracking-wider text-[var(--color-foreground)] uppercase">
                基本データの一括移行
              </h2>
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)] mb-3 leading-relaxed">
              既存の Excel / CSV から、HIKARU の基本データをまとめて登録できます。
            </p>
            <div className="space-y-2">
              {BASIC_DATA_OPTIONS.map(opt => (
                <EntityChoiceCard
                  key={opt.label}
                  option={opt}
                  selected={opt.available && entityType === opt.type}
                  onSelect={(t) => { setEntityType(t); setStep(2) }}
                />
              ))}
            </div>
          </div>

          {/* GROUP 2: 過去データの移行 */}
          <div>
            <div className="mb-2 flex items-baseline gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'oklch(0.73 0.12 78 / 0.85)' }}>
                GROUP 2
              </span>
              <h2 className="text-sm font-bold tracking-wider text-[var(--color-foreground)] uppercase">
                過去データの移行
              </h2>
              <span
                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
              >
                任意
              </span>
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)] mb-3 leading-relaxed">
              以前のシステムや Excel で管理していた履歴を HIKARU へ引き継ぎます。この移行は任意です。
            </p>
            <div className="space-y-2">
              {HISTORICAL_DATA_OPTIONS.map(opt => (
                <EntityChoiceCard
                  key={opt.label}
                  option={opt}
                  selected={false}
                  onSelect={(t) => { setEntityType(t); setStep(2) }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- Render: Step 2 — File Upload ----

  if (step === 2 && !processing) {
    const entityLabel = BASIC_DATA_OPTIONS.find(o => o.type === entityType)?.label ?? ''

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
