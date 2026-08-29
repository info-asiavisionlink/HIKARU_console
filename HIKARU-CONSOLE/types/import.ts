// ============================================================
// HIKARU Import Foundation — TypeScript Types
// ============================================================

export type ImportSessionStatus =
  | 'created'
  | 'uploading'
  | 'uploaded'
  | 'scanning'
  | 'extracting'
  | 'mapping'
  | 'validating'
  | 'review_required'
  | 'ready_to_commit'
  | 'committing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rolled_back'

export type ImportSourceType = 'csv' | 'xlsx'

export type ImportEntityType =
  | 'client'
  | 'store'
  | 'employee'
  | 'project'
  | 'invoice'
  | 'expense'

export type ImportValidationStatus = 'pending' | 'valid' | 'invalid' | 'warning'

export type ImportReviewStatus = 'pending' | 'approved' | 'rejected' | 'skipped'

export type ImportCommitAction = 'insert' | 'update' | 'skip' | 'merge'

// ---- File Validation Result ----

export interface ImportFileValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  rowCount?: number
  formulaRisks?: FormulaRiskResult[]
}

export interface FormulaRiskResult {
  rowIndex: number
  columnKey: string
  value: string
}

// ---- DB Row Types ----

export interface ImportSession {
  id: string
  company_id: string
  created_by: string
  status: ImportSessionStatus
  entity_type: ImportEntityType
  source_type: ImportSourceType
  label: string | null
  total_rows: number | null
  valid_rows: number | null
  invalid_rows: number | null
  duplicate_rows: number | null
  error_message: string | null
  scan_status: string  // MVP: always 'not_required'
  created_at: string
  updated_at: string
}

export interface ImportFile {
  id: string
  session_id: string
  company_id: string
  original_filename: string
  storage_path: string
  mime_type: string
  file_size_bytes: number
  row_count: number | null
  validation_status: ImportValidationStatus
  validation_errors: unknown
  created_at: string
}

export interface ImportStagingRow {
  id: string
  session_id: string
  file_id: string
  company_id: string
  row_index: number
  raw_data: Record<string, string>            // key=original header, value=original cell string
  normalized_data: Record<string, string | null>  // key=normalized header, value=normalized string
  mapped_data: Record<string, unknown> | null     // key=canonical field name
  validation_status: ImportValidationStatus
  validation_errors: unknown
  review_status: ImportReviewStatus
  created_at: string
  updated_at: string
}

export interface ImportDuplicateCandidate {
  id: string
  session_id: string
  company_id: string
  staging_row_id: string
  existing_record_id: string
  existing_record_table: string
  similarity_score: number | null
  review_status: ImportReviewStatus
  resolved_action: ImportCommitAction | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

export interface ImportAuditLog {
  id: string
  session_id: string
  company_id: string
  actor_id: string
  action: string
  detail: Record<string, unknown> | null
  created_at: string
}

export interface ImportRollbackSnapshot {
  id: string
  session_id: string
  company_id: string
  target_table: string
  record_id: string
  snapshot_data: Record<string, unknown>
  created_at: string
}

export interface ImportCommitRecord {
  id: string
  session_id: string
  company_id: string
  committed_by: string
  committed_at: string
  total_inserted: number
  total_updated: number
  total_skipped: number
  rollback_available: boolean
  created_at: string
}

// ---- Storage Path Helpers ----

export interface ImportStoragePath {
  bucket: 'hikaru-imports'
  path: string   // {company_id}/{session_id}/{uuid}.{ext}
  companyId: string
  sessionId: string
  filename: string
}

// ---- Audit Action Constants ----

export const IMPORT_AUDIT_ACTIONS = {
  SESSION_CREATED:   'session.created',
  FILE_UPLOADED:     'file.uploaded',
  FILE_VALIDATED:    'file.validated',
  STAGING_COMPLETED: 'staging.completed',
  REVIEW_APPROVED:   'review.approved',
  REVIEW_REJECTED:   'review.rejected',
  COMMIT_APPLIED:    'commit.applied',
  ROLLBACK_APPLIED:  'rollback.applied',
  SESSION_FAILED:    'session.failed',
} as const

export type ImportAuditAction = typeof IMPORT_AUDIT_ACTIONS[keyof typeof IMPORT_AUDIT_ACTIONS]
