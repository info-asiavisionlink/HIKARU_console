// ============================================================
// CONSOLE Voice — 状態型定義（System と同仕様・独立コード）
// ============================================================

export type VoiceMode =
  | 'idle'        // 待機
  | 'listening'   // 音声認識中（LISTENING）
  | 'processing'  // モデル推論中（THINKING）
  | 'working'     // Tool実行中（WORKING）
  | 'speaking'    // 音声出力中（SPEAKING）
  | 'error'       // エラー状態

// 自然会話用 Conversation Context（セッションスコープ・DB保存なし）

export interface LastResultItem {
  id:    string
  label: string
}

export interface LastResultData {
  type:    'project_list' | 'notification_list' | 'expense_list' | 'attendance_list' | 'single' | 'none'
  items?:  LastResultItem[]
  summary?: string
}

export interface PendingConfirmation {
  action:        string
  params:        Record<string, string>
  safetyLevel:   3 | 4 | 5
  message:       string
  resourceType?: string
  resourceId?:   string
  expiresAt:     number
}

export type VoiceEngineMode = 'realtime' | 'realtime-connecting' | 'browser' | 'off'

export interface ConversationContext {
  lastIntent?:          string
  lastAction?:          string
  lastResultData?:      LastResultData
  previousResponseId?:  string
  pendingConfirmation?: PendingConfirmation
  pendingApproval?:     boolean
  pendingAction?:       string
}

// Voice設定（localStorage保存・Conversationは保存しない）
export interface VoiceSettings {
  voiceURI: string   // '' = browser default
  rate:     number   // 0.5-2.0
  pitch:    number   // 0-2.0
  volume:   number   // 0-1.0
}
