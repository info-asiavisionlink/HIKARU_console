// ============================================================
// Fix 1 — Duplicate Header Protection tests
//
// 契約:
//   - Exact duplicate (「電話,電話」)                             → FATAL
//   - Normalized duplicate (「 電話 ,電話」等 trim/NFC で collide) → FATAL
//   - Duplicate なしは PASS
//   - L2 semantic mapping (Mapper 側の別 layer) は無影響
//   - PII (cell value) は error / meta に含まれない
//   - CSV / XLSX 両方
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as XLSX from 'xlsx'
import { parseCsv, parseXlsx, extractFile } from '../extractor'
import { buildHeaderMapping } from '../mapper'

function csvBuf(s: string): Buffer { return Buffer.from(s, 'utf-8') }
function xlsxBuf(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'S')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer)
}

// ---- CSV Fix 1 ----

describe('Fix 1 — CSV duplicate header', () => {
  it('exact duplicate → errors + rows=[] + duplicateHeaders 記録', () => {
    const r = parseCsv(csvBuf('店舗名,電話番号,電話番号,住所\nA店,090-1,090-2,東京\n'))
    expect(r.errors.length).toBe(1)
    expect(r.errors[0]).toMatch(/同じ列名として認識される項目が複数あります/)
    expect(r.errors[0]).toContain('電話番号')
    expect(r.meta.duplicateHeaders).toEqual(['電話番号'])
    expect(r.rows).toEqual([])
  })

  it('normalized duplicate (trim/NFC で collide) → FATAL', () => {
    // 前後空白 + full-width スペース含む header は normalizeHeader() で collide する
    const r = parseCsv(csvBuf('電話番号,  電話番号  \nA,B\n'))
    expect(r.errors.length).toBe(1)
    expect(r.meta.duplicateHeaders).toContain('電話番号')
    expect(r.rows).toEqual([])
  })

  it('複数の重複列を報告 (最初 5 件を preview)', () => {
    const r = parseCsv(csvBuf('名前,名前,電話,電話,住所,住所\nA,B,C,D,E,F\n'))
    expect(r.errors.length).toBe(1)
    // 3 種類の重複、全て meta に含まれる
    expect(r.meta.duplicateHeaders.sort()).toEqual(['住所', '名前', '電話'])
    for (const h of ['名前', '電話', '住所']) {
      expect(r.errors[0]).toContain(h)
    }
  })

  it('PII (cell value) は error / meta に含まれない', () => {
    const r = parseCsv(csvBuf('メール,メール\ntest@example.com,secret@example.com\n'))
    expect(r.errors.length).toBe(1)
    // メールアドレス文字列が error にリークしていないこと
    for (const err of r.errors) {
      expect(err).not.toContain('test@example.com')
      expect(err).not.toContain('secret@example.com')
    }
    // meta にも rowData は載っていない
    expect(JSON.stringify(r.meta)).not.toContain('test@example.com')
    expect(JSON.stringify(r.meta)).not.toContain('secret@example.com')
  })

  it('duplicate 無し CSV は PASS (regression)', () => {
    const r = parseCsv(csvBuf('会社名,メール,電話,住所\nA,a@x.com,090,東京\n'))
    expect(r.errors).toEqual([])
    expect(r.rows.length).toBe(1)
  })

  it('空 header 列は duplicate 対象外 (既存契約維持)', () => {
    // 空 header は emptyHeaders に記録されるが duplicate ではない
    const r = parseCsv(csvBuf('名前,,住所\nA,B,C\n'))
    expect(r.errors).toEqual([])
    expect(r.meta.duplicateHeaders).toEqual([])
    expect(r.rows.length).toBe(1)
  })
})

// ---- XLSX Fix 1 ----

describe('Fix 1 — XLSX duplicate header', () => {
  it('exact duplicate → errors + rows=[]', () => {
    const r = parseXlsx(xlsxBuf([['店舗名', '電話番号', '電話番号', '住所'], ['A店', '090-1', '090-2', '東京']]))
    expect(r.errors.length).toBe(1)
    expect(r.meta.duplicateHeaders).toContain('電話番号')
    expect(r.rows).toEqual([])
  })

  it('normalized duplicate (前後空白) → FATAL', () => {
    const r = parseXlsx(xlsxBuf([['電話番号', '  電話番号  '], ['A', 'B']]))
    expect(r.errors.length).toBe(1)
    expect(r.meta.duplicateHeaders).toContain('電話番号')
    expect(r.rows).toEqual([])
  })

  it('duplicate 無し XLSX は PASS (regression)', () => {
    const r = parseXlsx(xlsxBuf([['name', 'value'], ['A', 1], ['B', 2]]))
    expect(r.errors).toEqual([])
    expect(r.rows.length).toBe(2)
  })
})

// ---- extractFile dispatcher ----

describe('Fix 1 — extractFile dispatcher forwards duplicate errors', () => {
  it('.csv duplicate → errors 経路', () => {
    const r = extractFile(csvBuf('a,a\n1,2\n'), 'csv')
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0]).toMatch(/同じ列名として認識される項目が複数あります/)
  })
  it('.xlsx duplicate → errors 経路', () => {
    const r = extractFile(xlsxBuf([['x', 'x'], [1, 2]]), 'xlsx')
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0]).toMatch(/同じ列名として認識される項目が複数あります/)
  })
})

// ---- L2 semantic mapping regression ----

describe('Fix 1 — L2 semantic mapping (Mapper) は Extractor duplicate protection と独立', () => {
  it('「電話」と「TEL」は Extractor では別 header (raw duplicate ではない)', () => {
    const r = parseCsv(csvBuf('会社名,電話,TEL\nA,090-1,090-2\n'))
    // Extractor レベルでは重複ではない
    expect(r.errors).toEqual([])
    expect(r.meta.duplicateHeaders).toEqual([])
    expect(r.rows.length).toBe(1)
  })
  it('Mapper 側 L2 synonym collision は既存契約通り (Fix 1 は無影響)', () => {
    // client entity: 「顧客名」と「取引先名」は両方 name canonical にマッピングされる。
    // Mapper の usedCanonical で first-match-wins、silent skip される (Extractor には
    // 影響しない = raw_data は両方保持)
    const r = parseCsv(csvBuf('顧客名,取引先名\n株式会社ABC,株式会社ABC\n'))
    expect(r.errors).toEqual([])
    expect(r.rows.length).toBe(1)

    // Mapper 側の collision 挙動 (別 test)
    const m = buildHeaderMapping(['顧客名', '取引先名'], 'client')
    expect(m.headerMapping['顧客名']).toBe('name')          // first-match wins
    expect(m.headerMapping['取引先名']).toBeUndefined()      // silent skip (usedCanonical)
  })
})

// ---- Extract route contract (静的 regex) ----

describe('Fix 1 — extract route DUPLICATE_HEADERS response', () => {
  const EXTRACT_ROUTE = resolve(__dirname, '../../../app/api/import/sessions/[id]/extract/route.ts')
  const src = readFileSync(EXTRACT_ROUTE, 'utf8')

  it("code 'DUPLICATE_HEADERS' を 422 で返す分岐が存在", () => {
    expect(src).toMatch(/DUPLICATE_HEADERS/)
    // 422 レスポンス
    expect(src).toMatch(/status:\s*422/)
  })
  it("duplicates: response に列名一覧を含める", () => {
    expect(src).toMatch(/duplicates:\s*result\.meta\.duplicateHeaders/)
  })
  it("audit log にも duplicate_headers を記録 (PII 無し)", () => {
    expect(src).toMatch(/duplicate_headers:\s*result\.meta\.duplicateHeaders/)
  })
  it('resetSession が呼ばれる (staging safety: 部分データを残さない)', () => {
    expect(src).toMatch(/resetSession\(auth,\s*sessionId/)
  })
})
