// ============================================================
// HIKARU Universal Import — Money / Integer Normalizer (Phase U1)
//
// 目的:
//   実世界の金額表記 (¥, ￥, 円, カンマ区切り) を、Postgres ::INT に安全に
//   cast 可能な canonical 数値文字列 ("1280" 等) へ正規化する。
//
// 対応:
//   906           → "906"
//   "906"         → "906"
//   "¥906"        → "906"
//   "￥906"       → "906" (全角 ￥、NFKC で半角 ¥ 化される)
//   "906円"       → "906"
//   "1,200"       → "1200"
//   "¥1,200"      → "1200"
//   "￥1,200円"   → "1200"
//   " 906 "       → "906"
//   "0"           → "0"
//   "-100"        → "-100"  (負数は許可、ただし field 契約側で reject 可能)
//
// reject:
//   "1.5"         → 小数は勝手に丸めない
//   "1,200.50"    → 同上
//   "abc"         → 数値として無効
//   ""            → 空
//   "9.99e10"     → 指数表記は reject (曖昧回避)
//
// Field 契約:
//   expenses.amount 等 INT >= 0 制約は Migration 058 RPC 側で再検証される。
//   本 normalizer は「INT に cast 可能な文字列にする」までを責務とし、
//   >= 0 判定は上位 (validator + RPC) に委ねる。
//
// 戻り値:
//   { ok: true, value: '1280' } | { ok: false, reason: 'invalid_number' | 'non_integer' | 'empty' }
// ============================================================

export type MoneyNormalizeResult =
  | { ok: true;  value: string }
  | { ok: false; reason: 'invalid_number' | 'non_integer' | 'empty' }

export function normalizeMoney(raw: string | number | null | undefined): MoneyNormalizeResult {
  if (raw === null || raw === undefined) return { ok: false, reason: 'empty' }

  // Number type を受け入れ (XLSX cell may deliver number directly)
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw))   return { ok: false, reason: 'invalid_number' }
    if (!Number.isInteger(raw))  return { ok: false, reason: 'non_integer' }
    return { ok: true, value: String(raw) }
  }

  if (typeof raw !== 'string') return { ok: false, reason: 'empty' }

  // NFKC (全角数字 / 全角 ￥ / 全角カンマ → 半角) + trim
  const s0 = raw.normalize('NFKC').trim()
  if (s0.length === 0) return { ok: false, reason: 'empty' }

  // 通貨記号 / 単位 / thousand separator を除去
  //   `¥` (U+00A5) / `￥` (NFKC で ¥) / `円`
  //   thousand separator: `,` (半角、NFKC で全角 `，` も半角化されている)
  const s1 = s0
    .replace(/¥/g,  '')
    .replace(/円/g, '')
    .replace(/,/g,  '')
    .trim()

  if (s1.length === 0) return { ok: false, reason: 'empty' }

  // 指数表記 / 小数 は reject
  if (/[eE]/.test(s1))  return { ok: false, reason: 'invalid_number' }
  if (/\./.test(s1))    return { ok: false, reason: 'non_integer' }

  // 純粋な整数 (先頭 optional +/-) だけを許可
  const m = /^([+-]?\d+)$/.exec(s1)
  if (!m) return { ok: false, reason: 'invalid_number' }

  // 数値として parse し、有限性を再確認
  const n = Number(m[1])
  if (!Number.isFinite(n))  return { ok: false, reason: 'invalid_number' }
  if (!Number.isInteger(n)) return { ok: false, reason: 'non_integer' }

  return { ok: true, value: String(n) }
}
