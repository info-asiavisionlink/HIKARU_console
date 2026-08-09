// ============================================================
// 契約管理 サービス・ユーティリティ
// ============================================================

export type ContractStatus = 'draft' | 'sent' | 'reviewing' | 'signed' | 'active' | 'expired' | 'terminated'
export type ContractType   = 'service' | 'subcontract' | 'nda' | 'other'
export type CounterpartyType = 'client' | 'partner'
export type SignProvider   = 'manual' | 'cloudsign' | 'docusign' | 'other'

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft:      '下書き',
  sent:       '送付済み',
  reviewing:  '確認中',
  signed:     '締結済み',
  active:     '有効',
  expired:    '期限切れ',
  terminated: '解約',
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  service:    '清掃業務委託契約',
  subcontract:'業務委託・協力会社契約',
  nda:        '秘密保持契約',
  other:      'その他',
}

export const COUNTERPARTY_LABELS: Record<CounterpartyType, string> = {
  client:  '顧客',
  partner: '協力業者',
}

export const SIGN_PROVIDER_LABELS: Record<SignProvider, string> = {
  manual:    '手動（自社管理）',
  cloudsign: 'CloudSign',
  docusign:  'DocuSign',
  other:     'その他',
}

// 期限アラート区分
export type DeadlineUrgency = 'expired' | 'critical' | 'warning' | 'caution' | 'normal' | 'none'

export interface DeadlineInfo {
  daysUntilExpiry: number | null
  urgency: DeadlineUrgency
  label: string
}

export function calculateDeadlineInfo(endDate: string | null | undefined): DeadlineInfo {
  if (!endDate) return { daysUntilExpiry: null, urgency: 'none', label: '期限なし' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  const diff = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  let urgency: DeadlineUrgency
  let label: string

  if (diff < 0) {
    urgency = 'expired'
    label   = `${Math.abs(diff)}日超過`
  } else if (diff === 0) {
    urgency = 'critical'
    label   = '本日期限'
  } else if (diff <= 6) {
    urgency = 'critical'
    label   = `${diff}日後`
  } else if (diff <= 29) {
    urgency = 'warning'
    label   = `${diff}日後`
  } else if (diff <= 89) {
    urgency = 'caution'
    label   = `${diff}日後`
  } else {
    urgency = 'normal'
    label   = `${diff}日後`
  }

  return { daysUntilExpiry: diff, urgency, label }
}

export const URGENCY_CONFIG: Record<DeadlineUrgency, {
  label: string; textColor: string; bgColor: string; borderColor: string
}> = {
  expired:  { label: '期限切れ', textColor: 'oklch(0.65 0.25 27)', bgColor: 'oklch(0.65 0.25 27 / 0.15)', borderColor: 'oklch(0.65 0.25 27 / 0.4)' },
  critical: { label: '緊急',     textColor: 'oklch(0.60 0.22 30)', bgColor: 'oklch(0.60 0.22 30 / 0.15)', borderColor: 'oklch(0.60 0.22 30 / 0.4)' },
  warning:  { label: '警告',     textColor: 'oklch(0.70 0.18 60)', bgColor: 'oklch(0.70 0.18 60 / 0.15)', borderColor: 'oklch(0.70 0.18 60 / 0.4)' },
  caution:  { label: '注意',     textColor: 'oklch(0.73 0.12 78)', bgColor: 'oklch(0.73 0.12 78 / 0.15)', borderColor: 'oklch(0.73 0.12 78 / 0.4)' },
  normal:   { label: '正常',     textColor: 'oklch(0.65 0.15 160)', bgColor: 'oklch(0.65 0.15 160 / 0.15)', borderColor: 'oklch(0.65 0.15 160 / 0.4)' },
  none:     { label: '—',        textColor: 'oklch(0.55 0.008 75)', bgColor: 'transparent',                borderColor: 'transparent' },
}

// ファイル検証
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

export function validateContractFile(file: { size: number; type: string }): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `ファイルサイズは20MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'PDF・画像・Word文書（.docx）のみアップロードできます'
  }
  return null
}

export function contractStoragePath(
  companyId: string,
  contractId: string,
  version: number,
  fileName: string
): string {
  return `${companyId}/${contractId}/v${version}/${fileName}`
}

export function formatContractDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

// 通知タイプ
export type ExpiryNotificationType = '60d' | '30d' | '7d' | '0d'

export const EXPIRY_NOTIFICATION_DAYS: Record<ExpiryNotificationType, number> = {
  '60d': 60,
  '30d': 30,
  '7d':  7,
  '0d':  0,
}
