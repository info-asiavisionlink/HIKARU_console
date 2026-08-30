// ============================================================
// Duplicate Engine Tests
// OpenAI calls: 0
// Business table writes: 0
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  normalizeAddress,
  detectClientDuplicates,
  detectStoreDuplicates,
  SCORE_THRESHOLD,
  type ExistingClient,
  type ExistingStore,
  type StagedRowForDuplicate,
} from '../duplicate-engine'

// ============================================================
// Normalization
// ============================================================

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com')
  })
  it('returns null for empty/null', () => {
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('   ')).toBeNull()
  })
  it('returns null if no @ symbol', () => {
    expect(normalizeEmail('notanemail')).toBeNull()
  })
})

describe('normalizePhone', () => {
  it('removes hyphens, parens, spaces', () => {
    expect(normalizePhone('03-1234-5678')).toBe('0312345678')
    expect(normalizePhone('(03) 1234 5678')).toBe('0312345678')
    expect(normalizePhone('090-0000-0000')).toBe('09000000000')
  })
  it('removes full-width space', () => {
    expect(normalizePhone('03　1234　5678')).toBe('0312345678')
  })
  it('returns null for too-short result', () => {
    expect(normalizePhone('123')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone('')).toBeNull()
  })
  it('returns null for empty', () => {
    expect(normalizePhone('---')).toBeNull()
  })
})

describe('normalizeName', () => {
  it('applies NFC, trim, lowercase', () => {
    expect(normalizeName('  株式会社ABC  ')).toBe('株式会社abc')
    expect(normalizeName('テスト株式会社')).toBe('テスト株式会社')
  })
  it('returns null for empty/null', () => {
    expect(normalizeName(null)).toBeNull()
    expect(normalizeName('')).toBeNull()
    expect(normalizeName('   ')).toBeNull()
  })
})

describe('normalizeAddress', () => {
  it('normalizes whitespace and lowercases', () => {
    expect(normalizeAddress('東京都  渋谷区 1-1')).toBe('東京都 渋谷区 1-1')
    expect(normalizeAddress('  Osaka  ')).toBe('osaka')
  })
  it('returns null for empty/null', () => {
    expect(normalizeAddress(null)).toBeNull()
    expect(normalizeAddress('')).toBeNull()
  })
})

// ============================================================
// Client Duplicate Detection
// ============================================================

function makeClient(overrides: Partial<ExistingClient> = {}): ExistingClient {
  return {
    id:      'existing-client-001',
    name:    '株式会社テスト',
    email:   'test@example.com',
    phone:   '03-1234-5678',
    address: '東京都渋谷区1-1',
    ...overrides,
  }
}

function makeStagedRow(
  id: string,
  mapped: Record<string, string | null> | null,
): StagedRowForDuplicate {
  return { id, mapped_data: mapped }
}

describe('detectClientDuplicates — email exact', () => {
  it('creates candidate when email matches exactly', () => {
    const row     = makeStagedRow('row-001', { name: '別会社', email: 'test@example.com', phone: null, address: null })
    const clients = [makeClient()]
    const results = detectClientDuplicates([row], clients)
    expect(results).toHaveLength(1)
    expect(results[0].stagingRowId).toBe('row-001')
    expect(results[0].existingRecordId).toBe('existing-client-001')
    expect(results[0].matchReasons).toContain('email_exact')
    expect(results[0].score).toBeGreaterThanOrEqual(0.95)
  })

  it('is case-insensitive for email', () => {
    const row     = makeStagedRow('row-002', { email: 'TEST@EXAMPLE.COM', name: null, phone: null, address: null })
    const clients = [makeClient({ email: 'test@example.com' })]
    const results = detectClientDuplicates([row], clients)
    expect(results).toHaveLength(1)
    expect(results[0].matchReasons).toContain('email_exact')
  })
})

describe('detectClientDuplicates — phone exact', () => {
  it('creates candidate when phone matches after separator removal', () => {
    const row     = makeStagedRow('row-003', { name: '別会社', phone: '0312345678', email: null, address: null })
    const clients = [makeClient({ phone: '03-1234-5678' })]
    const results = detectClientDuplicates([row], clients)
    expect(results).toHaveLength(1)
    expect(results[0].matchReasons).toContain('phone_normalized')
    expect(results[0].score).toBeGreaterThanOrEqual(0.80)
  })

  it('matches phone with parens format', () => {
    const row     = makeStagedRow('row-004', { phone: '(03)12345678', name: null, email: null, address: null })
    const clients = [makeClient({ phone: '0312345678' })]
    const results = detectClientDuplicates([row], clients)
    expect(results).toHaveLength(1)
  })
})

describe('detectClientDuplicates — name normalized', () => {
  it('creates candidate when name matches exactly (case insensitive)', () => {
    const row     = makeStagedRow('row-005', { name: '株式会社テスト', email: null, phone: null, address: null })
    const clients = [makeClient({ email: null, phone: null, address: null })]
    const results = detectClientDuplicates([row], clients)
    expect(results).toHaveLength(1)
    expect(results[0].matchReasons).toContain('name_normalized')
    expect(results[0].score).toBeGreaterThanOrEqual(0.65)
    expect(results[0].score).toBeGreaterThanOrEqual(SCORE_THRESHOLD)
  })

  it('does not match when names differ', () => {
    const row     = makeStagedRow('row-006', { name: '全く別の会社', email: null, phone: null, address: null })
    const clients = [makeClient({ email: null, phone: null })]
    const results = detectClientDuplicates([row], clients)
    expect(results).toHaveLength(0)
  })
})

describe('detectClientDuplicates — name + address normalized', () => {
  it('creates strong candidate when both name and address match', () => {
    const row = makeStagedRow('row-007', {
      name:    '株式会社テスト',
      address: '東京都渋谷区1-1',
      email:   null,
      phone:   null,
    })
    const clients = [makeClient({ email: null, phone: null })]
    const results = detectClientDuplicates([row], clients)
    expect(results).toHaveLength(1)
    expect(results[0].matchReasons).toContain('name_address_normalized')
    expect(results[0].score).toBeGreaterThanOrEqual(0.85)
  })
})

describe('detectClientDuplicates — no match', () => {
  it('returns empty when nothing matches', () => {
    const row     = makeStagedRow('row-008', { name: '全く違う会社', email: 'other@other.com', phone: '09000000000', address: '大阪府' })
    const clients = [makeClient()]
    const results = detectClientDuplicates([row], clients)
    expect(results).toHaveLength(0)
  })

  it('returns empty when mapped_data is null', () => {
    const row     = makeStagedRow('row-009', null)
    const clients = [makeClient()]
    const results = detectClientDuplicates([row], clients)
    expect(results).toHaveLength(0)
  })
})

describe('detectClientDuplicates — score is deterministic', () => {
  it('returns same score on repeated calls', () => {
    const row     = makeStagedRow('row-010', { email: 'test@example.com', phone: '03-1234-5678', name: '株式会社テスト', address: null })
    const clients = [makeClient()]
    const r1 = detectClientDuplicates([row], clients)
    const r2 = detectClientDuplicates([row], clients)
    expect(r1[0].score).toBe(r2[0].score)
    expect(r1[0].matchReasons.sort()).toEqual(r2[0].matchReasons.sort())
  })
})

describe('detectClientDuplicates — multiple signals boost score', () => {
  it('score increases when email and phone both match', () => {
    const rowEmailOnly  = makeStagedRow('r1', { email: 'test@example.com', phone: null,         name: null, address: null })
    const rowBoth       = makeStagedRow('r2', { email: 'test@example.com', phone: '03-1234-5678', name: null, address: null })
    const clients = [makeClient()]
    const [single] = detectClientDuplicates([rowEmailOnly], clients)
    const [multi]  = detectClientDuplicates([rowBoth],      clients)
    expect(multi.score).toBeGreaterThan(single.score)
  })

  it('score is capped at 1.0', () => {
    const row = makeStagedRow('r3', {
      email:   'test@example.com',
      phone:   '03-1234-5678',
      name:    '株式会社テスト',
      address: '東京都渋谷区1-1',
    })
    const clients = [makeClient()]
    const [result] = detectClientDuplicates([row], clients)
    expect(result.score).toBeLessThanOrEqual(1.0)
  })
})

// ============================================================
// Store Duplicate Detection
// ============================================================

function makeStore(overrides: Partial<ExistingStore> = {}): ExistingStore {
  return {
    id:        'existing-store-001',
    name:      'テスト店舗',
    phone:     '06-1234-5678',
    address:   '大阪府大阪市1-1',
    client_id: 'client-a',
    ...overrides,
  }
}

describe('detectStoreDuplicates — same name same client context', () => {
  it('creates candidate for matching store name', () => {
    const row     = makeStagedRow('srow-001', { name: 'テスト店舗', phone: null, address: null })
    const stores  = [makeStore()]
    const results = detectStoreDuplicates([row], stores)
    expect(results).toHaveLength(1)
    expect(results[0].matchReasons).toContain('name_normalized')
    expect(results[0].existingRecordTable).toBe('stores')
  })
})

describe('detectStoreDuplicates — same name different client possible', () => {
  it('still creates candidate (human must decide if different client = different store)', () => {
    const row    = makeStagedRow('srow-002', { name: 'テスト店舗', phone: null, address: null })
    const stores = [
      makeStore({ client_id: 'client-a' }),
      makeStore({ id: 'existing-store-002', client_id: 'client-b' }),
    ]
    const results = detectStoreDuplicates([row], stores)
    expect(results).toHaveLength(2)
  })
})

describe('detectStoreDuplicates — address match', () => {
  it('creates candidate when name and address both match', () => {
    const row    = makeStagedRow('srow-003', { name: 'テスト店舗', address: '大阪府大阪市1-1', phone: null })
    const stores = [makeStore()]
    const results = detectStoreDuplicates([row], stores)
    expect(results).toHaveLength(1)
    expect(results[0].matchReasons).toContain('name_address_normalized')
    expect(results[0].score).toBeGreaterThanOrEqual(0.85)
  })
})

describe('detectStoreDuplicates — phone match', () => {
  it('creates candidate when phone matches', () => {
    const row    = makeStagedRow('srow-004', { name: '全く別の店', phone: '06-1234-5678', address: null })
    const stores = [makeStore()]
    const results = detectStoreDuplicates([row], stores)
    expect(results).toHaveLength(1)
    expect(results[0].matchReasons).toContain('phone_normalized')
    expect(results[0].score).toBeGreaterThanOrEqual(0.80)
  })
})

describe('detectStoreDuplicates — no match', () => {
  it('returns empty when nothing matches', () => {
    const row    = makeStagedRow('srow-005', { name: '全然違う店', phone: '011-000-0000', address: '北海道' })
    const stores = [makeStore()]
    const results = detectStoreDuplicates([row], stores)
    expect(results).toHaveLength(0)
  })
})

// ============================================================
// Tenant Isolation (caller responsibility — engine is pure)
// ============================================================

describe('detectClientDuplicates — tenant isolation (caller must filter)', () => {
  it('matches against whatever existing records are passed — caller must filter by company_id', () => {
    // If caller accidentally passes another company's clients, engine would match them.
    // This test documents that isolation is the CALLER's responsibility.
    const rowA   = makeStagedRow('rA', { email: 'shared@example.com', name: null, phone: null, address: null })
    const clientCompanyA = makeClient({ id: 'ca-001', email: 'shared@example.com' })
    const clientCompanyB = makeClient({ id: 'cb-001', email: 'shared@example.com' })

    // Caller passes only company A's clients
    const resultsA = detectClientDuplicates([rowA], [clientCompanyA])
    expect(resultsA.map(r => r.existingRecordId)).toEqual(['ca-001'])

    // If caller accidentally passes both (wrong!), engine finds both — caller's bug
    const resultsBoth = detectClientDuplicates([rowA], [clientCompanyA, clientCompanyB])
    expect(resultsBoth).toHaveLength(2)
  })
})

// ============================================================
// Edge Cases
// ============================================================

describe('detectClientDuplicates — edge cases', () => {
  it('handles empty staging rows', () => {
    expect(detectClientDuplicates([], [makeClient()])).toHaveLength(0)
  })

  it('handles empty existing clients', () => {
    const row = makeStagedRow('r-edge', { email: 'x@x.com', name: null, phone: null, address: null })
    expect(detectClientDuplicates([row], [])).toHaveLength(0)
  })

  it('handles row with all null mapped fields', () => {
    const row = makeStagedRow('r-null', { name: null, email: null, phone: null, address: null })
    expect(detectClientDuplicates([row], [makeClient()])).toHaveLength(0)
  })
})

describe('detectStoreDuplicates — edge cases', () => {
  it('handles empty stores list', () => {
    const row = makeStagedRow('sr-edge', { name: 'テスト店舗', phone: null, address: null })
    expect(detectStoreDuplicates([row], [])).toHaveLength(0)
  })
})
