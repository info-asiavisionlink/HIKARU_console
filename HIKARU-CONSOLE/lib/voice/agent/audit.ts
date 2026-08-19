// ============================================================
// JARVIS Console Audit Logger
// DB migration なし。構造化ログでVercel Logsへ出力。
// 機密情報（会話全文・個人データ）は含めない。
// ============================================================

export type AuditResult = 'success' | 'failed' | 'rejected' | 'cancelled'
export type AuditSource = 'jarvis_console' | 'jarvis_console_realtime'

export interface ConsoleAuditLog {
  type:          'jarvis_console_audit'
  source:        AuditSource
  actor:         string   // admin_id
  actorType:     'admin'
  companyId?:    string
  action:        string
  resourceType?: string
  resourceId?:   string
  safetyLevel:   number
  confirmed:     boolean
  result:        AuditResult
  reason?:       string
  timestamp:     string
}

export function logConsoleAudit(entry: Omit<ConsoleAuditLog, 'type' | 'timestamp'>): void {
  const log: ConsoleAuditLog = {
    type:      'jarvis_console_audit',
    timestamp: new Date().toISOString(),
    ...entry,
  }
  console.log(JSON.stringify(log))
}
