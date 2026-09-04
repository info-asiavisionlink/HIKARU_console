// ============================================================
// HIKARU Import — CSV / XLSX Deterministic Extractor
//
// 設計方針:
//   - Formula evaluation禁止 (SheetJS cellFormula:false)
//   - raw_data不変 (元の値を上書きしない)
//   - normalized_dataはvalidation_errorsメタデータに含む
//   - AI推測禁止 (deterministic-only)
//   - 上限: MAX_ROWS / MAX_COLUMNS / MAX_CELL_LENGTH
//
// 依存:
//   - csv-parse (v7) — quoted fields / BOM / CRLF 対応
//   - xlsx (SheetJS v0.18) — cellFormula:false でformula不実行
// ============================================================

import { parse as csvParse } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { detectSpreadsheetFormulaRisk } from './file-security'

// ---- Resource Limits ----

export const MAX_ROWS        = 10_000
export const MAX_COLUMNS     = 100
export const MAX_CELL_LENGTH = 10_000  // chars per cell

// ---- Types ----

export interface ExtractedRow {
  rowIndex:       number                          // 1-based, first data row = 1
  rawData:        Record<string, string>          // key = ORIGINAL header, value = original cell string (unmodified)
  normalizedData: Record<string, string | null>   // key = NORMALIZED header, value = normalized string (null if empty)
  formulaRisks:   string[]                        // normalized header keys where formula risk detected
  isEmpty:        boolean                         // all cells empty
}

export interface ExtractMeta {
  rawHeaders:        string[]    // original headers before normalization
  normalizedHeaders: string[]    // after trim / unicode-normalize
  rowCount:          number      // data rows (excluding header)
  columnCount:       number
  formulaWarningCount: number
  duplicateHeaders:  string[]    // normalized headers that appeared more than once
  emptyHeaders:      string[]    // original headers that were blank
  sheetCount?:       number      // XLSX only
  selectedSheet?:    string      // XLSX only
}

export interface ParseResult {
  rows: ExtractedRow[]
  meta: ExtractMeta
  warnings: string[]
  errors: string[]     // fatal parse errors
}

// ---- Header Normalization ----

// Normalize a single header: trim whitespace, unicode NFC, remove BOM char.
export function normalizeHeader(raw: string): string {
  return raw
    .replace(/^﻿/, '')           // BOM
    .normalize('NFC')
    .trim()
}

// Normalize a cell value: trim, NFC, empty-string → null in DB but keep as '' for raw_data.
export function normalizeCell(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  const str = String(raw)
  return str.normalize('NFC').trim()
}

// ---- Charset detection + decode ----
//
// 日本企業の Excel export は Shift_JIS / CP932 (Windows-31J) 出力が頻出。
// 優先順序:
//   1. UTF-8 BOM (EF BB BF) → strip して UTF-8 として decode
//   2. UTF-8 として妥当 (invalid byte sequence なし) → そのまま
//   3. Shift_JIS decode 試行
//   4. 全て失敗 → parse error として返す
//
// 推測で silent corruption を起こさない: 不正 bytes は明示 error として扱う。

import { decode as iconvDecode } from 'iconv-lite'

/**
 * UTF-8 として妥当な byte 列か判定 (invalid multi-byte sequence を検出)。
 * Node.js TextDecoder は { fatal: true } で invalid → throw する。
 */
function isValidUtf8(buffer: Buffer): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return true
  } catch {
    return false
  }
}

interface DecodedCsv {
  text:    string
  charset: 'utf-8-bom' | 'utf-8' | 'shift-jis'
  warning: string | null
}

/**
 * CSV buffer を文字列へ decode。charset を明示的に判定する。
 * 判定不能な場合は throw (呼び出し側で parse error として返す)。
 */
function decodeCsvBuffer(buffer: Buffer): DecodedCsv {
  // 1. UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    const stripped = buffer.slice(3)
    return {
      text:    stripped.toString('utf-8'),
      charset: 'utf-8-bom',
      warning: 'UTF-8 BOM detected and removed',
    }
  }

  // 2. UTF-8 as-is
  if (isValidUtf8(buffer)) {
    return { text: buffer.toString('utf-8'), charset: 'utf-8', warning: null }
  }

  // 3. Shift_JIS fallback (iconv-lite の 'shift_jis' alias は CP932 相当を扱う)
  try {
    const text = iconvDecode(buffer, 'shift_jis')
    // iconv-lite は不正 byte でも throw せず substitute char を挿入する。
    // � (replacement char) が多量に含まれる場合は silent corruption を疑う。
    const replaceChars = (text.match(/�/g) ?? []).length
    if (replaceChars > 10) {
      throw new Error(
        `Shift_JIS デコード後に置換文字が ${replaceChars} 個検出されました。文字コードが不明の可能性があります。`,
      )
    }
    return {
      text,
      charset: 'shift-jis',
      warning: 'Shift_JIS / CP932 として解析しました',
    }
  } catch (e) {
    throw new Error(
      `文字コードを判別できませんでした (UTF-8 / Shift_JIS ともに失敗): ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

// ---- CSV Parser ----

export function parseCsv(buffer: Buffer): ParseResult {
  const warnings: string[] = []
  const errors: string[]   = []

  // Decode with charset detection (UTF-8 BOM → UTF-8 → Shift_JIS fallback)
  let decoded: DecodedCsv
  try {
    decoded = decodeCsvBuffer(buffer)
  } catch (e) {
    return {
      rows:     [],
      meta:     emptyMeta(),
      warnings,
      errors:   [`CSV解析エラー: ${e instanceof Error ? e.message : String(e)}`],
    }
  }

  if (decoded.warning) warnings.push(decoded.warning)

  // Parse all rows as string arrays (no type coercion)
  let rawRows: string[][]
  try {
    rawRows = csvParse(decoded.text, {
      columns:          false,      // return arrays not objects
      skip_empty_lines: false,      // we handle empty rows ourselves
      trim:             false,      // we normalize separately
      cast:             false,      // no type coercion
      relax_quotes:     false,
      bom:              false,      // 既に decode 側で strip 済
    }) as string[][]
  } catch (e) {
    return {
      rows:     [],
      meta:     emptyMeta(),
      warnings,
      errors:   [`CSV解析エラー: ${e instanceof Error ? e.message : String(e)}`],
    }
  }

  if (rawRows.length === 0) {
    return { rows: [], meta: emptyMeta(), warnings, errors: ['ファイルが空です'] }
  }

  return buildParseResult(rawRows, warnings, errors)
}

// Export for testing
export { decodeCsvBuffer }

// ---- XLSX Parser ----

export function parseXlsx(buffer: Buffer): ParseResult {
  const warnings: string[] = []
  const errors: string[]   = []

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, {
      type:        'buffer',
      cellFormula: false,   // Formula文字列を読み込まない (important for security)
      cellNF:      false,
      cellHTML:    false,
      cellDates:   false,   // 日付を文字列として扱う (parse時に意味変換させない)
      raw:         true,    // Raw cell values
      dense:       true,
    })
  } catch (e) {
    return {
      rows:     [],
      meta:     emptyMeta(),
      warnings,
      errors:   [`XLSXブックの読み込みエラー: ${e instanceof Error ? e.message : String(e)}`],
    }
  }

  const sheetCount = workbook.SheetNames.length
  if (sheetCount === 0) {
    return { rows: [], meta: emptyMeta(), warnings, errors: ['Workbookにシートが存在しません'] }
  }

  if (sheetCount > 1) {
    warnings.push(`複数シートが存在します (${sheetCount}枚)。最初のシートのみ処理します: "${workbook.SheetNames[0]}"`)
  }

  const selectedSheet = workbook.SheetNames[0]
  const worksheet     = workbook.Sheets[selectedSheet]

  if (!worksheet) {
    return { rows: [], meta: emptyMeta(), warnings, errors: ['シートデータが読み取れません'] }
  }

  // sheet_to_json with header:1 returns array of arrays
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    header:    1,
    raw:       true,    // raw values (formula cells return cached value without f property)
    defval:    '',      // empty cells → empty string
    blankrows: true,    // include blank rows (we filter later)
  }) as unknown[][]

  // Convert each cell to string
  const stringRows: string[][] = rawRows.map(row =>
    (row as unknown[]).map(cell => {
      if (cell === null || cell === undefined) return ''
      return String(cell)
    })
  )

  const result    = buildParseResult(stringRows, warnings, errors)
  result.meta.sheetCount    = sheetCount
  result.meta.selectedSheet = selectedSheet
  return result
}

// ---- Core Row Builder ----

function buildParseResult(
  rawRows: string[][],
  warnings: string[],
  errors: string[],
): ParseResult {

  if (rawRows.length === 0) {
    return { rows: [], meta: emptyMeta(), warnings, errors: ['データが空です'] }
  }

  if (rawRows.length === 1) {
    // ヘッダー行のみ、データ行なし
    const rawHeaders        = rawRows[0]
    const normalizedHeaders = rawHeaders.map(normalizeHeader)
    return {
      rows:     [],
      meta:     {
        rawHeaders,
        normalizedHeaders,
        rowCount:            0,
        columnCount:         normalizedHeaders.length,
        formulaWarningCount: 0,
        duplicateHeaders:    [],
        emptyHeaders:        [],
      },
      warnings,
      errors:   ['データ行がありません (ヘッダー行のみです)'],
    }
  }

  // Header row = first row
  const rawHeaderRow = rawRows[0]

  // Column limit check (header width determines column count)
  if (rawHeaderRow.length > MAX_COLUMNS) {
    return {
      rows:     [],
      meta:     emptyMeta(),
      warnings,
      errors:   [`列数が上限を超えています (${rawHeaderRow.length} > ${MAX_COLUMNS})。最大${MAX_COLUMNS}列まで対応しています`],
    }
  }

  const rawHeaders        = rawHeaderRow
  const normalizedHeaders = rawHeaders.map(normalizeHeader)

  // Empty header detection
  const emptyHeaders: string[] = []
  normalizedHeaders.forEach((h, i) => {
    if (h === '') emptyHeaders.push(`列${i + 1} (元: "${rawHeaders[i]}")`)
  })

  // Duplicate header detection (use normalized)
  const seenHeaders = new Map<string, number>()
  const duplicateHeaders: string[] = []
  normalizedHeaders.forEach(h => {
    if (h === '') return
    const count = (seenHeaders.get(h) ?? 0) + 1
    seenHeaders.set(h, count)
    if (count === 2) duplicateHeaders.push(h)  // report once on second occurrence
  })

  if (emptyHeaders.length > 0) {
    warnings.push(`空のヘッダー列が ${emptyHeaders.length} 件あります: ${emptyHeaders.slice(0, 5).join(', ')}`)
  }
  if (duplicateHeaders.length > 0) {
    warnings.push(`重複するヘッダーが ${duplicateHeaders.length} 件あります: ${duplicateHeaders.join(', ')}`)
  }

  const dataRows       = rawRows.slice(1)
  let   formulaWarnings = 0
  const extractedRows: ExtractedRow[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const rawRow   = dataRows[i]

    // Row limit
    if (i >= MAX_ROWS) {
      warnings.push(`行数が上限 ${MAX_ROWS} を超えたため、以降の行はスキップされました`)
      break
    }

    // Build raw_data object (key = normalized header, value = raw cell string)
    // raw_data: key = original header, value = original cell string (absolutely unmodified)
    const rawData:        Record<string, string>        = {}
    // normalized_data: key = normalized header, value = normalized string (null if empty)
    const normalizedData: Record<string, string | null> = {}
    const formulaRisks: string[] = []
    let   allEmpty = true

    for (let j = 0; j < normalizedHeaders.length; j++) {
      const rawHeader  = rawHeaders[j]   || `_raw_col${j + 1}`
      const normHeader = normalizedHeaders[j] || `_col${j + 1}`
      const rawValue   = rawRow[j] ?? ''

      // Cell length limit applied to normalized value; raw_data always stores original
      const truncated = rawValue.length > MAX_CELL_LENGTH
      const clampedRaw = truncated ? rawValue.slice(0, MAX_CELL_LENGTH) : rawValue

      if (truncated) {
        warnings.push(`行${i + 1} 列"${normHeader}": セル文字数が上限(${MAX_CELL_LENGTH})を超えました。切り詰めました`)
      }

      // raw_data: completely unmodified original value (before any normalization)
      rawData[rawHeader] = rawValue

      // normalized_data: trimmed + NFC, empty → null
      const normalizedVal = normalizeCell(clampedRaw)
      normalizedData[normHeader] = normalizedVal === '' ? null : normalizedVal

      // Formula risk detection uses normalized value (trimStart handles leading spaces)
      if (detectSpreadsheetFormulaRisk(rawValue)) {
        formulaRisks.push(normHeader)
        formulaWarnings++
      }

      if (rawValue !== '') allEmpty = false
    }

    extractedRows.push({
      rowIndex:       i + 1,
      rawData,
      normalizedData,
      formulaRisks,
      isEmpty: allEmpty,
    })
  }

  const meta: ExtractMeta = {
    rawHeaders,
    normalizedHeaders,
    rowCount:            extractedRows.length,
    columnCount:         normalizedHeaders.length,
    formulaWarningCount: formulaWarnings,
    duplicateHeaders,
    emptyHeaders:        emptyHeaders.map(h => h),
  }

  return { rows: extractedRows, meta, warnings, errors }
}

function emptyMeta(): ExtractMeta {
  return {
    rawHeaders:          [],
    normalizedHeaders:   [],
    rowCount:            0,
    columnCount:         0,
    formulaWarningCount: 0,
    duplicateHeaders:    [],
    emptyHeaders:        [],
  }
}

// ---- Unified Entry Point ----

export function extractFile(buffer: Buffer, ext: string): ParseResult {
  if (ext === 'csv') return parseCsv(buffer)
  if (ext === 'xlsx') return parseXlsx(buffer)
  return {
    rows:     [],
    meta:     emptyMeta(),
    warnings: [],
    errors:   [`未対応の拡張子: .${ext}`],
  }
}
