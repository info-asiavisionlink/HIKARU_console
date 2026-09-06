// ============================================================
// HIKARU Universal Import — Boolean Normalizer (Phase U1)
//
// 目的:
//   実世界の boolean 表記 (日本語・英語・数値・記号) を、Postgres ::BOOL に
//   安全に cast 可能な canonical `"true"` / `"false"` 文字列へ正規化する。
//
// TRUE 判定 (allowlist):
//   true, TRUE, True, t, T
//   1
//   yes, YES, Yes, y, Y
//   はい, ハイ
//   有, あり, アリ
//   ○, ◯, ⭕
//
// FALSE 判定 (allowlist):
//   false, FALSE, False, f, F
//   0
//   no, NO, No, n, N
//   いいえ, イイエ
//   無, なし, ナシ
//   ×, ✕, ✖, ✗
//
// reject (曖昧値を勝手に false にしない):
//   -, 未定, 不明, TBD, 空文字, その他任意文字列
//
// 戻り値:
//   { ok: true, value: 'true' | 'false' } | { ok: false, reason: 'unknown' | 'empty' }
// ============================================================

export type BooleanNormalizeResult =
  | { ok: true;  value: 'true' | 'false' }
  | { ok: false; reason: 'unknown' | 'empty' }

const TRUE_SET: ReadonlySet<string> = new Set([
  'true', 't',
  '1',
  'yes', 'y',
  'はい', 'ハイ',
  '有', 'あり', 'アリ',
  '○', '◯', '⭕',
])

const FALSE_SET: ReadonlySet<string> = new Set([
  'false', 'f',
  '0',
  'no', 'n',
  'いいえ', 'イイエ',
  '無', 'なし', 'ナシ',
  '×', '✕', '✖', '✗',
])

export function normalizeBoolean(raw: string | boolean | number | null | undefined): BooleanNormalizeResult {
  if (raw === null || raw === undefined) return { ok: false, reason: 'empty' }

  // Native boolean pass-through
  if (typeof raw === 'boolean') {
    return { ok: true, value: raw ? 'true' : 'false' }
  }

  // Native number: 1/0 のみ許可、それ以外は unknown
  if (typeof raw === 'number') {
    if (raw === 1) return { ok: true, value: 'true'  }
    if (raw === 0) return { ok: true, value: 'false' }
    return { ok: false, reason: 'unknown' }
  }

  if (typeof raw !== 'string') return { ok: false, reason: 'empty' }

  const s = raw.normalize('NFKC').trim().toLowerCase()
  if (s.length === 0) return { ok: false, reason: 'empty' }

  if (TRUE_SET.has(s))  return { ok: true,  value: 'true'  }
  if (FALSE_SET.has(s)) return { ok: true,  value: 'false' }

  return { ok: false, reason: 'unknown' }
}
