'use client'
// ============================================================
// useConsoleVoiceAssistant — CONSOLE専用Voice制御hook
// System の useVoiceAssistant とは完全分離。
// CONSOLE業務（Admin操作）専用。
// ============================================================

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { browserTTS } from '@/lib/voice/tts/browser'
import type { VoiceMode, ConversationContext, LastResultData } from '@/lib/voice/state/types'
import type { ConsoleActionName } from '@/lib/voice/registry/console.actions'

// ─── STT型補完 ─────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
type SpeechRecognitionInstance = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  start(): void; stop(): void; abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror:  ((e: SpeechRecognitionErrorEvent) => void) | null
  onend:    (() => void) | null
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

// ─── L1 CONSOLE データ取得 ──────────────────────────────────
interface L1Result { text: string; data: LastResultData }

async function fetchConsoleL1Result(action: ConsoleActionName): Promise<L1Result> {
  const none = (text: string): L1Result => ({ text, data: { type: 'none' } })
  try {
    switch (action) {
      case 'console.get_notifications': {
        const res = await fetch('/api/console-notifications', { credentials: 'include' })
        if (!res.ok) return none('通知を取得できませんでした。')
        const data = await res.json()
        const list = data.notifications ?? []
        const unread = data.unread_count ?? list.filter((n: { is_read: boolean }) => !n.is_read).length
        return none(unread === 0 ? '未読の通知はありません。' : `未読の通知が${unread}件あります。`)
      }
      case 'console.get_pending_requests': {
        const res = await fetch('/api/project-requests?status=pending&count=true', { credentials: 'include' })
        if (!res.ok) return none('案件依頼を確認できませんでした。')
        const data = await res.json()
        const count = data.count ?? (data.data?.length ?? 0)
        return none(count === 0 ? '未対応の案件依頼はありません。' : `未対応の案件依頼が${count}件あります。`)
      }
      case 'console.get_pending_expenses': {
        const res = await fetch('/api/expenses?status=submitted', { credentials: 'include' })
        if (!res.ok) return none('経費申請を確認できませんでした。')
        const data = await res.json()
        // API: { expenses: [...], kpi: {...} }
        const items = Array.isArray(data?.expenses) ? data.expenses : []
        if (items.length === 0) return none('承認待ちの経費申請はありません。')
        const CATS: Record<string, string> = { transport: '交通費', parking: '駐車料', supplies: '備品費', consumables: '消耗品費', other: 'その他' }
        const list = items.slice(0, 3).map((e: any, i: number) => {
          const name = e.profiles?.name ?? '申請者不明'
          const cat  = CATS[e.category] ?? 'その他'
          const amt  = `${Number(e.amount ?? 0).toLocaleString('ja-JP')}円`
          return `${i + 1}件目: ${name}、${cat}、${amt}`
        }).join('。')
        return none(`承認待ち経費が${items.length}件あります。${list}`)
      }
      case 'console.get_expense_detail': {
        return none('経費詳細を確認するには、まず「承認待ちの経費教えて」で一覧を取得してください。')
      }
      case 'console.get_project_detail': {
        return none('案件詳細を確認するには、まず「案件一覧教えて」で一覧を取得してください。')
      }
      case 'console.get_project_assignments': {
        return none('担当者を確認するには、まず「案件一覧教えて」で案件を選択してください。')
      }
      case 'console.get_pending_attendance': {
        const res = await fetch('/api/attendance/corrections?status=pending', { credentials: 'include' })
        if (!res.ok) return none('勤怠修正申請を確認できませんでした。')
        const data = await res.json()
        // API: { corrections: [...] }
        const items = Array.isArray(data?.corrections) ? data.corrections : []
        return none(items.length === 0 ? '承認待ちの勤怠修正申請はありません。' : `承認待ちの勤怠修正申請が${items.length}件あります。`)
      }
      case 'console.get_revenue': {
        const res = await fetch('/api/dashboard', { credentials: 'include' })
        if (!res.ok) return none('売上情報を取得できませんでした。')
        const data = await res.json()
        const rev = data?.revenue
        if (!rev || typeof rev !== 'object') return none('現在HIKARUに登録されている情報からは売上を確認できません。')
        // API: revenue.this_month/this_year = 税込合計、unpaid = 請求済未入金、unbilled = 未請求
        const fmt = (n: number): string => `${Math.round(n).toLocaleString('ja-JP')}円`
        const parts: string[] = []
        if (rev.this_month != null) parts.push(`今月の売上: ${fmt(rev.this_month)}`)
        if (rev.this_year  != null) parts.push(`今年の売上: ${fmt(rev.this_year)}`)
        if (rev.unpaid     != null) parts.push(`未入金: ${fmt(rev.unpaid)}`)
        if (rev.unbilled   != null) parts.push(`未請求: ${fmt(rev.unbilled)}`)
        return none(parts.length > 0
          ? `売上情報 — ${parts.join('、')}`
          : '売上情報を確認できませんでした。')
      }
      case 'console.get_dashboard': {
        return none('ダッシュボードに最新情報を表示します。')
      }
      default:
        return none('')
    }
  } catch {
    return none('データの取得中にエラーが発生しました。')
  }
}

// ─── L2 CONSOLE ナビゲーション実行 ─────────────────────────
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

// ─── セッション設定 ────────────────────────────────────────
const SESSION_STOP_RE = /^(終了|やめて|止めて|ストップ|セッション終了|会話終了|閉じて|おしまい|終わり)$/
const SILENCE_TIMEOUT_MS = 28_000

// ─── Hook Return型 ──────────────────────────────────────────
export interface UseConsoleVoiceAssistantReturn {
  mode:              VoiceMode
  transcript:        string
  response:          string
  errorMessage:      string
  messages:          ConsoleChatMessage[]
  isSpeechSupported: boolean
  startListening:    () => void
  stopAll:           () => void
  handleUtterance:   (utterance: string) => Promise<void>
  isSession:         boolean
  startSession:      () => void
  stopSession:       () => void
}

// ─── Main Hook ──────────────────────────────────────────────
export function useConsoleVoiceAssistant(): UseConsoleVoiceAssistantReturn {
  const router   = useRouter()
  const pathname = usePathname()

  const [mode,         setMode]         = React.useState<VoiceMode>('idle')
  const [transcript,   setTranscript]   = React.useState('')
  const [response,     setResponse]     = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState('')
  const [messages,     setMessages]     = React.useState<ConsoleChatMessage[]>([])
  const [isSession,    setIsSession]    = React.useState(false)

  const recognitionRef     = React.useRef<SpeechRecognitionInstance | null>(null)
  const modeRef            = React.useRef<VoiceMode>('idle')
  const isSessionRef       = React.useRef(false)
  const silenceTimerRef    = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const startListeningRef  = React.useRef<() => void>(() => {})
  const conversationCtxRef = React.useRef<ConversationContext>({})
  const messagesRef        = React.useRef<ConsoleChatMessage[]>([])

  const setModeSync = React.useCallback((m: VoiceMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  const isSpeechSupported = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }, [])

  const clearSilenceTimer = React.useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
  }, [])

  const scheduleSilenceTimeout = React.useCallback(() => {
    clearSilenceTimer()
    silenceTimerRef.current = setTimeout(() => {
      if (!isSessionRef.current) return
      isSessionRef.current = false
      setIsSession(false)
      browserTTS.stop()
      modeRef.current = 'idle'
      setMode('idle')
    }, SILENCE_TIMEOUT_MS)
  }, [clearSilenceTimer])

  const speakAndMaybeResume = React.useCallback((text: string) => {
    clearSilenceTimer()
    modeRef.current = 'speaking'
    setMode('speaking')
    browserTTS.speak(text, () => {
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 400)
      } else {
        modeRef.current = 'idle'
        setMode('idle')
      }
    })
  }, [clearSilenceTimer])

  const stopAll = React.useCallback(() => {
    clearSilenceTimer()
    isSessionRef.current = false
    setIsSession(false)
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
  }, [clearSilenceTimer, setModeSync])

  const stopSession = React.useCallback(() => {
    isSessionRef.current = false
    setIsSession(false)
    clearSilenceTimer()
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
  }, [clearSilenceTimer, setModeSync])

  const finishWithError = React.useCallback((msg: string) => {
    clearSilenceTimer()
    setErrorMessage(msg)
    setModeSync('error')
    setTimeout(() => {
      setModeSync('idle')
      setErrorMessage('')
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 800)
      }
    }, 3500)
  }, [clearSilenceTimer, setModeSync])

  const addMessage = React.useCallback((role: 'user' | 'assistant', text: string) => {
    setMessages(prev => {
      const next = [...prev.slice(-4), { role, text, timestamp: Date.now() }]
      messagesRef.current = next
      return next
    })
  }, [])

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
      conversationCtxRef.current = { lastIntent: action, lastAction: action }
      speakAndMaybeResume(reply)
      return
    }

    const l1 = await fetchConsoleL1Result(action)
    const reply = voiceReply ?? l1.text
    setResponse(reply)
    addMessage('assistant', reply)
    conversationCtxRef.current = { lastIntent: action, lastAction: action, lastResultData: l1.data }
    speakAndMaybeResume(reply)
  }, [router, addMessage, speakAndMaybeResume])

  const handleUtterance = React.useCallback(async (utterance: string) => {
    if (isSessionRef.current && SESSION_STOP_RE.test(utterance.trim())) {
      addMessage('user', utterance)
      addMessage('assistant', '会話を終了します')
      isSessionRef.current = false
      setIsSession(false)
      clearSilenceTimer()
      speakAndMaybeResume('会話を終了します')
      return
    }

    setTranscript(utterance)
    addMessage('user', utterance)
    setModeSync('processing')

    const recentMessages = messagesRef.current.slice(-6).map(m => ({ role: m.role, content: m.text }))

    try {
      const res = await fetch('/api/ai/console-intent', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          utterance,
          currentPath: pathname,
          recentMessages,
          lastIntent:     conversationCtxRef.current.lastIntent,
          lastResultData: conversationCtxRef.current.lastResultData,
        }),
      })
      if (!res.ok) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }
      const result: IntentResult = await res.json()
      await executeAction(result)
    } catch {
      finishWithError('音声アシスタントへの接続に失敗しました。')
    }
  }, [pathname, executeAction, finishWithError, addMessage, speakAndMaybeResume, clearSilenceTimer, setModeSync])

  const startListening = React.useCallback(() => {
    if (!isSpeechSupported) { finishWithError('このブラウザでは音声入力を利用できません。'); return }
    if (modeRef.current === 'speaking') { browserTTS.stop(); setModeSync('idle'); return }
    if (modeRef.current === 'processing') return

    setErrorMessage('')
    setTranscript('')
    setModeSync('listening')
    if (isSessionRef.current) scheduleSilenceTimeout()

    const SpeechRec = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as new () => SpeechRecognitionInstance
    const rec = new SpeechRec()
    rec.lang = 'ja-JP'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      clearSilenceTimer()
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (!text.trim()) { finishWithError('音声を認識できませんでした。'); return }
      handleUtterance(text.trim())
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      clearSilenceTimer()
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        finishWithError('マイクの使用を許可してください。')
      } else if (e.error === 'no-speech') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 300)
        } else {
          finishWithError('音声が検出されませんでした。')
        }
      } else {
        finishWithError('音声認識でエラーが発生しました。')
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
  }, [isSpeechSupported, handleUtterance, finishWithError, setModeSync, scheduleSilenceTimeout, clearSilenceTimer])

  React.useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  const startSession = React.useCallback(() => {
    if (!isSpeechSupported) { finishWithError('このブラウザでは音声入力を利用できません。'); return }
    isSessionRef.current = true
    setIsSession(true)
    startListeningRef.current()
  }, [isSpeechSupported, finishWithError])

  return {
    mode, transcript, response, errorMessage, messages,
    isSpeechSupported, startListening, stopAll, handleUtterance,
    isSession, startSession, stopSession,
  }
}
