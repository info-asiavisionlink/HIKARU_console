// ============================================================
// HIKARU Universal Import — Project Status Dictionary (Phase U1)
//
// Canonical values (Source of Truth):
//   Migration 057 line: v_status NOT IN (
//     'active', 'paused', 'completed', 'cancelled',
//     'scheduled_confirmed', 'scheduled_unconfirmed',
//     'reclean_requested', 'billing_pending',
//     'reclean_scheduled_confirmed', 'reclean_scheduled_unconfirmed'
//   )
//   Migration 049 ENUM: public.project_status
//
// 判断原則:
//   - 完全一致 (NFKC + trim + lowercase) のみ
//   - 業務固有 status (scheduled_confirmed / reclean_* 等) は 英字 canonical
//     または明確な日本語ラベル (「予定 確定」等) のみ許容、曖昧回避
// ============================================================

export const PROJECT_STATUS_CANONICAL = [
  'active',
  'paused',
  'completed',
  'cancelled',
  'scheduled_confirmed',
  'scheduled_unconfirmed',
  'reclean_requested',
  'billing_pending',
  'reclean_scheduled_confirmed',
  'reclean_scheduled_unconfirmed',
] as const
export type ProjectStatusCanonical = typeof PROJECT_STATUS_CANONICAL[number]

function normKey(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase()
}

const RAW: ReadonlyArray<[string, ProjectStatusCanonical]> = [
  // active
  ['active',                 'active'],
  ['稼働中',                 'active'],
  ['進行中',                 'active'],
  ['アクティブ',             'active'],

  // paused
  ['paused',                 'paused'],
  ['一時停止',               'paused'],
  ['停止中',                 'paused'],
  ['ポーズ',                 'paused'],

  // completed
  ['completed',              'completed'],
  ['完了',                   'completed'],
  ['終了',                   'completed'],

  // cancelled
  ['cancelled',              'cancelled'],
  ['canceled',               'cancelled'],
  ['キャンセル',             'cancelled'],
  ['中止',                   'cancelled'],

  // scheduled_confirmed / unconfirmed (業務語彙が特殊なので英字 + 明確日本語のみ)
  ['scheduled_confirmed',    'scheduled_confirmed'],
  ['予定 確定',              'scheduled_confirmed'],
  ['予定確定',               'scheduled_confirmed'],
  ['scheduled_unconfirmed',  'scheduled_unconfirmed'],
  ['予定 未確定',            'scheduled_unconfirmed'],
  ['予定未確定',             'scheduled_unconfirmed'],

  // reclean_requested / billing_pending
  ['reclean_requested',      'reclean_requested'],
  ['再清掃 要',              'reclean_requested'],
  ['再清掃要請',             'reclean_requested'],
  ['billing_pending',        'billing_pending'],
  ['請求 保留',              'billing_pending'],
  ['請求保留',               'billing_pending'],

  // reclean_scheduled_confirmed / unconfirmed
  ['reclean_scheduled_confirmed',    'reclean_scheduled_confirmed'],
  ['再清掃 予定 確定',                'reclean_scheduled_confirmed'],
  ['再清掃予定確定',                  'reclean_scheduled_confirmed'],
  ['reclean_scheduled_unconfirmed',  'reclean_scheduled_unconfirmed'],
  ['再清掃 予定 未確定',              'reclean_scheduled_unconfirmed'],
  ['再清掃予定未確定',                'reclean_scheduled_unconfirmed'],
]

const LOOKUP: ReadonlyMap<string, ProjectStatusCanonical> = (() => {
  const m = new Map<string, ProjectStatusCanonical>()
  for (const [k, v] of RAW) {
    const nk = normKey(k)
    if (!m.has(nk)) m.set(nk, v)
  }
  return m
})()

export function normalizeProjectStatus(raw: string | null | undefined): ProjectStatusCanonical | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const key = normKey(raw)
  if (key.length === 0) return null
  return LOOKUP.get(key) ?? null
}
