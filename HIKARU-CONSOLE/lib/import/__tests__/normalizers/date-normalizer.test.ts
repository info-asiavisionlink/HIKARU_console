import { describe, it, expect } from 'vitest'
import { normalizeDate } from '../../normalizers/date-normalizer'

describe('normalizeDate — supported formats', () => {
  it('ISO 8601 (canonical)', () => {
    expect(normalizeDate('2026-09-06')).toEqual({ ok: true, value: '2026-09-06' })
    expect(normalizeDate('2026-9-6')).toEqual({ ok: true, value: '2026-09-06' })
  })

  it('slash (ISO order)', () => {
    expect(normalizeDate('2026/09/06')).toEqual({ ok: true, value: '2026-09-06' })
    expect(normalizeDate('2026/9/6')).toEqual({ ok: true, value: '2026-09-06' })
    expect(normalizeDate('2026/9/6/')).toEqual({ ok: true, value: '2026-09-06' })
  })

  it('dot separator (ISO order)', () => {
    expect(normalizeDate('2026.09.06')).toEqual({ ok: true, value: '2026-09-06' })
    expect(normalizeDate('2026.9.6')).toEqual({ ok: true, value: '2026-09-06' })
  })

  it('Japanese 年月日', () => {
    expect(normalizeDate('2026年9月6日')).toEqual({ ok: true, value: '2026-09-06' })
    expect(normalizeDate('2026年09月06日')).toEqual({ ok: true, value: '2026-09-06' })
    expect(normalizeDate('2026 年 9 月 6 日')).toEqual({ ok: true, value: '2026-09-06' })
  })

  it('全角数字 (NFKC 半角化)', () => {
    expect(normalizeDate('２０２６-０９-０６')).toEqual({ ok: true, value: '2026-09-06' })
    expect(normalizeDate('２０２６年９月６日')).toEqual({ ok: true, value: '2026-09-06' })
  })

  it('date + time (time 切り捨て)', () => {
    expect(normalizeDate('2026-09-06T09:00:00')).toEqual({ ok: true, value: '2026-09-06' })
    expect(normalizeDate('2026-09-06 09:00')).toEqual({ ok: true, value: '2026-09-06' })
    expect(normalizeDate('2026/9/6 9:00')).toEqual({ ok: true, value: '2026-09-06' })
  })

  it('trim + edge dates', () => {
    expect(normalizeDate('  2026-09-06  ')).toEqual({ ok: true, value: '2026-09-06' })
    expect(normalizeDate('2026-01-01')).toEqual({ ok: true, value: '2026-01-01' })
    expect(normalizeDate('2026-12-31')).toEqual({ ok: true, value: '2026-12-31' })
    // leap year
    expect(normalizeDate('2024-02-29')).toEqual({ ok: true, value: '2024-02-29' })
  })
})

describe('normalizeDate — reject', () => {
  it('invalid calendar dates', () => {
    expect(normalizeDate('2026-02-30')).toEqual({ ok: false, reason: 'invalid_date' })
    expect(normalizeDate('2026-13-01')).toEqual({ ok: false, reason: 'invalid_date' })
    expect(normalizeDate('2026-00-15')).toEqual({ ok: false, reason: 'invalid_date' })
    expect(normalizeDate('2026-11-31')).toEqual({ ok: false, reason: 'invalid_date' })
    expect(normalizeDate('2025-02-29')).toEqual({ ok: false, reason: 'invalid_date' })  // non-leap
  })

  it('ambiguous MM/DD/YYYY or DD/MM/YYYY (先頭 4 桁が year でない)', () => {
    expect(normalizeDate('09/06/2026')).toEqual({ ok: false, reason: 'ambiguous_date' })
    expect(normalizeDate('06/09/2026')).toEqual({ ok: false, reason: 'ambiguous_date' })
    expect(normalizeDate('9/6/2026')).toEqual({ ok: false, reason: 'ambiguous_date' })
    expect(normalizeDate('06-09-2026')).toEqual({ ok: false, reason: 'ambiguous_date' })
    expect(normalizeDate('06.09.2026')).toEqual({ ok: false, reason: 'ambiguous_date' })
  })

  it('year out of range', () => {
    expect(normalizeDate('1899-01-01')).toEqual({ ok: false, reason: 'invalid_date' })
    expect(normalizeDate('3000-01-01')).toEqual({ ok: false, reason: 'invalid_date' })
  })

  it('empty / null / undefined', () => {
    expect(normalizeDate('')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeDate('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeDate(null)).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeDate(undefined)).toEqual({ ok: false, reason: 'empty' })
  })

  it('non-string types', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeDate(20260906 as any)).toEqual({ ok: false, reason: 'empty' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeDate({} as any)).toEqual({ ok: false, reason: 'empty' })
  })

  it('garbage', () => {
    expect(normalizeDate('abc')).toEqual({ ok: false, reason: 'invalid_date' })
    expect(normalizeDate('2026-09')).toEqual({ ok: false, reason: 'invalid_date' })
    expect(normalizeDate('2026')).toEqual({ ok: false, reason: 'invalid_date' })
    expect(normalizeDate('Sep 6, 2026')).toEqual({ ok: false, reason: 'invalid_date' })
  })
})
