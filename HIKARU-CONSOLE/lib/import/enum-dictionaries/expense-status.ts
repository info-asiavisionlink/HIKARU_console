// ============================================================
// HIKARU Universal Import — Expense Status Dictionary (Phase U1)
//
// Canonical values (Source of Truth):
//   Migration 058 line: v_status NOT IN ('draft', 'submitted', 'approved', 'rejected', 'settled', 'withdrawn')
//
// 目的:
//   実世界の日本語 status 表記を canonical enum 値へ決定的に変換。
//
// 判断原則:
//   - 完全一致 (NFKC + trim + lowercase) のみ
//   - 曖昧 (「保留」→ どの status?) は null で reject
// ============================================================

export const EXPENSE_STATUS_CANONICAL = ['draft', 'submitted', 'approved', 'rejected', 'settled', 'withdrawn'] as const
export type ExpenseStatusCanonical = typeof EXPENSE_STATUS_CANONICAL[number]

function normKey(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase()
}

const RAW: ReadonlyArray<[string, ExpenseStatusCanonical]> = [
  // draft (下書き)
  ['draft',       'draft'],
  ['下書き',      'draft'],
  ['下書',        'draft'],
  ['未申請',      'draft'],

  // submitted (申請済み)
  ['submitted',   'submitted'],
  ['申請済',      'submitted'],
  ['申請済み',    'submitted'],
  ['申請中',      'submitted'],
  ['提出済',      'submitted'],
  ['提出済み',    'submitted'],

  // approved (承認済み)
  ['approved',    'approved'],
  ['承認済',      'approved'],
  ['承認済み',    'approved'],
  ['承認',        'approved'],

  // rejected (却下)
  ['rejected',    'rejected'],
  ['却下',        'rejected'],
  ['却下済',      'rejected'],
  ['差戻',        'rejected'],
  ['差し戻し',    'rejected'],

  // settled (精算済み)
  ['settled',     'settled'],
  ['精算済',      'settled'],
  ['精算済み',    'settled'],
  ['精算',        'settled'],

  // withdrawn (取下げ)
  ['withdrawn',   'withdrawn'],
  ['取下',        'withdrawn'],
  ['取下げ',      'withdrawn'],
  ['取り下げ',    'withdrawn'],
  ['取り下げ済', 'withdrawn'],
]

const LOOKUP: ReadonlyMap<string, ExpenseStatusCanonical> = (() => {
  const m = new Map<string, ExpenseStatusCanonical>()
  for (const [k, v] of RAW) {
    const nk = normKey(k)
    if (!m.has(nk)) m.set(nk, v)
  }
  return m
})()

export function normalizeExpenseStatus(raw: string | null | undefined): ExpenseStatusCanonical | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const key = normKey(raw)
  if (key.length === 0) return null
  return LOOKUP.get(key) ?? null
}
