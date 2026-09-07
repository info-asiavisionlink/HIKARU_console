// ============================================================
// Notification type whitelists (Console)
//
// Console admin向け通知の許可 type 一覧。
// 通知一覧APIと既読APIで同一 whitelist を共有する。
//
// 追加ルール:
//   - 削除禁止 (既存 Production 通知が消える)
//   - rename 禁止 (System 側 insert が対応 rename されない限り不一致)
//   - Worker向け type (attendance_correction_approved 等) をここに混ぜない
// ============================================================

export const ADMIN_NOTIFICATION_TYPES = [
  'attendance_correction_submitted',
  'expense_submitted',
  'project_report_submitted',
  'project_proposal_submitted',
] as const

export type AdminNotificationType = typeof ADMIN_NOTIFICATION_TYPES[number]
