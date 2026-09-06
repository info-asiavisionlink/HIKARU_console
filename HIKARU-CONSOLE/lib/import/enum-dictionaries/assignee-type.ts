// ============================================================
// HIKARU Universal Import — Assignee Type Dictionary (Phase U1)
//
// Canonical values (Source of Truth):
//   Migration 058 / 060 CHECK: v_assignee_type NOT IN ('employee', 'partner')
//   DB CHECK constraint: expenses / shifts の assignee_type
// ============================================================

export const ASSIGNEE_TYPE_CANONICAL = ['employee', 'partner'] as const
export type AssigneeTypeCanonical = typeof ASSIGNEE_TYPE_CANONICAL[number]

function normKey(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase()
}

const RAW: ReadonlyArray<[string, AssigneeTypeCanonical]> = [
  // employee (従業員)
  ['employee',   'employee'],
  ['従業員',     'employee'],
  ['社員',       'employee'],
  ['スタッフ',   'employee'],
  ['正社員',     'employee'],

  // partner (協力業者)
  ['partner',    'partner'],
  ['協力業者',   'partner'],
  ['協力会社',   'partner'],
  ['パートナー', 'partner'],
  ['外部業者',   'partner'],
  ['委託先',     'partner'],
]

const LOOKUP: ReadonlyMap<string, AssigneeTypeCanonical> = (() => {
  const m = new Map<string, AssigneeTypeCanonical>()
  for (const [k, v] of RAW) {
    const nk = normKey(k)
    if (!m.has(nk)) m.set(nk, v)
  }
  return m
})()

export function normalizeAssigneeType(raw: string | null | undefined): AssigneeTypeCanonical | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const key = normKey(raw)
  if (key.length === 0) return null
  return LOOKUP.get(key) ?? null
}
