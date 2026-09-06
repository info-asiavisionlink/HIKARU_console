// ============================================================
// Phase U1 — Integration + Regression Contract Tests
//
// mapper.ts の L1 header matching + value normalization 統合を verify する。
// U1 scope 内で通せる pattern のみを test し、U2 (synonym mapping) 相当は
// あえて test しない (Phase U2 で追加予定)。
// ============================================================

import { describe, it, expect } from 'vitest'
import { buildHeaderMapping, applyRowMapping, validateMappedRow } from '../mapper'

describe('mapper — L0 (exact) contract 維持 (regression)', () => {
  it('client: 会社名 → name (L0 exact)', () => {
    const { headerMapping } = buildHeaderMapping(['会社名'], 'client')
    expect(headerMapping['会社名']).toBe('name')
  })
  it('employee: 社員番号 → employee_number (L0 exact)', () => {
    const { headerMapping } = buildHeaderMapping(['社員番号'], 'employee')
    expect(headerMapping['社員番号']).toBe('employee_number')
  })
  it('expense: 発生日 → expense_date (L0 exact)', () => {
    const { headerMapping } = buildHeaderMapping(['発生日'], 'expense')
    expect(headerMapping['発生日']).toBe('expense_date')
  })
})

describe('mapper — L1 normalized header matching (Phase U1 new)', () => {
  it('trailing space が付いた header も match', () => {
    const { headerMapping } = buildHeaderMapping(['  社員番号  '], 'employee')
    expect(headerMapping['  社員番号  ']).toBe('employee_number')
  })

  it('全角英数字 → 半角で match (NFKC)', () => {
    const { headerMapping } = buildHeaderMapping(['ＥＭＰＬＯＹＥＥ_ＮＵＭＢＥＲ'], 'employee')
    expect(headerMapping['ＥＭＰＬＯＹＥＥ_ＮＵＭＢＥＲ']).toBe('employee_number')
  })

  it('separator 差 (-/_/space) を吸収して match', () => {
    // L0 alias `employee_number` に対して `employee-number` は separator 違いで normalize 後一致
    const { headerMapping } = buildHeaderMapping(['employee-number'], 'employee')
    expect(headerMapping['employee-number']).toBe('employee_number')

    // 大文字混在 + space 混在
    const { headerMapping: hm2 } = buildHeaderMapping(['Employee Number'], 'employee')
    expect(hm2['Employee Number']).toBe('employee_number')
  })

  it('意味変換しない: スタッフNo は unmapped のまま (Phase U2 で対応)', () => {
    const { headerMapping, unmappedHeaders } = buildHeaderMapping(['スタッフNo'], 'employee')
    expect(headerMapping['スタッフNo']).toBeUndefined()
    expect(unmappedHeaders).toContain('スタッフNo')
  })

  it('L0 が優先される (L1 fallback は L0 miss 時のみ)', () => {
    // 既存 alias `会社名` (L0 hit) と `会社_名` (L1 hit) の両方が候補にあっても
    // L0 exact match が先に成立、canonical `name` へ 1 対 1 mapping
    const { headerMapping } = buildHeaderMapping(['会社名', '会社_名'], 'client')
    expect(headerMapping['会社名']).toBe('name')
    // 2 番目 header は既に canonical `name` が使用済のため skip される (usedCanonical)
    expect(headerMapping['会社_名']).toBeUndefined()
  })
})

describe('mapper — value normalization (Phase U1 new)', () => {
  it('expense_date: 2026年9月6日 → 2026-09-06', () => {
    const mapping = buildHeaderMapping(['発生日'], 'expense')
    const { mappedData } = applyRowMapping({ '発生日': '2026年9月6日' }, mapping, 'expense')
    expect(mappedData['expense_date']).toBe('2026-09-06')
  })

  it('expense amount: ¥1,280 → 1280', () => {
    const mapping = buildHeaderMapping(['金額'], 'expense')
    const { mappedData } = applyRowMapping({ '金額': '¥1,280' }, mapping, 'expense')
    expect(mappedData['amount']).toBe('1280')
  })

  it('expense category: 備品費 → supplies', () => {
    const mapping = buildHeaderMapping(['カテゴリ'], 'expense')
    const { mappedData } = applyRowMapping({ 'カテゴリ': '備品費' }, mapping, 'expense')
    expect(mappedData['category']).toBe('supplies')
  })

  it('expense status: 下書き → draft', () => {
    const mapping = buildHeaderMapping(['ステータス'], 'expense')
    const { mappedData } = applyRowMapping({ 'ステータス': '下書き' }, mapping, 'expense')
    expect(mappedData['status']).toBe('draft')
  })

  it('project_type: スポット → spot', () => {
    const mapping = buildHeaderMapping(['案件種別'], 'project')
    const { mappedData } = applyRowMapping({ '案件種別': 'スポット' }, mapping, 'project')
    expect(mappedData['project_type']).toBe('spot')
  })

  it('project status: 稼働中 → active', () => {
    const mapping = buildHeaderMapping(['ステータス'], 'project')
    const { mappedData } = applyRowMapping({ 'ステータス': '稼働中' }, mapping, 'project')
    expect(mappedData['status']).toBe('active')
  })

  it('shift start_time: 9時 → 09:00:00', () => {
    const mapping = buildHeaderMapping(['開始時刻'], 'shift')
    const { mappedData } = applyRowMapping({ '開始時刻': '9時' }, mapping, 'shift')
    expect(mappedData['start_time']).toBe('09:00:00')
  })

  it('shift shift_date: 2026/9/6 → 2026-09-06', () => {
    const mapping = buildHeaderMapping(['シフト日'], 'shift')
    const { mappedData } = applyRowMapping({ 'シフト日': '2026/9/6' }, mapping, 'shift')
    expect(mappedData['shift_date']).toBe('2026-09-06')
  })

  it('shift assignee_type: 従業員 → employee', () => {
    const mapping = buildHeaderMapping(['担当者種別'], 'shift')
    const { mappedData } = applyRowMapping({ '担当者種別': '従業員' }, mapping, 'shift')
    expect(mappedData['assignee_type']).toBe('employee')
  })

  it('project key_borrowing: はい → true', () => {
    const mapping = buildHeaderMapping(['鍵貸出'], 'project')
    const { mappedData } = applyRowMapping({ '鍵貸出': 'はい' }, mapping, 'project')
    expect(mappedData['key_borrowing']).toBe('true')
  })

  it('project key_borrowing: × → false', () => {
    const mapping = buildHeaderMapping(['鍵貸出'], 'project')
    const { mappedData } = applyRowMapping({ '鍵貸出': '×' }, mapping, 'project')
    expect(mappedData['key_borrowing']).toBe('false')
  })
})

describe('mapper — non-normalized field pass-through (regression)', () => {
  it('electronic phone number は数値扱いしない (leading zero 保護)', () => {
    // phone は MONEY_FIELDS に含まれない → normalizer 適用されない
    const mapping = buildHeaderMapping(['電話番号'], 'employee')
    const { mappedData } = applyRowMapping({ '電話番号': '090-1234-5678' }, mapping, 'employee')
    expect(mappedData['phone']).toBe('090-1234-5678')  // hyphen 保持、数値化されない
  })

  it('社員番号 (employee_number) の leading zero 保護', () => {
    // employee_number は MONEY_FIELDS 含まれない → 文字列として保持
    const mapping = buildHeaderMapping(['社員番号'], 'employee')
    const { mappedData } = applyRowMapping({ '社員番号': '000123' }, mapping, 'employee')
    expect(mappedData['employee_number']).toBe('000123')
  })

  it('address / notes 等 free text はそのまま', () => {
    const mapping = buildHeaderMapping(['住所', '備考'], 'employee')
    const { mappedData } = applyRowMapping({
      '住所': '東京都渋谷区 1-2-3',
      '備考': '¥1000 という文字列を含む備考',  // MONEY field ではないため無傷
    }, mapping, 'employee')
    expect(mappedData['address']).toBe('東京都渋谷区 1-2-3')
    expect(mappedData['notes']).toBe('¥1000 という文字列を含む備考')
  })
})

describe('mapper — normalization fallback (safe raw preservation)', () => {
  it('normalize 失敗時は raw 値を保持 (validation 側で reject 発火)', () => {
    // date normalize 失敗 → raw ('abc') が mappedData に残る
    const mapping = buildHeaderMapping(['発生日'], 'expense')
    const { mappedData } = applyRowMapping({ '発生日': 'abc' }, mapping, 'expense')
    expect(mappedData['expense_date']).toBe('abc')
  })

  it('enum 未知値は raw を保持 (RPC の enum check で reject)', () => {
    const mapping = buildHeaderMapping(['カテゴリ'], 'expense')
    const { mappedData } = applyRowMapping({ 'カテゴリ': 'unknown_category' }, mapping, 'expense')
    expect(mappedData['category']).toBe('unknown_category')
  })

  it('ambiguous date (09/06/2026) は raw を保持', () => {
    const mapping = buildHeaderMapping(['発生日'], 'expense')
    const { mappedData } = applyRowMapping({ '発生日': '09/06/2026' }, mapping, 'expense')
    expect(mappedData['expense_date']).toBe('09/06/2026')
  })
})

describe('Real-world dirty fixture — U1 scope', () => {
  it('expense: 現実的な expense 1 行 (U1 で通せる範囲)', () => {
    // header に L1 (space / case) 揺れ、値に normalizer 対応形式を含む fixture。
    // 「スタッフNo → 社員番号」等の synonym はまだ効かないので、L0 で通る
    // header 名 (「社員番号」等) を使用する。
    const headers = ['  社員番号  ', '発生日', 'カテゴリ', '金額', 'ステータス', '備考', '申請者種別']
    const mapping = buildHeaderMapping(headers, 'expense')

    expect(mapping.headerMapping['  社員番号  ']).toBe('employee_number')
    expect(mapping.headerMapping['発生日']).toBe('expense_date')
    expect(mapping.headerMapping['カテゴリ']).toBe('category')
    expect(mapping.headerMapping['金額']).toBe('amount')
    expect(mapping.headerMapping['ステータス']).toBe('status')
    expect(mapping.headerMapping['備考']).toBe('note')
    expect(mapping.headerMapping['申請者種別']).toBe('assignee_type')

    const row = {
      '  社員番号  ': 'TEST-EMP-001',
      '発生日':       '2026年9月6日',
      'カテゴリ':     '備品費',
      '金額':         '¥1,280',
      'ステータス':   '下書き',
      '備考':         'universal import test',
      '申請者種別':   '従業員',
    }
    const { mappedData } = applyRowMapping(row, mapping, 'expense')

    // 全 canonical に正規化された値が入っている
    expect(mappedData['employee_number']).toBe('TEST-EMP-001')
    expect(mappedData['expense_date']).toBe('2026-09-06')
    expect(mappedData['category']).toBe('supplies')
    expect(mappedData['amount']).toBe('1280')
    expect(mappedData['status']).toBe('draft')
    expect(mappedData['note']).toBe('universal import test')
    expect(mappedData['assignee_type']).toBe('employee')
  })
})

describe('validator regression (unchanged)', () => {
  it('client: name 必須欠落は invalid', () => {
    const mapping = buildHeaderMapping(['メール'], 'client')
    const { mappedData, unmappedHeaders } = applyRowMapping({ 'メール': 'a@b.c' }, mapping, 'client')
    const v = validateMappedRow(mappedData, 'client', unmappedHeaders)
    expect(v.status).toBe('invalid')
    expect(v.missingRequired).toContain('name')
  })
})
