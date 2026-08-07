// 単発・定期案件のステータス定義
export const SPOT_RECURRING_STATUSES = [
  { value: 'scheduled_confirmed',           label: '作業予定確定',     variant: 'info' },
  { value: 'scheduled_unconfirmed',         label: '作業予定未確定',   variant: 'warning' },
  { value: 'active',                        label: '稼働中',           variant: 'success' },
  { value: 'reclean_requested',             label: '再清掃依頼',       variant: 'destructive' },
  { value: 'billing_pending',               label: '入金待ち',         variant: 'warning' },
  { value: 'completed',                     label: '入金完了',         variant: 'secondary' },
  { value: 'reclean_scheduled_confirmed',   label: '再清掃予定確定',   variant: 'info' },
  { value: 'reclean_scheduled_unconfirmed', label: '再清掃予定未確定', variant: 'warning' },
] as const

export type SpotRecurringStatus = typeof SPOT_RECURRING_STATUSES[number]['value']

export const srStatusLabel: Record<string, string> = Object.fromEntries(
  SPOT_RECURRING_STATUSES.map(s => [s.value, s.label])
)

export const srStatusVariant: Record<string, string> = Object.fromEntries(
  SPOT_RECURRING_STATUSES.map(s => [s.value, s.variant])
)
