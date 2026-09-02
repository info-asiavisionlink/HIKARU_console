// ============================================================
// Safe Redirect Helper — Unit Tests (P4)
//
// Open Redirect 攻撃対策の pure function 検証。
// getSafeAuthRedirect(input) は常に internal allowlist path を返す。
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  getSafeAuthRedirect,
  AUTH_REDIRECT_ALLOWLIST,
  AUTH_REDIRECT_DEFAULT,
} from '../safe-redirect'

// ============================================================
// Default fallback
// ============================================================

describe('getSafeAuthRedirect — fallback default', () => {
  it('AUTH_REDIRECT_DEFAULT is /dashboard', () => {
    expect(AUTH_REDIRECT_DEFAULT).toBe('/dashboard')
  })

  it('returns default for null', () => {
    expect(getSafeAuthRedirect(null)).toBe('/dashboard')
  })

  it('returns default for undefined', () => {
    expect(getSafeAuthRedirect(undefined)).toBe('/dashboard')
  })

  it('returns default for empty string', () => {
    expect(getSafeAuthRedirect('')).toBe('/dashboard')
  })

  it('returns default for whitespace only', () => {
    expect(getSafeAuthRedirect('   ')).toBe('/dashboard')
  })

  it('returns default for non-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getSafeAuthRedirect(123 as any)).toBe('/dashboard')
  })
})

// ============================================================
// Allowlist paths — accepted
// ============================================================

describe('getSafeAuthRedirect — allowlist paths accepted', () => {
  it('allows exact /set-password', () => {
    expect(getSafeAuthRedirect('/set-password')).toBe('/set-password')
  })

  it('allows exact /setup', () => {
    expect(getSafeAuthRedirect('/setup')).toBe('/setup')
  })

  it('allows exact /dashboard', () => {
    expect(getSafeAuthRedirect('/dashboard')).toBe('/dashboard')
  })

  it('allows /setup with query string', () => {
    expect(getSafeAuthRedirect('/setup?entity_type=client')).toBe('/setup?entity_type=client')
  })

  it('allows /dashboard with fragment', () => {
    expect(getSafeAuthRedirect('/dashboard#section')).toBe('/dashboard#section')
  })

  it('allows sub-path of allowlist (/setup/details)', () => {
    // '/setup' prefix + '/'
    expect(getSafeAuthRedirect('/setup/details')).toBe('/setup/details')
  })

  it('AUTH_REDIRECT_ALLOWLIST contains expected paths', () => {
    expect(AUTH_REDIRECT_ALLOWLIST).toContain('/set-password')
    expect(AUTH_REDIRECT_ALLOWLIST).toContain('/setup')
    expect(AUTH_REDIRECT_ALLOWLIST).toContain('/dashboard')
  })
})

// ============================================================
// Non-allowlist internal paths → default fallback
// ============================================================

describe('getSafeAuthRedirect — non-allowlist internal paths', () => {
  it('rejects /login (not in allowlist)', () => {
    expect(getSafeAuthRedirect('/login')).toBe('/dashboard')
  })

  it('rejects /admin (not in allowlist)', () => {
    expect(getSafeAuthRedirect('/admin')).toBe('/dashboard')
  })

  it('rejects /clients (not in allowlist)', () => {
    expect(getSafeAuthRedirect('/clients')).toBe('/dashboard')
  })

  it('rejects /settings (not in allowlist — even though it exists)', () => {
    expect(getSafeAuthRedirect('/settings')).toBe('/dashboard')
  })

  it('does NOT accidentally match /setup-fake (prefix match must be exact + /)', () => {
    expect(getSafeAuthRedirect('/setup-fake')).toBe('/dashboard')
  })

  it('does NOT accidentally match /dashboards (prefix match strict)', () => {
    expect(getSafeAuthRedirect('/dashboards')).toBe('/dashboard')
  })
})

// ============================================================
// External / protocol URLs — reject
// ============================================================

describe('getSafeAuthRedirect — external URLs rejected', () => {
  it('rejects https://evil.com', () => {
    expect(getSafeAuthRedirect('https://evil.com')).toBe('/dashboard')
  })

  it('rejects http://evil.com', () => {
    expect(getSafeAuthRedirect('http://evil.com')).toBe('/dashboard')
  })

  it('rejects //evil.com (protocol-relative)', () => {
    expect(getSafeAuthRedirect('//evil.com')).toBe('/dashboard')
  })

  it('rejects //evil.com/dashboard', () => {
    expect(getSafeAuthRedirect('//evil.com/dashboard')).toBe('/dashboard')
  })

  it('rejects /\\evil.com (backslash protocol-relative variant)', () => {
    expect(getSafeAuthRedirect('/\\evil.com')).toBe('/dashboard')
  })

  it('rejects javascript: scheme', () => {
    expect(getSafeAuthRedirect('javascript:alert(1)')).toBe('/dashboard')
  })

  it('rejects data: scheme', () => {
    expect(getSafeAuthRedirect('data:text/html,evil')).toBe('/dashboard')
  })

  it('rejects vbscript: scheme', () => {
    expect(getSafeAuthRedirect('vbscript:alert(1)')).toBe('/dashboard')
  })

  it('rejects mailto: scheme', () => {
    expect(getSafeAuthRedirect('mailto:x@y.com')).toBe('/dashboard')
  })
})

// ============================================================
// Path traversal / backslash / control characters — reject
// ============================================================

describe('getSafeAuthRedirect — traversal / control chars', () => {
  it('rejects ../admin', () => {
    expect(getSafeAuthRedirect('../admin')).toBe('/dashboard')
  })

  it('rejects /..', () => {
    expect(getSafeAuthRedirect('/..')).toBe('/dashboard')
  })

  it('rejects /setup/../admin', () => {
    expect(getSafeAuthRedirect('/setup/../admin')).toBe('/dashboard')
  })

  it('rejects paths with backslash', () => {
    expect(getSafeAuthRedirect('/setup\\admin')).toBe('/dashboard')
  })

  it('rejects null byte', () => {
    expect(getSafeAuthRedirect('/setup\x00.txt')).toBe('/dashboard')
  })

  it('rejects newline', () => {
    expect(getSafeAuthRedirect('/setup\nevil')).toBe('/dashboard')
  })

  it('rejects tab', () => {
    expect(getSafeAuthRedirect('/setup\tevil')).toBe('/dashboard')
  })
})

// ============================================================
// Contract invariants
// ============================================================

describe('getSafeAuthRedirect — invariants', () => {
  it('always returns a value starting with /', () => {
    const inputs = [null, '', '/setup', 'evil.com', 'https://x.com', '//y.com', '/../a']
    for (const i of inputs) {
      const out = getSafeAuthRedirect(i as string | null)
      expect(out.startsWith('/')).toBe(true)
    }
  })

  it('never returns a URL with scheme', () => {
    const inputs = ['https://x.com', 'http://x.com', 'javascript:1']
    for (const i of inputs) {
      expect(getSafeAuthRedirect(i)).not.toMatch(/^[a-z]+:/i)
    }
  })

  it('output is always one of AUTH_REDIRECT_ALLOWLIST prefixes or DEFAULT', () => {
    const inputs = ['/set-password', '/setup?x=1', '/dashboard#a', '/admin', 'evil.com']
    for (const i of inputs) {
      const out = getSafeAuthRedirect(i)
      const isAllowed = AUTH_REDIRECT_ALLOWLIST.some(p => out === p || out.startsWith(p + '/') || out.startsWith(p + '?') || out.startsWith(p + '#'))
      const isDefault = out === AUTH_REDIRECT_DEFAULT
      expect(isAllowed || isDefault).toBe(true)
    }
  })
})
