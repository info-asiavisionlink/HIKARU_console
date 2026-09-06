// ============================================================
// HIKARU Universal Import — Date Normalizer (Phase U1)
//
// 目的:
//   実世界の日本語 CSV / Excel の日付表記を、Postgres ::DATE に安全に cast
//   可能な canonical `YYYY-MM-DD` へ正規化する。
//
// 対応:
//   ISO 8601:            2026-09-06
//   Slash (ISO order):   2026/09/06 / 2026/9/6 / 2026/9/6/
//   Dot:                 2026.09.06 / 2026.9.6
//   Japanese:            2026年9月6日 / 2026年09月06日
//   With time (date only 抽出): 2026-09-06T09:00:00, 2026-09-06 09:00
//
// 明示 reject (曖昧回避):
//   MM/DD/YYYY (米国式) / DD/MM/YYYY (欧州式) は「2026 以外の先頭 4 桁」を
//   持たない場合は判定不能として reject (Phase U1 では推測しない)。
//   例: "09/06/2026" → reject (ambiguous)
//
//   不正日付 (2026-02-30 / 2026-13-01) は Date object validation で reject。
//
// timezone 変換禁止:
//   DATE は日付のみを扱う。時刻部分は無視する (未検証 warning は上位側に委譲)。
//
// 戻り値:
//   { ok: true, value: 'YYYY-MM-DD' } | { ok: false, reason: 'invalid_date' | 'ambiguous_date' | 'empty' }
// ============================================================

export type DateNormalizeResult =
  | { ok: true;  value: string }
  | { ok: false; reason: 'invalid_date' | 'ambiguous_date' | 'empty' }

/** 正規化された YYYY-MM-DD を返す。曖昧・不正・空文字は reject。 */
export function normalizeDate(raw: string | null | undefined): DateNormalizeResult {
  if (raw === null || raw === undefined) return { ok: false, reason: 'empty' }
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' }

  // NFKC で全角数字 (２０２６ → 2026) を半角化、trim
  const s = raw.normalize('NFKC').trim()
  if (s.length === 0) return { ok: false, reason: 'empty' }

  // Pattern 4 (Japanese 年月日) は先に判定する — 内部 space を含む場合がある
  //   例: "2026 年 9 月 6 日" — 空白で split すると失敗するため、full string で先に評価
  let m = /^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*$/.exec(s)
  if (m) return finalize(+m[1], +m[2], +m[3])

  // Time 部分を切り落として date-only 部分に集中する (ISO / slash / dot 用)
  //   "2026-09-06T09:00:00" → "2026-09-06"
  //   "2026-09-06 09:00"    → "2026-09-06"
  //   "2026/9/6 9:00"       → "2026/9/6"
  const dateOnly = s.split(/[T\s]/)[0]

  // Pattern 1: YYYY-MM-DD (ISO 8601 canonical)
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateOnly)
  if (m) return finalize(+m[1], +m[2], +m[3])

  // Pattern 2: YYYY/MM/DD (ISO order with slash)
  m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\/?$/.exec(dateOnly)
  if (m) return finalize(+m[1], +m[2], +m[3])

  // Pattern 3: YYYY.MM.DD (dot separator, ISO order)
  m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(dateOnly)
  if (m) return finalize(+m[1], +m[2], +m[3])

  // Ambiguous X/Y/Z pattern (先頭 4 桁が year でない = 判定不能)
  //   09/06/2026 (US MM/DD/YYYY) or 06/09/2026 (EU DD/MM/YYYY)
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}$/.test(dateOnly)) {
    return { ok: false, reason: 'ambiguous_date' }
  }
  if (/^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{4}$/.test(dateOnly)) {
    return { ok: false, reason: 'ambiguous_date' }
  }

  return { ok: false, reason: 'invalid_date' }
}

// ---- Internal ----

function finalize(y: number, mo: number, d: number): DateNormalizeResult {
  // Range check
  if (y < 1900 || y > 2999)   return { ok: false, reason: 'invalid_date' }
  if (mo < 1  || mo > 12)     return { ok: false, reason: 'invalid_date' }
  if (d  < 1  || d  > 31)     return { ok: false, reason: 'invalid_date' }

  // Calendar validity check via Date object round-trip (2026-02-30 等を弾く)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth()    !== mo - 1 ||
    dt.getUTCDate()     !== d
  ) {
    return { ok: false, reason: 'invalid_date' }
  }

  const mm = String(mo).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return { ok: true, value: `${y}-${mm}-${dd}` }
}
