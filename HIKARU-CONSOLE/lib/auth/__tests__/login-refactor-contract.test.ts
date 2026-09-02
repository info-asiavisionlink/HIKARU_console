// ============================================================
// Login Refactor Contract Tests (P3)
//
// 実際の loginAction は Server Component + Supabase client 依存で
// unit test には重すぎるため、
// ここでは以下の static 契約を保証する:
//
//   G. 既存 loginAction が共通 helper (setConsoleSessionCookies) を利用
//   H. Login 成功時 redirect は /dashboard のまま
//   I. non-admin login 拒否ロジックが維持
//   J. logoutAction が clearConsoleSessionCookies を利用
//
// 加えて、直接 cookieStore.set('hk_c_role', ...) / delete 呼び出しが
// 残っていないことを保証する (P3 の目的そのもの)。
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const LOGIN_ACTIONS_PATH = resolve(__dirname, '../../../app/(auth)/login/actions.ts')
const source = readFileSync(LOGIN_ACTIONS_PATH, 'utf8')

// ============================================================
// CASE G: loginAction uses shared helper
// ============================================================

describe('login actions — CASE G (uses shared helper)', () => {
  it('imports setConsoleSessionCookies from console-session helper', () => {
    expect(source).toMatch(/import\s*{[^}]*setConsoleSessionCookies[^}]*}\s*from\s*['"]@\/lib\/auth\/console-session['"]/)
  })

  it('calls setConsoleSessionCookies (login path uses shared helper)', () => {
    expect(source).toMatch(/setConsoleSessionCookies\s*\(/)
  })

  it('does NOT directly set hk_c_role / hk_c_uid via cookieStore.set', () => {
    // 直接 cookieStore.set('hk_c_role', ...) が login/logout 内に残っていないこと
    expect(source).not.toMatch(/cookieStore\.set\(\s*['"]hk_c_role['"]/)
    expect(source).not.toMatch(/cookieStore\.set\(\s*['"]hk_c_uid['"]/)
  })
})

// ============================================================
// CASE H: redirect target preserved
// ============================================================

describe('login actions — CASE H (redirect preserved)', () => {
  it('loginAction still redirects to /dashboard on success', () => {
    expect(source).toMatch(/redirect\(\s*['"]\/dashboard['"]\s*\)/)
  })

  it('resetPasswordAction still redirects to /dashboard (unchanged in P3)', () => {
    // reset password は今回変更対象外だが、redirect先が変わっていないことを確認
    const matches = source.match(/redirect\(\s*['"]\/dashboard['"]/g)
    expect(matches).not.toBeNull()
    expect((matches ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

// ============================================================
// CASE I: non-admin login rejection preserved
// ============================================================

describe('login actions — CASE I (non-admin rejection preserved)', () => {
  it('still checks profile.role !== "admin" and calls signOut', () => {
    // role check + signOut 両方が login flow に残っていること
    expect(source).toMatch(/profile\.role\s*!==\s*['"]admin['"]/)
    expect(source).toMatch(/supabase\.auth\.signOut\(\)/)
  })

  it('still returns Japanese error for non-admin login', () => {
    expect(source).toContain('HIKARU System')
  })

  it('never calls setConsoleSessionCookies BEFORE role check', () => {
    // role check の後に helper 呼び出しが来ることを構造的に確認
    const roleCheckIdx = source.search(/profile\.role\s*!==\s*['"]admin['"]/)
    const helperIdx    = source.search(/setConsoleSessionCookies\s*\(/)
    expect(roleCheckIdx).toBeGreaterThan(-1)
    expect(helperIdx).toBeGreaterThan(-1)
    expect(helperIdx).toBeGreaterThan(roleCheckIdx)
  })
})

// ============================================================
// CASE J: logoutAction uses shared clear helper
// ============================================================

describe('login actions — CASE J (logout uses shared clear helper)', () => {
  it('imports clearConsoleSessionCookies', () => {
    expect(source).toMatch(/import\s*{[^}]*clearConsoleSessionCookies[^}]*}\s*from\s*['"]@\/lib\/auth\/console-session['"]/)
  })

  it('calls clearConsoleSessionCookies', () => {
    expect(source).toMatch(/clearConsoleSessionCookies\s*\(/)
  })

  it('does NOT directly cookieStore.delete hk_c_role / hk_c_uid / hk_c_at / hk_c_rt', () => {
    expect(source).not.toMatch(/cookieStore\.delete\(\s*['"]hk_c_role['"]/)
    expect(source).not.toMatch(/cookieStore\.delete\(\s*['"]hk_c_uid['"]/)
    expect(source).not.toMatch(/cookieStore\.delete\(\s*['"]hk_c_at['"]/)
    expect(source).not.toMatch(/cookieStore\.delete\(\s*['"]hk_c_rt['"]/)
  })

  it('logoutAction still redirects to /login', () => {
    expect(source).toMatch(/redirect\(\s*['"]\/login['"]\s*\)/)
  })
})

// ============================================================
// Password Flow Preservation (unchanged in P3)
// ============================================================

describe('login actions — password flow unchanged', () => {
  it('still uses signInWithPassword', () => {
    expect(source).toMatch(/signInWithPassword/)
  })

  it('still uses resetPasswordForEmail (forgot-password)', () => {
    expect(source).toMatch(/resetPasswordForEmail/)
  })

  it('still uses updateUser for password reset', () => {
    expect(source).toMatch(/supabase\.auth\.updateUser\(\s*{\s*password/)
  })
})
