// ============================================================
// 通知 target_url の内部パス検証
//
// notification.target_url を router.push() に直接渡す前に必ず通す。
// 想定外の scheme / cross-origin へ遷移させないための最終防衛線。
//
// 許可: '/' で始まる内部パスのみ
//   /jobs/123
//   /expenses/456
//   /attendance/2026/9
// 拒否: scheme 付き / protocol-relative / javascript: / data:
//   http://... https://... //evil.example javascript:... data:...
//   空文字, null, undefined, 非 string
// ============================================================

export function isSafeInternalNotificationPath(url: unknown): url is string {
  if (typeof url !== 'string') return false
  if (url.length === 0) return false
  if (!url.startsWith('/')) return false
  // Protocol-relative (//evil.example) は cross-origin なので拒否
  if (url.startsWith('//')) return false
  // scheme を含むものは拒否 (URL parser を挟まないシンプル判定)
  //   例: "/foo?url=http://" のような query 内 http は許可される (path 判定なので安全)
  //   拒否したいのは pathname 部分に scheme が生えているパターン
  const firstSegmentEnd = url.search(/[?#]/)
  const pathnamePart = firstSegmentEnd === -1 ? url : url.slice(0, firstSegmentEnd)
  if (/^\/[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(pathnamePart)) return false
  // javascript:, data:, vbscript:, file: 等が /path の途中に埋まっていても拒否
  // (実際には startsWith('/') 判定で防いでいるが二重防御)
  if (/(?:javascript|data|vbscript|file):/i.test(pathnamePart)) return false
  return true
}
