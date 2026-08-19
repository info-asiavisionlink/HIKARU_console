// ============================================================
// JARVIS Agent — 型定義（CONSOLE専用）
// Systemとは完全分離。Admin Context中心。
// ============================================================

export interface ConsoleAgentContext {
  /** 認証済みAdmin/Manager ID（API Route で検証済み）*/
  userId:      string
  companyId:   string
  currentPath: string
  cookieHeader: string
  baseUrl:     string
}

export interface ToolResult {
  success: boolean
  text:    string
  items?:  Array<{ id: string; label: string }>
  data?:   Record<string, unknown>
}

export interface ConsoleAgentTool {
  name:        string
  description: string
  safetyLevel: 0 | 1 | 2
  parameters: {
    type:       'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?:  string[]
  }
  execute(params: Record<string, string>, ctx: ConsoleAgentContext): Promise<ToolResult>
}

export interface ConsoleAgentApiResponse {
  action:      string | null
  confidence:  number
  params:      Record<string, string>
  voiceReply:  string | null
  resultData?: {
    type:   'project_list' | 'expense_list' | 'attendance_list' | 'notification_list' | 'single' | 'none'
    items?: Array<{ id: string; label: string }>
    summary?: string
  }
}
