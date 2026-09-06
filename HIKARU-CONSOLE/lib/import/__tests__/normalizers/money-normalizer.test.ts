import { describe, it, expect } from 'vitest'
import { normalizeMoney } from '../../normalizers/money-normalizer'

describe('normalizeMoney — supported', () => {
  it('plain integer', () => {
    expect(normalizeMoney('906')).toEqual({ ok: true, value: '906' })
    expect(normalizeMoney('0')).toEqual({ ok: true, value: '0' })
    expect(normalizeMoney('1000000')).toEqual({ ok: true, value: '1000000' })
  })

  it('currency symbols (¥ / ￥ / 円)', () => {
    expect(normalizeMoney('¥906')).toEqual({ ok: true, value: '906' })
    expect(normalizeMoney('￥906')).toEqual({ ok: true, value: '906' })  // NFKC で ¥ 化
    expect(normalizeMoney('906円')).toEqual({ ok: true, value: '906' })
    expect(normalizeMoney('¥ 906')).toEqual({ ok: true, value: '906' })
    expect(normalizeMoney('￥1,200円')).toEqual({ ok: true, value: '1200' })
  })

  it('thousand separator', () => {
    expect(normalizeMoney('1,200')).toEqual({ ok: true, value: '1200' })
    expect(normalizeMoney('¥1,200')).toEqual({ ok: true, value: '1200' })
    expect(normalizeMoney('1,000,000')).toEqual({ ok: true, value: '1000000' })
  })

  it('全角数字 (NFKC)', () => {
    expect(normalizeMoney('９０６')).toEqual({ ok: true, value: '906' })
    expect(normalizeMoney('￥９０６円')).toEqual({ ok: true, value: '906' })
  })

  it('negative integer', () => {
    expect(normalizeMoney('-100')).toEqual({ ok: true, value: '-100' })
    expect(normalizeMoney('-1,000')).toEqual({ ok: true, value: '-1000' })
  })

  it('native number (XLSX cell)', () => {
    expect(normalizeMoney(906)).toEqual({ ok: true, value: '906' })
    expect(normalizeMoney(0)).toEqual({ ok: true, value: '0' })
    expect(normalizeMoney(-100)).toEqual({ ok: true, value: '-100' })
  })

  it('trim', () => {
    expect(normalizeMoney('  906  ')).toEqual({ ok: true, value: '906' })
    expect(normalizeMoney('　906　')).toEqual({ ok: true, value: '906' })
  })
})

describe('normalizeMoney — reject non-integer', () => {
  it('decimals rejected (Phase U1 では丸めない)', () => {
    expect(normalizeMoney('1.5')).toEqual({ ok: false, reason: 'non_integer' })
    expect(normalizeMoney('1,200.50')).toEqual({ ok: false, reason: 'non_integer' })
    expect(normalizeMoney('¥1,200.50')).toEqual({ ok: false, reason: 'non_integer' })
    expect(normalizeMoney(1.5)).toEqual({ ok: false, reason: 'non_integer' })
  })
})

describe('normalizeMoney — reject invalid', () => {
  it('scientific notation', () => {
    expect(normalizeMoney('9.99e10')).toEqual({ ok: false, reason: 'invalid_number' })
    expect(normalizeMoney('1e5')).toEqual({ ok: false, reason: 'invalid_number' })
  })

  it('non-numeric', () => {
    expect(normalizeMoney('abc')).toEqual({ ok: false, reason: 'invalid_number' })
    expect(normalizeMoney('906abc')).toEqual({ ok: false, reason: 'invalid_number' })
    expect(normalizeMoney('abc906')).toEqual({ ok: false, reason: 'invalid_number' })
  })

  it('non-finite number', () => {
    expect(normalizeMoney(NaN)).toEqual({ ok: false, reason: 'invalid_number' })
    expect(normalizeMoney(Infinity)).toEqual({ ok: false, reason: 'invalid_number' })
    expect(normalizeMoney(-Infinity)).toEqual({ ok: false, reason: 'invalid_number' })
  })

  it('empty', () => {
    expect(normalizeMoney('')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeMoney('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeMoney(null)).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeMoney(undefined)).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeMoney('¥')).toEqual({ ok: false, reason: 'empty' })     // 通貨記号のみ
    expect(normalizeMoney('円')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeMoney(',')).toEqual({ ok: false, reason: 'empty' })
  })
})
