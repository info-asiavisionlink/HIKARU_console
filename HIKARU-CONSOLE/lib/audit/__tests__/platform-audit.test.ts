// ============================================================
// Platform Provisioning Audit — Unit Tests
//
// Phase P2 テスト:
//   - Normal write
//   - Metadata sanitization (機密 key 除去)
//   - DB failure が握り潰されない
//   - actor_user_id は必ず auth.userId 由来
//   - platform_operators / Business tables を触らない
//   - client-supplied companyId が Audit authority にならない
//
// Business tables への書き込み: 0
// OpenAI calls: 0
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import {
  writePlatformAudit,
  sanitizeAuditMetadata,
} from '../platform-audit'
import type { AuthContext } from '@/lib/supabase/server-admin'

// ---- Mock helpers ----

interface MockAuth {
  auth:        AuthContext
  insertSpy:   ReturnType<typeof vi.fn>
  fromSpy:     ReturnType<typeof vi.fn>
}

function makeAuthContext(opts: {
  userId?:  string
  dbError?: { code: string; message: string } | null
  returnedId?: string
}): MockAuth {
  const { userId = 'operator-uuid', dbError = null, returnedId = 'audit-row-id' } = opts

  const singleImpl = vi.fn(() => Promise.resolve({
    data:  dbError ? null : { id: returnedId },
    error: dbError,
  }))
  const selectImpl = vi.fn(() => ({ single: singleImpl }))
  const insertSpy  = vi.fn(() => ({ select: selectImpl }))
  const fromSpy    = vi.fn(() => ({ insert: insertSpy }))

  const auth = {
    userId,
    companyId: 'irrelevant-company',
    rlsClient: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminClient: { from: fromSpy } as any,
  } as AuthContext

  return { auth, insertSpy, fromSpy }
}

// ============================================================
// sanitizeAuditMetadata (pure)
// ============================================================

describe('sanitizeAuditMetadata', () => {
  it('returns null for null/undefined input', () => {
    expect(sanitizeAuditMetadata(null)).toBeNull()
    expect(sanitizeAuditMetadata(undefined)).toBeNull()
  })

  it('preserves safe keys', () => {
    const result = sanitizeAuditMetadata({
      email_hash: 'abc123',
      company_name: 'ABC',
      note: 'ok',
    })
    expect(result).toEqual({
      email_hash: 'abc123',
      company_name: 'ABC',
      note: 'ok',
    })
  })

  it('removes password key', () => {
    const result = sanitizeAuditMetadata({ email: 'a@a.com', password: 'secret' })
    expect(result).not.toHaveProperty('password')
    expect(result).toHaveProperty('email')
  })

  it('removes access_token and refresh_token', () => {
    const result = sanitizeAuditMetadata({
      access_token:  'at',
      refresh_token: 'rt',
      user: 'ok',
    })
    expect(result).not.toHaveProperty('access_token')
    expect(result).not.toHaveProperty('refresh_token')
    expect(result).toHaveProperty('user')
  })

  it('removes authorization / cookie / secret', () => {
    const result = sanitizeAuditMetadata({
      authorization: 'Bearer xxx',
      cookie: 'sess=yyy',
      secret: 'zzz',
      keep: 'me',
    })
    expect(result).not.toHaveProperty('authorization')
    expect(result).not.toHaveProperty('cookie')
    expect(result).not.toHaveProperty('secret')
    expect(result).toHaveProperty('keep')
  })

  it('removes service_role / service_role_key', () => {
    const result = sanitizeAuditMetadata({
      service_role: 'x',
      service_role_key: 'y',
      other: 'z',
    })
    expect(result).not.toHaveProperty('service_role')
    expect(result).not.toHaveProperty('service_role_key')
    expect(result).toHaveProperty('other')
  })

  it('removes api_key / apikey / bearer', () => {
    const result = sanitizeAuditMetadata({
      api_key: 'x',
      APIKEY: 'y',
      bearer: 'z',
      keep: 'ok',
    })
    expect(result).not.toHaveProperty('api_key')
    expect(result).not.toHaveProperty('APIKEY')
    expect(result).not.toHaveProperty('bearer')
    expect(result).toHaveProperty('keep')
  })

  it('is case-insensitive', () => {
    const result = sanitizeAuditMetadata({
      Password: 'x',
      PASSWORD: 'y',
      TOKEN: 'z',
    })
    expect(result).toBeNull()
  })

  it('removes keys containing forbidden substrings', () => {
    const result = sanitizeAuditMetadata({
      user_password:   'x',
      access_token_id: 'y',
      csrf_token:      'z',
      keep_me:         'ok',
    })
    expect(result).not.toHaveProperty('user_password')
    expect(result).not.toHaveProperty('access_token_id')
    expect(result).not.toHaveProperty('csrf_token')
    expect(result).toHaveProperty('keep_me')
  })

  it('returns null when only forbidden keys present', () => {
    const result = sanitizeAuditMetadata({ password: 'x', token: 'y' })
    expect(result).toBeNull()
  })

  it('removes invite_token and invite_url', () => {
    const result = sanitizeAuditMetadata({
      invite_token: 'x',
      invite_url: 'https://...',
      target_email_hash: 'ok',
    })
    expect(result).not.toHaveProperty('invite_token')
    expect(result).not.toHaveProperty('invite_url')
    expect(result).toHaveProperty('target_email_hash')
  })
})

// ============================================================
// writePlatformAudit — CASE A: Normal insert
// ============================================================

describe('writePlatformAudit — CASE A (normal)', () => {
  it('inserts into platform_audit_logs on success', async () => {
    const { auth, insertSpy, fromSpy } = makeAuthContext({ userId: 'op-1' })
    const result = await writePlatformAudit(auth, {
      action:      'company.provisioning.completed',
      status:      'success',
      targetType:  'company',
      targetId:    'company-123',
    })
    expect(result.ok).toBe(true)
    expect(result.id).toBe('audit-row-id')
    expect(fromSpy).toHaveBeenCalledWith('platform_audit_logs')
    expect(insertSpy).toHaveBeenCalledTimes(1)
  })
})

// ============================================================
// CASE B: Required fields propagate
// ============================================================

describe('writePlatformAudit — CASE B (required fields)', () => {
  it('actor_user_id is sourced from auth.userId', async () => {
    const { auth, insertSpy } = makeAuthContext({ userId: 'operator-42' })
    await writePlatformAudit(auth, {
      action: 'company.provisioning.started',
      status: 'started',
    })
    const row = insertSpy.mock.calls[0][0]
    expect(row.actor_user_id).toBe('operator-42')
  })

  it('action and status are stored as-is', async () => {
    const { auth, insertSpy } = makeAuthContext({})
    await writePlatformAudit(auth, {
      action: 'admin.invitation.sent',
      status: 'success',
    })
    const row = insertSpy.mock.calls[0][0]
    expect(row.action).toBe('admin.invitation.sent')
    expect(row.status).toBe('success')
  })

  it('optional targetType / targetId / requestId default to null', async () => {
    const { auth, insertSpy } = makeAuthContext({})
    await writePlatformAudit(auth, {
      action: 'company.provisioning.failed',
      status: 'failure',
    })
    const row = insertSpy.mock.calls[0][0]
    expect(row.target_type).toBeNull()
    expect(row.target_id).toBeNull()
    expect(row.request_id).toBeNull()
    expect(row.metadata).toBeNull()
  })
})

// ============================================================
// CASE C-F: Forbidden metadata rejection
// ============================================================

describe('writePlatformAudit — CASE C (password rejected)', () => {
  it('password key does NOT reach INSERT payload', async () => {
    const { auth, insertSpy } = makeAuthContext({})
    await writePlatformAudit(auth, {
      action: 'admin.invitation.sent',
      status: 'success',
      metadata: { email: 'a@a.com', password: 'plain-text' },
    })
    const row = insertSpy.mock.calls[0][0]
    expect(row.metadata).not.toHaveProperty('password')
    expect(row.metadata).toHaveProperty('email')
  })
})

describe('writePlatformAudit — CASE D (access_token rejected)', () => {
  it('access_token key does NOT reach INSERT payload', async () => {
    const { auth, insertSpy } = makeAuthContext({})
    await writePlatformAudit(auth, {
      action: 'admin.invitation.sent',
      status: 'success',
      metadata: { access_token: 'at-xxx', target: 'user-1' },
    })
    const row = insertSpy.mock.calls[0][0]
    expect(row.metadata).not.toHaveProperty('access_token')
    expect(row.metadata).toHaveProperty('target')
  })
})

describe('writePlatformAudit — CASE E (authorization rejected)', () => {
  it('authorization key does NOT reach INSERT payload', async () => {
    const { auth, insertSpy } = makeAuthContext({})
    await writePlatformAudit(auth, {
      action: 'admin.invitation.sent',
      status: 'success',
      metadata: { authorization: 'Bearer xxx', op: 'invite' },
    })
    const row = insertSpy.mock.calls[0][0]
    expect(row.metadata).not.toHaveProperty('authorization')
    expect(row.metadata).toHaveProperty('op')
  })
})

describe('writePlatformAudit — CASE F (cookie rejected)', () => {
  it('cookie key does NOT reach INSERT payload', async () => {
    const { auth, insertSpy } = makeAuthContext({})
    await writePlatformAudit(auth, {
      action: 'admin.invitation.sent',
      status: 'success',
      metadata: { cookie: 'sess=yyy', kind: 'admin' },
    })
    const row = insertSpy.mock.calls[0][0]
    expect(row.metadata).not.toHaveProperty('cookie')
    expect(row.metadata).toHaveProperty('kind')
  })
})

// ============================================================
// CASE G: DB failure — must NOT be silently swallowed
// ============================================================

describe('writePlatformAudit — CASE G (DB failure)', () => {
  it('returns { ok: false, error } on DB error', async () => {
    const { auth } = makeAuthContext({
      dbError: { code: '23505', message: 'unique violation' },
    })
    const result = await writePlatformAudit(auth, {
      action: 'company.provisioning.completed',
      status: 'success',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('unique violation')
  })

  it('never returns ok=true when DB errors', async () => {
    const { auth } = makeAuthContext({
      dbError: { code: '500', message: 'connection lost' },
    })
    const result = await writePlatformAudit(auth, {
      action: 'admin.invitation.sent',
      status: 'success',
    })
    expect(result.ok).not.toBe(true)
  })

  it('does not throw on DB error', async () => {
    const { auth } = makeAuthContext({
      dbError: { code: '500', message: 'connection lost' },
    })
    await expect(writePlatformAudit(auth, {
      action: 'company.provisioning.failed',
      status: 'failure',
    })).resolves.toBeDefined()
  })
})

// ============================================================
// CASE H: Business tables are NOT written
// ============================================================

describe('writePlatformAudit — CASE H (Business tables untouched)', () => {
  it('only platform_audit_logs is written to', async () => {
    const { auth, fromSpy } = makeAuthContext({})
    await writePlatformAudit(auth, {
      action: 'company.provisioning.completed',
      status: 'success',
    })
    expect(fromSpy).toHaveBeenCalledWith('platform_audit_logs')
    expect(fromSpy).toHaveBeenCalledTimes(1)

    const forbiddenTables = ['companies', 'profiles', 'employees', 'clients', 'stores', 'projects', 'invoices', 'expenses']
    for (const t of forbiddenTables) {
      expect(fromSpy).not.toHaveBeenCalledWith(t)
    }
  })
})

// ============================================================
// CASE I: platform_operators is NOT written
// ============================================================

describe('writePlatformAudit — CASE I (platform_operators untouched)', () => {
  it('does not touch platform_operators table', async () => {
    const { auth, fromSpy } = makeAuthContext({})
    await writePlatformAudit(auth, {
      action: 'company.provisioning.started',
      status: 'started',
    })
    expect(fromSpy).not.toHaveBeenCalledWith('platform_operators')
  })
})

// ============================================================
// CASE J: Client-supplied companyId is NOT audit authority
// ============================================================

describe('writePlatformAudit — CASE J (spoof-resistant)', () => {
  it('AuthContext.companyId is NOT used as actor authority', async () => {
    const { auth, insertSpy } = makeAuthContext({ userId: 'operator-real' })
    // Simulate injection: caller sets fake companyId
    auth.companyId = 'spoofed-company-id'
    await writePlatformAudit(auth, {
      action: 'company.provisioning.completed',
      status: 'success',
    })
    const row = insertSpy.mock.calls[0][0]
    // actor_user_id is auth.userId, NOT derived from companyId
    expect(row.actor_user_id).toBe('operator-real')
    // Row must have no company_id field (schema does not include company_id at all)
    expect(row).not.toHaveProperty('company_id')
  })

  it('function signature takes only (auth, input) — no arbitrary actorUserId argument', () => {
    expect(writePlatformAudit.length).toBe(2)
  })
})

// ============================================================
// Missing/invalid input validation
// ============================================================

describe('writePlatformAudit — invalid input', () => {
  it('rejects when auth.userId is empty', async () => {
    const { auth } = makeAuthContext({ userId: '' })
    const result = await writePlatformAudit(auth, {
      action: 'company.provisioning.completed',
      status: 'success',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('actor_user_id missing')
  })

  it('rejects when action is empty', async () => {
    const { auth } = makeAuthContext({})
    const result = await writePlatformAudit(auth, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action: '' as any,
      status: 'success',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('action required')
  })

  it('rejects when status is empty', async () => {
    const { auth } = makeAuthContext({})
    const result = await writePlatformAudit(auth, {
      action: 'company.provisioning.completed',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: '' as any,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('status required')
  })
})
