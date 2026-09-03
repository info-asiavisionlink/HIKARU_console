// ============================================================
// HIKARU Console — Safe Login Next Helper
//
// 目的:
//   /login?next=<path> の value を安全な Console 内部 path に解決する。
//   middleware が pathname を明示的に付与するため、通常は Console 内部
//   の relative path が渡ってくる想定。
//
// Security:
//   Open Redirect 対策として以下を全て拒否する:
//     - non-string / empty
//     - 外部URL (`https://...`, `http://...`, `javascript:...`)
//     - protocol-relative URL (`//evil.example`)
//     - 相対 path (先頭が `/` でない)
//     - Auth loop 発生 path (`/login`, `/forgot-password`, `/reset-password`)
//     - API path (`/api/...` は human page ではない)
//
// Pure function, no side effects, no I/O.
// ============================================================

/** Auth loop / non-page destination を防ぐための拒否 prefix。 */
const REJECTED_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/api/',
] as const

/**
 * `?next=` value を検証して安全な internal path を返す。
 * 拒否された場合は null (呼び出し側で default fallback を使う想定)。
 */
export function safeLoginNext(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (trimmed.length === 0) return null

  // 先頭 `/` 必須、`//` (protocol-relative) は拒否
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null

  // Auth loop / API path 拒否
  for (const prefix of REJECTED_PREFIXES) {
    if (trimmed === prefix || trimmed.startsWith(prefix + '/') || trimmed.startsWith(prefix + '?')) {
      return null
    }
    // `/api/` は末尾スラッシュ含みで既に match
    if (prefix.endsWith('/') && trimmed.startsWith(prefix)) return null
  }

  return trimmed
}
