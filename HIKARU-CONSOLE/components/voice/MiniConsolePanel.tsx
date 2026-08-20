'use client'
// ============================================================
// MiniConsolePanel — 全Pageの小型JARVIS状態インジケーター（CONSOLE版）
// isSession時のみ表示。既存管理UI操作を妨げないサイズと位置。
// ============================================================

import * as React from 'react'
import { useConsoleJarvis } from '@/lib/voice/ConsoleVoiceContext'
import { usePathname }      from 'next/navigation'
import { Radio, X, ChevronDown, ChevronUp } from 'lucide-react'

const G  = 'oklch(0.73 0.12 78)'
const GB = 'oklch(0.88 0.13 78)'
const GD = 'oklch(0.73 0.12 78 / 0.50)'

export function MiniConsolePanel() {
  const {
    mode, isSession, isStandby, messages, stopSession, voiceEngineMode,
  } = useConsoleJarvis()

  const pathname  = usePathname()
  const [expanded, setExpanded] = React.useState(false)

  if (pathname === '/assistant') return null
  if (!isSession) return null

  const isListening  = mode === 'listening'
  const isSpeaking   = mode === 'speaking'
  const isProc       = mode === 'processing'
  const isWorking    = mode === 'working'
  const isFallback   = voiceEngineMode === 'browser'
  const isConnecting = voiceEngineMode === 'realtime-connecting'

  const statusLabel = isStandby    ? 'STANDBY'
    : isConnecting                 ? 'CONNECTING...'
    : isListening                  ? 'LISTENING'
    : isSpeaking                   ? 'SPEAKING'
    : isWorking                    ? 'WORKING'
    : isProc                       ? 'THINKING'
    : isFallback                   ? 'FALLBACK'
    : 'ACTIVE'

  const dotColor = isStandby     ? GD
    : isConnecting               ? 'oklch(0.70 0.20 55)'
    : isListening                ? '#4ade80'
    : isSpeaking                 ? GB
    : isWorking                  ? 'oklch(0.80 0.18 55)'
    : isFallback                 ? 'oklch(0.65 0.15 260)'
    : G

  const recentMessages = messages.slice(-6)

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1"
      style={{ maxWidth: 280 }}
    >
      {expanded && recentMessages.length > 0 && (
        <div
          className="w-full rounded-xl p-3 space-y-2 mb-1"
          style={{
            background:     'oklch(0.06 0.003 260 / 0.96)',
            border:         `1px solid ${G}30`,
            backdropFilter: 'blur(12px)',
          }}
        >
          {recentMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[88%] rounded-lg px-3 py-1.5 text-[11px] leading-snug"
                style={msg.role === 'user'
                  ? { background: `${G}1e`, color: GB }
                  : { background: 'oklch(0.10 0.004 260)', color: 'oklch(0.80 0.008 75)' }
                }
              >
                <span className="text-[8px] tracking-[0.2em] uppercase mr-1" style={{ color: GD }}>
                  {msg.role === 'user' ? 'YOU' : 'JARVIS'}
                </span>
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex items-center gap-2 rounded-full px-3 py-1.5 select-none"
        style={{
          background:     'oklch(0.06 0.003 260 / 0.92)',
          border:         `1px solid ${G}40`,
          backdropFilter: 'blur(12px)',
          boxShadow:      `0 0 12px ${G}30`,
        }}
      >
        <div
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{
            background: dotColor,
            boxShadow:  isListening ? `0 0 6px ${dotColor}` : undefined,
            animation:  isListening ? 'mcp-pulse 1s ease-in-out infinite' : undefined,
          }}
        />
        <style>{`@keyframes mcp-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

        <Radio className="h-3 w-3 shrink-0" style={{ color: G }} />

        <span className="text-[10px] font-bold tracking-[0.18em]" style={{ color: GB }}>
          JARVIS
        </span>
        <span className="text-[9px] tracking-[0.12em]" style={{ color: GD }}>
          {statusLabel}
        </span>

        {recentMessages.length > 0 && (
          <button
            onClick={() => setExpanded(p => !p)}
            className="flex h-4 w-4 items-center justify-center rounded-full"
            style={{ color: GD }}
            aria-label={expanded ? '折りたたむ' : '会話を展開'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
        )}

        <button
          onClick={stopSession}
          className="flex h-4 w-4 items-center justify-center rounded-full"
          style={{ color: GD }}
          aria-label="JARVIS終了"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
