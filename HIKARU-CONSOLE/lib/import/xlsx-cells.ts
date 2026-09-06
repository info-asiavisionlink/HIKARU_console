// ============================================================
// HIKARU Import — XLSX Native Cell Normalization (Phase U4)
//
// 目的:
//   Excel の native cell 値 (Date object / Number / Boolean など) を、
//   HIKARU の staging_rows.normalized_data に格納するための文字列へ
//   deterministic に変換する。
//
// 設計原則:
//   - Field type 推測禁止:
//       セル値そのものが date-typed かは workbook metadata (Date object)
//       からのみ判断する。「45541」という単なる数値を勝手に日付にしない。
//   - Time-zone-safe:
//       Excel の date cell は UTC 深夜として JS Date 化される (SheetJS の
//       cellDates:true 挙動)。ここでは UTC 成分をそのまま YYYY-MM-DD /
//       ISO datetime 化する (local timezone shift を混入させない)。
//   - Formula 評価禁止:
//       f プロパティ (formula source) には触らない。cached .v のみ使う。
//   - Raw-preserving:
//       raw_data には元のシリアル値 (数値文字列) を保存し、normalized_data
//       にのみ ISO 化した文字列を入れる (呼び出し側で分離)。
// ============================================================

/**
 * Excel の native Date cell (SheetJS cellDates:true で JS Date 化された値) を、
 * HIKARU の canonical 表現に変換する。
 *
 * - 時刻部分が全て 0 (深夜 00:00:00 UTC) → YYYY-MM-DD (date-only 扱い)
 * - 時刻部分あり                             → YYYY-MM-DDTHH:MM:SS (ISO datetime, 秒までのみ)
 *
 * Excel が保持する datetime は timezone 情報を持たないため、UTC の year/month/day/hour/…
 * 成分をそのまま文字列化する (=タイムゾーン変換なし)。これにより開発者環境のロケール差で
 * 同じ file が別の date を返す事故を防ぐ。
 */
export function formatExcelDate(d: Date): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) return ''

  const y  = d.getUTCFullYear()
  const mo = d.getUTCMonth() + 1
  const dy = d.getUTCDate()
  const h  = d.getUTCHours()
  const mi = d.getUTCMinutes()
  const s  = d.getUTCSeconds()

  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  const yyyy = pad(y, 4)
  const dateStr = `${yyyy}-${pad(mo)}-${pad(dy)}`

  if (h === 0 && mi === 0 && s === 0) return dateStr
  return `${dateStr}T${pad(h)}:${pad(mi)}:${pad(s)}`
}

/**
 * SheetJS の sheet_to_json (raw:true, cellDates:true) から返される cell 値を
 * 文字列に変換する。
 *
 * 型別処理:
 *   Date         → formatExcelDate (YYYY-MM-DD or ISO datetime)
 *   number       → String() 経由。整数/小数はそのまま (1280 → "1280", 1.5 → "1.5")
 *   boolean      → "true" / "false"
 *   null/undefined → "" (raw_data では ""、normalized_data では null に変換)
 *   string       → そのまま
 *   その他       → String() (defensive)
 *
 * NOTE:
 *   ここでは意味変換 (¥1,280 → 1280) はしない。それは U1 normalizer + mapper が担当。
 *   Excel が「¥1,280」表示のセルを持っていても、cell の raw value は 1280 (number) で
 *   ある。我々は number → "1280" に stringify するだけで、canonical 化は下流に委ねる。
 */
export function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date)                return formatExcelDate(cell)
  if (typeof cell === 'boolean')           return cell ? 'true' : 'false'
  if (typeof cell === 'number') {
    // NaN / Infinity は安全側で空文字 (raw_data には元表示があるので情報は失われない)
    if (!Number.isFinite(cell)) return ''
    // 整数ならそのまま、非整数は toString で (0.1+0.2=0.30000000000000004 等の展開は避けたい
    // — Excel から来た値は既に丸め済みのはず。念のため precision 保持のため String() を使う)
    return String(cell)
  }
  return String(cell)
}
