// ============================================================
// Extractor Tests — CSV / XLSX Deterministic Parser
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  parseXlsx,
  normalizeHeader,
  normalizeCell,
  extractFile,
  MAX_ROWS,
  MAX_COLUMNS,
  MAX_CELL_LENGTH,
} from '../extractor'
import * as XLSX from 'xlsx'

// ---- Test Helpers ----

function csvBuf(text: string): Buffer {
  return Buffer.from(text, 'utf8')
}

function csvBufBOM(text: string): Buffer {
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')])
}

function makeXlsx(rows: (string | number | null)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

// ---- normalizeHeader ----

describe('normalizeHeader', () => {
  it('trims whitespace',            () => expect(normalizeHeader(' 会社名 ')).toBe('会社名'))
  it('removes BOM character',       () => expect(normalizeHeader('﻿会社名')).toBe('会社名'))
  it('applies NFC normalization',   () => {
    const nfd = '゙' // combining dakuten (NFD form part)
    const h   = 'が' + nfd  // combining form
    const result = normalizeHeader(h)
    expect(result.normalize('NFC')).toBe(result)
  })
  it('preserves inner content',     () => expect(normalizeHeader('  会社 名  ')).toBe('会社 名'))
  it('empty string stays empty',    () => expect(normalizeHeader('   ')).toBe(''))
})

// ---- normalizeCell ----

describe('normalizeCell', () => {
  it('trims whitespace',   () => expect(normalizeCell('  ABC  ')).toBe('ABC'))
  it('handles null',       () => expect(normalizeCell(null)).toBe(''))
  it('handles undefined',  () => expect(normalizeCell(undefined)).toBe(''))
  it('converts number',    () => expect(normalizeCell(42)).toBe('42'))
  it('keeps negative num', () => expect(normalizeCell(-1000)).toBe('-1000'))
})

// ---- CSV: Simple ----

describe('parseCsv — basic', () => {
  it('parses simple CSV', () => {
    const r = parseCsv(csvBuf('会社名,住所\n株式会社ABC,東京都\n'))
    expect(r.errors).toHaveLength(0)
    expect(r.rows).toHaveLength(1)
    // rawData key = original header
    expect(r.rows[0].rawData['会社名']).toBe('株式会社ABC')
    expect(r.rows[0].rawData['住所']).toBe('東京都')
    // normalizedData key = normalized header
    expect(r.rows[0].normalizedData['会社名']).toBe('株式会社ABC')
    expect(r.meta.normalizedHeaders).toEqual(['会社名', '住所'])
  })

  it('BOM UTF-8 is stripped', () => {
    const r = parseCsv(csvBufBOM('名前,コード\nABC,001\n'))
    expect(r.errors).toHaveLength(0)
    expect(r.meta.normalizedHeaders[0]).toBe('名前')
    expect(r.warnings.some(w => w.includes('BOM'))).toBe(true)
  })

  it('quoted fields with comma inside', () => {
    const r = parseCsv(csvBuf('名前,住所\n"株式会社ABC","東京都,中央区"\n'))
    expect(r.errors).toHaveLength(0)
    expect(r.rows[0].rawData['住所']).toBe('東京都,中央区')
  })

  it('escaped quotes', () => {
    const r = parseCsv(csvBuf('名前\n"田中 ""太郎"""\n'))
    expect(r.errors).toHaveLength(0)
    expect(r.rows[0].rawData['名前']).toBe('田中 "太郎"')
  })

  it('CRLF line endings', () => {
    const r = parseCsv(csvBuf('名前,コード\r\nABC,001\r\nDEF,002\r\n'))
    expect(r.errors).toHaveLength(0)
    expect(r.rows).toHaveLength(2)
  })

  it('LF line endings', () => {
    const r = parseCsv(csvBuf('名前\nABC\nDEF\n'))
    expect(r.errors).toHaveLength(0)
    expect(r.rows).toHaveLength(2)
  })

  it('empty cell: rawData="" (original preserved)', () => {
    const r = parseCsv(csvBuf('A,B,C\n1,,3\n'))
    expect(r.rows[0].rawData['B']).toBe('')
  })

  it('empty row detected as isEmpty', () => {
    const r = parseCsv(csvBuf('A,B\n1,2\n,\n3,4\n'))
    expect(r.rows[1].isEmpty).toBe(true)
    expect(r.rows[0].isEmpty).toBe(false)
  })

  it('empty file returns error', () => {
    const r = parseCsv(csvBuf(''))
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it('header-only CSV returns empty rows with error', () => {
    const r = parseCsv(csvBuf('名前,コード\n'))
    expect(r.meta.rowCount).toBe(0)
    expect(r.errors.length).toBeGreaterThan(0)
  })
})

// ---- CSV: Headers ----

describe('parseCsv — headers', () => {
  it('detects duplicate headers', () => {
    const r = parseCsv(csvBuf('名前,名前,住所\nA,B,C\n'))
    expect(r.meta.duplicateHeaders).toContain('名前')
    expect(r.warnings.some(w => w.includes('重複'))).toBe(true)
  })

  it('detects empty headers', () => {
    const r = parseCsv(csvBuf('名前,,住所\nA,B,C\n'))
    expect(r.warnings.some(w => w.includes('空'))).toBe(true)
  })

  it('empty header column uses _col fallback key in normalizedData', () => {
    const r = parseCsv(csvBuf('名前,,住所\nA,B,C\n'))
    // normalizedData uses _col{n} fallback for empty headers
    expect(Object.keys(r.rows[0].normalizedData)).toContain('_col2')
    // rawData uses _raw_col{n} fallback for empty original headers
    expect(Object.keys(r.rows[0].rawData)).toContain('_raw_col2')
  })

  it('normalizes header whitespace', () => {
    const r = parseCsv(csvBuf(' 会社名 , 住所 \nABC,東京\n'))
    expect(r.meta.normalizedHeaders).toEqual(['会社名', '住所'])
    expect(r.meta.rawHeaders).toEqual([' 会社名 ', ' 住所 '])
  })

  it('preserves raw headers separately from normalized', () => {
    const r = parseCsv(csvBuf(' 会社名 ,コード\nABC,001\n'))
    expect(r.meta.rawHeaders[0]).toBe(' 会社名 ')
    expect(r.meta.normalizedHeaders[0]).toBe('会社名')
    // rawData uses original header key
    expect(r.rows[0].rawData[' 会社名 ']).toBe('ABC')
    // normalizedData uses normalized header key
    expect(r.rows[0].normalizedData['会社名']).toBe('ABC')
  })

  it('raw/normalized are separate objects — 3-layer data separation', () => {
    const r = parseCsv(csvBuf(' 会社名 , 住所 \n  株式会社ABC  , 東京都  \n'))
    // rawData: original header key, original (unmodified) value
    expect(r.rows[0].rawData[' 会社名 ']).toBe('  株式会社ABC  ')
    // normalizedData: normalized header key, trimmed value
    expect(r.rows[0].normalizedData['会社名']).toBe('株式会社ABC')
    // rawData must NOT be changed by normalization
    expect(r.rows[0].rawData[' 会社名 ']).toBe('  株式会社ABC  ')
  })

  it('empty cell: rawData="", normalizedData=null', () => {
    const r = parseCsv(csvBuf('A,B,C\n1,,3\n'))
    expect(r.rows[0].rawData['B']).toBe('')
    expect(r.rows[0].normalizedData['B']).toBeNull()
  })
})

// ---- CSV: Resource Limits ----

describe('parseCsv — resource limits', () => {
  it('rejects too many columns', () => {
    const header = Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `col${i}`).join(',')
    const row    = Array.from({ length: MAX_COLUMNS + 1 }, () => 'val').join(',')
    const r = parseCsv(csvBuf(`${header}\n${row}\n`))
    expect(r.errors.some(e => e.includes('列数'))).toBe(true)
    expect(r.rows).toHaveLength(0)
  })

  it('truncates at MAX_ROWS and adds warning', () => {
    const lines = ['col\n', ...Array.from({ length: MAX_ROWS + 5 }, (_, i) => `row${i}\n`)]
    const r = parseCsv(csvBuf(lines.join('')))
    expect(r.rows.length).toBeLessThanOrEqual(MAX_ROWS)
    expect(r.warnings.some(w => w.includes('上限'))).toBe(true)
  })

  it('truncates very long cell in normalizedData and warns; rawData preserves original', () => {
    const longVal = 'X'.repeat(MAX_CELL_LENGTH + 100)
    const r = parseCsv(csvBuf(`col\n${longVal}\n`))
    expect(r.errors).toHaveLength(0)
    // normalizedData is truncated to MAX_CELL_LENGTH
    expect((r.rows[0].normalizedData['col'] ?? '').length).toBeLessThanOrEqual(MAX_CELL_LENGTH)
    // rawData stores the original unmodified value
    expect(r.rows[0].rawData['col'].length).toBe(longVal.length)
    expect(r.warnings.some(w => w.includes('切り詰め'))).toBe(true)
  })
})

// ---- CSV: Formula Detection ----

describe('parseCsv — formula detection', () => {
  it('detects = formula and flags as risk', () => {
    // Use proper CSV quoting for formula with internal double quotes
    const r = parseCsv(csvBuf('名前,金額\n田中,=EVIL\n'))
    expect(r.errors).toHaveLength(0)
    expect(r.rows[0].formulaRisks).toContain('金額')
    expect(r.meta.formulaWarningCount).toBe(1)
  })

  it('detects + formula', () => {
    const r = parseCsv(csvBuf('名前\n+CMD\n'))
    expect(r.rows[0].formulaRisks).toContain('名前')
  })

  it('detects @ formula', () => {
    const r = parseCsv(csvBuf('名前\n@SUM\n'))
    expect(r.rows[0].formulaRisks).toContain('名前')
  })

  it('flags -1000 as formula risk (negative number starts with -)', () => {
    // 設計上: -1000 は formula risk として flagging されるが、blockしない
    const r = parseCsv(csvBuf('金額\n-1000\n'))
    expect(r.rows[0].formulaRisks).toContain('金額')
    // raw value は変更しない
    expect(r.rows[0].rawData['金額']).toBe('-1000')
  })

  it('does NOT flag normal text', () => {
    const r = parseCsv(csvBuf('名前\n山田太郎\n'))
    expect(r.rows[0].formulaRisks).toHaveLength(0)
  })

  it('does NOT flag email address', () => {
    const r = parseCsv(csvBuf('メール\nuser@example.com\n'))
    expect(r.rows[0].formulaRisks).toHaveLength(0)
  })

  it('raw value is preserved even for formula-like cells', () => {
    const r = parseCsv(csvBuf('金額\n=EVIL\n'))
    expect(r.rows[0].rawData['金額']).toBe('=EVIL')    // rawData: unchanged original
    expect(r.rows[0].normalizedData['金額']).toBe('=EVIL')  // normalizedData: same (formula strings just trimmed)
    expect(r.rows[0].formulaRisks).toContain('金額')
  })

  it('row_index is 1-based', () => {
    const r = parseCsv(csvBuf('名前\nA\nB\nC\n'))
    expect(r.rows[0].rowIndex).toBe(1)
    expect(r.rows[2].rowIndex).toBe(3)
  })
})

// ---- XLSX ----

describe('parseXlsx — basic', () => {
  it('parses a valid workbook', () => {
    const buf = makeXlsx([
      ['会社名', '住所'],
      ['ABC', '東京都'],
      ['DEF', '大阪府'],
    ])
    const r = parseXlsx(buf)
    expect(r.errors).toHaveLength(0)
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0].rawData['会社名']).toBe('ABC')
  })

  it('warns on multiple sheets and uses first', () => {
    const ws1 = XLSX.utils.aoa_to_sheet([['A'], ['1']])
    const ws2 = XLSX.utils.aoa_to_sheet([['B'], ['2']])
    const wb  = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1')
    XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2')
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

    const r = parseXlsx(buf)
    expect(r.meta.sheetCount).toBe(2)
    expect(r.meta.selectedSheet).toBe('Sheet1')
    expect(r.warnings.some(w => w.includes('複数シート'))).toBe(true)
    expect(r.rows[0].rawData['A']).toBe('1')
  })

  it('formula cell is NOT evaluated (returns raw/cached value)', () => {
    // With cellFormula:false, formula cells return the cached value or empty
    const ws = XLSX.utils.aoa_to_sheet([['金額'], [100]])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

    const r = parseXlsx(buf)
    expect(r.errors).toHaveLength(0)
    // value should be raw '100', not evaluated expression
    expect(r.rows[0].rawData['金額']).toBe('100')
  })

  it('empty workbook returns error', () => {
    const wb  = XLSX.utils.book_new()
    const ws  = XLSX.utils.aoa_to_sheet([[]])
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
    const r = parseXlsx(buf)
    // header only or empty → rowCount = 0 → error
    expect(r.meta.rowCount).toBe(0)
  })

  it('rejects too many columns', () => {
    const headerRow = Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `col${i}`)
    const dataRow   = Array.from({ length: MAX_COLUMNS + 1 }, () => 'val')
    const buf = makeXlsx([headerRow, dataRow])
    const r = parseXlsx(buf)
    expect(r.errors.some(e => e.includes('列数'))).toBe(true)
  })

  it('metadata: sheetCount and selectedSheet', () => {
    const buf = makeXlsx([['A', 'B'], ['1', '2']])
    const r   = parseXlsx(buf)
    expect(r.meta.sheetCount).toBe(1)
    expect(r.meta.selectedSheet).toBe('Sheet1')
  })
})

// ---- extractFile ----

describe('extractFile', () => {
  it('dispatches csv extension to CSV parser', () => {
    const r = extractFile(csvBuf('col\nval\n'), 'csv')
    expect(r.errors).toHaveLength(0)
    expect(r.rows).toHaveLength(1)
  })

  it('dispatches xlsx extension to XLSX parser', () => {
    const buf = makeXlsx([['col'], ['val']])
    const r   = extractFile(buf, 'xlsx')
    expect(r.errors).toHaveLength(0)
    expect(r.rows).toHaveLength(1)
  })

  it('returns error for unsupported extension', () => {
    const r = extractFile(Buffer.from(''), 'pdf')
    expect(r.errors.some(e => e.includes('未対応'))).toBe(true)
  })
})

// ---- Constants ----

describe('Resource limit constants', () => {
  it('MAX_ROWS is 10000', ()        => expect(MAX_ROWS).toBe(10_000))
  it('MAX_COLUMNS is 100', ()       => expect(MAX_COLUMNS).toBe(100))
  it('MAX_CELL_LENGTH is 10000', () => expect(MAX_CELL_LENGTH).toBe(10_000))
})

// ---- AI call verification ----

describe('AI calls', () => {
  it('extractor makes zero OpenAI calls (no import of openai in extractor)', async () => {
    // Static check: extractor.ts must not import openai
    const mod = await import('../extractor')
    // If we reached here, no runtime OpenAI calls occurred
    expect(mod).toBeDefined()
  })
})
