// ============================================================
// Phase U3 — Review Editing & Safe Resolution
// End-to-end contract via pure functions (applyReviewPatch + metadata)
//
// spec test cases:
//   A. Client mapped_data edit
//   B. Store client reference (invalid UUID / null reset)
//   C. Employee date/status edit
//   D. Project enum edit
//   E. Expense amount / category / expense_date edit
//   F. Attendance work_date / integer edit
//   G. Shift date / time / status
//   H. Cross-company UUID rejection (invalid_uuid)  [DB check is API-side; here format]
//   I. Non-editable field rejection
//   J. raw_data unchanged
//   K. normalized_data unchanged
//   L. edited value re-normalization
//   M. validation_errors refresh
//   N. ambiguous remains ambiguous until explicit selection
//   O. column default empty-only
//   P. existing value not overwritten by default
//   Q. CREATE/UPDATE/SKIP regression (existing route not touched by U3)
//   R. U1/U2 full regression (implicit via full test suite)
// ============================================================

import { describe, it, expect } from 'vitest'
import { applyReviewPatch, shouldApplyDefault } from '../review-edit'
import { getEditableFields, getFieldMeta, PATCH_FORBIDDEN_KEYS } from '../editable-fields'

const UUID_A = '00000000-0000-0000-0000-00000000000a'
const UUID_B = '00000000-0000-0000-0000-00000000000b'

// ============================================================
// A. Client mapped_data edit
// ============================================================

describe('A. Client mapped_data edit', () => {
  it('name / code / email / phone / address / contact_name / notes 全て editable', () => {
    for (const k of ['name', 'code', 'email', 'phone', 'address', 'contact_name', 'notes']) {
      expect(getFieldMeta('client', k)).toBeDefined()
    }
  })
  it('name 変更 → mapped_data 更新 + validation=valid + duplicate stale', () => {
    const r = applyReviewPatch({ name: '旧名', code: 'C-1' }, { name: '新名' }, 'client')
    expect(r.mergedMapped['name']).toBe('新名')
    expect(r.validation.status).toBe('valid')
    expect(r.duplicateStale).toBe(true)
  })
})

// ============================================================
// B. Store client reference selection
// ============================================================

describe('B. Store client_id reference selection', () => {
  it('valid UUID を選択 → client_id + client_fk_status=resolved + duplicate stale', () => {
    const r = applyReviewPatch(
      { name: 'S1' },
      { client_id: UUID_A },
      'store',
    )
    expect(r.mergedMapped['client_id']).toBe(UUID_A)
    expect(r.mergedMapped['client_fk_status']).toBe('resolved')
    expect(r.duplicateStale).toBe(true)
  })
  it('null を送ると リセット (id=null, fk_status=not_found)', () => {
    const r = applyReviewPatch(
      { name: 'S1', client_id: UUID_A, client_fk_status: 'resolved' },
      { client_id: null },
      'store',
    )
    expect(r.mergedMapped['client_id']).toBeNull()
    expect(r.mergedMapped['client_fk_status']).toBe('not_found')
  })
  it('不正 UUID は reject (Server は cross-company チェックに移らない)', () => {
    const r = applyReviewPatch({}, { client_id: 'not-a-uuid' }, 'store')
    expect(r.rejected).toContainEqual({ field: 'client_id', reason: 'invalid_uuid' })
  })
})

// ============================================================
// C. Employee date / status edit
// ============================================================

describe('C. Employee date / status edit', () => {
  it('birth_date: 1990年4月15日 → 1990-04-15', () => {
    const r = applyReviewPatch({ name: '山田' }, { birth_date: '1990年4月15日' }, 'employee')
    expect(r.mergedMapped['birth_date']).toBe('1990-04-15')
  })
  it('hire_date: 2020/4/1 → 2020-04-01', () => {
    const r = applyReviewPatch({ name: '山田' }, { hire_date: '2020/4/1' }, 'employee')
    expect(r.mergedMapped['hire_date']).toBe('2020-04-01')
  })
  it('status enum: active passthrough', () => {
    const r = applyReviewPatch({ name: '山田' }, { status: 'active' }, 'employee')
    expect(r.mergedMapped['status']).toBe('active')  // canonical passthrough
  })
})

// ============================================================
// D. Project enum edit
// ============================================================

describe('D. Project enum edit', () => {
  it('project_type: 定期 → recurring', () => {
    const r = applyReviewPatch({ name: 'P1' }, { project_type: '定期' }, 'project')
    expect(r.mergedMapped['project_type']).toBe('recurring')
  })
  it('status: 稼働中 → active', () => {
    const r = applyReviewPatch({ name: 'P1' }, { status: '稼働中' }, 'project')
    expect(r.mergedMapped['status']).toBe('active')
  })
  it('key_borrowing: はい → true (boolean)', () => {
    const r = applyReviewPatch({ name: 'P1' }, { key_borrowing: 'はい' }, 'project')
    expect(r.mergedMapped['key_borrowing']).toBe('true')
  })
})

// ============================================================
// E. Expense amount / category / expense_date edit
// ============================================================

describe('E. Expense amount / category / expense_date edit', () => {
  it('amount: ¥12,800 → 12800', () => {
    const r = applyReviewPatch({ worker_id: UUID_A, expense_date: '2026-09-06' }, { amount: '¥12,800' }, 'expense')
    expect(r.mergedMapped['amount']).toBe('12800')
  })
  it('category: 交通費 → transport', () => {
    const r = applyReviewPatch({ worker_id: UUID_A, expense_date: '2026-09-06' }, { category: '交通費' }, 'expense')
    expect(r.mergedMapped['category']).toBe('transport')
  })
  it('expense_date: 2026/9/6 → 2026-09-06', () => {
    const r = applyReviewPatch({ worker_id: UUID_A }, { expense_date: '2026/9/6' }, 'expense')
    expect(r.mergedMapped['expense_date']).toBe('2026-09-06')
  })
  it('status: 精算済 → settled', () => {
    const r = applyReviewPatch({ worker_id: UUID_A, expense_date: '2026-09-06' }, { status: '精算済' }, 'expense')
    expect(r.mergedMapped['status']).toBe('settled')
  })
})

// ============================================================
// F. Attendance work_date / integer edit
// ============================================================

describe('F. Attendance work_date / integer edit', () => {
  it('work_date: 2026.09.06 → 2026-09-06', () => {
    const r = applyReviewPatch({ worker_id: UUID_A }, { work_date: '2026.09.06' }, 'attendance')
    expect(r.mergedMapped['work_date']).toBe('2026-09-06')
  })
  it('break_minutes: 60 (integer)', () => {
    const r = applyReviewPatch({ worker_id: UUID_A, work_date: '2026-09-06' }, { break_minutes: '60' }, 'attendance')
    expect(r.mergedMapped['break_minutes']).toBe('60')
  })
  it('work_minutes: 480', () => {
    const r = applyReviewPatch({ worker_id: UUID_A, work_date: '2026-09-06' }, { work_minutes: '480' }, 'attendance')
    expect(r.mergedMapped['work_minutes']).toBe('480')
  })
  it('clock_in はここでは raw 保持 (RPC が TIMESTAMPTZ cast)', () => {
    const raw = '2026-09-06T09:00:00+09:00'
    const r = applyReviewPatch({ worker_id: UUID_A, work_date: '2026-09-06' }, { clock_in: raw }, 'attendance')
    // clock_in は DATE_FIELDS / TIME_FIELDS 未登録なので raw のまま渡る
    expect(r.mergedMapped['clock_in']).toBe(raw)
  })
})

// ============================================================
// G. Shift date / time / status
// ============================================================

describe('G. Shift date / time / status', () => {
  it('shift_date: 2026年9月6日 → 2026-09-06', () => {
    const r = applyReviewPatch(
      { project_id: UUID_A, assignee_type: 'employee', start_time: '09:00:00', end_time: '18:00:00' },
      { shift_date: '2026年9月6日' },
      'shift',
    )
    expect(r.mergedMapped['shift_date']).toBe('2026-09-06')
  })
  it('start_time: 9時 → 09:00:00', () => {
    const r = applyReviewPatch(
      { project_id: UUID_A, assignee_type: 'employee', shift_date: '2026-09-06', end_time: '18:00:00' },
      { start_time: '9時' },
      'shift',
    )
    expect(r.mergedMapped['start_time']).toBe('09:00:00')
  })
  it('end_time: 18時30分 → 18:30:00', () => {
    const r = applyReviewPatch(
      { project_id: UUID_A, assignee_type: 'employee', shift_date: '2026-09-06', start_time: '09:00:00' },
      { end_time: '18時30分' },
      'shift',
    )
    expect(r.mergedMapped['end_time']).toBe('18:30:00')
  })
  it('status enum は canonical passthrough (完了 → completed とかは辞書無しなので raw)', () => {
    const r = applyReviewPatch(
      { project_id: UUID_A, assignee_type: 'employee', shift_date: '2026-09-06', start_time: '09:00:00', end_time: '18:00:00' },
      { status: 'completed' },
      'shift',
    )
    expect(r.mergedMapped['status']).toBe('completed')
  })
})

// ============================================================
// H. Cross-company UUID rejection (format-level)
// ============================================================

describe('H. Cross-company / invalid UUID', () => {
  it('format 不正 UUID は route レイヤ以前に reject', () => {
    // Note: cross-company UUID の DB 検証は API route の役割
    // (contract test で route の .eq(company_id) 存在を verify 済)。
    // ここでは applyReviewPatch が UUID 形式 layer を持つことを確認。
    const r = applyReviewPatch({}, { client_id: 'fake' }, 'store')
    expect(r.rejected).toContainEqual({ field: 'client_id', reason: 'invalid_uuid' })
  })
})

// ============================================================
// I. Non-editable field rejection
// ============================================================

describe('I. Non-editable field rejection', () => {
  it('company_id / session_id / worker_id / created_by 等の内部フィールドを reject', () => {
    for (const forbidden of ['company_id', 'session_id', 'worker_id', 'created_by', 'approved_by', 'submitted_at']) {
      const r = applyReviewPatch({ name: 'A' }, { [forbidden]: 'evil' }, 'expense')
      const rej = r.rejected.find(x => x.field === forbidden)
      expect(rej).toBeDefined()
      expect(rej!.reason).toBe('forbidden_internal')
    }
  })
  it('EDITABLE_FIELDS 外 (typo / 未登録) を reject', () => {
    const r = applyReviewPatch({}, { totally_new_field: 'x' } as never, 'client')
    expect(r.rejected).toContainEqual({ field: 'totally_new_field', reason: 'not_editable' })
  })
  it('entity の editable field が entity 違いだと reject (例: client に project_type)', () => {
    const r = applyReviewPatch({ name: 'A' }, { project_type: 'spot' }, 'client')  // client には project_type 無し
    expect(r.rejected).toContainEqual({ field: 'project_type', reason: 'not_editable' })
  })
})

// ============================================================
// J. raw_data unchanged (pure function は raw を受け取らない — module invariant)
// ============================================================

describe('J. raw_data immutability (pure function contract)', () => {
  it('applyReviewPatch は raw_data 引数を受け取らない (触りようがない)', () => {
    // Static contract: signature に raw_data / normalized_data が存在しないことで
    // 「触れない」= module 全体で不変性を保証する
    const r = applyReviewPatch({ name: 'A' }, { name: 'B' }, 'client')
    // returned shape に raw_data / normalized_data キー無し
    expect('raw_data' in r).toBe(false)
    expect('normalized_data' in r).toBe(false)
  })
})

// ============================================================
// K. normalized_data unchanged (同上)
// ============================================================

describe('K. normalized_data immutability', () => {
  it('applyReviewPatch は normalized_data を触らない (module 契約)', () => {
    const currentMapped = { name: 'A', code: 'C-1' }
    const before = JSON.stringify(currentMapped)
    applyReviewPatch(currentMapped, { name: 'B' }, 'client')
    // 引数の mapped_data も破壊しない (spread merge のみ)
    expect(JSON.stringify(currentMapped)).toBe(before)
  })
})

// ============================================================
// L. edited value re-normalization
// ============================================================

describe('L. Edited value re-normalization', () => {
  it('生 CSV 表記を送っても canonical に整形される', () => {
    const r = applyReviewPatch({}, { amount: '¥12,800', category: '備品費', expense_date: '2026/9/6' }, 'expense')
    expect(r.acceptedPatch['amount']).toBe('12800')
    expect(r.acceptedPatch['category']).toBe('supplies')
    expect(r.acceptedPatch['expense_date']).toBe('2026-09-06')
  })
})

// ============================================================
// M. validation_errors refresh
// ============================================================

describe('M. Validation errors refresh', () => {
  it('必須項目を追加すると invalid → valid に遷移', () => {
    const before = applyReviewPatch({}, { code: 'C-1' }, 'client')
    expect(before.validation.status).toBe('invalid')
    expect(before.validation.missingRequired).toContain('name')

    const after  = applyReviewPatch({ code: 'C-1' }, { name: 'ABC' }, 'client')
    expect(after.validation.status).toBe('valid')
    expect(after.validation.missingRequired).not.toContain('name')
  })
  it('必須項目を空にすると valid → invalid に遷移', () => {
    const before = applyReviewPatch({ name: 'ABC' }, {}, 'client')  // no patch, still valid
    expect(before.validation.status).toBe('valid')

    const after  = applyReviewPatch({ name: 'ABC' }, { name: '' }, 'client')
    expect(after.validation.status).toBe('invalid')
    expect(after.validation.missingRequired).toContain('name')
  })
})

// ============================================================
// N. Ambiguous remains ambiguous until explicit selection
// ============================================================

describe('N. Ambiguous FK — explicit selection only', () => {
  it('ambiguous 状態 (fk_status=ambiguous, id=null) は手動選択まで維持', () => {
    // Simulate mapper が ambiguous を set したあと、edit なしで再 apply しても
    // ambiguous は変わらない (module は勝手に決めない)
    const r = applyReviewPatch(
      { name: 'S', client_id: null, client_fk_status: 'ambiguous' },
      {},  // no patch
      'store',
    )
    expect(r.mergedMapped['client_id']).toBeNull()
    expect(r.mergedMapped['client_fk_status']).toBe('ambiguous')
  })
  it('ユーザーが UUID を明示選択して初めて resolved に遷移', () => {
    const r = applyReviewPatch(
      { name: 'S', client_id: null, client_fk_status: 'ambiguous' },
      { client_id: UUID_A },
      'store',
    )
    expect(r.mergedMapped['client_id']).toBe(UUID_A)
    expect(r.mergedMapped['client_fk_status']).toBe('resolved')
  })
})

// ============================================================
// O. Column default empty-only
// ============================================================

describe('O. Column default empty-only', () => {
  it('shouldApplyDefault: null / undefined / 空文字 / 空白は true', () => {
    expect(shouldApplyDefault(null)).toBe(true)
    expect(shouldApplyDefault(undefined)).toBe(true)
    expect(shouldApplyDefault('')).toBe(true)
    expect(shouldApplyDefault('   ')).toBe(true)
  })
})

// ============================================================
// P. Existing value not overwritten by default
// ============================================================

describe('P. Existing value not overwritten', () => {
  it('shouldApplyDefault: 既存値ありは false', () => {
    expect(shouldApplyDefault('supplies')).toBe(false)
    expect(shouldApplyDefault('0')).toBe(false)  // '0' is a valid value, not empty
    expect(shouldApplyDefault('draft')).toBe(false)
    expect(shouldApplyDefault('false')).toBe(false)  // string 'false' is a value
  })
})

// ============================================================
// Q. CREATE/UPDATE/SKIP regression (module 分離、U3 は既存 route を触らない)
// ============================================================

describe('Q. CREATE/UPDATE/SKIP existing route regression (module boundary)', () => {
  it('applyReviewPatch は review_status を返さない (既存 PATCH /review/[rowId] の担当)', () => {
    const r = applyReviewPatch({ name: 'A' }, { name: 'B' }, 'client')
    // U3 module は review_status 決定に関与しない (duplicate_stale フラグを返すのみ)
    expect('review_status' in r).toBe(false)
    // API route が duplicate_stale を見て review_status='pending' へリセットする責務
    expect(typeof r.duplicateStale).toBe('boolean')
  })
})

// ============================================================
// R. U1 / U2 full regression — implicit via full test suite (27+ files)
// (ここでは U3 module 単体で U1 normalizer / U2 header mapper が壊れていないことを spot check)
// ============================================================

describe('R. U1/U2 spot regression via U3 pipeline', () => {
  it('U1: money normalizer 経由 (¥1,280 → 1280)', () => {
    const r = applyReviewPatch({}, { amount: '¥1,280' }, 'expense')
    expect(r.acceptedPatch['amount']).toBe('1280')
  })
  it('U1: date normalizer 経由 (2026年9月6日 → 2026-09-06)', () => {
    const r = applyReviewPatch({}, { expense_date: '2026年9月6日' }, 'expense')
    expect(r.acceptedPatch['expense_date']).toBe('2026-09-06')
  })
  it('U1: enum dict 経由 (備品費 → supplies)', () => {
    const r = applyReviewPatch({}, { category: '備品費' }, 'expense')
    expect(r.acceptedPatch['category']).toBe('supplies')
  })
  it('U2: header synonym は mapper 側で解決済 = U3 は canonical field 名を受け取る', () => {
    // U3 は canonical field 名で patch を受ける (「スタッフNo」ではなく employee_number)
    const meta = getFieldMeta('employee', 'employee_number')
    expect(meta).toBeDefined()
    expect(meta!.type).toBe('text')
  })
})

// ============================================================
// Extra: 7 entity editable field coverage smoke (spec test list rows all entities)
// ============================================================

describe('7 entity editable field smoke', () => {
  const ents = ['client', 'store', 'employee', 'project', 'expense', 'attendance', 'shift'] as const
  for (const ent of ents) {
    it(`${ent}: editable field 非空`, () => {
      expect(getEditableFields(ent).length).toBeGreaterThan(0)
    })
  }
})

// ============================================================
// Security invariants
// ============================================================

describe('Security invariants', () => {
  it('company_id 直接 patch は forbidden_internal', () => {
    const r = applyReviewPatch({ name: 'A' }, { company_id: 'other-company-uuid' }, 'client')
    expect(r.rejected.some(x => x.field === 'company_id' && x.reason === 'forbidden_internal')).toBe(true)
    // 元 mapped_data には他社の company_id が入らない
    expect(r.mergedMapped['company_id']).toBeUndefined()
  })
  it('worker_id 直接 patch は forbidden_internal (auth_user_id 経由でのみ解決)', () => {
    const r = applyReviewPatch({}, { worker_id: UUID_A }, 'attendance')
    expect(r.rejected.some(x => x.field === 'worker_id' && x.reason === 'forbidden_internal')).toBe(true)
    expect(r.mergedMapped['worker_id']).toBeUndefined()
  })
  it('client_fk_status 直接 patch は forbidden_internal', () => {
    const r = applyReviewPatch({}, { client_fk_status: 'resolved' }, 'store')
    expect(r.rejected.some(x => x.field === 'client_fk_status' && x.reason === 'forbidden_internal')).toBe(true)
  })
  it('全 PATCH_FORBIDDEN_KEYS が実際に reject される', () => {
    for (const k of PATCH_FORBIDDEN_KEYS) {
      const r = applyReviewPatch({}, { [k]: 'anything' }, 'expense')
      expect(r.rejected.some(x => x.field === k)).toBe(true)
    }
  })
})
