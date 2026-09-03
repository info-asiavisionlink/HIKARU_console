// ============================================================
// safeSetupReturn — Setup Round-Trip Allowlist Tests
//
// Setup Center から /clients/new などへ `?return=/setup` を渡し、
// 保存完了後に /setup へ戻す仕組みの唯一の安全境界。
// STEP A で導入。Open Redirect 対策として allowlist のみ許可する契約を検証する。
// ============================================================

import { describe, it, expect } from 'vitest'
import { safeSetupReturn } from '../return-to'

describe('safeSetupReturn — allowlist accept', () => {
  it('accepts /setup', () => {
    expect(safeSetupReturn('/setup')).toBe('/setup')
  })
})

describe('safeSetupReturn — reject invalid / external', () => {
  it('returns null for null / undefined / empty string', () => {
    expect(safeSetupReturn(null)).toBeNull()
    expect(safeSetupReturn(undefined)).toBeNull()
    expect(safeSetupReturn('')).toBeNull()
  })

  it('returns null for non-string inputs', () => {
    // @ts-expect-error — runtime protection for unexpected shapes
    expect(safeSetupReturn(123)).toBeNull()
    // @ts-expect-error
    expect(safeSetupReturn({ path: '/setup' })).toBeNull()
  })

  it('rejects external absolute URLs', () => {
    expect(safeSetupReturn('https://evil.example')).toBeNull()
    expect(safeSetupReturn('http://evil.example/setup')).toBeNull()
    expect(safeSetupReturn('javascript:alert(1)')).toBeNull()
  })

  it('rejects protocol-relative URLs', () => {
    expect(safeSetupReturn('//evil.example')).toBeNull()
    expect(safeSetupReturn('//evil.example/setup')).toBeNull()
  })

  it('rejects non-allowlisted internal paths', () => {
    // /setup 以外は現在すべて拒否 (allowlist に追加されるまで)
    expect(safeSetupReturn('/dashboard')).toBeNull()
    expect(safeSetupReturn('/clients')).toBeNull()
    expect(safeSetupReturn('/settings')).toBeNull()
    expect(safeSetupReturn('/setup/child')).toBeNull()
    expect(safeSetupReturn('/setup?q=1')).toBeNull()
  })

  it('rejects case variants', () => {
    // allowlist は case-sensitive
    expect(safeSetupReturn('/Setup')).toBeNull()
    expect(safeSetupReturn('/SETUP')).toBeNull()
  })
})
