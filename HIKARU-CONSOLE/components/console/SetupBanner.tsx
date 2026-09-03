'use client'

// ============================================================
// HIKARU Dashboard — Setup Banner
//
// 目的:
//   Dashboard 上部で BUSINESS_READY=false の Admin を Setup Center へ誘導する。
//
// 表示条件:
//   - businessReady === false のみ表示
//   - Loading / fetch error / status null は "非表示"
//     (Dashboard 主要機能は絶対に壊さない)
//
// Dismiss:
//   なし。BUSINESS_READY 達成で自動的に消える単純仕様。
//
// Readiness の Source of Truth:
//   /api/setup-status → computeReadiness() (lib/setup/readiness.ts)
//   Banner 側で独自に判定条件を再実装しない。
// ============================================================

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@hikaru/ui'
import { AlertCircle, ChevronRight } from 'lucide-react'
import type { SetupStatus } from '@/lib/setup/readiness'

export function SetupBanner() {
  const [businessReady, setBusinessReady] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/setup-status')
      .then((res) => (res.ok ? (res.json() as Promise<SetupStatus>) : null))
      .then((data) => {
        if (cancelled) return
        if (data?.readiness) setBusinessReady(data.readiness.businessReady)
      })
      .catch(() => {
        // Silent fallback — Dashboard 本体を壊さない
      })
    return () => { cancelled = true }
  }, [])

  // null (loading / error) → 非表示、true (Ready) → 非表示、false のみ表示
  if (businessReady !== false) return null

  return (
    <div
      className="mb-6 rounded-[var(--radius-lg)] p-4 flex flex-wrap items-center gap-4"
      style={{
        background: 'oklch(0.73 0.12 78 / 0.08)',
        border: '1px solid oklch(0.73 0.12 78 / 0.30)',
        backdropFilter: 'blur(16px)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <AlertCircle
          className="h-5 w-5 shrink-0"
          style={{ color: 'oklch(0.73 0.12 78)' }}
        />
        <div className="flex flex-col min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'oklch(0.88 0.13 78)' }}>
            初期設定を完了しましょう
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.65 0.008 75)' }}>
            HIKARUを利用開始するために、会社情報・顧客・従業員などの基本情報を設定してください。
          </p>
        </div>
      </div>
      <Link href="/setup" className="shrink-0">
        <Button size="sm" aria-label="初期設定を続ける">
          初期設定を続ける <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  )
}
