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
  | 'ENTITY_NOT_SUPPORTED'
  | 'INVALID_SESSION_STATUS'
  | 'PENDING_ROWS_REMAIN'
  | 'PENDING_CANDIDATES_REMAIN'
  | 'EMPTY_SESSION'

export interface CommitEligibilityResult {
  canCommit: boolean
  reason: CommitBlockedReason | null
}

const ALLOWED_STATUSES = new Set(['review_required', 'ready_to_commit'])

/**
 * Backend commit RPC が実装済 + Production 適用済 の entity。
 * UI enable と Backend commit route の gate、共通の Source of Truth。
 * 新規 entity 対応時は必ずここに追加してから UI enable する。
 */
export const SUPPORTED_COMMIT_ENTITIES: readonly string[] = [
  'client',    // Migration 051 適用済 + Production POSTCHECK PASS
  'store',     // Migration 053 適用済 + Production POSTCHECK PASS (44/44)
  'employee',  // Migration 054 適用済 + Production POSTCHECK PASS (44/44)
  // 'project' — Batch 2 (backend 未実装)
  // 'expense' / 'attendance' / 'shift' — Batch 3 (backend 未実装)
] as const

export function evaluateCommitEligibility(
  input: CommitEligibilityInput,
): CommitEligibilityResult {
  if (!SUPPORTED_COMMIT_ENTITIES.includes(input.entityType)) {
    return { canCommit: false, reason: 'ENTITY_NOT_SUPPORTED' }
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
