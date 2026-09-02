// ============================================================
// Auth Callback Route Contract Tests (P4)
//
// Callback route (app/auth/callback/route.ts) が下記の
// セキュリティ契約を守っていることを source-static level で保証する:
//
//   - Query parameter (role/user_id/company_id) を authority として使わない
//   - user_metadata を authority として使わない
//   - exchangeCodeForSession を用いる (JWT独自decodeしない)
//   - profiles を Server side で確認 (role='admin' + company_id 必須)
//   - setConsoleSessionCookies へ role='admin' 固定を渡す
//   - fail-closed: 失敗時 clearConsoleSessionCookies + signOut を試みる
//   - getSafeAuthRedirect を経由して redirect (open redirect対策)
//   - Platform Operator check を呼ばない (Trust Boundary separation)
//   - checkPlatformOperator / platform_operators / platform_audit_logs を触らない
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROUTE_PATH = resolve(__dirname, '../../../app/auth/callback/route.ts')
const source = readFileSync(ROUTE_PATH, 'utf8')

// ============================================================
// Fundamental usage of Supabase SSR
// ============================================================

describe('callback route — Supabase SSR usage', () => {
  it('uses @supabase/ssr createServerClient (not custom JWT decode)', () => {
    expect(source).toMatch(/from\s+['"]@supabase\/ssr['"]/)
    expect(source).toMatch(/createServerClient/)
  })

  it('uses exchangeCodeForSession (canonical Supabase flow)', () => {
    expect(source).toMatch(/exchangeCodeForSession\s*\(/)
  })

  it('reads code from URL search params', () => {
    expect(source).toMatch(/searchParams\.get\(\s*['"]code['"]\s*\)/)
  })

  it('reads next from URL search params', () => {
    expect(source).toMatch(/searchParams\.get\(\s*['"]next['"]\s*\)/)
  })
})

// ============================================================
// Authority sources
// ============================================================

describe('callback route — authority separation (CASE I/J/K/L)', () => {
  it('does NOT read role/user_id/company_id from query parameters', () => {
    expect(source).not.toMatch(/searchParams\.get\(\s*['"]role['"]/)
    expect(source).not.toMatch(/searchParams\.get\(\s*['"]user_id['"]/)
    expect(source).not.toMatch(/searchParams\.get\(\s*['"]company_id['"]/)
  })

  it('does NOT read user_metadata as authority (comments excluded)', () => {
    // コメント行を除いた実コードで user_metadata / raw_user_meta_data の
    // property access / destructure が無いこと。
    const codeOnly = source
      .split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
      .join('\n')
    // property access: .user_metadata / .raw_user_meta_data
    expect(codeOnly).not.toMatch(/\.user_metadata\b/)
    expect(codeOnly).not.toMatch(/\.raw_user_meta_data\b/)
    // destructure: { user_metadata } / { raw_user_meta_data }
    expect(codeOnly).not.toMatch(/{\s*[^}]*\buser_metadata\b/)
    expect(codeOnly).not.toMatch(/{\s*[^}]*\braw_user_meta_data\b/)
  })

  it('queries profiles table for authority (role + company_id)', () => {
    expect(source).toMatch(/from\(\s*['"]profiles['"]\s*\)/)
    expect(source).toMatch(/select\(\s*['"][^'"]*role[^'"]*company_id[^'"]*['"]|select\(\s*['"][^'"]*company_id[^'"]*role[^'"]*['"]/)
  })

  it('enforces role === "admin" server-side', () => {
    expect(source).toMatch(/role\s*!==\s*['"]admin['"]/)
  })

  it('enforces company_id NOT NULL', () => {
    // `!p.company_id` or `!profile.company_id` 相当
    expect(source).toMatch(/!\s*p\.company_id|!\s*profile\.company_id/)
  })
})

// ============================================================
// Console cookie handoff
// ============================================================

describe('callback route — Console cookie handoff (P3 helper)', () => {
  it('imports setConsoleSessionCookies from P3 helper', () => {
    expect(source).toMatch(/import\s*{[^}]*setConsoleSessionCookies[^}]*}\s*from\s*['"]@\/lib\/auth\/console-session['"]/)
  })

  it('imports clearConsoleSessionCookies from P3 helper', () => {
    expect(source).toMatch(/clearConsoleSessionCookies/)
  })

  it('passes role: "admin" fixed to setConsoleSessionCookies', () => {
    // helper 呼び出しに 'admin' が渡っている (role query spoof の影響を受けない)
    expect(source).toMatch(/setConsoleSessionCookies\s*\([\s\S]*role:\s*['"]admin['"]/)
  })

  it('passes verified userId (authUserId) to setConsoleSessionCookies', () => {
    expect(source).toMatch(/setConsoleSessionCookies\s*\([\s\S]*userId:\s*authUserId/)
  })

  it('does NOT set cookies directly (hk_c_role / hk_c_uid)', () => {
    expect(source).not.toMatch(/cookieStore\.set\(\s*['"]hk_c_role['"]/)
    expect(source).not.toMatch(/cookieStore\.set\(\s*['"]hk_c_uid['"]/)
  })
})

// ============================================================
// Fail-closed behavior (CASE T/U)
// ============================================================

describe('callback route — fail-closed', () => {
  it('has a failClosed helper that signs out and clears cookies', () => {
    expect(source).toMatch(/failClosed/)
    expect(source).toMatch(/signOut\(\)/)
  })

  it('calls clearConsoleSessionCookies in failClosed path', () => {
    // failClosed 内で clearConsoleSessionCookies 呼び出し
    expect(source).toMatch(/clearConsoleSessionCookies\(\)/)
  })

  it('failClosed redirects to /login (not exposing code/token)', () => {
    expect(source).toMatch(/new URL\(\s*['"]\/login['"]/)
    // error code のみを付ける (token/code はつけない)
    expect(source).toMatch(/searchParams\.set\(\s*['"]error['"]/)
  })

  it('does NOT include code or token in log/redirect output', () => {
    // console.log / error に code/token を出さない
    expect(source).not.toMatch(/console\.log\([^)]*code/)
    expect(source).not.toMatch(/searchParams\.set\(\s*['"]code['"]/)
    expect(source).not.toMatch(/searchParams\.set\(\s*['"]access_token['"]/)
  })

  it('has fail paths for: invalid_callback / auth_failed / profile_denied / internal_error', () => {
    expect(source).toMatch(/'invalid_callback'/)
    expect(source).toMatch(/'auth_failed'/)
    expect(source).toMatch(/'profile_denied'/)
    expect(source).toMatch(/'internal_error'/)
  })
})

// ============================================================
// Safe redirect
// ============================================================

describe('callback route — safe redirect (CASE M/N/O/P/Q/R)', () => {
  it('imports getSafeAuthRedirect helper', () => {
    expect(source).toMatch(/import\s*{[^}]*getSafeAuthRedirect[^}]*}\s*from\s*['"]@\/lib\/auth\/safe-redirect['"]/)
  })

  it('calls getSafeAuthRedirect on next parameter', () => {
    expect(source).toMatch(/getSafeAuthRedirect\s*\(\s*next\s*\)/)
  })

  it('does NOT redirect using raw next (bypassing helper)', () => {
    // NextResponse.redirect(new URL(next, ...)) の直接使用禁止
    expect(source).not.toMatch(/NextResponse\.redirect\(\s*new URL\(\s*next\s*,/)
  })
})

// ============================================================
// Trust Boundary separation (Platform Operator vs Customer Admin)
// ============================================================

describe('callback route — trust boundary (Platform Operator NOT involved)', () => {
  it('does NOT import checkPlatformOperator', () => {
    expect(source).not.toMatch(/checkPlatformOperator/)
  })

  it('does NOT reference platform_operators table', () => {
    expect(source).not.toMatch(/platform_operators/)
  })

  it('does NOT write platform_audit_logs (P4 does not audit)', () => {
    expect(source).not.toMatch(/platform_audit_logs/)
    expect(source).not.toMatch(/writePlatformAudit/)
  })
})

// ============================================================
// HTTP method
// ============================================================

describe('callback route — HTTP method', () => {
  it('exports GET handler only (not POST)', () => {
    expect(source).toMatch(/export\s+async\s+function\s+GET\s*\(/)
    expect(source).not.toMatch(/export\s+async\s+function\s+POST\s*\(/)
  })
})
