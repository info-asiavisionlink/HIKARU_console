// ============================================================
// CONSOLE Voice — 状態型定義（System と同仕様・独立コード）
// ============================================================

export type VoiceMode =
  | 'idle'        // 待機
  | 'listening'   // 音声認識中
  | 'processing'  // Intent解析中
  | 'speaking'    // TTS読み上げ中
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

export interface ConversationContext {
  lastIntent?:     string
  lastAction?:     string
  lastResultData?: LastResultData
}
