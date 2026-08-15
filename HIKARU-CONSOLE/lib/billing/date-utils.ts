/**
 * JST (Asia/Tokyo) 日付ユーティリティ
 *
 * Vercel はデフォルト UTC 環境で動作するため、
 * new Date().toISOString().split('T')[0] は UTC 日付を返し、
 * 日本時間 0:00〜8:59 の間に実行すると前日の日付になる。
 *
 * 業務上の DATE カラム（issue_date / actual_payment_date 等）は
 * 日本時間の「今日」を正確に返す必要があるため、このユーティリティを使用する。
 *
 * 対象外（変更禁止）:
 *   TIMESTAMPTZ 型（issued_at / cancelled_at / pdf_generated_at / created_at など）は
 *   UTC 絶対時刻で保存するのが正しいため、new Date().toISOString() のままにすること。
 */

/** Asia/Tokyo 基準で今日の YYYY-MM-DD を返す */
export function getJstDateString(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

/** Asia/Tokyo 基準で今年の西暦（4桁）を返す */
export function getJstYear(): number {
  return parseInt(getJstDateString().slice(0, 4), 10)
}

/** Asia/Tokyo 基準で今月を返す（1-indexed: 1〜12） */
export function getJstMonth(): number {
  return parseInt(getJstDateString().slice(5, 7), 10)
}

/**
 * 対象月の末日を YYYY-MM-DD 形式で返す（timezone 非依存）。
 * Date.UTC を使用することで環境の timezone に依存しない。
 * @param year  4桁年
 * @param month 1-indexed 月（1〜12）
 */
export function getMonthLastDay(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0))
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
