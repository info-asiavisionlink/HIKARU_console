// ============================================================
// Extractor U4 tests — XLSX sheet selection + native cell normalization
//
// XLSX fixture は SheetJS を使って test 内でメモリ上に生成する。
// (外部ファイル不要、決定的、CI ready)
//
// カバー:
//   A. Workbook 3 sheets
//   B. sheet selection by name
//   C. sheet selection by index
//   D. 存在しない sheet reject
//   E. single sheet auto (backward compat)
//   F. Excel native Date cell → YYYY-MM-DD 変換
//   G. Excel native datetime → ISO 化
//   H. Excel number → digit string ("¥1,280" 表示 = raw 1280)
//   I. Excel boolean → "true" / "false"
//   J. Empty rows マーキング
//   K. Duplicate headers 検出
//   L. 日本語 sheet name
//   M. listXlsxSheets discovery
// ============================================================

import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseXlsx, listXlsxSheets, extractFile } from '../extractor'

function makeXlsx(sheetsData: Array<{ name: string; rows: (string | number | Date | boolean | null)[][] }>): Buffer {
  const wb = XLSX.utils.book_new()
  for (const s of sheetsData) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows as unknown[][], { cellDates: true })
    XLSX.utils.book_append_sheet(wb, ws, s.name)
  }
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(out as ArrayBuffer)
}

// ---------- A / M. Multi-sheet discovery ----------

describe('listXlsxSheets — discovery only', () => {
  it('3 sheets の name / index / rowCount / columnCount を返す', () => {
    const buf = makeXlsx([
      { name: '2026年9月', rows: [['名前', '金額'], ['A', 100], ['B', 200]] },
      { name: '2026年8月', rows: [['名前', '金額'], ['C', 300]] },
      { name: 'マスタ',    rows: [['ID'], ['x']] },
    ])
    const { sheets, errors } = listXlsxSheets(buf)
    expect(errors).toEqual([])
    expect(sheets.length).toBe(3)
    expect(sheets[0].name).toBe('2026年9月')
    expect(sheets[0].index).toBe(0)
    expect(sheets[0].rowCount).toBe(3)      // header + 2 data
    expect(sheets[0].columnCount).toBe(2)
    expect(sheets[1].name).toBe('2026年8月')
    expect(sheets[2].name).toBe('マスタ')
  })
  it('壊れた buffer でも throw せず (defensive)', () => {
    // Note: SheetJS は極めて寛容な parser で、多くの入力から workbook を組もうとする。
    // 我々の contract は「throw しない、必ず { sheets, errors } を返す」。
    // SheetJS が万一「シート数 0」or 例外を投げた場合は errors 有りになる (defense-in-depth)。
    const bad = Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
    const result = listXlsxSheets(bad)
    expect(result).toHaveProperty('sheets')
    expect(result).toHaveProperty('errors')
    expect(Array.isArray(result.sheets)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
  })
})

// ---------- B / C. Sheet selection ----------

describe('parseXlsx — sheet selection', () => {
  const buf = makeXlsx([
    { name: '2026年9月', rows: [['name', 'amount'], ['A', 100], ['B', 200]] },
    { name: '2026年8月', rows: [['name', 'amount'], ['C', 300]] },
    { name: 'マスタ',    rows: [['id'], ['x']] },
  ])

  it('B: sheet 名指定 (existing name) で対象シートを抽出', () => {
    const r = parseXlsx(buf, { sheet: '2026年8月' })
    expect(r.errors).toEqual([])
    expect(r.meta.selectedSheet).toBe('2026年8月')
    expect(r.meta.rowCount).toBe(1)  // 1 data row (C, 300)
    expect(r.rows[0].rawData['name']).toBe('C')
  })
  it('C: sheet index 指定 (0-based)', () => {
    const r = parseXlsx(buf, { sheet: 2 })  // マスタ
    expect(r.errors).toEqual([])
    expect(r.meta.selectedSheet).toBe('マスタ')
  })
  it('D: 存在しない sheet 名 → errors + availableSheets を返す', () => {
    const r = parseXlsx(buf, { sheet: '存在しないシート' })
    expect(r.errors.length).toBe(1)
    expect(r.errors[0]).toMatch(/指定されたシートが見つかりません/)
    expect(r.meta.availableSheets).toEqual(['2026年9月', '2026年8月', 'マスタ'])
    expect(r.rows).toEqual([])
  })
  it('D: 範囲外 index → errors', () => {
    const r = parseXlsx(buf, { sheet: 99 })
    expect(r.errors[0]).toMatch(/範囲外/)
  })
  it('L: 日本語 sheet 名を index / name 両方で処理可能', () => {
    const r = parseXlsx(buf, { sheet: 'マスタ' })
    expect(r.errors).toEqual([])
    expect(r.meta.selectedSheet).toBe('マスタ')
  })
})

// ---------- E. Backward compat: single sheet auto ----------

describe('parseXlsx — backward compat', () => {
  it('E: sheet option 未指定 + 単一 sheet → auto (warning 無し)', () => {
    const buf = makeXlsx([{ name: 'Sheet1', rows: [['a', 'b'], [1, 2]] }])
    const r = parseXlsx(buf)
    expect(r.errors).toEqual([])
    expect(r.meta.selectedSheet).toBe('Sheet1')
    expect(r.warnings.filter(w => /複数シート/.test(w))).toEqual([])
  })
  it('sheet option 未指定 + 複数 sheet → 最初の sheet + warning', () => {
    const buf = makeXlsx([
      { name: 'A', rows: [['x'], ['1']] },
      { name: 'B', rows: [['y'], ['2']] },
    ])
    const r = parseXlsx(buf)
    expect(r.meta.selectedSheet).toBe('A')
    expect(r.warnings.some(w => /複数シート/.test(w))).toBe(true)
  })
  it('availableSheets が meta に含まれる (multi でも single でも)', () => {
    const buf1 = makeXlsx([{ name: 'X', rows: [['a'], [1]] }])
    expect(parseXlsx(buf1).meta.availableSheets).toEqual(['X'])
    const buf2 = makeXlsx([
      { name: 'A', rows: [['a'], [1]] },
      { name: 'B', rows: [['a'], [2]] },
    ])
    expect(parseXlsx(buf2).meta.availableSheets).toEqual(['A', 'B'])
  })
})

// ---------- F / G. Excel native Date cell ----------

describe('parseXlsx — Excel native Date', () => {
  it('F: date-only cell → YYYY-MM-DD', () => {
    const d = new Date(Date.UTC(2026, 8, 6))  // 2026-09-06 UTC
    const buf = makeXlsx([{ name: 'S', rows: [['日付'], [d]] }])
    const r = parseXlsx(buf)
    expect(r.errors).toEqual([])
    // normalized_data には ISO 化された文字列が入る
    expect(r.rows[0].normalizedData['日付']).toBe('2026-09-06')
  })
  it('G: datetime cell → YYYY-MM-DDTHH:MM:SS', () => {
    const dt = new Date(Date.UTC(2026, 8, 6, 9, 30, 0))
    const buf = makeXlsx([{ name: 'S', rows: [['時刻'], [dt]] }])
    const r = parseXlsx(buf)
    expect(r.rows[0].normalizedData['時刻']).toBe('2026-09-06T09:30:00')
  })
})

// ---------- H / I. Native number / boolean ----------

describe('parseXlsx — Excel native number / boolean', () => {
  it('H: number → digit string (「¥1,280」表示 = raw 1280)', () => {
    const buf = makeXlsx([{ name: 'S', rows: [['金額'], [1280]] }])
    const r = parseXlsx(buf)
    expect(r.rows[0].normalizedData['金額']).toBe('1280')
  })
  it('I: boolean → "true" / "false"', () => {
    const buf = makeXlsx([{ name: 'S', rows: [['flag'], [true], [false]] }])
    const r = parseXlsx(buf)
    expect(r.rows[0].normalizedData['flag']).toBe('true')
    expect(r.rows[1].normalizedData['flag']).toBe('false')
  })
  it('float number は precision 保持', () => {
    const buf = makeXlsx([{ name: 'S', rows: [['x'], [1.5]] }])
    const r = parseXlsx(buf)
    expect(r.rows[0].normalizedData['x']).toBe('1.5')
  })
})

// ---------- J / K. Empty rows / duplicate headers ----------

describe('parseXlsx — empty / duplicate header handling', () => {
  it('J: 全空行は isEmpty=true としてマーク (削除はしない)', () => {
    const buf = makeXlsx([{ name: 'S', rows: [['a'], ['x'], [null], ['y']] }])
    const r = parseXlsx(buf)
    expect(r.rows.length).toBe(3)
    expect(r.rows[1].isEmpty).toBe(true)
    expect(r.rows[0].isEmpty).toBe(false)
    expect(r.rows[2].isEmpty).toBe(false)
  })
  it('K: 重複 header 検出 → FATAL error (Fix 1: silent overwrite 防止)', () => {
    const buf = makeXlsx([{ name: 'S', rows: [['名前', '電話', '電話'], ['A', '000', '111']] }])
    const r = parseXlsx(buf)
    // Fix 1: 重複ヘッダーは errors として停止させる契約
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0]).toMatch(/同じ列名として認識される項目が複数あります/)
    expect(r.meta.duplicateHeaders).toContain('電話')
    expect(r.rows).toEqual([])
  })
})

// ---------- extractFile dispatcher forwards sheet option ----------

describe('extractFile — dispatcher forwards sheet option to parseXlsx', () => {
  it('.xlsx + sheet option 指定', () => {
    const buf = makeXlsx([
      { name: 'A', rows: [['x'], ['A']] },
      { name: 'B', rows: [['x'], ['B']] },
    ])
    const r = extractFile(buf, 'xlsx', { sheet: 'B' })
    expect(r.meta.selectedSheet).toBe('B')
  })
  it('.csv では sheet 引数は無視される', () => {
    const csv = Buffer.from('a,b\n1,2\n')
    const r = extractFile(csv, 'csv', { sheet: 'X' })
    expect(r.errors).toEqual([])
    expect(r.meta.selectedSheet).toBeUndefined()
  })
})

// ---------- 100+ rows (M) ----------

describe('parseXlsx — 100+ rows performance sanity', () => {
  it('M: 200 行の XLSX でも全 row を処理', () => {
    const rows: (string | number)[][] = [['id', 'val']]
    for (let i = 1; i <= 200; i++) rows.push([`ID-${i}`, i])
    const buf = makeXlsx([{ name: 'S', rows }])
    const r = parseXlsx(buf)
    expect(r.errors).toEqual([])
    expect(r.meta.rowCount).toBe(200)
    expect(r.rows[199].normalizedData['id']).toBe('ID-200')
    expect(r.rows[199].normalizedData['val']).toBe('200')
  })
})
