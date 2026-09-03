// ============================================================
// HIKARU Setup — Safe Return Helper
//
// 目的:
//   /setup から /clients/new などの Create page へ遷移する際に
//   ?return=/setup を渡し、保存完了後に /setup へ安全に戻す。
//
// Security:
//   Open Redirect対策として、明示的な allowlist のみ許可。
//   現時点は /setup のみ。将来必要になったら追加。
//   外部URL / protocol-relative // / javascript: / 相対path は全て null 返却。
//
// Pure function, no side effects, no I/O.
// ============================================================

const ALLOWED_RETURN_PATHS = ['/setup'] as const

export type SafeReturnPath = (typeof ALLOWED_RETURN_PATHS)[number]

/**
 * URL query の `?return=` 値を安全な internal path に解決する。
 * allowlist に含まれない場合は null 返却 (呼び出し側で default を使う想定)。
 */
export function safeSetupReturn(raw: string | null | undefined): SafeReturnPath | null {
  if (!raw || typeof raw !== 'string') return null
  return (ALLOWED_RETURN_PATHS as readonly string[]).includes(raw)
    ? (raw as SafeReturnPath)
    : null
}
