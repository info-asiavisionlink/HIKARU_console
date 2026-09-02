// ============================================================
// Platform Operator Authorization — Unit Tests
//
// Phase P1 テスト:
//   - Trust Boundary の各 CASE (A〜F) を pure function level で保証
//   - Supabase client を最小限にmockする
//   - profiles.role='admin' 単独では Operator にならないことを明示
//   - Client供給値 (role/company_id) が判定に影響しないことを明示
//
// Business tables への書き込み: 0
// OpenAI calls: 0
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { checkPlatformOperator, isPlatformOperator } from '../platform-operator'
import type { AuthContext } from '@/lib/supabase/server-admin'

// ---- Mock helpers ----

/**
 * platform_operators の SELECT 結果を模擬する adminClient を返す。
 * data = 存在時のレコード、null = 未登録、error付き = DB失敗。
 */
function makeAuthContext(opts: {
  userId:  string | null
  found?:  boolean
  dbError?: { code: string; message: string } | null
}): AuthContext {
  const { userId, found = false, dbError = null } = opts

  const maybeSingleImpl = vi.fn(() => Promise.resolve({
    data:  dbError ? null : (found ? { auth_user_id: userId } : null),
    error: dbError,
  }))

  const eqImpl     = vi.fn(() => ({ maybeSingle: maybeSingleImpl }))
  const selectImpl = vi.fn(() => ({ eq: eqImpl }))
  const fromImpl   = vi.fn(() => ({ select: selectImpl }))

  return {
    userId: userId as string,     // テスト目的で null を許容
    companyId: 'irrelevant-company',
    rlsClient: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminClient: { from: fromImpl } as any,
  } as AuthContext
}

// ============================================================
// CASE A: Unauthenticated → unauthorized
// (通常は API route側で getAuthContext=null で先に弾かれるが、
//  helper自身も念のため防御する)
// ============================================================

describe('checkPlatformOperator — CASE A (unauthenticated)', () => {
  it('returns "unauthorized" when auth.userId is null-like', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noAuth = { userId: '', companyId: '', rlsClient: null, adminClient: {} as any } as AuthContext
    expect(checkPlatformOperator(noAuth)).resolves.toBe('unauthorized')
  })
})

// ============================================================
// CASE B: Customer Admin (profiles.role='admin') → DENY
// profile role は checkPlatformOperator が参照すべきではない。
// platform_operators に存在しなければ 'not_operator' を返すこと。
// ============================================================

describe('checkPlatformOperator — CASE B (Customer Admin denied)', () => {
  it('returns "not_operator" when user has admin role but NOT in platform_operators', async () => {
    const auth = makeAuthContext({ userId: 'customer-admin-uuid', found: false })
    const result = await checkPlatformOperator(auth)
    expect(result).toBe('not_operator')
  })

  it('never queries profiles.role — only platform_operators table', async () => {
    const auth = makeAuthContext({ userId: 'customer-admin-uuid', found: false })
    await checkPlatformOperator(auth)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((auth.adminClient as any).from).toHaveBeenCalledWith('platform_operators')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((auth.adminClient as any).from).not.toHaveBeenCalledWith('profiles')
  })
})

// ============================================================
// CASE C: Worker → DENY
// ============================================================

describe('checkPlatformOperator — CASE C (Worker denied)', () => {
  it('returns "not_operator" for worker user', async () => {
    const auth = makeAuthContext({ userId: 'worker-uuid', found: false })
    expect(await checkPlatformOperator(auth)).toBe('not_operator')
  })
})

// ============================================================
// CASE D: Registered Platform Operator → ALLOW
// ============================================================

describe('checkPlatformOperator — CASE D (Platform Operator allowed)', () => {
  it('returns "operator" when user is in platform_operators', async () => {
    const auth = makeAuthContext({ userId: 'operator-uuid', found: true })
    expect(await checkPlatformOperator(auth)).toBe('operator')
  })

  it('isPlatformOperator returns true for operator', async () => {
    const auth = makeAuthContext({ userId: 'operator-uuid', found: true })
    expect(await isPlatformOperator(auth)).toBe(true)
  })

  it('isPlatformOperator returns false for non-operator', async () => {
    const auth = makeAuthContext({ userId: 'non-operator-uuid', found: false })
    expect(await isPlatformOperator(auth)).toBe(false)
  })
})

// ============================================================
// CASE E: Client supplied fake role/company_id/user_id → 判定に影響しない
// (checkPlatformOperator は AuthContext.userId のみ使用)
// ============================================================

describe('checkPlatformOperator — CASE E (spoof-resistant)', () => {
  it('does not accept a user_id argument — uses auth.userId only', () => {
    // TypeScript signature が引数 auth のみを取ることを型で保証
    // (実行時はfunction.lengthで引数数を確認)
    expect(checkPlatformOperator.length).toBe(1)
  })

  it('ignores client-supplied companyId in AuthContext', async () => {
    // AuthContext.companyId を偽装しても、platform_operators の
    // 判定は auth_user_id のみ依存
    const auth = makeAuthContext({ userId: 'user-a', found: false })
    // 偽の companyId を入れても not_operator のまま
    auth.companyId = 'spoofed-company-id'
    expect(await checkPlatformOperator(auth)).toBe('not_operator')
  })

  it('SELECT filter uses auth_user_id column only', async () => {
    const auth = makeAuthContext({ userId: 'user-a', found: false })
    await checkPlatformOperator(auth)
    // adminClient.from('platform_operators').select().eq('auth_user_id', ...)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromMock   = (auth.adminClient as any).from
    const selectMock = fromMock.mock.results[0].value.select
    const eqMock     = selectMock.mock.results[0].value.eq
    expect(eqMock).toHaveBeenCalledWith('auth_user_id', 'user-a')
  })
})

// ============================================================
// CASE F: 別 Company の Admin → DENY
// company_id が異なっても、platform_operators に登録が無ければ拒否
// ============================================================

describe('checkPlatformOperator — CASE F (cross-company admin denied)', () => {
  it('returns "not_operator" for admin from company B (not in operators)', async () => {
    const auth = makeAuthContext({ userId: 'company-b-admin', found: false })
    expect(await checkPlatformOperator(auth)).toBe('not_operator')
  })
})

// ============================================================
// CASE G: DB Error → 安全側 (not_operator) に倒す
// ============================================================

describe('checkPlatformOperator — DB error handling', () => {
  it('returns "not_operator" on DB error (fail-safe)', async () => {
    const auth = makeAuthContext({
      userId: 'user-uuid',
      dbError: { code: '500', message: 'connection failed' },
    })
    expect(await checkPlatformOperator(auth)).toBe('not_operator')
  })

  it('never returns "operator" on DB error', async () => {
    const auth = makeAuthContext({
      userId: 'user-uuid',
      dbError: { code: 'PGRST999', message: 'db down' },
    })
    const result = await checkPlatformOperator(auth)
    expect(result).not.toBe('operator')
  })
})

// ============================================================
// Design Invariants (契約テスト)
// ============================================================

describe('checkPlatformOperator — design invariants', () => {
  it('takes exactly one argument (AuthContext)', () => {
    expect(checkPlatformOperator.length).toBe(1)
  })

  it('return values are limited to the union type', async () => {
    const results = [
      await checkPlatformOperator(makeAuthContext({ userId: 'a', found: true })),
      await checkPlatformOperator(makeAuthContext({ userId: 'b', found: false })),
    ]
    const allowed = ['operator', 'not_operator', 'unauthorized']
    for (const r of results) {
      expect(allowed).toContain(r)
    }
  })

  it('never queries any Business Data table', async () => {
    const auth = makeAuthContext({ userId: 'user', found: false })
    await checkPlatformOperator(auth)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromMock = (auth.adminClient as any).from
    const businessTables = ['clients', 'stores', 'employees', 'projects', 'invoices', 'expenses', 'companies']
    for (const t of businessTables) {
      expect(fromMock).not.toHaveBeenCalledWith(t)
    }
  })
})
