// ============================================================
// HIKARU Universal Import — Project Type Dictionary (Phase U1)
//
// Canonical values (Source of Truth):
//   Migration 057 line: v_project_type NOT IN ('spot', 'recurring', 'hotel')
//   Migration 049 ENUM: public.project_type
// ============================================================

export const PROJECT_TYPE_CANONICAL = ['spot', 'recurring', 'hotel'] as const
export type ProjectTypeCanonical = typeof PROJECT_TYPE_CANONICAL[number]

function normKey(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase()
}

const RAW: ReadonlyArray<[string, ProjectTypeCanonical]> = [
  // spot (単発案件)
  ['spot',       'spot'],
  ['スポット',    'spot'],
  ['単発',       'spot'],
  ['単発案件',   'spot'],

  // recurring (定期案件)
  ['recurring',  'recurring'],
  ['定期',       'recurring'],
  ['定期案件',   'recurring'],
  ['ルーチン',   'recurring'],

  // hotel (ホテル案件)
  ['hotel',      'hotel'],
  ['ホテル',     'hotel'],
  ['ホテル案件', 'hotel'],
]

const LOOKUP: ReadonlyMap<string, ProjectTypeCanonical> = (() => {
  const m = new Map<string, ProjectTypeCanonical>()
  for (const [k, v] of RAW) {
    const nk = normKey(k)
    if (!m.has(nk)) m.set(nk, v)
  }
  return m
})()

export function normalizeProjectType(raw: string | null | undefined): ProjectTypeCanonical | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const key = normKey(raw)
  if (key.length === 0) return null
  return LOOKUP.get(key) ?? null
}
