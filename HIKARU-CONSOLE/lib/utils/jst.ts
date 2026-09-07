// ============================================================
// JST-safe date helpers
//
// `new Date().toISOString().split('T')[0]` は UTC ベース。
// 例: JST 2026-09-08 00:30 は UTC 2026-09-07 15:30 なので、
// UTC 経由すると日付が 1 日前にズレる。
//
// 実行環境の TZ に依存せず必ず JST の YYYY-MM-DD を返す。
// sv-SE ロケールを使う理由: ISO 8601 と同じ `YYYY-MM-DD` フォーマット。
// ============================================================

export function todayJST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

export function toJSTDateString(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}
