'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, X, Radio, Globe, Activity } from 'lucide-react'
import { useConsoleVoiceAssistant } from '@/lib/voice/useConsoleVoiceAssistant'
import { VOICE_ASSISTANT_NAME } from '@/lib/voice/config'

// ============================================================
// CONSOLE JARVIS — 管理者向けVoice Interface
// System の /assistant とは完全分離・CONSOLE専用
// ============================================================

const G  = 'oklch(0.73 0.12 78)'
const GB = 'oklch(0.88 0.13 78)'
const GD = 'oklch(0.73 0.12 78 / 0.50)'

const STATE_TEXT: Record<string, string> = {
  idle:       `${VOICE_ASSISTANT_NAME}が待機中です`,
  listening:  '音声を聞いています...',
  processing: '処理しています...',
  speaking:   '回答中です...',
  error:      'もう一度お試しください',
}

const QUICK_COMMANDS = [
  { label: 'ダッシュボード', utterance: 'ダッシュボード' },
  { label: '案件管理',       utterance: '案件管理を開いて' },
  { label: '通知確認',       utterance: '通知を確認して' },
  { label: '経費確認',       utterance: '承認待ちの経費を確認して' },
  { label: '従業員管理',     utterance: '従業員管理を開いて' },
  { label: 'シフト管理',     utterance: 'シフト管理を開いて' },
  { label: '勤怠管理',       utterance: '勤怠管理を開いて' },
  { label: 'AI分析',         utterance: 'AI分析を開いて' },
]

// シンプルなCSSアニメーションのAI Core（CONSOLE版）
function ConsoleAICore({ mode }: { mode: string }) {
  const isActive = mode === 'listening' || mode === 'processing' || mode === 'speaking'
  const baseGlow = isActive ? `0 0 60px ${G}80, 0 0 120px ${G}40` : `0 0 30px ${G}40`

  return (
    <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
      <style>{`
        @keyframes ca-cw  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ca-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes ca-pulse { 0%,100% { opacity: 0.7; transform: scale(0.97); } 50% { opacity: 1; transform: scale(1.03); } }
        @media (prefers-reduced-motion: reduce) { [class*="ca-"] { animation-duration: 60s !important; } }
      `}</style>

      {/* Outer ring */}
      <svg width="240" height="240" viewBox="0 0 240 240" style={{ position: 'absolute', overflow: 'visible' }}>
        <g style={{ transformOrigin: '120px 120px', animation: `ca-cw ${isActive ? '6s' : '20s'} linear infinite` }}>
          <circle cx="120" cy="120" r="110" fill="none" stroke={G} strokeWidth="0.5" strokeDasharray="4 16" opacity="0.4" />
        </g>
        <g style={{ transformOrigin: '120px 120px', animation: `ca-ccw ${isActive ? '3.5s' : '12s'} linear infinite` }}>
          <circle cx="120" cy="120" r="88" fill="none" stroke={G} strokeWidth="1" strokeDasharray="20 8 6 12" opacity="0.6" />
        </g>
        <g style={{ transformOrigin: '120px 120px', animation: `ca-cw ${isActive ? '2s' : '8s'} linear infinite` }}>
          <circle cx="120" cy="120" r="66" fill="none" stroke={GB} strokeWidth="1.5" strokeDasharray="14 6" opacity="0.7" />
        </g>
        <circle cx="120" cy="120" r="44" fill="none" stroke={G} strokeWidth="0.5" opacity="0.35" />
        <defs>
          <radialGradient id="ca-core" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor={GB} />
            <stop offset="60%" stopColor="oklch(0.52 0.10 75)" />
            <stop offset="100%" stopColor="oklch(0.08 0.005 260)" />
          </radialGradient>
        </defs>
        <circle
          cx="120" cy="120" r="36"
          fill="url(#ca-core)"
          style={{
            animation: `ca-pulse ${isActive ? '0.8s' : '3s'} ease-in-out infinite`,
            filter: `brightness(${isActive ? 1.5 : 1}) drop-shadow(${baseGlow})`,
          }}
        />
      </svg>

      {/* CSS glow overlay */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        boxShadow: baseGlow, pointerEvents: 'none',
        animation: `ca-pulse ${isActive ? '0.8s' : '3s'} ease-in-out infinite`,
      }} />
    </div>
  )
}

// VoiceWave
function VoiceWave({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-[3px]" style={{ height: 20 }}>
      <style>{`@keyframes cw { 0%{transform:scaleY(0.3)} 100%{transform:scaleY(1)} }`}</style>
      {[0.4,0.7,1,0.7,0.4,0.6,0.9,0.6,0.4].map((h, i) => (
        <div key={i} className="w-[3px] rounded-full" style={{
          background: G, height: `${h * 100}%`, opacity: active ? 0.9 : 0.3,
          animation: active ? `cw ${0.55 + i * 0.09}s ${i * 0.07}s ease-in-out infinite alternate` : 'none',
          transformOrigin: 'bottom',
        }} />
      ))}
    </div>
  )
}

export default function ConsoleAssistantPage() {
  const router = useRouter()
  const {
    mode, errorMessage, messages, isSpeechSupported,
    startListening, stopAll, handleUtterance,
    isSession, startSession, stopSession,
  } = useConsoleVoiceAssistant()

  const isActive = mode === 'listening'
  const isProc   = mode === 'processing'
  const isSpeak  = mode === 'speaking'
  const isError  = mode === 'error'

  const stateText = STATE_TEXT[mode] ?? STATE_TEXT.idle

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - var(--header-height, 64px))' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${G}20` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full" style={{ background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: 'oklch(0.75 0.009 75)' }}>
            AI ENGINE
          </span>
          {isSession && (
            <span className="ml-2 text-xs rounded-full px-2 py-0.5 font-bold"
              style={{ background: `${G}28`, border: `1px solid ${G}`, color: GB }}>
              会話中
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <VoiceWave active={isActive || isSpeak} />
          <button
            onClick={() => router.push('/dashboard')}
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ color: GD }}
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main: 2-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Quick Commands */}
        <aside
          className="hidden lg:flex flex-col gap-3 p-4 shrink-0 overflow-y-auto"
          style={{ width: 220, borderRight: `1px solid ${G}1a` }}
        >
          <div className="rounded-xl p-3" style={{ background: `${G}0e`, border: `1px solid ${G}2a` }}>
            <p className="text-base font-black tracking-[0.08em]" style={{
              background: `linear-gradient(90deg, ${G}, ${GB})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {VOICE_ASSISTANT_NAME}
            </p>
            <p className="text-[9px] tracking-[0.22em] uppercase mt-0.5" style={{ color: GD }}>
              CONSOLE ASSISTANT
            </p>
          </div>

          <p className="text-[9px] tracking-[0.25em] uppercase px-1 mt-1" style={{ color: GD }}>
            QUICK COMMANDS
          </p>
          {QUICK_COMMANDS.map(({ label, utterance }) => (
            <button
              key={label}
              onClick={() => handleUtterance(utterance)}
              disabled={isActive || isProc}
              className="rounded-lg px-3 py-2 text-xs font-medium text-left transition-all active:scale-95 disabled:opacity-40"
              style={{ background: `${G}08`, border: `1px solid ${G}20`, color: 'oklch(0.70 0.008 75)' }}
            >
              {label}
            </button>
          ))}
        </aside>

        {/* Center */}
        <main className="flex flex-1 flex-col items-center overflow-y-auto px-4 pt-8 pb-6 gap-6">

          <ConsoleAICore mode={mode} />

          {/* Status */}
          <div
            className="w-full max-w-md rounded-xl px-5 py-4 text-center"
            style={{ background: `${G}09`, border: `1px solid ${G}1a` }}
          >
            <p className="text-base leading-relaxed" style={{ color: isError ? 'oklch(0.78 0.24 22)' : 'oklch(0.82 0.009 75)' }}>
              {isError ? (errorMessage || stateText) : stateText}
            </p>
            {(isActive || isSpeak) && (
              <div className="flex justify-center mt-3"><VoiceWave active /></div>
            )}
          </div>

          {/* Transcript */}
          {messages.length > 0 && (
            <div className="w-full max-w-md space-y-2">
              {messages.slice(-4).map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[82%] rounded-xl px-4 py-2.5 text-sm leading-relaxed"
                    style={msg.role === 'user'
                      ? { background: `${G}1e`, border: `1px solid ${G}38`, color: GB }
                      : { background: 'oklch(0.09 0.004 260)', border: '1px solid oklch(0.14 0.003 260)', color: 'oklch(0.82 0.008 75)' }
                    }
                  >
                    <p className="text-[8px] tracking-[0.2em] uppercase mb-1" style={{ color: GD }}>
                      {msg.role === 'user' ? 'YOU' : VOICE_ASSISTANT_NAME}
                    </p>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mic buttons */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => { if (isActive || isProc) { stopAll(); } else { startListening() } }}
                disabled={isProc || isSession}
                className="flex h-16 w-16 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-40"
                style={{
                  background: isActive ? 'oklch(0.62 0.24 22)' : `linear-gradient(135deg, ${G}, ${GB})`,
                  boxShadow: isActive ? '0 0 24px oklch(0.62 0.24 22 / 0.5)' : `0 0 24px ${G}55`,
                }}
                aria-label={isActive ? '停止' : '1回話す'}
              >
                {isActive ? <MicOff className="h-7 w-7 text-white" /> : <Mic className="h-7 w-7" style={{ color: 'oklch(0.06 0.003 260)' }} />}
              </button>
              <span className="text-[10px]" style={{ color: GD }}>1回話す</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => { if (isSession) stopSession(); else startSession() }}
                disabled={isProc}
                className="flex h-16 w-16 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-40"
                style={{
                  background: isSession ? `${G}20` : `${G}10`,
                  border: `2px solid ${isSession ? G : `${G}30`}`,
                  boxShadow: isSession ? `0 0 20px ${G}50` : 'none',
                }}
                aria-label={isSession ? '会話終了' : 'ハンズフリー開始'}
              >
                <Radio className="h-6 w-6" style={{ color: isSession ? GB : GD }} />
              </button>
              <span className="text-[10px]" style={{ color: GD }}>
                {isSession ? '会話中' : 'ハンズフリー'}
              </span>
            </div>
          </div>

          {/* Mobile Quick Commands */}
          <div className="lg:hidden w-full max-w-md">
            <p className="text-[9px] tracking-[0.3em] uppercase mb-2" style={{ color: GD }}>QUICK COMMANDS</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_COMMANDS.map(({ label, utterance }) => (
                <button
                  key={label}
                  onClick={() => handleUtterance(utterance)}
                  disabled={isActive || isProc}
                  className="rounded-lg px-3 py-2 text-xs font-medium transition-all active:scale-95 disabled:opacity-40 text-left"
                  style={{ background: `${G}10`, border: `1px solid ${G}28`, color: 'oklch(0.70 0.008 75)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!isSpeechSupported && (
            <p className="text-xs text-center" style={{ color: 'oklch(0.50 0.007 75)' }}>
              このブラウザでは音声入力を利用できません。Chrome または Safari をご使用ください。
            </p>
          )}
        </main>
      </div>
    </div>
  )
}
