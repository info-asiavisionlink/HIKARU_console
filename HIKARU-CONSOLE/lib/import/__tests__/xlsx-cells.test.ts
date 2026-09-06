// ============================================================
// xlsx-cells.ts unit tests (Phase U4)
//
// - formatExcelDate: UTC-safe な YYYY-MM-DD / ISO datetime 化
// - cellToString: Date / number / boolean / null / string の canonical 化
// ============================================================

import { describe, it, expect } from 'vitest'
import { formatExcelDate, cellToString } from '../xlsx-cells'

describe('formatExcelDate', () => {
  it('date-only (UTC 00:00:00) → YYYY-MM-DD', () => {
    const d = new Date(Date.UTC(2026, 8, 6, 0, 0, 0))
    expect(formatExcelDate(d)).toBe('2026-09-06')
  })
  it('datetime with time → YYYY-MM-DDTHH:MM:SS (秒まで)', () => {
    const d = new Date(Date.UTC(2026, 8, 6, 9, 30, 45))
    expect(formatExcelDate(d)).toBe('2026-09-06T09:30:45')
  })
  it('UTC 成分を timezone shift しない (Date object の UTC 成分のみ使う)', () => {
    // 開発者環境 tz が JST でも UTC 深夜として作成された Date は "2026-09-06" になる
    const d = new Date(Date.UTC(2026, 8, 6, 0, 0, 0))
    expect(formatExcelDate(d)).toBe('2026-09-06')
  })
  it('invalid Date → 空文字', () => {
    expect(formatExcelDate(new Date(NaN))).toBe('')
  })
  it('4桁 year zero-pad は 4 桁', () => {
    const d = new Date(Date.UTC(999, 0, 1, 0, 0, 0))
    expect(formatExcelDate(d)).toBe('0999-01-01')
  })
})

describe('cellToString — native cell types', () => {
  it('null / undefined → 空文字', () => {
    expect(cellToString(null)).toBe('')
    expect(cellToString(undefined)).toBe('')
  })
  it('string passthrough', () => {
    expect(cellToString('hello')).toBe('hello')
    expect(cellToString('')).toBe('')
    expect(cellToString('  spaces  ')).toBe('  spaces  ')  // extractor 側で trim
  })
  it('Date object → ISO 化 (formatExcelDate 経由)', () => {
    const d = new Date(Date.UTC(2026, 8, 6))
    expect(cellToString(d)).toBe('2026-09-06')
    const dt = new Date(Date.UTC(2026, 8, 6, 9, 30, 0))
    expect(cellToString(dt)).toBe('2026-09-06T09:30:00')
  })
  it('integer number → digit string', () => {
    expect(cellToString(1280)).toBe('1280')
    expect(cellToString(0)).toBe('0')
    expect(cellToString(-100)).toBe('-100')
  })
  it('float number → precision 保持 (Excel からの丸め済想定)', () => {
    expect(cellToString(1.5)).toBe('1.5')
    expect(cellToString(0.1)).toBe('0.1')
  })
  it('NaN / Infinity → 空文字 (defensive)', () => {
    expect(cellToString(NaN)).toBe('')
    expect(cellToString(Infinity)).toBe('')
    expect(cellToString(-Infinity)).toBe('')
  })
  it('boolean → "true" / "false"', () => {
    expect(cellToString(true)).toBe('true')
    expect(cellToString(false)).toBe('false')
  })
  it('その他 object → String()', () => {
    // sheet_to_json では通常来ないが defensive
    expect(cellToString({ toString: () => 'obj' })).toBe('obj')
  })
})
