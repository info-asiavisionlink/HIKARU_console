// ============================================================
// extractor — Charset detection tests (UTF-8 / BOM / Shift_JIS)
//
// 日本市場向け: Shift_JIS / CP932 の Excel export CSV を正しく decode する。
// 推測禁止: 判定不能な場合は silent corruption ではなく parse error として返す。
// ============================================================

import { describe, it, expect } from 'vitest'
import { encode as iconvEncode } from 'iconv-lite'
import { parseCsv, decodeCsvBuffer } from '../extractor'

describe('decodeCsvBuffer — UTF-8', () => {
  it('decodes plain UTF-8', () => {
    const buffer = Buffer.from('会社名,メール\n株式会社テスト,test@example.com', 'utf-8')
    const result = decodeCsvBuffer(buffer)
    expect(result.charset).toBe('utf-8')
    expect(result.text).toContain('会社名')
    expect(result.warning).toBeNull()
  })

  it('strips UTF-8 BOM and decodes', () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf])
    const utf8 = Buffer.from('会社名\n株式会社テスト', 'utf-8')
    const buffer = Buffer.concat([bom, utf8])
    const result = decodeCsvBuffer(buffer)
    expect(result.charset).toBe('utf-8-bom')
    expect(result.text).toContain('会社名')
    expect(result.warning).toMatch(/BOM/)
  })
})

describe('decodeCsvBuffer — Shift_JIS / CP932', () => {
  it('decodes Shift_JIS Japanese CSV', () => {
    // Excel export で頻出 (日本語 header + データ)
    const buffer = iconvEncode('会社名,電話番号\n株式会社山田,03-1234-5678', 'shift_jis')
    const result = decodeCsvBuffer(buffer)
    expect(result.charset).toBe('shift-jis')
    expect(result.text).toContain('会社名')
    expect(result.text).toContain('株式会社山田')
    expect(result.warning).toMatch(/Shift_JIS/)
  })

  it('decodes CP932 (Windows-31J alias of Shift_JIS)', () => {
    // 半角カナ含み (Windows-31J)
    const buffer = iconvEncode('氏名,ﾌﾘｶﾞﾅ\n山田太郎,ﾔﾏﾀﾞ ﾀﾛｳ', 'shift_jis')
    const result = decodeCsvBuffer(buffer)
    expect(result.charset).toBe('shift-jis')
    expect(result.text).toContain('氏名')
  })
})

describe('decodeCsvBuffer — invalid bytes', () => {
  it('throws when byte sequence is not UTF-8 nor decodable cleanly as Shift_JIS', () => {
    // Shift_JIS の trail byte 位置に invalid byte を配置 → 大量置換文字誘発
    // (0x81-0x9F, 0xE0-0xFC が lead byte; 0x40-0x7E, 0x80-0xFC が trail)
    // 単独 lead byte (0x81) を連続配置すると trail 期待で置換文字連発
    const buf = Buffer.alloc(60)
    for (let i = 0; i < 60; i++) buf[i] = i % 2 === 0 ? 0x81 : 0x00
    expect(() => decodeCsvBuffer(buf)).toThrow(/文字コードを判別できませんでした|置換文字/)
  })
})

describe('parseCsv — end-to-end charset behavior', () => {
  it('parses Shift_JIS CSV with warning', () => {
    const buffer = iconvEncode('会社名,メール\n株式会社山田,yamada@example.com', 'shift_jis')
    const result = parseCsv(buffer)
    expect(result.errors).toEqual([])
    expect(result.warnings.some(w => /Shift_JIS/.test(w))).toBe(true)
    expect(result.rows.length).toBeGreaterThan(0)
  })

  it('parses UTF-8 CSV without charset warning', () => {
    const buffer = Buffer.from('会社名,メール\n株式会社テスト,test@example.com', 'utf-8')
    const result = parseCsv(buffer)
    expect(result.errors).toEqual([])
    expect(result.warnings.some(w => /Shift_JIS/.test(w))).toBe(false)
  })

  it('parses UTF-8 BOM CSV with BOM warning', () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf])
    const utf8 = Buffer.from('会社名\n株式会社テスト', 'utf-8')
    const result = parseCsv(Buffer.concat([bom, utf8]))
    expect(result.errors).toEqual([])
    expect(result.warnings.some(w => /BOM/.test(w))).toBe(true)
  })

  it('returns parse error for undetectable encoding', () => {
    const buf = Buffer.alloc(60)
    for (let i = 0; i < 60; i++) buf[i] = i % 2 === 0 ? 0x81 : 0x00
    const result = parseCsv(buf)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.rows).toEqual([])
  })
})
