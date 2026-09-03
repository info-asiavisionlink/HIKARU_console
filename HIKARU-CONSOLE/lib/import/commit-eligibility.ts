// ============================================================
// HIKARU Import — Client Commit Eligibility (pure)
//
// UI ("登録する" button enable/disable) と API pre-check の双方で
// 使う純粋関数。
//
// Source of Truth はあくまで RPC 側 (commit_client_import_session)。
// この関数は UX と API 400 応答の早期返却用の gate。
// ============================================================

export interface CommitEligibilityInput {
  /** import_sessions.status */
  sessionStatus: string
  /** import_sessions.entity_type */
  entityType: string
  /** review summary からの pending row count (=total - reviewed) */
  pendingRows: number
  /** review summary からの pending duplicate candidate count */
  pendingCandidates: number
  /** review summary からの total row count */
  totalRows: number
  /** review summary からの invalid row count (validation_status='invalid') */
  invalidRows: number
}

export type CommitBlockedReason =
  | 'NOT_CLIENT_ENTITY'
  | 'INVALID_SESSION_STATUS'
  | 'PENDING_ROWS_REMAIN'
  | 'PENDING_CANDIDATES_REMAIN'
  | 'EMPTY_SESSION'

export interface CommitEligibilityResult {
  canCommit: boolean
  reason: CommitBlockedReason | null
}

const ALLOWED_STATUSES = new Set(['review_required', 'ready_to_commit'])

export function evaluateCommitEligibility(
  input: CommitEligibilityInput,
): CommitEligibilityResult {
  if (input.entityType !== 'client') {
    return { canCommit: false, reason: 'NOT_CLIENT_ENTITY' }
  }
  if (!ALLOWED_STATUSES.has(input.sessionStatus)) {
    return { canCommit: false, reason: 'INVALID_SESSION_STATUS' }
  }
  if (input.totalRows <= 0) {
    return { canCommit: false, reason: 'EMPTY_SESSION' }
  }
  if (input.pendingRows > 0) {
    return { canCommit: false, reason: 'PENDING_ROWS_REMAIN' }
  }
  if (input.pendingCandidates > 0) {
    return { canCommit: false, reason: 'PENDING_CANDIDATES_REMAIN' }
  }
  // invalidRows は「未 approve のまま残っていても OK (=pending or skipped 扱い)」。
  // approved かつ invalid は RPC 側で defense in depth として拒否する。
  return { canCommit: true, reason: null }
}
