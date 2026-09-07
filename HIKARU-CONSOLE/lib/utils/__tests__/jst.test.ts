// ============================================================
// JST-safe date helper tests
//
// Bug: `new Date().toISOString().split('T')[0]` returns UTC date.
// JST 00:00〜08:59 → UTC 15:00〜23:59 前日 → 日付が 1 日ズレる。
//
// 検証: todayJST() が JST 深夜帯でも当日の YYYY-MM-DD を返す。
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { todayJST, toJSTDateString } from '../jst'

describe('todayJST', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(()  => { vi.useRealTimers() })

  it('YYYY-MM-DD の形式で返す', () => {
    vi.setSystemTime(new Date('2026-09-07T12:00:00Z'))
    const s = todayJST()
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('JST 00:30 (UTC 15:30 前日) でも JST 当日を返す', () => {
    // JST 2026-09-08 00:30 = UTC 2026-09-07 15:30
    vi.setSystemTime(new Date('2026-09-07T15:30:00Z'))
    expect(todayJST()).toBe('2026-09-08')
  })

  it('JST 08:59 (UTC 23:59 前日) でも JST 当日を返す', () => {
    // JST 2026-09-08 08:59 = UTC 2026-09-07 23:59
    vi.setSystemTime(new Date('2026-09-07T23:59:00Z'))
    expect(todayJST()).toBe('2026-09-08')
  })

  it('JST 09:00 (UTC 00:00 当日) で JST 当日を返す', () => {
    // JST 2026-09-08 09:00 = UTC 2026-09-08 00:00
    vi.setSystemTime(new Date('2026-09-08T00:00:00Z'))
    expect(todayJST()).toBe('2026-09-08')
  })

  it('JST 23:59 でも JST 当日を返す (境界)', () => {
    // JST 2026-09-08 23:59 = UTC 2026-09-08 14:59
    vi.setSystemTime(new Date('2026-09-08T14:59:00Z'))
    expect(todayJST()).toBe('2026-09-08')
  })

  it('toISOString().split() の bug と対比: 素の pattern は UTC 日付を返す', () => {
    // JST 00:30 に naive pattern を使うと前日 09-07 が返ってしまう (回帰 guard)
    vi.setSystemTime(new Date('2026-09-07T15:30:00Z'))
    const naive = new Date().toISOString().split('T')[0]
    expect(naive).toBe('2026-09-07')       // ← Bug (UTC)
    expect(todayJST()).toBe('2026-09-08')  // ← Fix (JST)
    expect(naive).not.toBe(todayJST())
  })
})

describe('toJSTDateString', () => {
  it('任意の Date を JST YYYY-MM-DD に変換する', () => {
    expect(toJSTDateString(new Date('2026-09-07T15:30:00Z'))).toBe('2026-09-08')
    expect(toJSTDateString(new Date('2026-09-07T00:00:00Z'))).toBe('2026-09-07')
    expect(toJSTDateString(new Date('2026-01-01T14:59:59Z'))).toBe('2026-01-01')
  })
})

// ─── Invoice page wiring (regression guard) ────────────────

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('invoice pages use todayJST() instead of naive toISOString().split()', () => {
  const INVOICE_NEW  = resolve(__dirname, '../../../app/(console)/invoices/new/page.tsx')
  const INVOICE_EDIT = resolve(__dirname, '../../../app/(console)/invoices/[id]/page.tsx')

  it('invoices/new/page.tsx が todayJST を使い naive pattern を持たない', () => {
    const src = readFileSync(INVOICE_NEW, 'utf8')
    expect(src).toContain("from '@/lib/utils/jst'")
    expect(src).toContain('todayJST()')
    expect(src).not.toMatch(/new Date\(\)\.toISOString\(\)\.split/)
  })

  it('invoices/[id]/page.tsx が todayJST を使い naive pattern を持たない', () => {
    const src = readFileSync(INVOICE_EDIT, 'utf8')
    expect(src).toContain("from '@/lib/utils/jst'")
    expect(src).toContain('todayJST()')
    expect(src).not.toMatch(/new Date\(\)\.toISOString\(\)\.split/)
  })
})
