// ============================================================
// HIKARU Import — Deterministic Duplicate Engine
//
// Design:
//   - No AI. No auto-merge. Zero OpenAI calls.
//   - Pure in-memory computation — no DB access in this module.
//   - Caller pre-loads existing records; this module matches them.
//
// Normalization (safe range only per spec):
//   - email:   trim + lowercase
//   - phone:   remove separators (- ( ) space 　)
//   - name:    NFC + trim + lowercase
//   - address: NFC + trim + lowercase + collapse whitespace
//
// Signals & base scores (0–1):
//   email_exact             0.95  very strong
//   phone_normalized        0.80  strong
//   name_address_normalized 0.85  strong
//   name_normalized         0.65  medium (client) | 0.60 (store)
//
// Combining: score = max(signal_scores) + 0.05 per extra signal, cap 1.0
// Threshold: 0.50 — below this, no candidate created.
//
// NOTE — SCHEMA GAP:
//   import_duplicate_candidates has no match_reasons column (migration 049).
//   match_reasons are returned in the API response but NOT persisted.
//   A future migration (050) must add match_reasons JSONB.
// ============================================================

// ---- Types ----

export type MatchReason =
  | 'email_exact'
  | 'phone_normalized'
  | 'name_address_normalized'
  | 'name_normalized'
  | 'employee_number_exact'
  | 'name_phone_normalized'

export interface ExistingClient {
  id:      string
  name:    string
  email:   string | null
  phone:   string | null
  address: string | null
}

export interface ExistingStore {
  id:        string
  name:      string
  phone:     string | null
  address:   string | null
  client_id: string
}

export interface ExistingEmployee {
  id:              string
  name:            string
  employee_number: string | null
  email:           string | null
  phone:           string | null
}

export interface StagedRowForDuplicate {
  id:          string
  mapped_data: Record<string, string | null> | null
}

export interface DuplicateMatch {
  stagingRowId:        string
  existingRecordId:    string
  existingRecordTable: 'clients' | 'stores' | 'employees'
  score:               number       // 0.0000–1.0000
  matchReasons:        MatchReason[]
}

// ---- Score Constants ----

const SCORE_EMAIL             = 0.95
const SCORE_PHONE             = 0.80
const SCORE_NAME_ADDRESS      = 0.85
const SCORE_NAME_CLIENT       = 0.65
const SCORE_NAME_STORE        = 0.60
const SCORE_EMPLOYEE_NUMBER   = 0.99  // UNIQUE constraint in DB (migration 011)
const SCORE_EMPLOYEE_EMAIL    = 0.90
const SCORE_NAME_PHONE        = 0.80
const SCORE_NAME_EMPLOYEE     = 0.55  // name-only は誤 match 高、慎重
const SCORE_THRESHOLD         = 0.50
const SCORE_EXTRA_SIGNAL_BONUS = 0.05
const SCORE_MAX               = 1.0

// ---- Normalization ----

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  return v.includes('@') && v.length >= 3 ? v : null
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Remove common separators: hyphen, parens, spaces (half/full-width)
  const cleaned = raw.replace(/[-\s()　]/g, '')
  return cleaned.length >= 10 ? cleaned : null
}

export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = raw.normalize('NFC').trim().toLowerCase()
  return v || null
}

export function normalizeAddress(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = raw.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
  return v || null
}

// ---- Score Computation ----

function computeScore(baseScores: number[]): number {
  if (baseScores.length === 0) return 0
  const max   = Math.max(...baseScores)
  const bonus = Math.min((baseScores.length - 1) * SCORE_EXTRA_SIGNAL_BONUS, 0.15)
  return Math.min(max + bonus, SCORE_MAX)
}

// ---- Client Lookup Structures ----

interface ClientLookups {
  byEmail:       Map<string, ExistingClient[]>
  byPhone:       Map<string, ExistingClient[]>
  byName:        Map<string, ExistingClient[]>
  byNameAddress: Map<string, ExistingClient[]>
}

function buildClientLookups(existing: ExistingClient[]): ClientLookups {
  const byEmail       = new Map<string, ExistingClient[]>()
  const byPhone       = new Map<string, ExistingClient[]>()
  const byName        = new Map<string, ExistingClient[]>()
  const byNameAddress = new Map<string, ExistingClient[]>()

  function push<V>(map: Map<string, V[]>, key: string | null, value: V) {
    if (!key) return
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(value)
  }

  for (const c of existing) {
    push(byEmail,       normalizeEmail(c.email),     c)
    push(byPhone,       normalizePhone(c.phone),     c)
    const nName = normalizeName(c.name)
    push(byName,        nName,                        c)
    const nAddr = normalizeAddress(c.address)
    if (nName && nAddr) push(byNameAddress, `${nName}|${nAddr}`, c)
  }

  return { byEmail, byPhone, byName, byNameAddress }
}

// ---- Store Lookup Structures ----

interface StoreLookups {
  byPhone:       Map<string, ExistingStore[]>
  byName:        Map<string, ExistingStore[]>
  byNameAddress: Map<string, ExistingStore[]>
}

function buildStoreLookups(existing: ExistingStore[]): StoreLookups {
  const byPhone       = new Map<string, ExistingStore[]>()
  const byName        = new Map<string, ExistingStore[]>()
  const byNameAddress = new Map<string, ExistingStore[]>()

  function push<V>(map: Map<string, V[]>, key: string | null, value: V) {
    if (!key) return
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(value)
  }

  for (const s of existing) {
    push(byPhone,       normalizePhone(s.phone),   s)
    const nName = normalizeName(s.name)
    push(byName,        nName,                      s)
    const nAddr = normalizeAddress(s.address)
    if (nName && nAddr) push(byNameAddress, `${nName}|${nAddr}`, s)
  }

  return { byPhone, byName, byNameAddress }
}

// ---- Client Duplicate Detection ----

function scanClientRow(
  row: StagedRowForDuplicate,
  lookups: ClientLookups,
): DuplicateMatch[] {
  const mapped = row.mapped_data
  if (!mapped) return []

  const nEmail   = normalizeEmail(mapped['email'])
  const nPhone   = normalizePhone(mapped['phone'])
  const nName    = normalizeName(mapped['name'])
  const nAddress = normalizeAddress(mapped['address'])

  // Per candidate: collect triggered signals
  const signals = new Map<string, { reasons: MatchReason[]; scores: number[] }>()

  function addSignal(id: string, reason: MatchReason, score: number) {
    if (!signals.has(id)) signals.set(id, { reasons: [], scores: [] })
    const s = signals.get(id)!
    if (!s.reasons.includes(reason)) {
      s.reasons.push(reason)
      s.scores.push(score)
    }
  }

  if (nEmail) {
    for (const c of (lookups.byEmail.get(nEmail) ?? [])) {
      addSignal(c.id, 'email_exact', SCORE_EMAIL)
    }
  }

  if (nPhone) {
    for (const c of (lookups.byPhone.get(nPhone) ?? [])) {
      addSignal(c.id, 'phone_normalized', SCORE_PHONE)
    }
  }

  if (nName && nAddress) {
    const key = `${nName}|${nAddress}`
    for (const c of (lookups.byNameAddress.get(key) ?? [])) {
      addSignal(c.id, 'name_address_normalized', SCORE_NAME_ADDRESS)
    }
  }

  if (nName) {
    for (const c of (lookups.byName.get(nName) ?? [])) {
      // Only add name_normalized if name_address_normalized not already triggered for this candidate
      const existing = signals.get(c.id)
      if (!existing?.reasons.includes('name_address_normalized')) {
        addSignal(c.id, 'name_normalized', SCORE_NAME_CLIENT)
      }
    }
  }

  const results: DuplicateMatch[] = []
  for (const [existingId, { reasons, scores }] of signals) {
    const score = computeScore(scores)
    if (score >= SCORE_THRESHOLD) {
      results.push({
        stagingRowId:        row.id,
        existingRecordId:    existingId,
        existingRecordTable: 'clients',
        score: Math.round(score * 10000) / 10000, // 4 decimal places for NUMERIC(5,4)
        matchReasons:        reasons,
      })
    }
  }

  return results
}

// ---- Store Duplicate Detection ----

function scanStoreRow(
  row: StagedRowForDuplicate,
  lookups: StoreLookups,
): DuplicateMatch[] {
  const mapped = row.mapped_data
  if (!mapped) return []

  const nPhone   = normalizePhone(mapped['phone'])
  const nName    = normalizeName(mapped['name'])
  const nAddress = normalizeAddress(mapped['address'])

  const signals = new Map<string, { reasons: MatchReason[]; scores: number[] }>()

  function addSignal(id: string, reason: MatchReason, score: number) {
    if (!signals.has(id)) signals.set(id, { reasons: [], scores: [] })
    const s = signals.get(id)!
    if (!s.reasons.includes(reason)) {
      s.reasons.push(reason)
      s.scores.push(score)
    }
  }

  if (nPhone) {
    for (const s of (lookups.byPhone.get(nPhone) ?? [])) {
      addSignal(s.id, 'phone_normalized', SCORE_PHONE)
    }
  }

  if (nName && nAddress) {
    const key = `${nName}|${nAddress}`
    for (const s of (lookups.byNameAddress.get(key) ?? [])) {
      addSignal(s.id, 'name_address_normalized', SCORE_NAME_ADDRESS)
    }
  }

  if (nName) {
    for (const s of (lookups.byName.get(nName) ?? [])) {
      const existing = signals.get(s.id)
      if (!existing?.reasons.includes('name_address_normalized')) {
        addSignal(s.id, 'name_normalized', SCORE_NAME_STORE)
      }
    }
  }

  const results: DuplicateMatch[] = []
  for (const [existingId, { reasons, scores }] of signals) {
    const score = computeScore(scores)
    if (score >= SCORE_THRESHOLD) {
      results.push({
        stagingRowId:        row.id,
        existingRecordId:    existingId,
        existingRecordTable: 'stores',
        score: Math.round(score * 10000) / 10000,
        matchReasons:        reasons,
      })
    }
  }

  return results
}

// ---- Public API ----

export function detectClientDuplicates(
  stagingRows: StagedRowForDuplicate[],
  existingClients: ExistingClient[],
): DuplicateMatch[] {
  const lookups = buildClientLookups(existingClients)
  const all: DuplicateMatch[] = []
  for (const row of stagingRows) {
    all.push(...scanClientRow(row, lookups))
  }
  return all
}

export function detectStoreDuplicates(
  stagingRows: StagedRowForDuplicate[],
  existingStores: ExistingStore[],
): DuplicateMatch[] {
  const lookups = buildStoreLookups(existingStores)
  const all: DuplicateMatch[] = []
  for (const row of stagingRows) {
    all.push(...scanStoreRow(row, lookups))
  }
  return all
}

// ---- Employee Detection ----
// 判定基準 (優先度順):
//   1. employee_number 完全一致 (UNIQUE) → 最強 signal
//   2. email 完全一致 (case-insensitive)
//   3. name + phone 一致 (両方存在時)
//   4. name 単独一致 (誤 match 高、低 score)

interface EmployeeLookups {
  byEmployeeNumber: Map<string, ExistingEmployee[]>
  byEmail:          Map<string, ExistingEmployee[]>
  byNamePhone:      Map<string, ExistingEmployee[]>
  byName:           Map<string, ExistingEmployee[]>
}

function normalizeEmployeeNumber(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  return s.length > 0 ? s : null
}

function buildEmployeeLookups(existing: ExistingEmployee[]): EmployeeLookups {
  const byEmployeeNumber = new Map<string, ExistingEmployee[]>()
  const byEmail          = new Map<string, ExistingEmployee[]>()
  const byNamePhone      = new Map<string, ExistingEmployee[]>()
  const byName           = new Map<string, ExistingEmployee[]>()

  for (const e of existing) {
    const en = normalizeEmployeeNumber(e.employee_number)
    if (en) {
      const b = byEmployeeNumber.get(en) ?? []
      b.push(e); byEmployeeNumber.set(en, b)
    }
    const ne = normalizeEmail(e.email)
    if (ne) {
      const b = byEmail.get(ne) ?? []
      b.push(e); byEmail.set(ne, b)
    }
    const nn = normalizeName(e.name)
    const np = normalizePhone(e.phone)
    if (nn && np) {
      const key = `${nn}|${np}`
      const b = byNamePhone.get(key) ?? []
      b.push(e); byNamePhone.set(key, b)
    }
    if (nn) {
      const b = byName.get(nn) ?? []
      b.push(e); byName.set(nn, b)
    }
  }
  return { byEmployeeNumber, byEmail, byNamePhone, byName }
}

function scanEmployeeRow(row: StagedRowForDuplicate, lookups: EmployeeLookups): DuplicateMatch[] {
  const mapped = row.mapped_data
  if (!mapped) return []

  const signals = new Map<string, { reasons: MatchReason[]; scores: number[] }>()
  const addSignal = (id: string, reason: MatchReason, score: number) => {
    const existing = signals.get(id) ?? { reasons: [], scores: [] }
    if (!existing.reasons.includes(reason)) {
      existing.reasons.push(reason)
      existing.scores.push(score)
      signals.set(id, existing)
    }
  }

  // (1) employee_number exact
  const en = normalizeEmployeeNumber(mapped['employee_number'])
  if (en) {
    for (const e of (lookups.byEmployeeNumber.get(en) ?? [])) {
      addSignal(e.id, 'employee_number_exact', SCORE_EMPLOYEE_NUMBER)
    }
  }

  // (2) email exact
  const ne = normalizeEmail(mapped['email'])
  if (ne) {
    for (const e of (lookups.byEmail.get(ne) ?? [])) {
      addSignal(e.id, 'email_exact', SCORE_EMPLOYEE_EMAIL)
    }
  }

  // (3) name + phone
  const nn = normalizeName(mapped['name'])
  const np = normalizePhone(mapped['phone'])
  if (nn && np) {
    const key = `${nn}|${np}`
    for (const e of (lookups.byNamePhone.get(key) ?? [])) {
      addSignal(e.id, 'name_phone_normalized', SCORE_NAME_PHONE)
    }
  }

  // (4) name-only (低 score、name+phone 既マッチ record は除外して二重加算防ぐ)
  if (nn) {
    for (const e of (lookups.byName.get(nn) ?? [])) {
      const existing = signals.get(e.id)
      if (!existing?.reasons.includes('name_phone_normalized')) {
        addSignal(e.id, 'name_normalized', SCORE_NAME_EMPLOYEE)
      }
    }
  }

  const results: DuplicateMatch[] = []
  for (const [existingId, { reasons, scores }] of signals) {
    const score = computeScore(scores)
    if (score >= SCORE_THRESHOLD) {
      results.push({
        stagingRowId:        row.id,
        existingRecordId:    existingId,
        existingRecordTable: 'employees',
        score: Math.round(score * 10000) / 10000,
        matchReasons:        reasons,
      })
    }
  }
  return results
}

export function detectEmployeeDuplicates(
  stagingRows: StagedRowForDuplicate[],
  existingEmployees: ExistingEmployee[],
): DuplicateMatch[] {
  const lookups = buildEmployeeLookups(existingEmployees)
  const all: DuplicateMatch[] = []
  for (const row of stagingRows) {
    all.push(...scanEmployeeRow(row, lookups))
  }
  return all
}

export { SCORE_THRESHOLD }
