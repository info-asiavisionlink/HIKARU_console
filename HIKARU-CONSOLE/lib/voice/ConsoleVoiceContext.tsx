'use client'
// ============================================================
// ConsoleVoiceContext — CONSOLE Persistent Voice Provider
// ConsoleLayoutに1つだけ配置。ページ遷移後もSessionを維持する。
// Realtime(WebRTC)を標準Voice Engine。失敗時はBrowser STTへfallback。
// SystemのSystemVoiceContextとは完全分離（CONSOLE業務専用）。
// useConsoleJarvis() で各Pageから消費する。
// ============================================================

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { browserTTS }            from '@/lib/voice/tts/browser'
import type {
  VoiceMode, VoiceEngineMode, ConversationContext, LastResultData, VoiceSettings, PendingConfirmation,
} from '@/lib/voice/state/types'
import type { ConsoleActionName } from '@/lib/voice/registry/console.actions'

// ─── CONSOLE Realtime定数 ─────────────────────────────────────
const RT_MODEL = 'gpt-4o-realtime-preview'

const RT_SYSTEM_PROMPT = `あなたはHIKARU Console管理者アシスタント「JARVIS」です。
管理者・マネージャーの業務をサポートする音声アシスタントです。
回答は2〜3文以内で日本語で簡潔に。

## Write操作（最重要）
承認操作（経費承認・勤怠承認等）は必ずユーザーの確認を取ってから execute_confirmed_action を呼ぶ。
確認なしに実行ツールを呼ばない。

## actionとparamsの対応
- console.approve_expense    → params: { expenseId }
- console.approve_attendance → params: { correctionId }`

function buildConsoleRealtimeTools(
  router: ReturnType<typeof useRouter>,
) {
  const apiFetch = async (path: string) => {
    const res = await fetch(path, { credentials: 'include' })
    if (!res.ok) return null
    return res.json()
  }
  return [
    {
      name: 'get_dashboard_summary', description: 'ダッシュボードの今日の状況サマリーを取得する',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => {
        const data = await apiFetch('/api/dashboard')
        if (!data) return 'ダッシュボード情報を取得できませんでした。'
        const parts: string[] = []
        if (data?.activeProjects  != null) parts.push(`進行中案件: ${data.activeProjects}件`)
        if (data?.pendingExpenses != null) parts.push(`承認待ち経費: ${data.pendingExpenses}件`)
        if (data?.pendingAttendance > 0)   parts.push(`勤怠修正申請: ${data.pendingAttendance}件`)
        return parts.length > 0 ? `現在: ${parts.join('、')}` : 'ダッシュボードを確認してください。'
      },
    },
    {
      name: 'get_pending_expenses', description: '承認待ちの経費申請件数と一覧・IDを確認する',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => {
        const data = await apiFetch('/api/expenses?status=submitted')
        if (!data) return '経費申請を確認できませんでした。'
        const items = Array.isArray(data?.data) ? data.data : []
        if (items.length === 0) return '承認待ちの経費申請はありません。'
        const list = items.slice(0, 3).map((e: any, i: number) => `${i + 1}: ${e.title ?? `¥${e.amount}`} [id:${e.id}]`).join(', ')
        return `承認待ちの経費申請が${items.length}件あります。${list}`
      },
    },
    {
      name: 'get_pending_attendance', description: '勤怠修正申請の承認待ちを確認する',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => {
        const data = await apiFetch('/api/attendance/corrections?status=pending')
        if (!data) return '勤怠修正申請を確認できませんでした。'
        const items = Array.isArray(data?.data) ? data.data : []
        if (items.length === 0) return '承認待ちの勤怠修正申請はありません。'
        const list = items.slice(0, 3).map((e: any, i: number) => `${i + 1}: ${e.worker_name ?? '従業員'} [id:${e.id}]`).join(', ')
        return `承認待ちの勤怠修正申請が${items.length}件あります。${list}`
      },
    },
    {
      name: 'get_notifications', description: '管理者向け通知・未読件数を確認する',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => {
        const data = await apiFetch('/api/console-notifications')
        if (!data) return '通知を取得できませんでした。'
        const unread = data.unread_count ?? 0
        return unread === 0 ? '未読の通知はありません。' : `未読の通知が${unread}件あります。`
      },
    },
    {
      name: 'navigate', description: '指定のページへ移動する',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      execute: async ({ path }: { path: string }) => { router.push(path); return `${path}へ移動します。` },
    },
    {
      name: 'execute_confirmed_action',
      description: 'ユーザーが「はい」と確認した後にのみ呼ぶ。Server Auth再検証して実行。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['console.approve_expense', 'console.approve_attendance'] },
          params: { type: 'object', additionalProperties: { type: 'string' } },
        },
        required: ['action'],
      },
      execute: async ({ action, params = {} }: { action: string; params?: Record<string, string> }) => {
        try {
          const res = await fetch('/api/ai/confirm-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ action, params, safetyLevel: 4, expiresAt: Date.now() + 90_000 }),
          })
          const data = await res.json()
          return res.ok ? (data.voiceReply ?? '完了しました。') : (data.error ?? '実行に失敗しました。')
        } catch { return '実行中にエラーが発生しました。' }
      },
    },
  ]
}

// ─── STT型補完 ───────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
type SpeechRecognitionInstance = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  start(): void; stop(): void; abort(): void
  onresult:  ((e: SpeechRecognitionEvent) => void) | null
  onerror:   ((e: SpeechRecognitionErrorEvent) => void) | null
  onend:     (() => void) | null
}

interface IntentResult {
  action:     ConsoleActionName | null
  confidence: number
  params:     Record<string, string>
  voiceReply: string | null
}

export interface ConsoleChatMessage {
  role:      'user' | 'assistant'
  text:      string
  timestamp: number
}

// ─── セッション設定 ──────────────────────────────────────────
const SESSION_STOP_RE    = /^(終了|やめて|止めて|ストップ|セッション終了|会話終了|閉じて|おしまい|終わり)$/
const CONFIRM_YES_EXACT  = new Set(['はい', 'うん', 'ええ', 'ok', 'OK', 'オーケー', 'そう', 'そうです', 'もちろん', 'わかりました', 'わかった'])
const CONFIRM_YES_STARTS = ['よろし', 'お願いします', 'いいです', 'いいよ', 'それでお願い', '実行して', '進めて', 'そうして', '承認します']
const CONFIRM_NO_EXACT   = new Set(['いいえ', 'いや', 'ノー'])
const CONFIRM_NO_STARTS  = ['やめ', 'キャンセル', 'やっぱり', '違います', '戻して', '実行しない', 'ストップ', '取り消し', '却下']
function isConfirmYes(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 20) return false
  if (CONFIRM_YES_EXACT.has(t)) return true
  return CONFIRM_YES_STARTS.some(w => t.startsWith(w) || t === w)
}
function isConfirmNo(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 25) return false
  if (CONFIRM_NO_EXACT.has(t)) return true
  return CONFIRM_NO_STARTS.some(w => t.startsWith(w) || t.includes(w))
}
const STANDBY_MS         = 60_000
const SESSION_TIMEOUT_MS = 5 * 60_000

// ─── Voice Settings localStorage ─────────────────────────────
const LS_KEY = 'hikaru_console_voice_settings'

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceURI: '',
  rate:     1.0,
  pitch:    1.0,
  volume:   1.0,
}

function loadVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_VOICE_SETTINGS
    return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) }
  } catch { return DEFAULT_VOICE_SETTINGS }
}

function saveVoiceSettings(s: VoiceSettings): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}

// ─── Context型 ───────────────────────────────────────────────
export interface ConsoleVoiceContextValue {
  mode:               VoiceMode
  isSession:          boolean
  isStandby:          boolean
  transcript:         string
  response:           string
  errorMessage:       string
  messages:           ConsoleChatMessage[]
  voiceSettings:      VoiceSettings
  setVoiceSettings:   (s: VoiceSettings) => void
  isSpeechSupported:  boolean
  voiceEngineMode:    VoiceEngineMode
  connectRealtime:    () => void
  disconnectRealtime: () => void
  startListening:     () => void
  stopAll:            () => void
  startSession:       () => void
  stopSession:        () => void
  handleUtterance:    (text: string) => Promise<void>
}

const ConsoleVoiceContext = React.createContext<ConsoleVoiceContextValue | null>(null)

// ─── L1 CONSOLE データ取得 ────────────────────────────────────
interface L1Result { text: string; data: LastResultData }

async function fetchConsoleL1Result(action: ConsoleActionName): Promise<L1Result> {
  const none = (text: string): L1Result => ({ text, data: { type: 'none' } })
  try {
    switch (action) {
      case 'console.get_notifications': {
        const res = await fetch('/api/console-notifications', { credentials: 'include' })
        if (!res.ok) return none('通知を取得できませんでした。')
        const data = await res.json()
        const list  = data.notifications ?? []
        const unread = data.unread_count ?? list.filter((n: { is_read: boolean }) => !n.is_read).length
        return none(unread === 0 ? '未読の通知はありません。' : `未読の通知が${unread}件あります。読み上げますか？`)
      }
      case 'console.get_pending_requests': {
        const res = await fetch('/api/project-requests?status=pending&count=true', { credentials: 'include' })
        if (!res.ok) return none('案件依頼を確認できませんでした。')
        const data = await res.json()
        const count = data.count ?? (data.data?.length ?? 0)
        return none(count === 0 ? '未対応の案件依頼はありません。' : `未対応の案件依頼が${count}件あります。確認しますか？`)
      }
      case 'console.get_pending_expenses': {
        const res = await fetch('/api/expenses?status=submitted', { credentials: 'include' })
        if (!res.ok) return none('経費申請を確認できませんでした。')
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : []
        return none(items.length === 0 ? '承認待ちの経費申請はありません。' : `承認待ちの経費申請が${items.length}件あります。承認しますか？`)
      }
      case 'console.get_pending_attendance': {
        const res = await fetch('/api/attendance/corrections?status=pending', { credentials: 'include' })
        if (!res.ok) return none('勤怠修正申請を確認できませんでした。')
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : []
        return none(items.length === 0 ? '承認待ちの勤怠修正申請はありません。' : `承認待ちの勤怠修正申請が${items.length}件あります。`)
      }
      case 'console.get_dashboard':
        return none('ダッシュボードに最新情報を表示します。')
      default:
        return none('')
    }
  } catch {
    return none('データの取得中にエラーが発生しました。')
  }
}

// ─── L2 CONSOLE ナビゲーション ───────────────────────────────
function executeConsoleL2Navigation(
  action: ConsoleActionName,
  router: ReturnType<typeof useRouter>
): string {
  switch (action) {
    case 'console.go_dashboard':          router.push('/dashboard');          return 'ダッシュボードに移動します'
    case 'console.go_back':               router.back();                      return '前の画面に戻ります'
    case 'console.open_projects':         router.push('/projects');           return '案件管理を開きます'
    case 'console.open_project_requests': router.push('/project-requests');   return '案件依頼を開きます'
    case 'console.open_clients':          router.push('/clients');            return '顧客管理を開きます'
    case 'console.open_employees':        router.push('/employees');          return '従業員管理を開きます'
    case 'console.open_partners':         router.push('/partners');           return '協力業者管理を開きます'
    case 'console.open_shifts':           router.push('/shifts');             return 'シフト管理を開きます'
    case 'console.open_attendance':       router.push('/attendance');         return '勤怠管理を開きます'
    case 'console.open_expenses':         router.push('/expenses');           return '経費管理を開きます'
    case 'console.open_invoices':         router.push('/invoices');           return '請求管理を開きます'
    case 'console.open_notifications':    router.push('/notifications');      return '通知管理を開きます'
    case 'console.open_quality':          router.push('/quality');            return '品質管理を開きます'
    case 'console.open_manuals':          router.push('/manuals');            return 'マニュアル管理を開きます'
    case 'console.open_reports':          router.push('/reports');            return '報告書管理を開きます'
    case 'console.open_analytics':        router.push('/analytics');          return 'AI分析を開きます'
    case 'console.open_inventory':        router.push('/inventory');          return '在庫管理を開きます'
    case 'console.open_contracts':        router.push('/contracts');          return '契約管理を開きます'
    case 'console.open_settings':         router.push('/settings');           return '設定を開きます'
    default:
      return ''
  }
}

// ─── Provider ────────────────────────────────────────────────
export function ConsoleVoiceProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [mode,            setMode]             = React.useState<VoiceMode>('idle')
  const [transcript,      setTranscript]       = React.useState('')
  const [response,        setResponse]         = React.useState('')
  const [errorMessage,    setErrorMessage]     = React.useState('')
  const [messages,        setMessages]         = React.useState<ConsoleChatMessage[]>([])
  const [isSession,       setIsSession]        = React.useState(false)
  const [isStandby,       setIsStandby]        = React.useState(false)
  const [voiceSettings,   setVoiceSettingsSt]  = React.useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const [voiceEngineMode, setVoiceEngineMode]  = React.useState<VoiceEngineMode>('off')

  React.useEffect(() => { setVoiceSettingsSt(loadVoiceSettings()) }, [])

  const setVoiceSettings = React.useCallback((s: VoiceSettings) => {
    setVoiceSettingsSt(s)
    saveVoiceSettings(s)
  }, [])

  const recognitionRef     = React.useRef<SpeechRecognitionInstance | null>(null)
  const modeRef            = React.useRef<VoiceMode>('idle')
  const isSessionRef       = React.useRef(false)
  const standbyTimerRef    = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sessionTimerRef    = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const startListeningRef  = React.useRef<() => void>(() => {})
  const conversationCtxRef = React.useRef<ConversationContext>({})
  const messagesRef        = React.useRef<ConsoleChatMessage[]>([])
  const voiceSettingsRef   = React.useRef<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const pathnameRef        = React.useRef(pathname)
  const realtimeSessionRef = React.useRef<any>(null)
  const voiceEngineModeRef = React.useRef<VoiceEngineMode>('off')

  React.useEffect(() => { voiceSettingsRef.current = voiceSettings },    [voiceSettings])
  React.useEffect(() => { pathnameRef.current      = pathname },         [pathname])
  React.useEffect(() => { voiceEngineModeRef.current = voiceEngineMode }, [voiceEngineMode])

  const isSpeechSupported = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }, [])

  const setModeSync = React.useCallback((m: VoiceMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  const clearActivityTimers = React.useCallback(() => {
    if (standbyTimerRef.current)  clearTimeout(standbyTimerRef.current)
    if (sessionTimerRef.current)  clearTimeout(sessionTimerRef.current)
  }, [])

  const scheduleStandby = React.useCallback(() => {
    clearActivityTimers()
    if (!isSessionRef.current) return
    setIsStandby(false)
    standbyTimerRef.current = setTimeout(() => {
      if (!isSessionRef.current) return
      setIsStandby(true)
      sessionTimerRef.current = setTimeout(() => {
        if (!isSessionRef.current) return
        isSessionRef.current = false
        setIsSession(false)
        setIsStandby(false)
        browserTTS.stop()
        recognitionRef.current?.abort()
        modeRef.current = 'idle'
        setMode('idle')
      }, SESSION_TIMEOUT_MS)
    }, STANDBY_MS)
  }, [clearActivityTimers])

  const addMessage = React.useCallback((role: 'user' | 'assistant', text: string) => {
    setMessages(prev => {
      const next = [...prev.slice(-19), { role, text, timestamp: Date.now() }]
      messagesRef.current = next
      return next
    })
  }, [])

  const speakAndMaybeResume = React.useCallback((text: string) => {
    modeRef.current = 'speaking'
    setMode('speaking')
    browserTTS.speak(text, () => {
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 400)
      } else {
        modeRef.current = 'idle'
        setMode('idle')
      }
    }, voiceSettingsRef.current)
  }, [])

  const stopAll = React.useCallback(() => {
    clearActivityTimers()
    isSessionRef.current = false
    setIsSession(false)
    setIsStandby(false)
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
    try { realtimeSessionRef.current?.close?.() }      catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearActivityTimers, setModeSync])

  const stopSession = React.useCallback(() => {
    clearActivityTimers()
    isSessionRef.current = false
    setIsSession(false)
    setIsStandby(false)
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
    try { realtimeSessionRef.current?.close?.() }      catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearActivityTimers, setModeSync])

  const finishWithError = React.useCallback((msg: string) => {
    setErrorMessage(msg)
    setModeSync('error')
    setTimeout(() => {
      setModeSync('idle')
      setErrorMessage('')
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 800)
      }
    }, 3500)
  }, [setModeSync])

  const executeAction = React.useCallback(async (result: IntentResult) => {
    const { action, confidence, voiceReply } = result

    if (!action || confidence < 0.6) {
      const msg = '発話の意図を理解できませんでした。もう一度お話しください。'
      setResponse(msg)
      addMessage('assistant', msg)
      speakAndMaybeResume(msg)
      return
    }

    const isNavAction = action.startsWith('console.open_') || action === 'console.go_dashboard' || action === 'console.go_back'

    if (isNavAction) {
      const navReply = executeConsoleL2Navigation(action, router)
      const reply    = voiceReply ?? navReply
      setResponse(reply)
      addMessage('assistant', reply)
      conversationCtxRef.current = {
        lastIntent:    action,
        lastAction:    action,
        lastResultData: conversationCtxRef.current.lastResultData,
      }
      speakAndMaybeResume(reply)
      return
    }

    const l1    = await fetchConsoleL1Result(action)
    const reply = voiceReply ?? l1.text
    setResponse(reply)
    addMessage('assistant', reply)
    conversationCtxRef.current = { lastIntent: action, lastAction: action, lastResultData: l1.data }
    speakAndMaybeResume(reply)
  }, [router, addMessage, speakAndMaybeResume])

  // ─── Confirmed Action 実行 ───────────────────────────────────
  const executeConfirmedAction = React.useCallback(async (pending: PendingConfirmation) => {
    setModeSync('processing')
    try {
      const res = await fetch('/api/ai/confirm-action', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({
          action:      pending.action,
          params:      pending.params,
          safetyLevel: pending.safetyLevel,
          expiresAt:   pending.expiresAt,
        }),
      })
      const data  = await res.json()
      const reply = res.ok
        ? (data.voiceReply ?? '完了しました。')
        : (data.error     ?? '実行に失敗しました。')
      setResponse(reply)
      addMessage('assistant', reply)
      conversationCtxRef.current = {
        ...conversationCtxRef.current,
        lastIntent:          pending.action,
        lastAction:          pending.action,
        pendingConfirmation: undefined,
      }
      speakAndMaybeResume(reply)
    } catch {
      finishWithError('実行中にエラーが発生しました。')
    }
  }, [addMessage, speakAndMaybeResume, finishWithError, setModeSync])

  const handleUtterance = React.useCallback(async (utterance: string) => {
    // ─── 期限切れ pendingConfirmation の自動クリア ───────────────
    const expiredPending = conversationCtxRef.current.pendingConfirmation
    if (expiredPending && Date.now() > expiredPending.expiresAt) {
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
      if (isConfirmYes(utterance.trim()) || isConfirmNo(utterance.trim())) {
        const msg = '確認の有効期限が切れました。もう一度操作してください。'
        setResponse(msg); addMessage('user', utterance); addMessage('assistant', msg)
        speakAndMaybeResume(msg)
        return
      }
    }

    if (isSessionRef.current && SESSION_STOP_RE.test(utterance.trim())) {
      addMessage('user', utterance)
      addMessage('assistant', '会話を終了します')
      isSessionRef.current = false
      setIsSession(false)
      clearActivityTimers()
      setIsStandby(false)
      speakAndMaybeResume('会話を終了します')
      return
    }

    // ─── Confirmation 待ち中の「はい/いいえ」処理 ─────────────
    const pending = conversationCtxRef.current.pendingConfirmation
    if (pending) {
      scheduleStandby()
      setIsStandby(false)
      setTranscript(utterance)
      addMessage('user', utterance)
      if (isConfirmYes(utterance.trim())) {
        await executeConfirmedAction(pending)
        return
      }
      if (isConfirmNo(utterance.trim())) {
        conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
        const msg = 'キャンセルしました。'
        setResponse(msg)
        addMessage('assistant', msg)
        speakAndMaybeResume(msg)
        return
      }
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
    }

    scheduleStandby()
    setIsStandby(false)
    setTranscript(utterance)
    addMessage('user', utterance)
    setModeSync('processing')

    const recentMessages = messagesRef.current.slice(-6).map(m => ({ role: m.role, content: m.text }))

    try {
      const requestBody = {
        utterance,
        currentPath:         pathnameRef.current,
        recentMessages,
        lastIntent:          conversationCtxRef.current.lastIntent,
        lastResultData:      conversationCtxRef.current.lastResultData,
        previousResponseId:  conversationCtxRef.current.previousResponseId,
      }

      // SDK経路（Agents SDK + Responses API）を優先、失敗時fallback
      let result: Record<string, unknown> | null = null
      let usedSdkRoute = false

      try {
        const sdkRes = await fetch('/api/ai/console-agent-sdk', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(requestBody),
        })
        if (sdkRes.ok) { result = await sdkRes.json(); usedSdkRoute = true }
      } catch {}

      if (!result || (result as any).error) {
        const fallbackRes = await fetch('/api/ai/console-agent', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(requestBody),
        })
        if (!fallbackRes.ok) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }
        result = await fallbackRes.json()
      }

      if (!result) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }

      conversationCtxRef.current = {
        ...conversationCtxRef.current,
        ...(result.resultData ? { lastResultData: result.resultData as any } : {}),
        ...(usedSdkRoute && result.previousResponseId
          ? { previousResponseId: result.previousResponseId as string }
          : {}),
        ...(result.pendingConfirmation
          ? { pendingConfirmation: result.pendingConfirmation as PendingConfirmation }
          : {}),
      }

      if (result.pendingConfirmation && result.voiceReply) {
        const confirmMsg = result.voiceReply as string
        setResponse(confirmMsg)
        addMessage('assistant', confirmMsg)
        speakAndMaybeResume(confirmMsg)
        return
      }

      if (!result.action && result.voiceReply) {
        setResponse(result.voiceReply as string)
        addMessage('assistant', result.voiceReply as string)
        conversationCtxRef.current = {
          ...conversationCtxRef.current,
          lastIntent: 'agent.response',
          lastAction: undefined,
        }
        speakAndMaybeResume(result.voiceReply as string)
        return
      }

      await executeAction(result as any)
    } catch {
      finishWithError('音声アシスタントへの接続に失敗しました。')
    }
  }, [executeAction, finishWithError, addMessage, speakAndMaybeResume, clearActivityTimers, scheduleStandby, setModeSync])

  // ─── CONSOLE Realtime接続 ─────────────────────────────────────
  const connectRealtime = React.useCallback(async () => {
    if (realtimeSessionRef.current) return
    if (voiceEngineModeRef.current === 'realtime-connecting') return

    setVoiceEngineMode('realtime-connecting')
    voiceEngineModeRef.current = 'realtime-connecting'

    try {
      const tokenRes = await fetch('/api/ai/console-realtime-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ model: RT_MODEL }),
      })
      if (!tokenRes.ok) throw new Error('token_failed')
      const { clientSecret } = await tokenRes.json()
      if (!clientSecret) throw new Error('no_token')

      const { RealtimeAgent, RealtimeSession } = await import('@openai/agents/realtime') as any
      const tools   = buildConsoleRealtimeTools(router)
      const agent   = new RealtimeAgent({ name: 'JARVIS Console Realtime', instructions: RT_SYSTEM_PROMPT, model: RT_MODEL, tools })
      const session = new RealtimeSession(agent, { model: RT_MODEL })

      session.on?.('connected', () => { setVoiceEngineMode('realtime'); voiceEngineModeRef.current = 'realtime'; setModeSync('listening') })
      session.on?.('disconnected', () => {
        realtimeSessionRef.current = null
        if (isSessionRef.current) {
          setVoiceEngineMode('browser'); voiceEngineModeRef.current = 'browser'
          setTimeout(() => { if (isSessionRef.current && voiceEngineModeRef.current === 'browser') startListeningRef.current() }, 800)
        } else { setVoiceEngineMode('off'); voiceEngineModeRef.current = 'off'; setModeSync('idle') }
      })
      session.on?.('error', () => {
        realtimeSessionRef.current = null; setVoiceEngineMode('browser'); voiceEngineModeRef.current = 'browser'
        if (isSessionRef.current) startListeningRef.current()
      })
      session.on?.('agent_start_speech',  () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('speaking') })
      session.on?.('agent_end_speech',    () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('listening') })
      session.on?.('user_start_speech',   () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('listening') })
      session.on?.('user_end_speech',     () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('processing') })
      session.on?.('tool_call_start',     () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('working') })
      session.on?.('tool_call_end',       () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('processing') })
      session.on?.('user_transcription_done',  (text: string) => { if (text?.trim()) { setTranscript(text.trim()); addMessage('user', text.trim()) } })
      session.on?.('agent_transcription_done', (text: string) => { if (text?.trim()) { setResponse(text.trim()); addMessage('assistant', text.trim()) } })

      await session.connect({ apiKey: clientSecret })
      realtimeSessionRef.current = session

    } catch (err) {
      console.error('[console-realtime]', err)
      setVoiceEngineMode('browser'); voiceEngineModeRef.current = 'browser'
      if (isSessionRef.current) setTimeout(() => startListeningRef.current(), 400)
    }
  }, [router, addMessage, setModeSync])

  const disconnectRealtime = React.useCallback(() => {
    try { realtimeSessionRef.current?.close?.() }      catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    setVoiceEngineMode('off'); voiceEngineModeRef.current = 'off'
  }, [])

  const startListening = React.useCallback(() => {
    if (voiceEngineModeRef.current === 'realtime' || voiceEngineModeRef.current === 'realtime-connecting') return
    if (!isSpeechSupported) { finishWithError('このブラウザでは音声入力を利用できません。'); return }
    if (modeRef.current === 'speaking') { browserTTS.stop(); setModeSync('idle'); return }
    if (modeRef.current === 'processing') return

    setErrorMessage('')
    setTranscript('')
    setModeSync('listening')

    const SpeechRec = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as new () => SpeechRecognitionInstance
    const rec = new SpeechRec()
    rec.lang = 'ja-JP'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (!text.trim()) { finishWithError('音声を認識できませんでした。'); return }
      handleUtterance(text.trim())
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        finishWithError('マイクの使用を許可してください。')
      } else if (e.error === 'no-speech') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 300)
        } else {
          finishWithError('音声が検出されませんでした。')
        }
      } else if (e.error === 'aborted') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 500)
        } else {
          setModeSync('idle')
        }
      } else {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 800)
        } else {
          finishWithError('音声認識でエラーが発生しました。')
        }
      }
    }
    rec.onend = () => {
      if (modeRef.current === 'listening') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 300)
        } else {
          setModeSync('idle')
        }
      }
    }
    try { rec.start() } catch { finishWithError('マイクを起動できませんでした。') }
  }, [isSpeechSupported, handleUtterance, finishWithError, setModeSync])

  React.useEffect(() => { startListeningRef.current = startListening }, [startListening])

  const startSession = React.useCallback(() => {
    isSessionRef.current = true
    setIsSession(true)
    setIsStandby(false)
    scheduleStandby()
    // Realtime優先。失敗時はBrowser STTへ自動fallback。
    connectRealtime()
  }, [scheduleStandby, connectRealtime])

  // ─── Phase P5: ページ遷移後の自然な次Action提案 ──────────────
  const prevPathRef = React.useRef(pathname)
  React.useEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    if (!isSessionRef.current) return
    if (prev === pathname) return

    const lastAction = conversationCtxRef.current.lastAction ?? ''

    // 案件依頼ページへ遷移
    if (pathname === '/project-requests' && lastAction === 'console.open_project_requests') {
      setTimeout(() => {
        if (!isSessionRef.current) return
        const msg = '案件依頼一覧を開きました。未対応の依頼を確認しますか？'
        addMessage('assistant', msg)
        setResponse(msg)
        speakAndMaybeResume(msg)
      }, 900)
      return
    }

    // 経費ページへ遷移
    if (pathname === '/expenses' && lastAction === 'console.open_expenses') {
      setTimeout(() => {
        if (!isSessionRef.current) return
        const msg = '経費管理を開きました。承認待ちの経費申請がある場合はご確認ください。'
        addMessage('assistant', msg)
        setResponse(msg)
        speakAndMaybeResume(msg)
      }, 900)
      return
    }
  }, [pathname, addMessage, speakAndMaybeResume])

  // ─── ページ遷移後の音声認識フェイルセーフ復旧 ──────────────────
  React.useEffect(() => {
    if (!isSessionRef.current) return
    const timer = setTimeout(() => {
      if (isSessionRef.current && modeRef.current === 'idle') {
        startListeningRef.current()
      }
    }, 700)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Logout クリーンアップ
  React.useEffect(() => {
    const handleLogout = () => {
      stopAll()
      setMessages([])
      messagesRef.current = []
      conversationCtxRef.current = {}
    }
    window.addEventListener('hikaru:logout', handleLogout)
    return () => window.removeEventListener('hikaru:logout', handleLogout)
  }, [stopAll])

  const value = React.useMemo<ConsoleVoiceContextValue>(() => ({
    mode, isSession, isStandby, transcript, response, errorMessage, messages,
    voiceSettings, setVoiceSettings, isSpeechSupported,
    voiceEngineMode, connectRealtime, disconnectRealtime,
    startListening, stopAll, startSession, stopSession, handleUtterance,
  }), [
    mode, isSession, isStandby, transcript, response, errorMessage, messages,
    voiceSettings, setVoiceSettings, isSpeechSupported,
    voiceEngineMode, connectRealtime, disconnectRealtime,
    startListening, stopAll, startSession, stopSession, handleUtterance,
  ])

  return (
    <ConsoleVoiceContext.Provider value={value}>
      {children}
    </ConsoleVoiceContext.Provider>
  )
}

// ─── Consumer hook ────────────────────────────────────────────
export function useConsoleJarvis(): ConsoleVoiceContextValue {
  const ctx = React.useContext(ConsoleVoiceContext)
  if (!ctx) throw new Error('useConsoleJarvis must be used within ConsoleVoiceProvider')
  return ctx
}
