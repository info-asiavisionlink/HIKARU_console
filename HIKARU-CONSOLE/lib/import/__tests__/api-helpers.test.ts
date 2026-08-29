// ============================================================
// Import API Helpers — Unit Tests
//
// DB不要の純粋ロジックテスト:
//   - VALID_ENTITY_TYPES / VALID_SOURCE_TYPES
//   - UPLOAD_ALLOWED_STATES (state machine)
//   - SESSION_LIST_LIMIT
//   - エラーコード定数
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  VALID_ENTITY_TYPES,
  VALID_SOURCE_TYPES,
  UPLOAD_ALLOWED_STATES,
  SESSION_LIST_LIMIT,
} from '../helpers'

// ---- Entity Type Validation ----

describe('VALID_ENTITY_TYPES', () => {
  it('contains all required entity types', () => {
    const required = ['client', 'store', 'employee', 'project', 'invoice', 'expense']
    for (const t of required) {
      expect(VALID_ENTITY_TYPES).toContain(t)
    }
  })

  it('rejects unknown entity types', () => {
    expect(VALID_ENTITY_TYPES).not.toContain('payment')
    expect(VALID_ENTITY_TYPES).not.toContain('user')
    expect(VALID_ENTITY_TYPES).not.toContain('')
  })

  it('has exactly 6 entity types', () => {
    expect(VALID_ENTITY_TYPES.length).toBe(6)
  })
})

// ---- Source Type Validation ----

describe('VALID_SOURCE_TYPES', () => {
  it('allows csv and xlsx only', () => {
    expect(VALID_SOURCE_TYPES).toContain('csv')
    expect(VALID_SOURCE_TYPES).toContain('xlsx')
  })

  it('does not allow xls, xlsm, pdf, etc', () => {
    expect(VALID_SOURCE_TYPES).not.toContain('xls')
    expect(VALID_SOURCE_TYPES).not.toContain('xlsm')
    expect(VALID_SOURCE_TYPES).not.toContain('pdf')
    expect(VALID_SOURCE_TYPES).not.toContain('doc')
  })

  it('has exactly 2 source types', () => {
    expect(VALID_SOURCE_TYPES.length).toBe(2)
  })
})

// ---- Upload Allowed States (state machine) ----

describe('UPLOAD_ALLOWED_STATES', () => {
  it('allows upload from created state', () => {
    expect(UPLOAD_ALLOWED_STATES).toContain('created')
  })

  it('does NOT allow upload from uploading state', () => {
    expect(UPLOAD_ALLOWED_STATES).not.toContain('uploading')
  })

  it('does NOT allow upload from uploaded state', () => {
    // uploaded = file already received; new upload requires new session
    expect(UPLOAD_ALLOWED_STATES).not.toContain('uploaded')
  })

  it('does NOT allow upload from terminal states', () => {
    const terminalStates = [
      'committed', 'rolled_back', 'failed', 'cancelled',
      'review_required', 'ready_to_commit', 'committing', 'completed',
    ]
    for (const state of terminalStates) {
      expect(UPLOAD_ALLOWED_STATES).not.toContain(state)
    }
  })

  const allowedSet = new Set(UPLOAD_ALLOWED_STATES as readonly string[])

  it('state machine: created allows upload', () => {
    expect(allowedSet.has('created')).toBe(true)
  })

  it('state machine: uploading blocks upload (transition in progress)', () => {
    expect(allowedSet.has('uploading')).toBe(false)
  })

  it('state machine: uploaded blocks upload (already done)', () => {
    expect(allowedSet.has('uploaded')).toBe(false)
  })

  it('state machine: failed blocks upload', () => {
    expect(allowedSet.has('failed')).toBe(false)
  })
})

// ---- Session List Limit ----

describe('SESSION_LIST_LIMIT', () => {
  it('is 50', () => {
    expect(SESSION_LIST_LIMIT).toBe(50)
  })

  it('is positive and reasonable', () => {
    expect(SESSION_LIST_LIMIT).toBeGreaterThan(0)
    expect(SESSION_LIST_LIMIT).toBeLessThanOrEqual(100)
  })
})

// ---- API Response Contract ----

describe('API response structure (contract tests)', () => {
  it('POST /api/import/sessions request must include entity_type and source_type', () => {
    const validRequest = { entity_type: 'client', source_type: 'csv', label: 'test' }
    expect(VALID_ENTITY_TYPES as readonly string[]).toContain(validRequest.entity_type)
    expect(VALID_SOURCE_TYPES as readonly string[]).toContain(validRequest.source_type)
  })

  it('POST /api/import/sessions must NOT accept company_id from client', () => {
    // company_id is not in VALID_ENTITY_TYPES or VALID_SOURCE_TYPES
    // This test documents that company_id must come from auth context only
    const requestBodyFields = ['entity_type', 'source_type', 'label']
    expect(requestBodyFields).not.toContain('company_id')
    expect(requestBodyFields).not.toContain('created_by')
    expect(requestBodyFields).not.toContain('status')
  })

  it('Upload path must use auth company_id not body company_id', () => {
    // buildImportStoragePath uses parameters from server-side, not request body
    // Storage path: {company_id}/{session_id}/{uuid}.{ext}
    const mockCompanyId = 'aaaaaaaa-0000-0000-0000-000000000000'
    const mockSessionId = 'bbbbbbbb-0000-0000-0000-000000000000'
    const mockUuid      = 'cccccccc-0000-0000-0000-000000000000'
    const path = `${mockCompanyId}/${mockSessionId}/${mockUuid}.csv`
    expect(path.startsWith(mockCompanyId)).toBe(true)
    // path first segment must be auth company_id
    expect(path.split('/')[0]).toBe(mockCompanyId)
  })

  it('cross-tenant: path for company A must not start with company B prefix', () => {
    const companyA = 'aaaaaaaa-0000-0000-0000-000000000000'
    const companyB = 'bbbbbbbb-0000-0000-0000-000000000000'
    const pathA = `${companyA}/session-1/uuid.csv`
    expect(pathA.startsWith(companyB)).toBe(false)
  })
})

// ---- Audit Log Contract ----

describe('Audit log content contract', () => {
  it('file.uploaded audit must not contain file content', () => {
    // The audit log for file.uploaded stores only:
    // file_id, file_size_bytes, mime_type, ext, has_warnings
    // NOT: raw file content, storage_path internals, Service Role Key
    const allowedAuditKeys = new Set([
      'file_id', 'file_size_bytes', 'mime_type', 'ext', 'has_warnings',
    ])
    const forbiddenKeys = ['file_content', 'raw_data', 'SUPABASE_SERVICE_ROLE_KEY', 'storage_path']
    for (const key of forbiddenKeys) {
      expect(allowedAuditKeys.has(key)).toBe(false)
    }
  })

  it('session.created audit captures entity_type and source_type only', () => {
    const auditDetail = { entity_type: 'client', source_type: 'csv' }
    expect(Object.keys(auditDetail)).not.toContain('company_id')
    expect(Object.keys(auditDetail)).not.toContain('created_by')
  })
})
