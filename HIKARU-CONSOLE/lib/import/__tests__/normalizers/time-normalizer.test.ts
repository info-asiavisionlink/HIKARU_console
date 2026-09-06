import { describe, it, expect } from 'vitest'
import { normalizeTime } from '../../normalizers/time-normalizer'

describe('normalizeTime — supported formats', () => {
  it('HH:MM:SS (canonical)', () => {
    expect(normalizeTime('09:00:00')).toEqual({ ok: true, value: '09:00:00' })
    expect(normalizeTime('9:0:0')).toEqual({ ok: true, value: '09:00:00' })
    expect(normalizeTime('23:59:59')).toEqual({ ok: true, value: '23:59:59' })
  })

  it('HH:MM (seconds default 0)', () => {
    expect(normalizeTime('09:00')).toEqual({ ok: true, value: '09:00:00' })
    expect(normalizeTime('9:00')).toEqual({ ok: true, value: '09:00:00' })
    expect(normalizeTime('9:30')).toEqual({ ok: true, value: '09:30:00' })
    expect(normalizeTime('00:00')).toEqual({ ok: true, value: '00:00:00' })
  })

  it('Japanese H時M分', () => {
    expect(normalizeTime('9時30分')).toEqual({ ok: true, value: '09:30:00' })
    expect(normalizeTime('09時30分')).toEqual({ ok: true, value: '09:30:00' })
    expect(normalizeTime('23時59分')).toEqual({ ok: true, value: '23:59:00' })
    expect(normalizeTime('9 時 30 分')).toEqual({ ok: true, value: '09:30:00' })
  })

  it('Japanese H時 only (分 default 0)', () => {
    expect(normalizeTime('9時')).toEqual({ ok: true, value: '09:00:00' })
    expect(normalizeTime('9 時')).toEqual({ ok: true, value: '09:00:00' })
  })

  it('全角数字 (NFKC)', () => {
    expect(normalizeTime('０９:００')).toEqual({ ok: true, value: '09:00:00' })
    expect(normalizeTime('９時３０分')).toEqual({ ok: true, value: '09:30:00' })
  })

  it('trim', () => {
    expect(normalizeTime('  09:00  ')).toEqual({ ok: true, value: '09:00:00' })
    expect(normalizeTime('　09:00　')).toEqual({ ok: true, value: '09:00:00' })
  })
})

describe('normalizeTime — reject', () => {
  it('out of range hour', () => {
    expect(normalizeTime('25:00')).toEqual({ ok: false, reason: 'invalid_time' })
    expect(normalizeTime('24:00')).toEqual({ ok: false, reason: 'invalid_time' })
  })

  it('out of range minute', () => {
    expect(normalizeTime('12:99')).toEqual({ ok: false, reason: 'invalid_time' })
    expect(normalizeTime('12:60')).toEqual({ ok: false, reason: 'invalid_time' })
    expect(normalizeTime('9時99分')).toEqual({ ok: false, reason: 'invalid_time' })
  })

  it('out of range second', () => {
    expect(normalizeTime('12:00:60')).toEqual({ ok: false, reason: 'invalid_time' })
    expect(normalizeTime('12:00:99')).toEqual({ ok: false, reason: 'invalid_time' })
  })

  it('empty / null / undefined', () => {
    expect(normalizeTime('')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeTime('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeTime(null)).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeTime(undefined)).toEqual({ ok: false, reason: 'empty' })
  })

  it('unsupported format (Phase U1 では英字 AM/PM 未対応)', () => {
    expect(normalizeTime('9:00 AM')).toEqual({ ok: false, reason: 'invalid_time' })
    expect(normalizeTime('9 AM')).toEqual({ ok: false, reason: 'invalid_time' })
    expect(normalizeTime('午前9時')).toEqual({ ok: false, reason: 'invalid_time' })
  })

  it('garbage', () => {
    expect(normalizeTime('abc')).toEqual({ ok: false, reason: 'invalid_time' })
    expect(normalizeTime('9')).toEqual({ ok: false, reason: 'invalid_time' })
  })
})
