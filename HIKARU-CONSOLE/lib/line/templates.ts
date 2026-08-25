// ============================================================
// LINE通知 メッセージテンプレート
// 通知文章の一元管理。変更はここだけで完結する。
// ============================================================

import type {
  ShiftNotificationParams,
  ExpenseNotificationParams,
  InvoiceNotificationParams,
  PaymentNotificationParams,
  AiAlertNotificationParams,
  ReportNotificationParams,
  ContractExpiryNotificationParams,
} from './types'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'HIKARU'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function formatAmount(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

// ─── シフト ───────────────────────────────────────────────

export function shiftCreatedTemplate(p: ShiftNotificationParams): string {
  return [
    `【${APP_NAME}】シフトが登録されました`,
    '',
    `案件：${p.projectName}`,
    p.locationName ? `場所：${p.locationName}` : '',
    `日時：${formatDate(p.shiftDate)} ${p.startTime}〜${p.endTime}`,
    `担当：${p.assigneeName}`,
    '',
    `${APP_NAME}で詳細を確認してください。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/shifts` : '',
  ].filter(Boolean).join('\n')
}

export function shiftUpdatedTemplate(p: ShiftNotificationParams): string {
  return [
    `【${APP_NAME}】シフトが変更されました`,
    '',
    `案件：${p.projectName}`,
    `日時：${formatDate(p.shiftDate)} ${p.startTime}〜${p.endTime}`,
    `担当：${p.assigneeName}`,
    '',
    `内容を確認してください。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/shifts` : '',
  ].filter(Boolean).join('\n')
}

export function shiftCancelledTemplate(p: ShiftNotificationParams): string {
  return [
    `【${APP_NAME}】シフトがキャンセルされました`,
    '',
    `案件：${p.projectName}`,
    `日時：${formatDate(p.shiftDate)} ${p.startTime}〜${p.endTime}`,
    '',
    `${APP_NAME}でご確認ください。`,
  ].filter(Boolean).join('\n')
}

export function shiftConfirmedTemplate(p: ShiftNotificationParams): string {
  return [
    `【${APP_NAME}】シフトが確定しました`,
    '',
    `案件：${p.projectName}`,
    `日時：${formatDate(p.shiftDate)} ${p.startTime}〜${p.endTime}`,
    `担当：${p.assigneeName}`,
    '',
    `当日はよろしくお願いします。`,
  ].filter(Boolean).join('\n')
}

// ─── 案件割当 ─────────────────────────────────────────────

export function projectAssignedTemplate(p: {
  projectName: string
  workDate?: string
  locationName?: string
  companyBaseUrl?: string
}): string {
  return [
    `【${APP_NAME}】案件が割り当てられました`,
    '',
    `案件：${p.projectName}`,
    p.workDate    ? `日時：${formatDate(p.workDate)}` : '',
    p.locationName ? `場所：${p.locationName}` : '',
    '',
    `${APP_NAME}で詳細を確認してください。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/projects` : '',
  ].filter(Boolean).join('\n')
}

// ─── 作業 ─────────────────────────────────────────────────

export function jobStartedTemplate(p: {
  projectName: string
  workerName: string
  startedAt: string
}): string {
  const time = new Date(p.startedAt)
  const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
  return [
    `【${APP_NAME}】作業開始`,
    '',
    `案件：${p.projectName}`,
    `担当：${p.workerName}`,
    `開始：${timeStr}`,
  ].join('\n')
}

export function jobCompletedTemplate(p: {
  projectName: string
  workerName: string
  startTime?: string
  endTime?: string
  companyBaseUrl?: string
}): string {
  return [
    `【${APP_NAME}】作業完了`,
    '',
    `案件：${p.projectName}`,
    `担当：${p.workerName}`,
    p.startTime && p.endTime ? `作業時間：${p.startTime}〜${p.endTime}` : '',
    '',
    `報告書を確認してください。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/reports` : '',
  ].filter(Boolean).join('\n')
}

// ─── AI評価 ───────────────────────────────────────────────

export function aiEvaluationAlertTemplate(p: AiAlertNotificationParams): string {
  return [
    `【${APP_NAME}】AI品質評価 要確認`,
    '',
    `案件：${p.projectName}`,
    `品質スコア：${p.score}`,
    `判定：${p.verdict}`,
    '',
    `HIKARU-CONSOLEで確認してください。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/reports` : '',
  ].filter(Boolean).join('\n')
}

// ─── 報告書 ───────────────────────────────────────────────

export function reportReadyTemplate(p: ReportNotificationParams): string {
  return [
    `【${APP_NAME}】清掃報告書が完成しました`,
    '',
    `案件：${p.projectName}`,
    `作業日：${formatDate(p.workDate)}`,
    '',
    `${APP_NAME}から報告書を確認できます。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/reports` : '',
  ].filter(Boolean).join('\n')
}

// ─── 経費 ─────────────────────────────────────────────────

export function expenseSubmittedTemplate(p: ExpenseNotificationParams): string {
  return [
    `【${APP_NAME}】経費申請があります`,
    '',
    `申請者：${p.applicantName}`,
    `金額：${formatAmount(p.amount)}`,
    `内容：${p.description}`,
    '',
    `HIKARU-CONSOLEで確認してください。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/expenses` : '',
  ].filter(Boolean).join('\n')
}

export function expenseApprovedTemplate(p: ExpenseNotificationParams): string {
  return [
    `【${APP_NAME}】経費申請が承認されました`,
    '',
    `金額：${formatAmount(p.amount)}`,
    `内容：${p.description}`,
  ].join('\n')
}

export function expenseRejectedTemplate(p: ExpenseNotificationParams): string {
  return [
    `【${APP_NAME}】経費申請が却下されました`,
    '',
    `金額：${formatAmount(p.amount)}`,
    `内容：${p.description}`,
    p.rejectReason ? `理由：${p.rejectReason}` : '',
  ].filter(Boolean).join('\n')
}

// ─── 請求書・見積書 ────────────────────────────────────────

export function quotePublishedTemplate(p: InvoiceNotificationParams): string {
  return [
    `【${APP_NAME}】見積書が発行されました`,
    '',
    `金額：${formatAmount(p.totalAmount)}`,
    '',
    `${APP_NAME}の顧客ポータルから確認できます。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/portal` : '',
  ].filter(Boolean).join('\n')
}

export function invoiceIssuedTemplate(p: InvoiceNotificationParams): string {
  return [
    `【${APP_NAME}】請求書が発行されました`,
    '',
    `請求番号：${p.invoiceNumber}`,
    `金額：${formatAmount(p.totalAmount)}`,
    p.dueDate ? `支払期限：${formatDate(p.dueDate)}` : '',
    '',
    `${APP_NAME}の顧客ポータルから確認できます。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/portal` : '',
  ].filter(Boolean).join('\n')
}

// ─── 入金 ─────────────────────────────────────────────────

export function paymentReceivedTemplate(p: PaymentNotificationParams): string {
  return [
    `【${APP_NAME}】入金を確認しました`,
    '',
    `請求番号：${p.invoiceNumber}`,
    `入金額：${formatAmount(p.amount)}`,
    `入金日：${formatDate(p.paidAt)}`,
  ].join('\n')
}

export function invoiceOverdueTemplate(p: {
  clientName: string
  invoiceNumber: string
  totalAmount: number
  dueDate: string
  companyBaseUrl?: string
}): string {
  return [
    `【${APP_NAME}】支払期限超過の請求書があります`,
    '',
    `顧客：${p.clientName}`,
    `請求番号：${p.invoiceNumber}`,
    `金額：${formatAmount(p.totalAmount)}`,
    `支払期限：${formatDate(p.dueDate)}`,
    '',
    `確認してください。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/invoices` : '',
  ].filter(Boolean).join('\n')
}

// ─── 契約期限 ─────────────────────────────────────────────

export function contractExpiryTemplate(p: ContractExpiryNotificationParams): string {
  const expiryLabel =
    p.daysUntilExpiry === 0  ? '本日' :
    p.daysUntilExpiry === 7  ? '7日後' :
    p.daysUntilExpiry === 30 ? '30日後' :
    p.daysUntilExpiry === 60 ? '60日後' :
    `${p.daysUntilExpiry}日後`

  return [
    `【${APP_NAME}】契約期限のお知らせ`,
    '',
    `契約先：${p.counterpartyName}`,
    `契約名：${p.contractTitle}`,
    '',
    `契約終了まで${expiryLabel === '本日' ? '本日が期限です' : `${expiryLabel}です`}。`,
    '',
    `契約終了日：${formatDate(p.endDate)}`,
    p.autoRenewal ? '（自動更新契約）' : '',
    '',
    `更新要否を確認してください。`,
    p.companyBaseUrl ? `${p.companyBaseUrl}/contracts` : '',
  ].filter(Boolean).join('\n')
}
