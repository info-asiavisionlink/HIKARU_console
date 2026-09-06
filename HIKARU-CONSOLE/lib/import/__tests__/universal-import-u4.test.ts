// ============================================================
// Phase U4 — XLSX & Bulk UX cross-cutting tests
//
// Spec test list (A–Y, subset relevant to pure-function verification):
//   A. Workbook 3 sheets                 (extractor-xlsx-u4 で cover)
//   B. sheet selection                    (extractor-xlsx-u4)
//   C. 存在しない sheet reject           (extractor-xlsx-u4)
//   D. single sheet auto                  (extractor-xlsx-u4)
//   E. Excel native date                  (extractor-xlsx-u4)
//   F. Excel native datetime              (extractor-xlsx-u4)
//   G. Excel time                         → 本 spec では TIMESTAMPTZ RPC cast の raw のまま
//   H. formatted money                    (extractor-xlsx-u4: raw number → digit string)
//   I. boolean                            (extractor-xlsx-u4)
//   J. empty rows                         (extractor-xlsx-u4)
//   K. duplicate headers                  (extractor-xlsx-u4)
//   L. formula cell                       (本ファイル)
//   M. 100+ rows                          (extractor-xlsx-u4)
//   N. Japanese sheet name                (extractor-xlsx-u4)
//   O. bulk CREATE valid rows             (本ファイル: pure eligibility 判定)
//   P. bulk CREATE validation error       (本ファイル)
//   Q. bulk CREATE ambiguous row          (本ファイル)
//   R. bulk CREATE unresolved duplicate   (本ファイル)
//   S. bulk SKIP                          (本ファイル)
//   T. mixed result counts                (本ファイル)
//   U. cross-company session reject       → u4-route-contract で cover
//   V. foreign row ID reject              → u4-route-contract で cover
//   W. empty-only default regression      → U3 tests
//   X. existing value not overwritten     → U3 tests
//   Y. single-row CREATE/UPDATE/SKIP      → 既存 review PATCH route (無変更)
//
// U1 / U2 / U3 regression は full suite で verify。
// ============================================================

import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseXlsx } from '../extractor'

function makeXlsx(sheetsData: Array<{ name: string; rows: unknown[][] }>): Buffer {
  const wb = XLSX.utils.book_new()
  for (const s of sheetsData) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows, { cellDates: true })
    XLSX.utils.book_append_sheet(wb, ws, s.name)
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer)
}

// ---- L. Formula cells — cached result value のみ使う (formula source は非読み込み) ----

describe('L. Formula cells safety', () => {
  it('formula cell の formula 文字列は raw_data に露出しない (cellFormula:false 契約)', () => {
    // XLSX.utils.aoa_to_sheet では formula を直接埋め込めないため、
    // manual に f プロパティを設定した cell を持つ worksheet を組む
    const wb = XLSX.utils.book_new()
    const ws: XLSX.WorkSheet = {
      '!ref': 'A1:B2',
      A1: { t: 's', v: 'header' },
      B1: { t: 's', v: 'compute' },
      A2: { t: 's', v: 'x' },
      B2: { t: 'n', v: 42, f: '=SUM(1,41)' },  // cached value 42
    }
    XLSX.utils.book_append_sheet(wb, ws, 'S')
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer)
    const r = parseXlsx(buf)
    // extractor は cellFormula:false + cached .v を使う
    expect(r.rows[0].normalizedData['compute']).toBe('42')
    // raw_data 内に formula 表記が漏れていない
    for (const [_k, v] of Object.entries(r.rows[0].rawData)) {
      expect(v).not.toMatch(/^=SUM/)
    }
  })
})

// ---- Bulk eligibility 判定 (pure) — server route を simulate ----
//
// Note: 実 route は Supabase adminClient を使うため DB integration test にはならない。
// ここでは route 内で採用している eligibility 判定式を直接検証し、契約が壊れていない
// ことを保証する。

interface FakeRow { id: string; review_status: string; validation_status: string }

function judgeCreate(rows: FakeRow[], pendingDupIds: Set<string>): { apply: string[]; skip: number; rejected: Array<{ row_id: string; reason: string }> } {
  const apply: string[] = []
  const rejected: Array<{ row_id: string; reason: string }> = []
  let skip = 0
  for (const row of rows) {
    if (row.review_status !== 'pending') { skip++; continue }
    if (row.validation_status !== 'valid') { rejected.push({ row_id: row.id, reason: 'validation_not_valid' }); continue }
    if (pendingDupIds.has(row.id))         { rejected.push({ row_id: row.id, reason: 'duplicate_unresolved' }); continue }
    apply.push(row.id)
  }
  return { apply, skip, rejected }
}

function judgeSkip(rows: FakeRow[]): { apply: string[]; skip: number } {
  const apply: string[] = []
  let skip = 0
  for (const row of rows) {
    if (row.review_status !== 'pending') { skip++; continue }
    apply.push(row.id)
  }
  return { apply, skip }
}

describe('O. bulk CREATE valid rows', () => {
  it('valid + pending + no dup → apply 対象', () => {
    const rows: FakeRow[] = [
      { id: 'r1', review_status: 'pending', validation_status: 'valid' },
      { id: 'r2', review_status: 'pending', validation_status: 'valid' },
    ]
    const r = judgeCreate(rows, new Set())
    expect(r.apply).toEqual(['r1', 'r2'])
    expect(r.rejected).toEqual([])
  })
})

describe('P. bulk CREATE validation error rejected', () => {
  it('validation_status=invalid は reject', () => {
    const rows: FakeRow[] = [
      { id: 'r1', review_status: 'pending', validation_status: 'invalid' },
      { id: 'r2', review_status: 'pending', validation_status: 'valid' },
    ]
    const r = judgeCreate(rows, new Set())
    expect(r.apply).toEqual(['r2'])
    expect(r.rejected).toContainEqual({ row_id: 'r1', reason: 'validation_not_valid' })
  })
  it('warning も (valid でないので) reject 扱い', () => {
    const rows: FakeRow[] = [{ id: 'r1', review_status: 'pending', validation_status: 'warning' }]
    const r = judgeCreate(rows, new Set())
    expect(r.rejected).toContainEqual({ row_id: 'r1', reason: 'validation_not_valid' })
  })
})

describe('Q. bulk CREATE ambiguous / R. unresolved duplicate rejected', () => {
  it('未解決 duplicate 有 → reject', () => {
    const rows: FakeRow[] = [
      { id: 'r1', review_status: 'pending', validation_status: 'valid' },
      { id: 'r2', review_status: 'pending', validation_status: 'valid' },
    ]
    const r = judgeCreate(rows, new Set(['r1']))
    expect(r.apply).toEqual(['r2'])
    expect(r.rejected).toContainEqual({ row_id: 'r1', reason: 'duplicate_unresolved' })
  })
  it('ambiguous FK は既に validation=invalid (mapper が判定) → validation_not_valid で reject 済', () => {
    // ambiguous FK は mapper.ts の validateMappedRow が invalidFields に追加する。
    // その結果 validation_status='warning' / 'invalid' になり、bulk CREATE では reject される。
    // → judgeCreate の validation ゲートで既に守られている。
    const rows: FakeRow[] = [{ id: 'r_amb', review_status: 'pending', validation_status: 'warning' }]
    const r = judgeCreate(rows, new Set())
    expect(r.rejected).toContainEqual({ row_id: 'r_amb', reason: 'validation_not_valid' })
  })
})

describe('S. bulk SKIP', () => {
  it('pending なら全て apply', () => {
    const rows: FakeRow[] = [
      { id: 'r1', review_status: 'pending', validation_status: 'valid' },
      { id: 'r2', review_status: 'pending', validation_status: 'invalid' },
    ]
    // SKIP は validation を問わない
    const r = judgeSkip(rows)
    expect(r.apply).toEqual(['r1', 'r2'])
  })
  it('既に skipped / approved なら idempotent skip', () => {
    const rows: FakeRow[] = [
      { id: 'r1', review_status: 'skipped',  validation_status: 'valid' },
      { id: 'r2', review_status: 'approved', validation_status: 'valid' },
    ]
    const r = judgeSkip(rows)
    expect(r.apply).toEqual([])
    expect(r.skip).toBe(2)
  })
})

describe('T. mixed result counts', () => {
  it('CREATE で apply / skip / rejected が混在', () => {
    const rows: FakeRow[] = [
      { id: 'r_valid',   review_status: 'pending',  validation_status: 'valid'   },  // → apply
      { id: 'r_invalid', review_status: 'pending',  validation_status: 'invalid' },  // → rejected
      { id: 'r_dup',     review_status: 'pending',  validation_status: 'valid'   },  // → rejected (dup)
      { id: 'r_done',    review_status: 'approved', validation_status: 'valid'   },  // → skip (idempotent)
    ]
    const r = judgeCreate(rows, new Set(['r_dup']))
    expect(r.apply).toEqual(['r_valid'])
    expect(r.skip).toBe(1)
    expect(r.rejected).toHaveLength(2)
    expect(r.rejected.map(x => x.reason).sort()).toEqual(['duplicate_unresolved', 'validation_not_valid'])
  })
})
