// ============================================================
// HIKARU Universal Import — Expense Category Dictionary (Phase U1)
//
// Canonical values (Source of Truth):
//   Migration 058 line: v_category NOT IN ('transport', 'parking', 'supplies', 'consumables', 'other')
//
// 目的:
//   実世界で使われる日本語の費目名を Migration 058 の canonical enum 値へ
//   決定的に (deterministic) 変換する共通辞書。
//
// 判断原則:
//   - 完全一致 (NFKC + trim + lowercase) のみ mapping
//   - 曖昧な場合 (例: 「事務用品費」を supplies / consumables どちらに?) は
//     mapping せず reject → 上位で Review へ委ねる
//   - 意味重複 / 業務ルール依存の判断は本辞書に含めない
// ============================================================

export const EXPENSE_CATEGORY_CANONICAL = ['transport', 'parking', 'supplies', 'consumables', 'other'] as const
export type ExpenseCategoryCanonical = typeof EXPENSE_CATEGORY_CANONICAL[number]

/** normalize key: NFKC + trim + lowercase */
function normKey(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase()
}

// [source alias, canonical]
// canonical それ自体 (transport, parking...) も許容するため含める。
const RAW: ReadonlyArray<[string, ExpenseCategoryCanonical]> = [
  // transport
  ['transport',    'transport'],
  ['交通費',       'transport'],
  ['交通',         'transport'],
  ['旅費交通費',   'transport'],
  ['旅費',         'transport'],

  // parking
  ['parking',      'parking'],
  ['駐車場',       'parking'],
  ['駐車料',       'parking'],
  ['駐車代',       'parking'],
  ['駐車',         'parking'],

  // supplies (備品費、耐久性のある物品)
  ['supplies',     'supplies'],
  ['備品',         'supplies'],
  ['備品費',       'supplies'],

  // consumables (消耗品費、使い切り物品)
  ['consumables',  'consumables'],
  ['消耗品',       'consumables'],
  ['消耗品費',     'consumables'],

  // other
  ['other',        'other'],
  ['その他',       'other'],
  ['雑費',         'other'],
]

// Build normalized lookup (first-match-wins)
const LOOKUP: ReadonlyMap<string, ExpenseCategoryCanonical> = (() => {
  const m = new Map<string, ExpenseCategoryCanonical>()
  for (const [k, v] of RAW) {
    const nk = normKey(k)
    if (!m.has(nk)) m.set(nk, v)
  }
  return m
})()

/**
 * 実世界の入力を Migration 058 の canonical value に変換。
 * 曖昧・未知は null (Phase U1 では推測しない、reject し上位で Review 判断)。
 */
export function normalizeExpenseCategory(raw: string | null | undefined): ExpenseCategoryCanonical | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const key = normKey(raw)
  if (key.length === 0) return null
  return LOOKUP.get(key) ?? null
}
