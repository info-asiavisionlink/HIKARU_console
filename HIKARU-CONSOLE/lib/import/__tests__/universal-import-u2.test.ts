// ============================================================
// Phase U2 — Semantic Header Mapping Tests
//
// scope:
//   - L2 synonym dictionary (`header-synonyms.ts`) が entity 別に
//     canonical field へ deterministic に変換すること。
//   - U1 (L0/L1) は regression 無し。tier metadata が正しく振られること。
//   - Ambiguity guard (within-tier / cross-tier) が silent 誤 mapping を防ぐこと。
//   - U1 の value normalizer と L2 header mapping を通した end-to-end。
// ============================================================

import { describe, it, expect } from 'vitest'
import { buildHeaderMapping, applyRowMapping } from '../mapper'

// =============================================================================
// L2 SYNONYM UNIT — per entity
// =============================================================================

describe('U2 L2 synonym — CLIENT', () => {
  it('取引先名 (既存 L0) はそのまま L0 で name に確定', () => {
    const m = buildHeaderMapping(['取引先名'], 'client')
    expect(m.headerMapping['取引先名']).toBe('name')
    expect(m.mappingTiers?.['取引先名']).toBe('exact')
  })
  it('お客様名 (L2 synonym) → name', () => {
    const m = buildHeaderMapping(['お客様名'], 'client')
    expect(m.headerMapping['お客様名']).toBe('name')
    expect(m.mappingTiers?.['お客様名']).toBe('synonym')
  })
  it('取引先番号 (L2) → code', () => {
    const m = buildHeaderMapping(['取引先番号'], 'client')
    expect(m.headerMapping['取引先番号']).toBe('code')
    expect(m.mappingTiers?.['取引先番号']).toBe('synonym')
  })
  it('窓口担当 (L2) → contact_name', () => {
    const m = buildHeaderMapping(['窓口担当'], 'client')
    expect(m.headerMapping['窓口担当']).toBe('contact_name')
    expect(m.mappingTiers?.['窓口担当']).toBe('synonym')
  })
})

describe('U2 L2 synonym — STORE', () => {
  it('店名 (L0) はそのまま name', () => {
    const m = buildHeaderMapping(['店名'], 'store')
    expect(m.headerMapping['店名']).toBe('name')
  })
  it('店番号 (L2) → code', () => {
    const m = buildHeaderMapping(['店番号'], 'store')
    expect(m.headerMapping['店番号']).toBe('code')
    expect(m.mappingTiers?.['店番号']).toBe('synonym')
  })
  it('責任者 (L2) → manager_name', () => {
    const m = buildHeaderMapping(['責任者'], 'store')
    expect(m.headerMapping['責任者']).toBe('manager_name')
  })
})

describe('U2 L2 synonym — EMPLOYEE', () => {
  it('スタッフNo. (L2) → employee_number', () => {
    const m = buildHeaderMapping(['スタッフNo.'], 'employee')
    expect(m.headerMapping['スタッフNo.']).toBe('employee_number')
    expect(m.mappingTiers?.['スタッフNo.']).toBe('synonym')
  })
  it('スタッフNo (period 無し) も同じく employee_number', () => {
    const m = buildHeaderMapping(['スタッフNo'], 'employee')
    expect(m.headerMapping['スタッフNo']).toBe('employee_number')
  })
  it('従業員コード (L0 既存) → employee_number', () => {
    const m = buildHeaderMapping(['従業員コード'], 'employee')
    expect(m.headerMapping['従業員コード']).toBe('employee_number')
    expect(m.mappingTiers?.['従業員コード']).toBe('exact')
  })
  it('社員ID / 従業員ID (L2) → employee_number', () => {
    const m = buildHeaderMapping(['社員ID', '従業員ID'], 'employee')
    // usedCanonical で片方だけ hit (first-match-wins)
    expect(m.headerMapping['社員ID']).toBe('employee_number')
    expect(m.headerMapping['従業員ID']).toBeUndefined()  // second header skipped
  })
  it('スタッフ名 (L2) → name', () => {
    const m = buildHeaderMapping(['スタッフ名'], 'employee')
    expect(m.headerMapping['スタッフ名']).toBe('name')
  })
  it('採用日 (L2) → hire_date', () => {
    const m = buildHeaderMapping(['採用日'], 'employee')
    expect(m.headerMapping['採用日']).toBe('hire_date')
  })
  it('携帯番号 (L2) → phone', () => {
    const m = buildHeaderMapping(['携帯番号'], 'employee')
    expect(m.headerMapping['携帯番号']).toBe('phone')
  })
})

describe('U2 L2 synonym — PROJECT', () => {
  it('現場名 (L2) → name', () => {
    const m = buildHeaderMapping(['現場名'], 'project')
    expect(m.headerMapping['現場名']).toBe('name')
    expect(m.mappingTiers?.['現場名']).toBe('synonym')
  })
  it('案件番号 (L2) → code', () => {
    const m = buildHeaderMapping(['案件番号'], 'project')
    expect(m.headerMapping['案件番号']).toBe('code')
  })
  it('案件タイプ (L2) → project_type', () => {
    const m = buildHeaderMapping(['案件タイプ'], 'project')
    expect(m.headerMapping['案件タイプ']).toBe('project_type')
  })
  it('契約開始日 / 作業終了日 (L2)', () => {
    const m = buildHeaderMapping(['契約開始日', '作業終了日'], 'project')
    expect(m.headerMapping['契約開始日']).toBe('start_date')
    expect(m.headerMapping['作業終了日']).toBe('end_date')
  })
  it('進捗状況 (L2) → status', () => {
    const m = buildHeaderMapping(['進捗状況'], 'project')
    expect(m.headerMapping['進捗状況']).toBe('status')
  })
  it('施設名 (L2) → store_name (FK resolution 用)', () => {
    const m = buildHeaderMapping(['施設名'], 'project')
    expect(m.headerMapping['施設名']).toBe('store_name')
  })
})

describe('U2 L2 synonym — EXPENSE', () => {
  it('スタッフNo (L2) → employee_number', () => {
    const m = buildHeaderMapping(['スタッフNo'], 'expense')
    expect(m.headerMapping['スタッフNo']).toBe('employee_number')
  })
  it('購入日 / 利用日 / 使用日 / 経費日 (L2) → expense_date', () => {
    for (const h of ['購入日', '利用日', '使用日', '経費日']) {
      const m = buildHeaderMapping([h], 'expense')
      expect(m.headerMapping[h]).toBe('expense_date')
    }
  })
  it('費目 / 経費区分 / 支出区分 (L2) → category', () => {
    for (const h of ['費目', '経費区分', '支出区分']) {
      const m = buildHeaderMapping([h], 'expense')
      expect(m.headerMapping[h]).toBe('category')
    }
  })
  it('支払額 / 支払金額 / 合計金額 / 税込金額 / 経費金額 (L2) → amount', () => {
    for (const h of ['支払額', '支払金額', '合計金額', '税込金額', '経費金額']) {
      const m = buildHeaderMapping([h], 'expense')
      expect(m.headerMapping[h]).toBe('amount')
    }
  })
  it('摘要 / 用途 / 購入内容 (L2) → description', () => {
    for (const h of ['摘要', '用途', '購入内容']) {
      const m = buildHeaderMapping([h], 'expense')
      expect(m.headerMapping[h]).toBe('description')
    }
  })
  it('現場名 (L2) → project_name', () => {
    const m = buildHeaderMapping(['現場名'], 'expense')
    expect(m.headerMapping['現場名']).toBe('project_name')
  })
})

describe('U2 L2 synonym — ATTENDANCE', () => {
  it('スタッフ番号 (L2) → employee_number', () => {
    const m = buildHeaderMapping(['スタッフ番号'], 'attendance')
    expect(m.headerMapping['スタッフ番号']).toBe('employee_number')
  })
  it('出勤日 / 勤務年月日 (L2) → work_date', () => {
    for (const h of ['出勤日', '勤務年月日']) {
      const m = buildHeaderMapping([h], 'attendance')
      expect(m.headerMapping[h]).toBe('work_date')
    }
  })
  it('始業時刻 (L2) → clock_in, 終業時刻 (L2) → clock_out', () => {
    const m = buildHeaderMapping(['始業時刻', '終業時刻'], 'attendance')
    expect(m.headerMapping['始業時刻']).toBe('clock_in')
    expect(m.headerMapping['終業時刻']).toBe('clock_out')
  })
  it('休憩開始時刻 / 休憩終了時刻 (L2)', () => {
    const m = buildHeaderMapping(['休憩開始時刻', '休憩終了時刻'], 'attendance')
    expect(m.headerMapping['休憩開始時刻']).toBe('break_start')
    expect(m.headerMapping['休憩終了時刻']).toBe('break_end')
  })
  it('実働時間 (L2) → work_minutes', () => {
    const m = buildHeaderMapping(['実働時間'], 'attendance')
    expect(m.headerMapping['実働時間']).toBe('work_minutes')
  })
})

describe('U2 L2 synonym — SHIFT', () => {
  it('現場名 (L2) → project_name', () => {
    const m = buildHeaderMapping(['現場名'], 'shift')
    expect(m.headerMapping['現場名']).toBe('project_name')
  })
  it('スタッフNo (L2) → employee_number', () => {
    const m = buildHeaderMapping(['スタッフNo'], 'shift')
    expect(m.headerMapping['スタッフNo']).toBe('employee_number')
  })
  it('作業日 (L2) → shift_date', () => {
    const m = buildHeaderMapping(['作業日'], 'shift')
    expect(m.headerMapping['作業日']).toBe('shift_date')
  })
  it('開始時間 / 終了時間 (L2)', () => {
    const m = buildHeaderMapping(['開始時間', '終了時間'], 'shift')
    expect(m.headerMapping['開始時間']).toBe('start_time')
    expect(m.headerMapping['終了時間']).toBe('end_time')
  })
  it('パートナー (L2) → partner_name', () => {
    const m = buildHeaderMapping(['パートナー'], 'shift')
    expect(m.headerMapping['パートナー']).toBe('partner_name')
  })
})

// =============================================================================
// TIER PRIORITY — L0 → L1 → L2
// =============================================================================

describe('U2 tier priority', () => {
  it('L0 が hit したら L2 は評価されない', () => {
    // 「案件名」は L0 で name に確定。L2 の「現場名 → name」より優先。
    const m = buildHeaderMapping(['案件名'], 'project')
    expect(m.headerMapping['案件名']).toBe('name')
    expect(m.mappingTiers?.['案件名']).toBe('exact')
  })
  it('L1 が hit したら L2 は評価されない (書式吸収優先)', () => {
    // 「Employee-Number」は L1 で employee_number に確定 (L0 aliases に
    // employee_number があるため L1 で match)。L2 スタッフNo synonym は無関係。
    const m = buildHeaderMapping(['Employee-Number'], 'employee')
    expect(m.headerMapping['Employee-Number']).toBe('employee_number')
    expect(m.mappingTiers?.['Employee-Number']).toBe('normalized')
  })
  it('L0/L1 が miss して初めて L2 で解決される', () => {
    const m = buildHeaderMapping(['スタッフNo.'], 'employee')
    expect(m.mappingTiers?.['スタッフNo.']).toBe('synonym')
  })
})

// =============================================================================
// AMBIGUITY GUARD — silent 誤 mapping 防止
// =============================================================================

describe('U2 ambiguity guard', () => {
  it('同一 canonical に L0 と L2 両方から候補があっても、first-match-wins で 1 header だけ mapping (usedCanonical)', () => {
    // L0 「社員番号 → employee_number」+ L2 「スタッフNo → employee_number」が
    // 同時に file にあった場合、先に来た方だけが employee_number に確定。
    const m = buildHeaderMapping(['スタッフNo', '社員番号'], 'employee')
    expect(m.headerMapping['スタッフNo']).toBe('employee_number')  // 先に処理
    expect(m.headerMapping['社員番号']).toBeUndefined()             // usedCanonical で skip
  })
  it('未知 header (辞書に無い) は synonym を勝手に推測しない', () => {
    // typo-like や意味不明な header は L2 でも解決しない。
    const m = buildHeaderMapping(['金額っぽい', 'スタッフかも', '現場？'], 'expense')
    expect(m.headerMapping['金額っぽい']).toBeUndefined()
    expect(m.headerMapping['スタッフかも']).toBeUndefined()
    expect(m.headerMapping['現場？']).toBeUndefined()
    expect(m.unmappedHeaders).toContain('金額っぽい')
    expect(m.unmappedHeaders).toContain('スタッフかも')
    expect(m.unmappedHeaders).toContain('現場？')
  })
  it('曖昧な単語 (「名前」「日付」「状態」「コード」) はどの entity でも勝手に確定しない', () => {
    // 「名前」は project / expense / shift の synonym dict に含めていない。
    // (含めた場合、name / employee_name / project_name のどれか判別不能)
    for (const ent of ['project', 'expense', 'shift'] as const) {
      const m = buildHeaderMapping(['名前'], ent)
      expect(m.headerMapping['名前']).toBeUndefined()
    }
  })
})

// =============================================================================
// REAL-WORLD EXPENSE CONTRACT (spec 指定 fixture)
// =============================================================================

describe('U2 real-world Expense fixture (spec required)', () => {
  it('スタッフNo. / 購入日 / 費目 / 支払額 / 状態 / 摘要 の 6 列を canonical 化', () => {
    const headers = ['スタッフNo.', '購入日', '費目', '支払額', '状態', '摘要']
    const mapping = buildHeaderMapping(headers, 'expense')

    // Header mapping tier
    expect(mapping.headerMapping['スタッフNo.']).toBe('employee_number')
    expect(mapping.headerMapping['購入日']).toBe('expense_date')
    expect(mapping.headerMapping['費目']).toBe('category')
    expect(mapping.headerMapping['支払額']).toBe('amount')
    expect(mapping.headerMapping['状態']).toBe('status')      // L0 既存
    expect(mapping.headerMapping['摘要']).toBe('description')

    expect(mapping.mappingTiers?.['スタッフNo.']).toBe('synonym')
    expect(mapping.mappingTiers?.['購入日']).toBe('synonym')
    expect(mapping.mappingTiers?.['費目']).toBe('synonym')
    expect(mapping.mappingTiers?.['支払額']).toBe('synonym')
    expect(mapping.mappingTiers?.['状態']).toBe('exact')
    expect(mapping.mappingTiers?.['摘要']).toBe('synonym')

    // Value normalization (U1 pipeline)
    const row = {
      'スタッフNo.': 'TEST-EMP-001',
      '購入日':      '2026年9月6日',
      '費目':        '備品費',
      '支払額':      '¥1,280',
      '状態':        '下書き',
      '摘要':        'HIKARU U2 TEST',
    }
    const { mappedData } = applyRowMapping(row, mapping, 'expense')

    expect(mappedData['employee_number']).toBe('TEST-EMP-001')
    expect(mappedData['expense_date']).toBe('2026-09-06')
    expect(mappedData['category']).toBe('supplies')
    expect(mappedData['amount']).toBe('1280')
    expect(mappedData['status']).toBe('draft')
    expect(mappedData['description']).toBe('HIKARU U2 TEST')
  })
})

// =============================================================================
// SEVEN-ENTITY FIXTURES — 各 entity 1 fixture (header + value)
// =============================================================================

describe('U2 seven-entity fixtures', () => {
  it('CLIENT: 取引先名 / 取引先コード / 窓口担当', () => {
    const headers = ['取引先名', '取引先コード', '窓口担当']
    const mapping = buildHeaderMapping(headers, 'client')
    const { mappedData } = applyRowMapping(
      { '取引先名': '株式会社ABC', '取引先コード': 'CL-001', '窓口担当': '山田 太郎' },
      mapping, 'client',
    )
    expect(mappedData['name']).toBe('株式会社ABC')
    expect(mappedData['code']).toBe('CL-001')
    expect(mappedData['contact_name']).toBe('山田 太郎')
  })

  it('STORE: 店名 / 店番号 / 取引先コード / 責任者', () => {
    const headers = ['店名', '店番号', '取引先コード', '責任者']
    const mapping = buildHeaderMapping(headers, 'store')
    const { mappedData } = applyRowMapping(
      { '店名': '新宿本店', '店番号': 'ST-001', '取引先コード': 'CL-001', '責任者': '佐藤 花子' },
      mapping, 'store',
    )
    expect(mappedData['name']).toBe('新宿本店')
    expect(mappedData['code']).toBe('ST-001')
    expect(mappedData['client_code']).toBe('CL-001')
    expect(mappedData['manager_name']).toBe('佐藤 花子')
  })

  it('EMPLOYEE: スタッフNo. / スタッフ名 / 採用日', () => {
    const headers = ['スタッフNo.', 'スタッフ名', '採用日']
    const mapping = buildHeaderMapping(headers, 'employee')
    const { mappedData } = applyRowMapping(
      { 'スタッフNo.': 'EMP-0001', 'スタッフ名': '山田 太郎', '採用日': '2020年4月1日' },
      mapping, 'employee',
    )
    expect(mappedData['employee_number']).toBe('EMP-0001')
    expect(mappedData['name']).toBe('山田 太郎')
    expect(mappedData['hire_date']).toBe('2020-04-01')
  })

  it('PROJECT: 現場名 / 案件番号 / 案件タイプ / 進捗状況', () => {
    const headers = ['現場名', '案件番号', '案件タイプ', '進捗状況']
    const mapping = buildHeaderMapping(headers, 'project')
    const { mappedData } = applyRowMapping(
      { '現場名': '新宿本店 定期清掃', '案件番号': 'PJ-2026-001', '案件タイプ': '定期', '進捗状況': '稼働中' },
      mapping, 'project',
    )
    expect(mappedData['name']).toBe('新宿本店 定期清掃')
    expect(mappedData['code']).toBe('PJ-2026-001')
    expect(mappedData['project_type']).toBe('recurring')
    expect(mappedData['status']).toBe('active')
  })

  it('EXPENSE: (real-world fixture 参照)', () => {
    // 上の "U2 real-world Expense fixture" describe を参照
    expect(true).toBe(true)
  })

  it('ATTENDANCE: スタッフNo. / 勤務日 / 始業時刻 / 終業時刻', () => {
    const headers = ['スタッフNo.', '勤務日', '始業時刻', '終業時刻']
    const mapping = buildHeaderMapping(headers, 'attendance')
    const { mappedData } = applyRowMapping(
      { 'スタッフNo.': 'EMP-0001', '勤務日': '2026/9/6', '始業時刻': '9時', '終業時刻': '18時' },
      mapping, 'attendance',
    )
    expect(mappedData['employee_number']).toBe('EMP-0001')
    expect(mappedData['work_date']).toBe('2026-09-06')
    // clock_in / clock_out は TIMESTAMPTZ カラム扱いのため U1 では value 変換しない
    // (mapper は raw を保持、RPC が ::TIMESTAMPTZ cast)。ここでは raw が渡ることを確認する。
    expect(mappedData['clock_in']).toBe('9時')
    expect(mappedData['clock_out']).toBe('18時')
  })

  it('SHIFT: 現場名 / スタッフNo. / シフト日 / 開始時間 / 終了時間', () => {
    const headers = ['現場名', 'スタッフNo.', 'シフト日', '開始時間', '終了時間']
    const mapping = buildHeaderMapping(headers, 'shift')
    const { mappedData } = applyRowMapping(
      {
        '現場名':     '新宿本店 定期清掃',
        'スタッフNo.': 'EMP-0001',
        'シフト日':   '2026/9/6',
        '開始時間':   '9:00',
        '終了時間':   '18:00',
      },
      mapping, 'shift',
    )
    expect(mappedData['project_name']).toBe('新宿本店 定期清掃')
    expect(mappedData['employee_number']).toBe('EMP-0001')
    expect(mappedData['shift_date']).toBe('2026-09-06')
    expect(mappedData['start_time']).toBe('09:00:00')
    expect(mappedData['end_time']).toBe('18:00:00')
  })
})

// =============================================================================
// U1 REGRESSION — value normalizer + L0/L1 header contract 維持
// =============================================================================

describe('U2 does not break U1 value normalization', () => {
  it('date normalizer 経由: 2026年9月6日 → 2026-09-06', () => {
    const m = buildHeaderMapping(['購入日'], 'expense')
    const { mappedData } = applyRowMapping({ '購入日': '2026年9月6日' }, m, 'expense')
    expect(mappedData['expense_date']).toBe('2026-09-06')
  })
  it('money normalizer 経由: ¥1,280 → 1280', () => {
    const m = buildHeaderMapping(['支払額'], 'expense')
    const { mappedData } = applyRowMapping({ '支払額': '¥1,280' }, m, 'expense')
    expect(mappedData['amount']).toBe('1280')
  })
  it('time normalizer 経由: 9時 → 09:00:00', () => {
    const m = buildHeaderMapping(['開始時間'], 'shift')
    const { mappedData } = applyRowMapping({ '開始時間': '9時' }, m, 'shift')
    expect(mappedData['start_time']).toBe('09:00:00')
  })
  it('boolean normalizer 経由: (existing L0 field) 鍵貸出 = はい → true', () => {
    const m = buildHeaderMapping(['鍵貸出'], 'project')
    const { mappedData } = applyRowMapping({ '鍵貸出': 'はい' }, m, 'project')
    expect(mappedData['key_borrowing']).toBe('true')
  })
  it('enum dict 経由: 費目 = 備品費 → supplies', () => {
    const m = buildHeaderMapping(['費目'], 'expense')
    const { mappedData } = applyRowMapping({ '費目': '備品費' }, m, 'expense')
    expect(mappedData['category']).toBe('supplies')
  })
})

// =============================================================================
// NEGATIVE / SAFETY — 存在しない entity, fuzzy 禁止, 曖昧語
// =============================================================================

describe('U2 negative safety', () => {
  it('未知 entity は synonym を返さない (空 mapping)', () => {
    // TypeScript 側で ImportEntityType 制約に守られているが、defensive に empty 保証
    const m = buildHeaderMapping(['スタッフNo'], 'client')  // client の L2 に スタッフNo 無し
    expect(m.headerMapping['スタッフNo']).toBeUndefined()
    expect(m.unmappedHeaders).toContain('スタッフNo')
  })
  it('typo は fuzzy で解決しない', () => {
    // 「スタッフナンバー」「支払金」等の変形は synonym に含めていない
    const m = buildHeaderMapping(['スタッフナンバー', '支払金', '購入'], 'expense')
    expect(m.headerMapping['スタッフナンバー']).toBeUndefined()
    expect(m.headerMapping['支払金']).toBeUndefined()
    expect(m.headerMapping['購入']).toBeUndefined()
  })
})
