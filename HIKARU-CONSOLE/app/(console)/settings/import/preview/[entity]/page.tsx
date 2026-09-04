'use client'

// ============================================================
// Data Migration — Entity Preview Page
//
// 目的:
//   7 entity すべてについて、backend 実装状態にかかわらず
//   「何を移行するか / どんなフィールドが対象か / 対応形式は何か / 移行はどんな流れか」
//   まで管理者が事前に理解できる screen を提供する。
//
// - enabled entity (client): 「移行を開始」→ 実 Wizard へ遷移
// - preview_only entity (store / employee 等): 「移行を開始」button は disabled、理由を表示
// - coming_soon entity: 同上 (準備中 badge)
//
// 本ページは表示専用。backend / DB / migration には触れない。
// ============================================================

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  PageHeader, Button, Card, CardContent, Badge,
} from '@hikaru/ui'
import {
  ChevronLeft, ChevronRight, ArrowRight, FileSpreadsheet, FileText,
  Info, ShieldCheck, Ban, CheckCircle2, AlertCircle,
} from 'lucide-react'
import {
  ENTITY_METADATA, isEntityKey, statusLabel,
  type EntityMetadata, type EntityStatus,
} from '@/lib/import/entity-metadata'

// ---- Local helpers ----

function StatusBadge({ status }: { status: EntityStatus }) {
  const label = statusLabel(status)
  let style: React.CSSProperties = {}
  if (status === 'enabled') {
    style = {
      background: 'oklch(0.72 0.18 150 / 0.12)',
      color:      'oklch(0.72 0.18 150)',
      border:     '1px solid oklch(0.72 0.18 150 / 0.30)',
    }
  } else if (status === 'preview_only') {
    style = {
      background: 'oklch(0.80 0.14 80 / 0.12)',
      color:      'oklch(0.80 0.14 80)',
      border:     '1px solid oklch(0.80 0.14 80 / 0.30)',
    }
  } else {
    style = {
      background: 'var(--color-muted)',
      color:      'var(--color-muted-foreground)',
      border:     '1px solid var(--color-border)',
    }
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={style}>
      {label}
    </span>
  )
}

// ---- Migration flow (5 steps) ----

const MIGRATION_STEPS: readonly { num: number; title: string; desc: string }[] = [
  { num: 1, title: 'ファイル選択', desc: 'CSV / Excel を選んでアップロードします。' },
  { num: 2, title: '項目の自動変換', desc: 'ファイルの列名を HIKARU の項目へ自動で対応付けます。' },
  { num: 3, title: '重複チェック', desc: '既存データとの重複を検出し、追加 / 更新 / スキップを選べます。' },
  { num: 4, title: '内容の確認',   desc: '登録対象の一覧をプレビューし、問題が無いか確認します。' },
  { num: 5, title: 'HIKARU へ登録', desc: '確認内容を HIKARU へ一括登録します。処理は自動で記録されます。' },
] as const

function FlowStep({ step, isLast }: { step: typeof MIGRATION_STEPS[number]; isLast: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
          style={{
            background: 'oklch(0.73 0.12 78 / 0.14)',
            color:      'oklch(0.73 0.12 78)',
            border:     '1px solid oklch(0.73 0.12 78 / 0.30)',
          }}
        >
          {step.num}
        </div>
        {!isLast && (
          <div
            className="w-px flex-1 mt-1"
            style={{ background: 'var(--color-border)', minHeight: 24 }}
          />
        )}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm font-medium text-[var(--color-foreground)]">{step.title}</p>
        <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 leading-relaxed">
          {step.desc}
        </p>
      </div>
    </div>
  )
}

// ---- Field list (2 col grid) ----

function FieldTable({ meta }: { meta: EntityMetadata }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--color-muted)' }}>
            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider">
              項目名
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider hidden sm:table-cell">
              説明
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wider w-24">
              必須
            </th>
          </tr>
        </thead>
        <tbody>
          {meta.fields.map((field, i) => (
            <tr
              key={field.label}
              style={{ borderTop: i === 0 ? undefined : '1px solid var(--color-border)' }}
            >
              <td className="px-3 py-2 text-[var(--color-foreground)] font-medium align-top">
                {field.label}
              </td>
              <td className="px-3 py-2 text-xs text-[var(--color-muted-foreground)] hidden sm:table-cell align-top">
                {field.description ?? '—'}
              </td>
              <td className="px-3 py-2 text-right align-top">
                {field.required ? (
                  <span
                    className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      background: 'oklch(0.73 0.12 78 / 0.10)',
                      color:      'oklch(0.73 0.12 78)',
                      border:     '1px solid oklch(0.73 0.12 78 / 0.25)',
                    }}
                  >
                    必須
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--color-muted-foreground)]">任意</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- Format info ----

function FormatInfo() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2">
        <FileText className="h-4 w-4 text-[var(--color-muted-foreground)]" />
        <div>
          <p className="text-xs font-medium text-[var(--color-foreground)]">CSV</p>
          <p className="text-[10px] text-[var(--color-muted-foreground)]">
            UTF-8 / Shift_JIS 対応
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2">
        <FileSpreadsheet className="h-4 w-4 text-[var(--color-muted-foreground)]" />
        <div>
          <p className="text-xs font-medium text-[var(--color-foreground)]">Excel</p>
          <p className="text-[10px] text-[var(--color-muted-foreground)]">
            .xlsx / .xls 対応
          </p>
        </div>
      </div>
    </div>
  )
}

// ---- Unavailable notice ----

function UnavailableNotice({ meta }: { meta: EntityMetadata }) {
  const isPreviewOnly = meta.status === 'preview_only'
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-4"
      style={{
        background: 'oklch(0.80 0.14 80 / 0.08)',
        border:     '1px solid oklch(0.80 0.14 80 / 0.25)',
      }}
    >
      <Info className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'oklch(0.80 0.14 80)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'oklch(0.80 0.14 80)' }}>
          {isPreviewOnly ? '接続準備中です' : '現在準備中です'}
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)] mt-1 leading-relaxed">
          {meta.unavailableReason}
        </p>
      </div>
    </div>
  )
}

// ---- Security note ----

function SecurityNote() {
  return (
    <div className="flex items-start gap-3 rounded-xl p-4 border border-[var(--color-border)]">
      <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'oklch(0.72 0.18 150)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-foreground)]">
          安全な移行フロー
        </p>
        <ul className="text-xs text-[var(--color-muted-foreground)] mt-1 leading-relaxed list-disc list-inside space-y-0.5">
          <li>アップロードした内容は自社のみで参照できます。</li>
          <li>登録前に必ず確認画面で内容をプレビューできます。</li>
          <li>登録処理はすべて操作履歴に記録されます。</li>
        </ul>
      </div>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function ImportPreviewPage() {
  const router       = useRouter()
  const params       = useParams<{ entity: string }>()
  const searchParams = useSearchParams()
  const returnPath   = searchParams.get('return')

  const entityParam = params?.entity ?? null

  // Guard: 不正な entity は Import Center へ redirect
  if (!isEntityKey(entityParam)) {
    if (typeof window !== 'undefined') {
      router.replace('/settings/import')
    }
    return null
  }

  const meta      = ENTITY_METADATA[entityParam]
  const Icon      = meta.icon
  const backHref  = returnPath ?? '/settings/import'
  const backLabel = returnPath === '/setup' ? '初期設定へ戻る' : 'データ移行センターへ戻る'

  const handleStart = () => {
    if (!meta.actionEnabled || !meta.wizardEntityParam) return
    const query = new URLSearchParams({ entity_type: meta.wizardEntityParam })
    if (returnPath) query.set('return', returnPath)
    router.push(`/settings/import/new?${query.toString()}`)
  }

  return (
    <div>
      <div className="mb-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
      </div>

      <PageHeader
        title={`${meta.label} の移行`}
        description={meta.shortDesc}
      />

      <div className="max-w-3xl space-y-6">

        {/* Overview card */}
        <Card>
          <CardContent className="py-5">
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                style={{
                  background: 'oklch(0.73 0.12 78 / 0.10)',
                  border:     '1px solid oklch(0.73 0.12 78 / 0.20)',
                }}
              >
                <Icon className="h-6 w-6" style={{ color: 'oklch(0.73 0.12 78)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-[var(--color-foreground)]">
                    {meta.label}
                  </h2>
                  <StatusBadge status={meta.status} />
                </div>
                <p className="text-sm text-[var(--color-muted-foreground)] mt-1.5 leading-relaxed">
                  {meta.fullDesc}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unavailable notice (preview_only / coming_soon) */}
        {meta.status !== 'enabled' && <UnavailableNotice meta={meta} />}

        {/* Formats */}
        <div>
          <h3 className="text-xs font-bold tracking-wider text-[var(--color-muted-foreground)] uppercase mb-2">
            対応するファイル形式
          </h3>
          <FormatInfo />
        </div>

        {/* Field list */}
        <div>
          <h3 className="text-xs font-bold tracking-wider text-[var(--color-muted-foreground)] uppercase mb-2">
            移行できる項目 ({meta.fields.length} 項目)
          </h3>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-3 leading-relaxed">
            以下の項目を CSV / Excel から取り込めます。必須項目以外は空欄でも登録できます。
            列名は日本語 / 英語のどちらでも自動で対応付けられます。
          </p>
          <FieldTable meta={meta} />
        </div>

        {/* Migration flow */}
        <div>
          <h3 className="text-xs font-bold tracking-wider text-[var(--color-muted-foreground)] uppercase mb-3">
            移行の流れ
          </h3>
          <div>
            {MIGRATION_STEPS.map((step, i) => (
              <FlowStep key={step.num} step={step} isLast={i === MIGRATION_STEPS.length - 1} />
            ))}
          </div>
        </div>

        {/* Security */}
        <SecurityNote />

        {/* Action */}
        <div className="pt-2">
          {meta.actionEnabled ? (
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Button size="lg" onClick={handleStart} aria-label={`${meta.label}の移行を開始`}>
                {meta.label}の移行を開始
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                次の画面でファイルをアップロードします。
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Button
                size="lg"
                variant="outline"
                disabled
                aria-label={`${meta.label}の移行 (現在利用できません)`}
                title={meta.unavailableReason}
              >
                <Ban className="h-4 w-4" />
                {meta.label}の移行を開始
              </Button>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                現在この機能は利用できません。上記の画面内容をご確認ください。
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
