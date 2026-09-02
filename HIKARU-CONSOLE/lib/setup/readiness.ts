// ============================================================
// HIKARU Initial Setup — Readiness Computation
//
// Pure functions only. No DB access, no async, no AI.
// All readiness flags are derived from existing Business Data.
// No setup_completed column or dedicated setup table is used.
//
// Rules (from formal spec):
//   COMPANY_READY  : company.name valid (trim non-empty)
//   CLIENT_READY   : active clients >= 1
//   STORE_READY    : active stores >= 1
//   EMPLOYEE_READY : active employees >= 1
//   PROJECT_READY  : active projects >= 1
//
//   ACCOUNT_READY  : COMPANY_READY (auth + company_id guaranteed by getAuthContext)
//   BUSINESS_READY : ACCOUNT_READY && CLIENT_READY && EMPLOYEE_READY
//   OPERATION_READY: BUSINESS_READY && PROJECT_READY
//
// STORE_READY is intentionally NOT required for BUSINESS_READY or OPERATION_READY.
// Reason: projects.store_id is nullable (migration 008) — stores are optional for operations.
// ============================================================

// ---- Types ----

export interface SetupCounts {
  clients:   number
  stores:    number
  employees: number
  projects:  number
}

export interface SetupReadiness {
  companyReady:   boolean
  clientReady:    boolean
  storeReady:     boolean
  employeeReady:  boolean
  projectReady:   boolean
  accountReady:   boolean
  businessReady:  boolean
  operationReady: boolean
}

export interface SetupStatus {
  company: {
    name:  string | null
    ready: boolean
  }
  counts:    SetupCounts
  readiness: SetupReadiness
}

// ---- Pure Readiness Computation ----

export function computeReadiness(
  companyName: string | null | undefined,
  counts: SetupCounts,
): SetupReadiness {
  const companyReady  = typeof companyName === 'string' && companyName.trim().length > 0
  const clientReady   = counts.clients   >= 1
  const storeReady    = counts.stores    >= 1
  const employeeReady = counts.employees >= 1
  const projectReady  = counts.projects  >= 1

  // ACCOUNT_READY: company name valid.
  // Auth + company_id validity is guaranteed upstream by getAuthContext() returning non-null.
  const accountReady = companyReady

  // BUSINESS_READY: can start assigning work.
  // Stores are deliberately excluded — operations work without them.
  const businessReady = accountReady && clientReady && employeeReady

  // OPERATION_READY: at least one active project exists.
  const operationReady = businessReady && projectReady

  return {
    companyReady,
    clientReady,
    storeReady,
    employeeReady,
    projectReady,
    accountReady,
    businessReady,
    operationReady,
  }
}
