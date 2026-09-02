// ============================================================
// Setup Readiness — Unit Tests
//
// Pure function tests. No DB, no mocks, no async.
// Covers all readiness rules from formal spec.
// ============================================================

import { describe, it, expect } from 'vitest'
import { computeReadiness, type SetupCounts } from '../readiness'

function counts(overrides: Partial<SetupCounts> = {}): SetupCounts {
  return {
    clients:   1,
    stores:    1,
    employees: 1,
    projects:  1,
    ...overrides,
  }
}

// ============================================================
// 1. FULLY READY — all >= 1 + valid name
// ============================================================

describe('computeReadiness — fully ready', () => {
  it('all READY when name valid and all counts >= 1', () => {
    const r = computeReadiness('株式会社HIKARU', counts())
    expect(r.companyReady).toBe(true)
    expect(r.clientReady).toBe(true)
    expect(r.storeReady).toBe(true)
    expect(r.employeeReady).toBe(true)
    expect(r.projectReady).toBe(true)
    expect(r.accountReady).toBe(true)
    expect(r.businessReady).toBe(true)
    expect(r.operationReady).toBe(true)
  })
})

// ============================================================
// 2. CLIENT = 0 → BUSINESS_READY = false
// ============================================================

describe('computeReadiness — clients = 0', () => {
  it('businessReady=false when clients=0', () => {
    const r = computeReadiness('HIKARU', counts({ clients: 0 }))
    expect(r.clientReady).toBe(false)
    expect(r.businessReady).toBe(false)
    expect(r.operationReady).toBe(false)
  })

  it('accountReady still true when clients=0', () => {
    const r = computeReadiness('HIKARU', counts({ clients: 0 }))
    expect(r.accountReady).toBe(true)
  })
})

// ============================================================
// 3. EMPLOYEES = 0 → BUSINESS_READY = false
// ============================================================

describe('computeReadiness — employees = 0', () => {
  it('businessReady=false when employees=0', () => {
    const r = computeReadiness('HIKARU', counts({ employees: 0 }))
    expect(r.employeeReady).toBe(false)
    expect(r.businessReady).toBe(false)
    expect(r.operationReady).toBe(false)
  })
})

// ============================================================
// 4. PROJECTS = 0 → OPERATION_READY = false, BUSINESS_READY = true
// ============================================================

describe('computeReadiness — projects = 0', () => {
  it('businessReady=true but operationReady=false when projects=0', () => {
    const r = computeReadiness('HIKARU', counts({ projects: 0 }))
    expect(r.projectReady).toBe(false)
    expect(r.businessReady).toBe(true)
    expect(r.operationReady).toBe(false)
  })
})

// ============================================================
// 5. STORES = 0 → does NOT affect BUSINESS_READY or OPERATION_READY
// ============================================================

describe('computeReadiness — stores = 0', () => {
  it('stores=0 does NOT block businessReady', () => {
    const r = computeReadiness('HIKARU', counts({ stores: 0 }))
    expect(r.storeReady).toBe(false)
    expect(r.businessReady).toBe(true)
  })

  it('stores=0 does NOT block operationReady', () => {
    const r = computeReadiness('HIKARU', counts({ stores: 0 }))
    expect(r.storeReady).toBe(false)
    expect(r.operationReady).toBe(true)
  })
})

// ============================================================
// 6. COMPANY NAME — edge cases
// ============================================================

describe('computeReadiness — company name validation', () => {
  it('companyReady=false when name is null', () => {
    const r = computeReadiness(null, counts())
    expect(r.companyReady).toBe(false)
    expect(r.accountReady).toBe(false)
    expect(r.businessReady).toBe(false)
  })

  it('companyReady=false when name is undefined', () => {
    const r = computeReadiness(undefined, counts())
    expect(r.companyReady).toBe(false)
    expect(r.accountReady).toBe(false)
  })

  it('companyReady=false when name is empty string', () => {
    const r = computeReadiness('', counts())
    expect(r.companyReady).toBe(false)
  })

  it('companyReady=false when name is whitespace only', () => {
    const r = computeReadiness('   ', counts())
    expect(r.companyReady).toBe(false)
  })

  it('companyReady=true when name has content after trim', () => {
    const r = computeReadiness('  HIKARU  ', counts())
    expect(r.companyReady).toBe(true)
  })

  it('companyReady=false propagates to businessReady=false', () => {
    const r = computeReadiness(null, counts())
    expect(r.businessReady).toBe(false)
    expect(r.operationReady).toBe(false)
  })
})

// ============================================================
// 7. ACCOUNT READY is COMPANY_READY only
// (auth + company_id validity is guaranteed by getAuthContext upstream)
// ============================================================

describe('computeReadiness — accountReady = companyReady', () => {
  it('accountReady mirrors companyReady', () => {
    expect(computeReadiness('HIKARU', counts()).accountReady).toBe(true)
    expect(computeReadiness(null, counts()).accountReady).toBe(false)
    expect(computeReadiness('', counts()).accountReady).toBe(false)
  })
})

// ============================================================
// 8. BUSINESS_READY strict conditions
// ============================================================

describe('computeReadiness — businessReady conditions', () => {
  it('businessReady=false when company not ready', () => {
    const r = computeReadiness(null, counts())
    expect(r.businessReady).toBe(false)
  })

  it('businessReady=false when clients=0 even if employees exist', () => {
    const r = computeReadiness('HIKARU', counts({ clients: 0 }))
    expect(r.businessReady).toBe(false)
  })

  it('businessReady=false when employees=0 even if clients exist', () => {
    const r = computeReadiness('HIKARU', counts({ employees: 0 }))
    expect(r.businessReady).toBe(false)
  })

  it('businessReady=true when company + clients + employees all ready', () => {
    const r = computeReadiness('HIKARU', counts({ stores: 0, projects: 0 }))
    expect(r.businessReady).toBe(true)
  })
})

// ============================================================
// 9. OPERATION_READY = businessReady && projectReady
// ============================================================

describe('computeReadiness — operationReady', () => {
  it('operationReady=false when businessReady=false even if projects exist', () => {
    const r = computeReadiness('HIKARU', counts({ clients: 0 }))
    expect(r.businessReady).toBe(false)
    expect(r.operationReady).toBe(false)
  })

  it('operationReady=true requires both businessReady AND projectReady', () => {
    const r = computeReadiness('HIKARU', counts())
    expect(r.businessReady).toBe(true)
    expect(r.projectReady).toBe(true)
    expect(r.operationReady).toBe(true)
  })
})

// ============================================================
// 10. DETERMINISTIC — same input = same output
// ============================================================

describe('computeReadiness — deterministic', () => {
  it('returns identical result on repeated calls', () => {
    const c = counts()
    const r1 = computeReadiness('HIKARU', c)
    const r2 = computeReadiness('HIKARU', c)
    expect(r1).toEqual(r2)
  })
})

// ============================================================
// 11. HIGH COUNTS — still correct
// ============================================================

describe('computeReadiness — high counts', () => {
  it('handles large counts correctly', () => {
    const r = computeReadiness('BigCompany', counts({ clients: 10000, stores: 5000, employees: 500, projects: 200 }))
    expect(r.businessReady).toBe(true)
    expect(r.operationReady).toBe(true)
  })
})
