import { describe, it, expect } from 'vitest'
import { normalizeHeader, headersEqualNormalized } from '../../normalizers/header-normalizer'

describe('normalizeHeader — basic', () => {
  it('empty / null / undefined → ""', () => {
    expect(normalizeHeader('')).toBe('')
    expect(normalizeHeader(null)).toBe('')
    expect(normalizeHeader(undefined)).toBe('')
  })

  it('trim whitespace (半角/全角)', () => {
    expect(normalizeHeader('  社員番号  ')).toBe('社員番号')
    expect(normalizeHeader('　社員番号　')).toBe('社員番号')  // 全角 space
  })

  it('lowercase 英字 (日本語には影響なし)', () => {
    expect(normalizeHeader('EMPLOYEE')).toBe('employee')
    expect(normalizeHeader('Employee')).toBe('employee')
    expect(normalizeHeader('社員')).toBe('社員')
  })

  it('separator 統一 (_/-/./space) → 単一 _', () => {
    expect(normalizeHeader('Employee_Number')).toBe('employee_number')
    expect(normalizeHeader('Employee-Number')).toBe('employee_number')
    expect(normalizeHeader('Employee Number')).toBe('employee_number')
    expect(normalizeHeader('Employee.Number')).toBe('employee_number')
    expect(normalizeHeader('Employee  Number')).toBe('employee_number')  // 2 spaces
    expect(normalizeHeader('Employee___Number')).toBe('employee_number') // 3 underscores
  })

  it('全角英数字 → 半角 (NFKC)', () => {
    expect(normalizeHeader('Ｅｍｐｌｏｙｅｅ')).toBe('employee')
    expect(normalizeHeader('EMPLOYEE_ＮＵＭＢＥＲ')).toBe('employee_number')
    expect(normalizeHeader('２０２６年')).toBe('2026年')
  })

  it('trailing "." 除去', () => {
    expect(normalizeHeader('社員No.')).toBe('社員no')
    expect(normalizeHeader('社員No')).toBe('社員no')
    expect(normalizeHeader('name.')).toBe('name')
  })

  it('leading/trailing separator 除去', () => {
    expect(normalizeHeader('_employee_number_')).toBe('employee_number')
    expect(normalizeHeader('-employee-number-')).toBe('employee_number')
    expect(normalizeHeader(' _ employee _ ')).toBe('employee')
  })

  it('全角 space + 半角混在', () => {
    expect(normalizeHeader('社員　番号')).toBe('社員_番号')  // 全角 space → NFKC 半角 → _
    expect(normalizeHeader('社員 番号')).toBe('社員_番号')
  })

  it('連続する記号は単一 _ に collapse', () => {
    expect(normalizeHeader('a__b')).toBe('a_b')
    expect(normalizeHeader('a  ..  b')).toBe('a_b')
    expect(normalizeHeader('a-_-b')).toBe('a_b')
  })

  it('意味変換しない (Phase U2 の synonym は Phase U1 では実施しない)', () => {
    // 「スタッフNo」→「社員番号」の意味変換なし
    expect(normalizeHeader('スタッフNo')).toBe('スタッフno')
    // 「Staff ID」→「employee_number」の意味変換なし
    expect(normalizeHeader('Staff ID')).toBe('staff_id')
  })

  it('非文字列 → ""', () => {
    // deliberately test runtime-guard (as if untrusted CSV cell)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeHeader(123 as any)).toBe('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeHeader({} as any)).toBe('')
  })
})

describe('normalizeHeader — Idempotency', () => {
  it('normalize(normalize(x)) === normalize(x)', () => {
    const samples = [
      'Employee Number',
      '社員No.',
      '  employee_number  ',
      'Ｅｍｐｌｏｙｅｅ　ＮＵＭＢＥＲ',
    ]
    for (const s of samples) {
      const once  = normalizeHeader(s)
      const twice = normalizeHeader(once)
      expect(twice).toBe(once)
    }
  })
})

describe('headersEqualNormalized', () => {
  it('L1 一致 pattern', () => {
    expect(headersEqualNormalized('EMPLOYEE NUMBER',   'employee_number')).toBe(true)
    expect(headersEqualNormalized('Employee-Number',   'EMPLOYEE_NUMBER')).toBe(true)
    expect(headersEqualNormalized(' 社員番号 ',        '社員番号')).toBe(true)
    expect(headersEqualNormalized('社員　番号',        '社員 番号')).toBe(true)
    expect(headersEqualNormalized('Ｅｍｐｌｏｙｅｅ',    'employee')).toBe(true)
  })

  it('意味が異なる header は一致しない', () => {
    expect(headersEqualNormalized('社員番号', 'スタッフNo')).toBe(false)
    expect(headersEqualNormalized('社員番号', '氏名')).toBe(false)
  })

  it('empty vs empty は match しない (defense: 空 header の誤マッチ防止)', () => {
    expect(headersEqualNormalized('', '')).toBe(false)
    expect(headersEqualNormalized('   ', '')).toBe(false)
  })
})
