// ============================================================
// LINE通知 型定義
// ============================================================

/** 通知イベント種別 */
export type NotificationEventType =
  // シフト
  | 'shift_created'
  | 'shift_updated'
  | 'shift_cancelled'
  | 'shift_confirmed'
  // 案件割当
  | 'project_assigned'
  // 作業
  | 'job_started'
  | 'job_completed'
  // AI評価
  | 'ai_evaluation_alert'
  // 報告書
  | 'report_ready'
  // 経費
  | 'expense_submitted'
  | 'expense_approved'
  | 'expense_rejected'
  // 請求書・見積書
  | 'quote_published'
  | 'invoice_issued'
  // 入金
  | 'payment_received'
  | 'invoice_overdue'

/** 通知先ロール */
export type NotificationTarget = 'admin' | 'employee' | 'partner' | 'client'

/** 通知送信リクエスト */
export interface NotificationRequest {
  companyId: string
  eventType: NotificationEventType
  /** 冪等キー: 省略すると重複チェックなし */
  notificationKey?: string
  /** 通知先プロフィールID（社内ユーザー） */
  profileId?: string
  /** 通知先LINE User ID（直接指定） */
  lineUserId?: string
  /** 顧客ポータルアカウントID */
  portalAccountId?: string
  /** LINE User ID（顧客） */
  clientLineUserId?: string
  /** メッセージ本文 */
  message: string
}

/** 通知結果 */
export interface NotificationResult {
  success: boolean
  skipped?: boolean
  skipReason?: 'no_line_user_id' | 'notify_disabled' | 'duplicate'
  logId?: string
  error?: string
}

/** シフト通知パラメータ */
export interface ShiftNotificationParams {
  projectName: string
  shiftDate: string      // "2026-08-15"
  startTime: string      // "09:00"
  endTime: string        // "17:00"
  assigneeName: string
  locationName?: string
  companyBaseUrl?: string
}

/** 経費通知パラメータ */
export interface ExpenseNotificationParams {
  applicantName: string
  amount: number
  description: string
  rejectReason?: string
  companyBaseUrl?: string
}

/** 請求書通知パラメータ */
export interface InvoiceNotificationParams {
  invoiceNumber: string
  clientName: string
  totalAmount: number
  dueDate?: string
  invoiceType: 'quote' | 'invoice'
  companyBaseUrl?: string
}

/** 入金通知パラメータ */
export interface PaymentNotificationParams {
  invoiceNumber: string
  amount: number
  paidAt: string
  companyBaseUrl?: string
}

/** AI評価アラートパラメータ */
export interface AiAlertNotificationParams {
  projectName: string
  score: number
  verdict: string
  companyBaseUrl?: string
}

/** 報告書通知パラメータ */
export interface ReportNotificationParams {
  projectName: string
  workDate: string
  companyBaseUrl?: string
}
