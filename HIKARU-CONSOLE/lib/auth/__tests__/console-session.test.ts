// ============================================================
// Console Session Cookie Helper — Unit Tests
//
// Phase P3 テスト:
//   - Cookie 名 / options が既存 loginAction と一致
//   - Cookie 値は Server-supplied (userId / role)
//   - 不正な role は reject
//   - 空 userId は reject
//   - clearConsoleSessionCookies が既存 hk_c_at / hk_c_rt も削除
//   - Cookie に token / password / session JSON を保存しない (契約テスト)
//   - Contract: 既存 loginAction Cookie 仕様と一致
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  setConsoleSessionCookies,
  clearConsoleSessionCookies,
  CONSOLE_COOKIE_ROLE,
  CONSOLE_COOKIE_UID,
  CONSOLE_LEGACY_COOKIES,
} from '../console-session'

// ---- Mock next/headers cookies() ----

const setMock    = vi.fn()
const deleteMock = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    set:    setMock,
    delete: deleteMock,
  })),
}))

beforeEach(() => {
  setMock.mockReset()
  deleteMock.mockReset()
})

// ============================================================
// Constants
// ============================================================

describe('Console session cookie constants', () => {
  it('CONSOLE_COOKIE_ROLE is hk_c_role', () => {
    expect(CONSOLE_COOKIE_ROLE).toBe('hk_c_role')
  })

  it('CONSOLE_COOKIE_UID is hk_c_uid', () => {
    expect(CONSOLE_COOKIE_UID).toBe('hk_c_uid')
  })

  it('CONSOLE_LEGACY_COOKIES includes hk_c_at and hk_c_rt', () => {
    expect(CONSOLE_LEGACY_COOKIES).toContain('hk_c_at')
    expect(CONSOLE_LEGACY_COOKIES).toContain('hk_c_rt')
  })
})

// ============================================================
// CASE A + B + C: Normal set (admin user)
// ============================================================

describe('setConsoleSessionCookies — CASE A/B/C (admin user, options match existing)', () => {
  it('sets hk_c_uid with given userId', async () => {
    await setConsoleSessionCookies({ userId: 'user-abc', role: 'admin', expiresIn: 3600 })
    const uidCall = setMock.mock.calls.find(c => c[0] === 'hk_c_uid')
    expect(uidCall).toBeDefined()
    expect(uidCall![1]).toBe('user-abc')
  })

  it('sets hk_c_role with "admin"', async () => {
    await setConsoleSessionCookies({ userId: 'user-abc', role: 'admin', expiresIn: 3600 })
    const roleCall = setMock.mock.calls.find(c => c[0] === 'hk_c_role')
    expect(roleCall).toBeDefined()
    expect(roleCall![1]).toBe('admin')
  })

  it('cookie options match existing loginAction spec exactly', async () => {
    await setConsoleSessionCookies({ userId: 'user-abc', role: 'admin', expiresIn: 3600 })
    const roleCall = setMock.mock.calls.find(c => c[0] === 'hk_c_role')
    const opts     = roleCall![2] as Record<string, unknown>

    expect(opts.httpOnly).toBe(true)
    expect(opts.sameSite).toBe('lax')
    expect(opts.path).toBe('/')
    expect(opts.maxAge).toBe(3600)
    // secure は NODE_ENV=production の時のみ true。test env では false。
    expect(opts.secure).toBe(process.env.NODE_ENV === 'production')
  })

  it('sets both cookies with identical options', async () => {
    await setConsoleSessionCookies({ userId: 'user-abc', role: 'admin', expiresIn: 3600 })
    const uidOpts  = setMock.mock.calls.find(c => c[0] === 'hk_c_uid')![2]
    const roleOpts = setMock.mock.calls.find(c => c[0] === 'hk_c_role')![2]
    expect(uidOpts).toEqual(roleOpts)
  })
})

// ============================================================
// CASE D: userId empty → reject
// ============================================================

describe('setConsoleSessionCookies — CASE D (userId validation)', () => {
  it('throws when userId is empty string', async () => {
    await expect(setConsoleSessionCookies({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userId: '' as any,
      role: 'admin',
    })).rejects.toThrow(/userId is required/)
    expect(setMock).not.toHaveBeenCalled()
  })

  it('throws when userId is undefined', async () => {
    await expect(setConsoleSessionCookies({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userId: undefined as any,
      role: 'admin',
    })).rejects.toThrow(/userId is required/)
    expect(setMock).not.toHaveBeenCalled()
  })

  it('throws when userId is non-string', async () => {
    await expect(setConsoleSessionCookies({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userId: 12345 as any,
      role: 'admin',
    })).rejects.toThrow(/userId is required/)
    expect(setMock).not.toHaveBeenCalled()
  })
})

// ============================================================
// CASE E: non-admin role → reject
// ============================================================

describe('setConsoleSessionCookies — CASE E (role validation)', () => {
  it('throws when role is "worker"', async () => {
    await expect(setConsoleSessionCookies({
      userId: 'user-1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: 'worker' as any,
    })).rejects.toThrow(/unsupported role/)
    expect(setMock).not.toHaveBeenCalled()
  })

  it('throws when role is "client"', async () => {
    await expect(setConsoleSessionCookies({
      userId: 'user-1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: 'client' as any,
    })).rejects.toThrow(/unsupported role/)
    expect(setMock).not.toHaveBeenCalled()
  })

  it('throws when role is any non-admin value (e.g. "operator")', async () => {
    // Console cookie の role は 'admin' に限定。任意文字列を Cookie 値として
    // 受け入れると middleware が admin として通してしまう危険がある。
    await expect(setConsoleSessionCookies({
      userId: 'user-1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: 'operator' as any,
    })).rejects.toThrow(/unsupported role/)
    expect(setMock).not.toHaveBeenCalled()
  })

  it('throws when role is empty string', async () => {
    await expect(setConsoleSessionCookies({
      userId: 'user-1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: '' as any,
    })).rejects.toThrow(/unsupported role/)
  })
})

// ============================================================
// CASE F: Token / password / session JSON MUST NOT be stored
// ============================================================

describe('setConsoleSessionCookies — CASE F (no secrets in cookie value)', () => {
  it('only two cookies are set (hk_c_role, hk_c_uid)', async () => {
    await setConsoleSessionCookies({ userId: 'user-abc', role: 'admin', expiresIn: 3600 })
    const cookieNames = setMock.mock.calls.map(c => c[0]).sort()
    expect(cookieNames).toEqual(['hk_c_role', 'hk_c_uid'])
    expect(cookieNames.length).toBe(2)
  })

  it('cookie value is not a JSON blob (no session/token payload)', async () => {
    await setConsoleSessionCookies({ userId: 'user-abc', role: 'admin', expiresIn: 3600 })
    for (const call of setMock.mock.calls) {
      const value = String(call[1])
      // JSON っぽい / URL っぽい / bearer っぽい値は入れていない
      expect(value.startsWith('{')).toBe(false)
      expect(value).not.toMatch(/^(eyJ|Bearer\s|sb-)/i)   // JWT っぽい / Bearer / Supabase session prefix
      expect(value).not.toMatch(/^https?:\/\//)
    }
  })

  it('function accepts only { userId, role, expiresIn } — no arbitrary metadata argument', () => {
    // Signature 契約: 意図しない payload を差し込めない
    expect(setConsoleSessionCookies.length).toBe(1)
  })
})

// ============================================================
// expiresIn fallback
// ============================================================

describe('setConsoleSessionCookies — expiresIn fallback (matches existing loginAction default of 3600)', () => {
  it('uses 3600 when expiresIn is undefined', async () => {
    await setConsoleSessionCookies({ userId: 'user-1', role: 'admin' })
    const opts = setMock.mock.calls[0][2] as Record<string, unknown>
    expect(opts.maxAge).toBe(3600)
  })

  it('uses 3600 when expiresIn is 0 or negative', async () => {
    await setConsoleSessionCookies({ userId: 'user-1', role: 'admin', expiresIn: 0 })
    const opts0 = setMock.mock.calls[0][2] as Record<string, unknown>
    expect(opts0.maxAge).toBe(3600)

    setMock.mockReset()

    await setConsoleSessionCookies({ userId: 'user-1', role: 'admin', expiresIn: -100 })
    const optsN = setMock.mock.calls[0][2] as Record<string, unknown>
    expect(optsN.maxAge).toBe(3600)
  })

  it('uses provided expiresIn when positive', async () => {
    await setConsoleSessionCookies({ userId: 'user-1', role: 'admin', expiresIn: 7200 })
    const opts = setMock.mock.calls[0][2] as Record<string, unknown>
    expect(opts.maxAge).toBe(7200)
  })
})

// ============================================================
// CASE J: Logout cookie cleanup preserves existing behavior
// ============================================================

describe('clearConsoleSessionCookies — CASE J (existing logout behavior preserved)', () => {
  it('deletes hk_c_role and hk_c_uid', async () => {
    await clearConsoleSessionCookies()
    const deleted = deleteMock.mock.calls.map(c => c[0])
    expect(deleted).toContain('hk_c_role')
    expect(deleted).toContain('hk_c_uid')
  })

  it('deletes legacy hk_c_at and hk_c_rt (matches existing logoutAction behavior)', async () => {
    await clearConsoleSessionCookies()
    const deleted = deleteMock.mock.calls.map(c => c[0])
    expect(deleted).toContain('hk_c_at')
    expect(deleted).toContain('hk_c_rt')
  })

  it('deletes exactly 4 cookies', async () => {
    await clearConsoleSessionCookies()
    expect(deleteMock).toHaveBeenCalledTimes(4)
  })
})
