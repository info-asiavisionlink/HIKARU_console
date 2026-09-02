// ============================================================
// Set-Password Server Action — Contract Tests (P5)
//
// 実 Server Action は Supabase / cookies / redirect 依存で
// unit test には重すぎる (P3/P4と同様のsource-static patternで契約保証)。
//
// 保証内容:
//   - Password validation: min 8 chars + confirmation match
//   - Session/Profile authority を server-side で必ず再確認
//   - Password を DB / cookie / audit / log / URL に出さない
//   - Query / user_metadata を authority に使わない
//   - Fail-closed: signOut + clearConsoleSessionCookies + /login redirect
//   - Success redirect は /setup (dashboard ではない)
//   - Existing reset-password / login flow を壊さない
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ACTIONS_PATH = resolve(__dirname, '../../../app/(auth)/set-password/actions.ts')
const PAGE_PATH    = resolve(__dirname, '../../../app/(auth)/set-password/page.tsx')
const LOGIN_ACTIONS_PATH = resolve(__dirname, '../../../app/(auth)/login/actions.ts')

const actionsSource = readFileSync(ACTIONS_PATH, 'utf8')
const pageSource    = readFileSync(PAGE_PATH,    'utf8')
const loginSource   = readFileSync(LOGIN_ACTIONS_PATH, 'utf8')

// Comment-stripped code slice (for property-access assertions)
const actionsCodeOnly = actionsSource
  .split('\n')
  .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
  .join('\n')

// ============================================================
// Password Validation (CASE G/H/I)
// ============================================================

describe('set-password action — password validation', () => {
  it('enforces minimum length constant (matches existing reset-password: 8)', () => {
    expect(actionsSource).toMatch(/MIN_PASSWORD_LENGTH\s*=\s*8/)
  })

  it('validates password.length < MIN_PASSWORD_LENGTH', () => {
    expect(actionsSource).toMatch(/password\.length\s*<\s*MIN_PASSWORD_LENGTH/)
  })

  it('rejects when password is missing or empty', () => {
    expect(actionsSource).toMatch(/!password/)
  })

  it('checks password !== confirmPassword', () => {
    expect(actionsSource).toMatch(/password\s*!==\s*confirmPassword/)
  })

  it('returns Japanese error for length violation', () => {
    expect(actionsSource).toContain('パスワードは')
    expect(actionsSource).toContain('文字以上')
  })

  it('returns Japanese error for confirmation mismatch', () => {
    expect(actionsSource).toContain('パスワードが一致しません')
  })
})

// ============================================================
// Authentication / Authority (CASE A-F, O, P)
// ============================================================

describe('set-password action — authority', () => {
  it('gets authenticated user from supabase.auth.getUser (not from client)', () => {
    expect(actionsSource).toMatch(/supabase\.auth\.getUser\(\)/)
  })

  it('queries profiles table with authenticated user.id', () => {
    expect(actionsSource).toMatch(/from\(\s*['"]profiles['"]\s*\)/)
    expect(actionsSource).toMatch(/\.eq\(\s*['"]id['"]\s*,\s*authUserId/)
  })

  it('enforces role === "admin" server-side', () => {
    expect(actionsSource).toMatch(/role\s*!==\s*['"]admin['"]/)
  })

  it('rejects NULL company_id', () => {
    expect(actionsSource).toMatch(/!\s*p\.company_id|!\s*profile\.company_id/)
  })

  it('does NOT read role/user_id/company_id from FormData (authority separation)', () => {
    expect(actionsSource).not.toMatch(/formData\.get\(\s*['"]role['"]/)
    expect(actionsSource).not.toMatch(/formData\.get\(\s*['"]user_id['"]/)
    expect(actionsSource).not.toMatch(/formData\.get\(\s*['"]company_id['"]/)
  })

  it('does NOT read user_metadata as authority (comments excluded)', () => {
    expect(actionsCodeOnly).not.toMatch(/\.user_metadata\b/)
    expect(actionsCodeOnly).not.toMatch(/\.raw_user_meta_data\b/)
    expect(actionsCodeOnly).not.toMatch(/{\s*[^}]*\buser_metadata\b/)
  })

  it('only reads password + confirmPassword from FormData', () => {
    const formGets = actionsSource.match(/formData\.get\(\s*['"][^'"]+['"]/g) ?? []
    for (const g of formGets) {
      expect(g).toMatch(/['"]password['"]|['"]confirmPassword['"]/)
    }
  })
})

// ============================================================
// Password Security (CASE L/M/N)
// ============================================================

describe('set-password action — password never leaks', () => {
  it('does NOT log password to console', () => {
    expect(actionsSource).not.toMatch(/console\.[a-z]+\([^)]*password/i)
  })

  it('does NOT write password to platform_audit_logs (comments excluded)', () => {
    // comment内は「書かない」ドキュメントとして許可、実コードで参照しないことを確認
    expect(actionsCodeOnly).not.toMatch(/platform_audit_logs/)
    expect(actionsCodeOnly).not.toMatch(/writePlatformAudit/)
  })

  it('does NOT set any cookie with password value', () => {
    expect(actionsSource).not.toMatch(/cookie[Ss]tore\.set\([^)]*password/)
  })

  it('does NOT INSERT/UPDATE profiles with password field', () => {
    expect(actionsSource).not.toMatch(/\.insert\(\s*{[^}]*password/)
    expect(actionsSource).not.toMatch(/\.update\(\s*{[^}]*password[^}]*}[\s\S]*from\(\s*['"]profiles['"]/)
  })

  it('never puts password in URL parameters or error string', () => {
    expect(actionsSource).not.toMatch(/searchParams\.set\(\s*['"][^'"]*password[^'"]*['"]/)
    expect(actionsSource).not.toMatch(/error:\s*[`'"][^`'"]*\$\{password/)
  })

  it('uses supabase.auth.updateUser as sole password update path', () => {
    expect(actionsSource).toMatch(/supabase\.auth\.updateUser\(\s*{\s*password\s*}\)/)
  })
})

// ============================================================
// Fail-closed Behavior (CASE A-F)
// ============================================================

describe('set-password action — fail-closed', () => {
  it('has failClosed helper', () => {
    expect(actionsSource).toMatch(/failClosed/)
  })

  it('failClosed signs out (best-effort)', () => {
    expect(actionsSource).toMatch(/supabase\.auth\.signOut\(\)/)
  })

  it('failClosed clears console session cookies', () => {
    expect(actionsSource).toMatch(/clearConsoleSessionCookies/)
  })

  it('failClosed redirects to /login (error code only, not password)', () => {
    expect(actionsSource).toMatch(/redirect\(\s*[`'"]?\/login/)
    expect(actionsSource).toMatch(/error=/)
    // ensure no password in redirect URL
    expect(actionsSource).not.toMatch(/redirect\([^)]*password/)
  })

  it('has fail paths for no_session / profile_denied / internal_error', () => {
    expect(actionsSource).toMatch(/'no_session'/)
    expect(actionsSource).toMatch(/'profile_denied'/)
    expect(actionsSource).toMatch(/'internal_error'/)
  })

  it('validation errors return same-page state (not fail-closed)', () => {
    // return { error: '...' } is present (in-page validation)
    expect(actionsSource).toMatch(/return\s*{\s*error:\s*['"`]/)
  })
})

// ============================================================
// Success Redirect (CASE K)
// ============================================================

describe('set-password action — success redirect', () => {
  it('redirects to /setup on success (not /dashboard)', () => {
    expect(actionsSource).toMatch(/redirect\(\s*['"]\/setup['"]\s*\)/)
  })

  it('does NOT redirect to /dashboard on success', () => {
    // fail path may redirect to /login, but success must go to /setup
    // (login/actions resetPasswordAction goes to /dashboard, but set-password differs)
    const successRedirects = actionsSource.match(/redirect\(\s*['"]\/dashboard['"]/g) ?? []
    expect(successRedirects).toHaveLength(0)
  })
})

// ============================================================
// Page contract
// ============================================================

describe('set-password page — UI contract', () => {
  it('uses "use client"', () => {
    expect(pageSource).toMatch(/^['"]use client['"]/m)
  })

  it('has form fields named password and confirmPassword', () => {
    expect(pageSource).toMatch(/name=['"]password['"]/)
    expect(pageSource).toMatch(/name=['"]confirmPassword['"]/)
  })

  it('does NOT expose role / user_id / company_id fields', () => {
    expect(pageSource).not.toMatch(/name=['"]role['"]/)
    expect(pageSource).not.toMatch(/name=['"]user_id['"]/)
    expect(pageSource).not.toMatch(/name=['"]company_id['"]/)
    expect(pageSource).not.toMatch(/name=['"]email['"]/)
  })

  it('uses type=password (with optional show/hide toggle)', () => {
    // Input either type="password" or type={showPw ? 'text' : 'password'}
    expect(pageSource).toMatch(/type=(['"]password['"]|{show[A-Za-z]+\s*\?\s*['"]text['"]\s*:\s*['"]password['"]})/)
  })

  it('imports setPasswordAction', () => {
    expect(pageSource).toMatch(/setPasswordAction/)
  })

  it('uses autoComplete="new-password" for browser hint', () => {
    expect(pageSource).toMatch(/autoComplete=['"]new-password['"]/)
  })
})

// ============================================================
// Non-regression on existing password flows (CASE Q)
// ============================================================

describe('existing login/reset-password flows — unchanged by P5', () => {
  it('existing resetPasswordAction still uses supabase.auth.updateUser', () => {
    expect(loginSource).toMatch(/supabase\.auth\.updateUser\(\s*{\s*password\s*}\)/)
  })

  it('existing forgotPasswordAction still uses resetPasswordForEmail', () => {
    expect(loginSource).toMatch(/resetPasswordForEmail/)
  })

  it('existing loginAction still uses signInWithPassword', () => {
    expect(loginSource).toMatch(/signInWithPassword/)
  })

  it('existing resetPasswordAction still redirects to /dashboard', () => {
    // set-password は /setup、既存 reset は /dashboard を維持
    expect(loginSource).toMatch(/redirect\(\s*['"]\/dashboard['"]/)
  })

  it('existing password policy (8 chars) is preserved', () => {
    expect(loginSource).toMatch(/password\.length\s*<\s*8/)
  })
})

// ============================================================
// P4 callback -> /set-password redirect (CASE R)
// ============================================================

describe('P4 callback → /set-password redirect chain', () => {
  it('/set-password is in P4 safe-redirect allowlist', () => {
    const safeRedirectPath = resolve(__dirname, '../safe-redirect.ts')
    const safeRedirectSource = readFileSync(safeRedirectPath, 'utf8')
    expect(safeRedirectSource).toMatch(/['"]\/set-password['"]/)
  })
})
