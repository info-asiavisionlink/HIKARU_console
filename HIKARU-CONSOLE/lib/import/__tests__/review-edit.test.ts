// ============================================================
// review-edit.ts unit tests (Phase U3)
//
// applyReviewPatch pure function の contract を verify する。
//
// カバー範囲:
//   - Allowlist: PATCH_FORBIDDEN_KEYS の内部フィールドは reject
//   - Allowlist: EDITABLE_FIELDS 外の field は reject
//   - Normalize: U1 normalizer が再適用される (¥1,280 → 1280, 備品費 → supplies)
//   - Reference: UUID 形式チェック + fk_status を 'resolved' に設定
//   - Reference: null / '' を送ると fk_status='not_found' + id=null にリセット
//   - Reference: 不正 UUID は reject
//   - Revalidation: patch 後の mapped_data で validateMappedRow 再実行
//   - Duplicate stale: name/email/phone/address/employee_number/code 変更で true
//   - Immutability: raw_data / normalized_data は本 module では触らない (pure)
// ============================================================

import { describe, it, expect } from 'vitest'
import { applyReviewPatch, isUuidLike, shouldApplyDefault } from '../review-edit'

const UUID = '00000000-0000-0000-0000-000000000001'

describe('applyReviewPatch — allowlist', () => {
  it('EDITABLE_FIELDS 外の field は reject', () => {
    const r = applyReviewPatch(
      { name: 'ABC' },
      { unknown_field: 'x' } as never,
      'client',
    )
    expect(r.rejected).toEqual([{ field: 'unknown_field', reason: 'not_editable' }])
    expect(r.acceptedPatch).toEqual({})
    expect(r.mergedMapped).toEqual({ name: 'ABC' })  // 元 mapped 不変
  })
  it('PATCH_FORBIDDEN_KEYS の内部フィールドは reject', () => {
    const forbidden = ['company_id', 'session_id', 'worker_id', 'client_fk_status', 'approved_by', 'submitted_at']
    for (const k of forbidden) {
      const r = applyReviewPatch({ name: 'A' }, { [k]: 'evil' }, 'expense')
      expect(r.rejected.some(x => x.field === k && x.reason === 'forbidden_internal')).toBe(true)
    }
  })
})

describe('applyReviewPatch — value normalization (U1 pipeline)', () => {
  it('expense.amount: ¥1,280 → 1280', () => {
    const r = applyReviewPatch({}, { amount: '¥1,280' }, 'expense')
    expect(r.rejected).toEqual([])
    expect(r.acceptedPatch['amount']).toBe('1280')
    expect(r.mergedMapped['amount']).toBe('1280')
  })
  it('expense.expense_date: 2026年9月6日 → 2026-09-06', () => {
    const r = applyReviewPatch({}, { expense_date: '2026年9月6日' }, 'expense')
    expect(r.acceptedPatch['expense_date']).toBe('2026-09-06')
  })
  it('expense.category: 備品費 → supplies (enum dict)', () => {
    const r = applyReviewPatch({}, { category: '備品費' }, 'expense')
    expect(r.acceptedPatch['category']).toBe('supplies')
  })
  it('expense.status: 下書き → draft', () => {
    const r = applyReviewPatch({}, { status: '下書き' }, 'expense')
    expect(r.acceptedPatch['status']).toBe('draft')
  })
  it('project.key_borrowing: はい → true (boolean normalizer)', () => {
    const r = applyReviewPatch({}, { key_borrowing: 'はい' }, 'project')
    expect(r.acceptedPatch['key_borrowing']).toBe('true')
  })
  it('shift.start_time: 9時30分 → 09:30:00 (time normalizer)', () => {
    const r = applyReviewPatch({}, { start_time: '9時30分' }, 'shift')
    expect(r.acceptedPatch['start_time']).toBe('09:30:00')
  })
  it('unknown enum は raw 保持 (validator が判定)', () => {
    const r = applyReviewPatch({}, { category: 'unknown_cat' }, 'expense')
    expect(r.acceptedPatch['category']).toBe('unknown_cat')  // raw fallback
  })
})

describe('applyReviewPatch — reference field', () => {
  it('valid UUID を送ると id 設定 + fk_status=resolved', () => {
    const r = applyReviewPatch({}, { client_id: UUID }, 'store')
    expect(r.rejected).toEqual([])
    expect(r.acceptedPatch['client_id']).toBe(UUID)
    expect(r.acceptedPatch['client_fk_status']).toBe('resolved')
    expect(r.duplicateStale).toBe(true)  // FK 変更で duplicate 判定 stale
  })
  it('null / \'\' を送ると id=null + fk_status=not_found', () => {
    const r1 = applyReviewPatch({ client_id: UUID }, { client_id: null }, 'store')
    expect(r1.acceptedPatch['client_id']).toBeNull()
    expect(r1.acceptedPatch['client_fk_status']).toBe('not_found')

    const r2 = applyReviewPatch({ client_id: UUID }, { client_id: '' }, 'store')
    expect(r2.acceptedPatch['client_id']).toBeNull()
    expect(r2.acceptedPatch['client_fk_status']).toBe('not_found')
  })
  it('不正 UUID は invalid_uuid で reject', () => {
    const r = applyReviewPatch({}, { client_id: 'not-a-uuid' }, 'store')
    expect(r.rejected).toEqual([{ field: 'client_id', reason: 'invalid_uuid' }])
    expect(r.acceptedPatch['client_id']).toBeUndefined()
  })
})

describe('applyReviewPatch — revalidation', () => {
  it('必須項目が埋まると validation=valid', () => {
    // client の name は required、他は optional
    const r = applyReviewPatch({}, { name: '株式会社ABC' }, 'client')
    expect(r.validation.status).toBe('valid')
  })
  it('必須項目が欠けると validation=invalid + missingRequired に含まれる', () => {
    const r = applyReviewPatch({}, { code: 'CL-001' }, 'client')  // name 未指定
    expect(r.validation.status).toBe('invalid')
    expect(r.validation.missingRequired).toContain('name')
  })
  it('unmappedHeaders があると warning になる可能性', () => {
    const r = applyReviewPatch({ name: 'X' }, { code: 'C-1' }, 'client', ['未知列'])
    // missingRequired=0, invalidFields=0, unmappedHeaders>0 → warning
    expect(r.validation.status).toBe('warning')
  })
})

describe('applyReviewPatch — duplicate stale detection', () => {
  it('name 変更で duplicateStale=true', () => {
    const r = applyReviewPatch({ name: 'A' }, { name: 'B' }, 'client')
    expect(r.duplicateStale).toBe(true)
  })
  it('email 変更で duplicateStale=true', () => {
    const r = applyReviewPatch({ email: 'a@x.com' }, { email: 'b@x.com' }, 'client')
    expect(r.duplicateStale).toBe(true)
  })
  it('phone 変更で duplicateStale=true', () => {
    const r = applyReviewPatch({ phone: '000' }, { phone: '111' }, 'client')
    expect(r.duplicateStale).toBe(true)
  })
  it('employee_number 変更で duplicateStale=true', () => {
    const r = applyReviewPatch({ employee_number: 'E1' }, { employee_number: 'E2' }, 'employee')
    expect(r.duplicateStale).toBe(true)
  })
  it('notes 等 non-signal field は duplicateStale=false', () => {
    const r = applyReviewPatch({ name: 'X' }, { notes: 'foo' }, 'client')
    expect(r.duplicateStale).toBe(false)
  })
})

describe('applyReviewPatch — merge semantics', () => {
  it('既存 mapped_data と patch を merge (patch が上書き)', () => {
    const r = applyReviewPatch(
      { name: 'A', code: 'C-1', notes: 'old' },
      { name: 'B' },
      'client',
    )
    expect(r.mergedMapped).toEqual({ name: 'B', code: 'C-1', notes: 'old' })
  })
  it('patch 対象外の既存 field は保持される', () => {
    const r = applyReviewPatch(
      { name: 'X', address: 'Tokyo' },
      { phone: '090-0000-0000' },
      'client',
    )
    expect(r.mergedMapped['address']).toBe('Tokyo')
    expect(r.mergedMapped['phone']).toBe('090-0000-0000')
  })
})

describe('utility functions', () => {
  it('isUuidLike: 標準 UUID を認識', () => {
    expect(isUuidLike('00000000-0000-0000-0000-000000000000')).toBe(true)
    expect(isUuidLike('12345678-1234-1234-1234-1234567890ab')).toBe(true)
  })
  it('isUuidLike: 非 UUID は false', () => {
    expect(isUuidLike('not-a-uuid')).toBe(false)
    expect(isUuidLike('12345678-1234-1234-1234-1234567890')).toBe(false)  // short
    expect(isUuidLike('')).toBe(false)
    expect(isUuidLike(null)).toBe(false)
  })
  it('shouldApplyDefault: null / undefined / 空文字は true', () => {
    expect(shouldApplyDefault(null)).toBe(true)
    expect(shouldApplyDefault(undefined)).toBe(true)
    expect(shouldApplyDefault('')).toBe(true)
    expect(shouldApplyDefault('   ')).toBe(true)
  })
  it('shouldApplyDefault: 値ありは false (既存値保護)', () => {
    expect(shouldApplyDefault('x')).toBe(false)
    expect(shouldApplyDefault('0')).toBe(false)  // 空文字と区別
    expect(shouldApplyDefault('false')).toBe(false)
  })
})
