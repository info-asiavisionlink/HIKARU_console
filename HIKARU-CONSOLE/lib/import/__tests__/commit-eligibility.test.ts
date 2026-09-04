// ============================================================
// evaluateCommitEligibility — Client Bulk Import Commit Gate
//
// UI と API 双方で使う pure gate。RPC 側にも同等の防御があるため
// ここは "早期 400 応答 + UX button enable" を目的とする。
// ============================================================

import { describe, it, expect } from 'vitest'
import { evaluateCommitEligibility, SUPPORTED_COMMIT_ENTITIES } from '../commit-eligibility'

const base = {
  sessionStatus:     'review_required',
  entityType:        'client',
  pendingRows:       0,
  pendingCandidates: 0,
  totalRows:         10,
  invalidRows:       0,
}

describe('SUPPORTED_COMMIT_ENTITIES allowlist', () => {
  it('exactly matches expected set (client / store / employee only — project/expense/attendance/shift 未実装)', () => {
    // このリストは backend RPC (Migration 051/053/054) と Production 適用状態の Source of Truth。
    // 追加は必ず: Migration 適用 + POSTCHECK PASS + Real E2E PASS の 3 条件成立後のみ。
    expect([...SUPPORTED_COMMIT_ENTITIES].sort())
      .toEqual(['client', 'employee', 'store'])
  })

  it('does NOT include unimplemented entities', () => {
    for (const et of ['project', 'expense', 'attendance', 'shift', 'invoice']) {
      expect(SUPPORTED_COMMIT_ENTITIES).not.toContain(et)
    }
  })
})

describe('evaluateCommitEligibility — allow', () => {
  it('accepts fully-reviewed client session in review_required', () => {
    expect(evaluateCommitEligibility(base)).toEqual({ canCommit: true, reason: null })
  })

  it('accepts store session (Migration 053 適用済)', () => {
    expect(evaluateCommitEligibility({ ...base, entityType: 'store' }))
      .toEqual({ canCommit: true, reason: null })
  })

  it('accepts employee session (Migration 054 適用済)', () => {
    expect(evaluateCommitEligibility({ ...base, entityType: 'employee' }))
      .toEqual({ canCommit: true, reason: null })
  })

  it('accepts session already promoted to ready_to_commit', () => {
    expect(evaluateCommitEligibility({ ...base, sessionStatus: 'ready_to_commit' }))
      .toEqual({ canCommit: true, reason: null })
  })

  it('accepts session with invalid rows as long as they are not pending (user skipped or explicitly left them)', () => {
    // invalid rows は Review UI で明示的に SKIP 選択される想定
    // pendingRows=0 (=すべて approved/skipped) なら OK
    expect(evaluateCommitEligibility({ ...base, invalidRows: 3 }))
      .toEqual({ canCommit: true, reason: null })
  })
})

describe('evaluateCommitEligibility — reject', () => {
  it('rejects entity types not in SUPPORTED_COMMIT_ENTITIES allowlist', () => {
    // project / expense / attendance / shift はまだ Backend RPC 未実装。
    // invoice も未対応。すべて ENTITY_NOT_SUPPORTED として弾く。
    for (const et of ['project', 'invoice', 'expense', 'attendance', 'shift']) {
      expect(evaluateCommitEligibility({ ...base, entityType: et }))
        .toEqual({ canCommit: false, reason: 'ENTITY_NOT_SUPPORTED' })
    }
  })

  it('rejects session in non-committable status', () => {
    for (const st of ['created', 'uploading', 'uploaded', 'mapping', 'validating',
                      'committing', 'completed', 'failed', 'cancelled', 'rolled_back']) {
      expect(evaluateCommitEligibility({ ...base, sessionStatus: st }))
        .toEqual({ canCommit: false, reason: 'INVALID_SESSION_STATUS' })
    }
  })

  it('rejects when pending rows remain (unreviewed)', () => {
    expect(evaluateCommitEligibility({ ...base, pendingRows: 1 }))
      .toEqual({ canCommit: false, reason: 'PENDING_ROWS_REMAIN' })
  })

  it('rejects when pending duplicate candidates remain', () => {
    expect(evaluateCommitEligibility({ ...base, pendingCandidates: 1 }))
      .toEqual({ canCommit: false, reason: 'PENDING_CANDIDATES_REMAIN' })
  })

  it('rejects empty session (0 rows)', () => {
    expect(evaluateCommitEligibility({ ...base, totalRows: 0 }))
      .toEqual({ canCommit: false, reason: 'EMPTY_SESSION' })
  })
})

describe('evaluateCommitEligibility — precedence', () => {
  it('entity check precedes status check', () => {
    // unsupported entity + 無効 status → entity 側が先に検知される
    expect(evaluateCommitEligibility({
      ...base,
      entityType:    'project',
      sessionStatus: 'created',
    })).toEqual({ canCommit: false, reason: 'ENTITY_NOT_SUPPORTED' })
  })

  it('pending rows precedes pending candidates', () => {
    expect(evaluateCommitEligibility({
      ...base,
      pendingRows:       2,
      pendingCandidates: 3,
    })).toEqual({ canCommit: false, reason: 'PENDING_ROWS_REMAIN' })
  })
})
