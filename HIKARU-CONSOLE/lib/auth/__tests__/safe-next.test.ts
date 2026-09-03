// ============================================================
// safeLoginNext — Open Redirect Protection Tests
//
// Login `?next=<value>` の allowlist を検証する。
// Server Action / LoginPage の両方で同じ helper を通すため、
// ここでの契約が Open Redirect 防止の唯一の砦。
// ============================================================

import { describe, it, expect } from 'vitest'
import { safeLoginNext } from '../safe-next'

describe('safeLoginNext — invalid / rejected inputs', () => {
  it('returns null for null / undefined / empty string', () => {
    expect(safeLoginNext(null)).toBeNull()
    expect(safeLoginNext(undefined)).toBeNull()
    expect(safeLoginNext('')).toBeNull()
    expect(safeLoginNext('   ')).toBeNull()
  })

  it('returns null for non-string inputs', () => {
    // @ts-expect-error — runtime protection for unexpected shapes
    expect(safeLoginNext(123)).toBeNull()
    // @ts-expect-error
    expect(safeLoginNext({ path: '/dashboard' })).toBeNull()
    // @ts-expect-error
    expect(safeLoginNext([])).toBeNull()
  })

  it('rejects external absolute URLs', () => {
    expect(safeLoginNext('https://evil.example')).toBeNull()
    expect(safeLoginNext('http://evil.example/path')).toBeNull()
    expect(safeLoginNext('javascript:alert(1)')).toBeNull()
    expect(safeLoginNext('data:text/html,<script>alert(1)</script>')).toBeNull()
  })

  it('rejects protocol-relative URLs (//evil.example)', () => {
    expect(safeLoginNext('//evil.example')).toBeNull()
    expect(safeLoginNext('//evil.example/dashboard')).toBeNull()
    expect(safeLoginNext('///triple.slash')).toBeNull()
  })

  it('rejects relative paths that do not start with /', () => {
    expect(safeLoginNext('dashboard')).toBeNull()
    expect(safeLoginNext('../etc/passwd')).toBeNull()
    expect(safeLoginNext('./relative')).toBeNull()
  })

  it('rejects auth loop paths (/login, /forgot-password, /reset-password)', () => {
    expect(safeLoginNext('/login')).toBeNull()
    expect(safeLoginNext('/login/')).toBeNull()
    expect(safeLoginNext('/login?next=/dashboard')).toBeNull()
    expect(safeLoginNext('/forgot-password')).toBeNull()
    expect(safeLoginNext('/forgot-password/step2')).toBeNull()
    expect(safeLoginNext('/reset-password')).toBeNull()
    expect(safeLoginNext('/reset-password?token=abc')).toBeNull()
  })

  it('rejects API paths', () => {
    expect(safeLoginNext('/api/setup-status')).toBeNull()
    expect(safeLoginNext('/api/import/upload')).toBeNull()
  })
})

describe('safeLoginNext — valid Console internal paths', () => {
  it('accepts common Console pages', () => {
    expect(safeLoginNext('/dashboard')).toBe('/dashboard')
    expect(safeLoginNext('/setup')).toBe('/setup')
    expect(safeLoginNext('/clients')).toBe('/clients')
    expect(safeLoginNext('/employees')).toBe('/employees')
    expect(safeLoginNext('/projects')).toBe('/projects')
    expect(safeLoginNext('/settings')).toBe('/settings')
  })

  it('accepts nested paths', () => {
    expect(safeLoginNext('/clients/abc-123')).toBe('/clients/abc-123')
    expect(safeLoginNext('/projects/xyz/edit')).toBe('/projects/xyz/edit')
    expect(safeLoginNext('/settings/import/new')).toBe('/settings/import/new')
  })

  it('accepts paths with query strings', () => {
    expect(safeLoginNext('/clients?filter=active')).toBe('/clients?filter=active')
    expect(safeLoginNext('/settings/import/new?entity_type=client&return=/setup'))
      .toBe('/settings/import/new?entity_type=client&return=/setup')
  })

  it('trims surrounding whitespace', () => {
    expect(safeLoginNext('  /dashboard  ')).toBe('/dashboard')
  })

  it('does NOT confuse /loginish with /login', () => {
    // "/loginish" is not "/login" nor "/login/xxx" nor "/login?xxx"
    expect(safeLoginNext('/loginish')).toBe('/loginish')
  })

  it('does NOT confuse /apix with /api', () => {
    expect(safeLoginNext('/apix')).toBe('/apix')
  })
})
