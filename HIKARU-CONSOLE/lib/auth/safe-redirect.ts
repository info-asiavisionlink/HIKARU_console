// ============================================================
// HIKARU Auth — Safe Redirect Helper
//
// 目的:
//   /auth/callback?next=... の next parameter に対して
//   Open Redirect 脆弱性を防ぐ allowlist ベースの検証。
//
// 原則:
//   - 内部 pathname のみ許可
//   - 明示的な allowlist (prefix match) に含まれない場合は default fallback
//   - スキーム付き URL (http:, https:, javascript:, data: ...) 拒否
//   - Protocol-relative (//evil.com), backslash 変種 (\), 制御文字 拒否
//   - ../ / ..\ / 二重スラッシュ path traversal 拒否
//
// Pure function:
//   - No I/O
//   - No side effect
//   - Unit test可能
// ============================================================

/**
 * Allowlist: 許可する内部 pathname の prefix。
 * exact match または `${prefix}` + '/' or '?' or '#' で始まるものを許可。
 *
 * 注:
 *   /set-password は P5 実装予定。P4 時点では route 未存在だが、
 *   invitation flow の redirect 先として先に allowlist入れておく (契約先出し)。
 */
export const AUTH_REDIRECT_ALLOWLIST = [
  '/set-password',
  '/setup',
  '/dashboard',
] as const

export const AUTH_REDIRECT_DEFAULT = '/dashboard'

/**
 * next parameter を安全な内部 pathname に解決する。
 * 危険な入力はすべて AUTH_REDIRECT_DEFAULT に落とす。
 *
 * @param nextRaw URL の ?next= から取り出した生の文字列 (null / undefined 可)
 * @returns 常に allowlist 上のいずれかの pathname
 */
export function getSafeAuthRedirect(nextRaw: string | null | undefined): string {
  if (!nextRaw || typeof nextRaw !== 'string') return AUTH_REDIRECT_DEFAULT

  const trimmed = nextRaw.trim()
  if (trimmed.length === 0) return AUTH_REDIRECT_DEFAULT

  // 制御文字 (null byte / newline / tab 等) 検出
  // JavaScript の文字列に含まれる制御文字は URL 検証を回避する典型手口。
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return AUTH_REDIRECT_DEFAULT

  // 先頭が '/' でなければ拒否 (相対 path や scheme 付きを弾く)
  if (!trimmed.startsWith('/')) return AUTH_REDIRECT_DEFAULT

  // Protocol-relative URL: '//evil.com' や '/\evil.com'
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return AUTH_REDIRECT_DEFAULT

  // Backslash を含む path (Windows-style traversal) 拒否
  if (trimmed.includes('\\')) return AUTH_REDIRECT_DEFAULT

  // Path traversal 拒否
  if (trimmed.includes('..')) return AUTH_REDIRECT_DEFAULT

  // Query / fragment を含む場合は pathname部分だけを allowlist 判定に使う
  // (例: '/setup?entity_type=client' → pathname '/setup' で allowlist 判定)
  const pathnameEnd = trimmed.search(/[?#]/)
  const pathname = pathnameEnd === -1 ? trimmed : trimmed.slice(0, pathnameEnd)

  const matched = AUTH_REDIRECT_ALLOWLIST.find(prefix =>
    pathname === prefix || pathname.startsWith(prefix + '/')
  )

  if (!matched) return AUTH_REDIRECT_DEFAULT

  return trimmed
}
