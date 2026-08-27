'use client'

import * as React from 'react'
import { useRouter }           from 'next/navigation'
import { Settings, Volume2, Home, Bell, Zap, X, Mic, Bot, Users, FileText, Calendar } from 'lucide-react'
import { ConsoleHikaruCore }   from '@/components/voice/ConsoleHikaruCore'
import { useConsoleJarvis }    from '@/lib/voice/ConsoleVoiceContext'
import { browserTTS }          from '@/lib/voice/tts/browser'
import { VOICE_ASSISTANT_NAME } from '@/lib/voice/config'
import type { VoiceSettings }  from '@/lib/voice/state/types'

// ============================================================
// CONSOLE JARVIS — System JARVIS UI Mirror
// Visual 100% System準拠。Voice Logic は ConsoleVoiceContext のまま。
// ============================================================

const BG   = '#020202'
const GD   = '#FFD700'
const GB   = '#FFE878'
const GDim = 'rgba(255,215,0,0.45)'
const GBdr = 'rgba(255,215,0,0.22)'

// Console-specific status items (same visual language as System)
const STATUS_ITEMS = [
  { key:'idle',       label:'STANDBY',    sub:'待機中',        color:'#C89010', dot:'#AA7800' },
  { key:'connecting', label:'CONNECTING', sub:'接続中',        color:'#00AFFF', dot:'#00AFFF' },
  { key:'listening',  label:'LISTENING',  sub:'聞いています',  color:'#FFD700', dot:'#FFD700' },
  { key:'processing', label:'THINKING',   sub:'考えています',  color:'#FFB800', dot:'#FFB800' },
  { key:'speaking',   label:'SPEAKING',   sub:'応答しています', color:'#00D860', dot:'#00D860' },
  { key:'error',      label:'ERROR',      sub:'接続エラー',    color:'#FF3030', dot:'#FF3030' },
] as const

type StatusKey = typeof STATUS_ITEMS[number]['key']

// Console JARVIS Quick Actions (Console-specific business actions)
const QUICK = [
  { label:'ダッシュボード', utt:'ダッシュボード',             Icon:Home   },
  { label:'通知確認',       utt:'通知を確認して',             Icon:Bell   },
  { label:'案件管理',       utt:'案件管理を開いて',           Icon:FileText},
  { label:'従業員管理',     utt:'従業員管理を開いて',         Icon:Users  },
  { label:'シフト管理',     utt:'シフト管理を開いて',         Icon:Calendar},
  { label:'経費確認',       utt:'承認待ちの経費を確認して',   Icon:Zap    },
  { label:'AI分析',         utt:'AI分析を開いて',             Icon:Bot    },
  { label:'設定',           utt:'設定を開いて',               Icon:Settings},
]

// ─── Wave bars ───────────────────────────────────────────────
function Wave({ active, h: mH = 18 }: { active: boolean; h?: number }) {
  const v = [.25,.48,.70,.92,1,.94,.74,.94,1,.80,.56,.30]
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:mH }}>
      <style>{`@keyframes jvw2{0%{transform:scaleY(.09)}100%{transform:scaleY(1)}}`}</style>
      {v.map((val, i) => (
        <div key={i} style={{
          width:3, borderRadius:2, height:`${val*mH}px`,
          background: active ? GB : GDim, opacity: active ? .88 : .22,
          animation: active ? `jvw2 ${.38+i*.07}s ease-in-out ${i*.055}s infinite alternate` : 'none',
          transformOrigin:'bottom',
        }}/>
      ))}
    </div>
  )
}

// ─── Clock ───────────────────────────────────────────────────
function Clock() {
  const [t, setT] = React.useState('')
  React.useEffect(() => {
    const f = () => setT(new Date().toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit', second:'2-digit'}))
    f(); const id = setInterval(f, 1000); return () => clearInterval(id)
  }, [])
  return <>{t}</>
}

// ─── Voice Settings Panel ─────────────────────────────────────
function SettingsPanel({ settings, onClose, onSave }: {
  settings: VoiceSettings; onClose: () => void; onSave: (s: VoiceSettings) => void
}) {
  const [l,  setL]  = React.useState<VoiceSettings>(settings)
  const [vs, setVs] = React.useState<SpeechSynthesisVoice[]>([])
  React.useEffect(() => {
    const f = () => { if (typeof window === 'undefined') return; setVs(window.speechSynthesis.getVoices()) }
    f(); window.speechSynthesis.addEventListener?.('voiceschanged', f)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', f)
  }, [])
  const all = vs.filter(v => v.lang.startsWith('ja'))
  return (
    <div style={{position:'absolute',inset:0,zIndex:30,background:'#040404',border:`1px solid ${GBdr}`,
      display:'flex',flexDirection:'column',padding:20,overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:18}}>
        <span style={{color:GB,fontSize:12,fontWeight:700,letterSpacing:'.18em',fontFamily:'monospace'}}>VOICE SETTINGS</span>
        <button onClick={onClose} style={{color:GDim,background:'none',border:'none',cursor:'pointer'}}><X style={{width:15,height:15}}/></button>
      </div>
      <label style={{color:GDim,fontSize:9,letterSpacing:'.2em',fontFamily:'monospace',marginBottom:5}}>音声</label>
      <select value={l.voiceURI} onChange={e => setL(p => ({...p, voiceURI:e.target.value}))}
        style={{background:'rgba(255,200,0,.06)',border:`1px solid ${GBdr}`,color:GB,borderRadius:8,padding:'6px 8px',fontSize:12,marginBottom:14}}>
        <option value="">自動</option>
        {all.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
      </select>
      {(['rate','pitch','volume'] as const).map(k => (
        <div key={k} style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:GDim,fontSize:9,letterSpacing:'.2em',fontFamily:'monospace'}}>{{rate:'速度',pitch:'ピッチ',volume:'音量'}[k]}</span>
            <span style={{color:GB,fontSize:9,fontFamily:'monospace'}}>{l[k].toFixed(1)}</span>
          </div>
          <input type="range" min={k==='pitch'?0:k==='volume'?0:.5} max={k==='volume'?1:2} step={.1}
            value={l[k]} onChange={e => setL(p => ({...p, [k]:parseFloat(e.target.value)}))}
            style={{width:'100%',accentColor:GD}}/>
        </div>
      ))}
      <div style={{display:'flex',gap:8,marginTop:4}}>
        <button onClick={() => browserTTS.speak(`こんにちは。私は${VOICE_ASSISTANT_NAME}です。`,undefined,l)}
          style={{flex:1,padding:'8px 0',borderRadius:10,border:`1px solid ${GBdr}`,background:'none',color:GB,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
          <Volume2 style={{width:13,height:13}}/>試聴
        </button>
        <button onClick={() => { onSave(l); onClose() }}
          style={{flex:1,padding:'8px 0',borderRadius:10,border:`1px solid ${GD}`,background:'rgba(255,215,0,.12)',color:GB,cursor:'pointer',fontSize:12,fontWeight:700}}>
          保存
        </button>
      </div>
    </div>
  )
}

// ─── Responsive JARVIS HUD ────────────────────────────────────
function JarvisHUD({ mode, isConnecting, onClick }: {
  mode: string; isConnecting: boolean; onClick: () => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [sz,  setSz]  = React.useState(360)
  const [hov, setHov] = React.useState(false)
  React.useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => {
      const cw = e.contentRect.width, ch = e.contentRect.height
      const s  = Math.floor(Math.min(cw, ch) / 1.04)
      setSz(Math.min(Math.max(s, 180), 700))
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:0,overflow:'hidden'}}>
      <ConsoleHikaruCore
        mode={mode as any}
        size={sz}
        isConnecting={isConnecting}
        onClick={onClick}
        isHovered={hov}
      />
    </div>
  )
}

// ─── Circuit Background ───────────────────────────────────────
function CircuitBackground({ mode }: { mode: string }) {
  const bright = (mode === 'listening' || mode === 'speaking') ? 1.35
               : (mode === 'processing' || mode === 'working')  ? 1.18 : 1.0
  const f = (b: number) => (b * bright).toFixed(3)

  return (
    <div
      aria-hidden="true"
      style={{ position:'absolute', inset:0, zIndex:-1, pointerEvents:'none', overflow:'hidden' }}
    >
      <style>{`
        @keyframes cbg-f1{to{stroke-dashoffset:-500}}
        @keyframes cbg-f2{to{stroke-dashoffset:360}}
        @keyframes cbg-nd{0%,100%{opacity:.26}50%{opacity:.84}}
        @keyframes cbg-sc{0%{opacity:0;left:-12%}18%{opacity:1}82%{opacity:.5}100%{opacity:0;left:115%}}
        @keyframes cbg-gl{0%,100%{opacity:.60}50%{opacity:1}}
        @media(prefers-reduced-motion:reduce){.cbg-a{animation:none!important}}
      `}</style>

      {/* Base: near-black gradient */}
      <div style={{ position:'absolute', inset:0,
        background:'radial-gradient(ellipse 58% 68% at 43% 50%,#050604 0%,#030504 42%,#020302 100%)' }}/>

      {/* Central ambient gold glow */}
      <div className="cbg-a" style={{
        position:'absolute', left:'22%', top:'8%', width:'46%', height:'84%',
        background:`radial-gradient(ellipse at 40% 50%,rgba(212,175,55,${f(0.05)}) 0%,rgba(185,148,18,${f(0.018)}) 42%,transparent 70%)`,
        animation:'cbg-gl 7s ease-in-out infinite',
      }}/>

      {/* SVG circuit network */}
      <svg viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%',
          maskImage:'linear-gradient(to right,black 0%,black 60%,rgba(0,0,0,.15) 84%,transparent 100%)',
          WebkitMaskImage:'linear-gradient(to right,black 0%,black 60%,rgba(0,0,0,.15) 84%,transparent 100%)',
        }}>

        {/* BACK LAYER: structural skeleton */}
        <g stroke={`rgba(212,175,55,${f(0.030)})`} fill="none" strokeWidth=".5" strokeLinecap="square">
          <path d="M0,185 L260,185 L260,240"/><path d="M0,375 L105,375"/>
          <path d="M0,565 L165,565 L165,515"/><path d="M155,0 L155,265"/>
          <path d="M430,0 L430,175"/><path d="M155,490 L155,750"/><path d="M430,595 L430,750"/>
        </g>

        {/* MID LAYER: main circuit arms */}
        <g fill="none" strokeLinecap="square">
          {/* ARM 1 top-left */}
          <path d="M430,332 L430,268 L368,268 L368,208 L298,208 L218,208 L218,152 L138,152"
            stroke={`rgba(212,175,55,${f(0.065)})`} strokeWidth="1"/>
          <path d="M368,268 L328,268 L328,322" stroke={`rgba(212,175,55,${f(0.028)})`} strokeWidth=".6"/>
          <path d="M298,208 L248,208 L248,258" stroke={`rgba(212,175,55,${f(0.022)})`} strokeWidth=".6"/>
          {/* ARM 2 top-right */}
          <path d="M458,332 L458,252 L528,252 L568,192 L682,192 L764,152"
            stroke={`rgba(212,175,55,${f(0.065)})`} strokeWidth="1"/>
          <path d="M528,252 L528,308 L588,308" stroke={`rgba(212,175,55,${f(0.022)})`} strokeWidth=".6"/>
          {/* ARM 3 right */}
          <path d="M480,375 L562,375 L602,332 L728,332 L836,332"
            stroke={`rgba(212,175,55,${f(0.065)})`} strokeWidth="1"/>
          <path d="M728,332 L728,282 L798,282" stroke={`rgba(212,175,55,${f(0.022)})`} strokeWidth=".6"/>
          <path d="M602,332 L602,282 L648,282" stroke={`rgba(212,175,55,${f(0.020)})`} strokeWidth=".6"/>
          {/* ARM 4 bottom-right */}
          <path d="M458,418 L458,502 L542,502 L582,562 L708,562 L812,602"
            stroke={`rgba(212,175,55,${f(0.065)})`} strokeWidth="1"/>
          <path d="M582,562 L582,502 L648,502" stroke={`rgba(212,175,55,${f(0.022)})`} strokeWidth=".6"/>
          {/* ARM 5 bottom */}
          <path d="M430,418 L430,532 L368,532 L368,638 L278,638 L198,698"
            stroke={`rgba(212,175,55,${f(0.065)})`} strokeWidth="1"/>
          <path d="M368,532 L318,532 L318,592" stroke={`rgba(212,175,55,${f(0.020)})`} strokeWidth=".6"/>
          {/* ARM 6 bottom-left */}
          <path d="M398,418 L338,418 L278,478 L178,478 L98,522"
            stroke={`rgba(212,175,55,${f(0.065)})`} strokeWidth="1"/>
          {/* ARM 7 left */}
          <path d="M378,375 L288,375 L248,412 L138,412 L52,412"
            stroke={`rgba(212,175,55,${f(0.065)})`} strokeWidth="1"/>
          <path d="M288,375 L288,322 L222,322 L118,322" stroke={`rgba(212,175,55,${f(0.022)})`} strokeWidth=".6"/>
          {/* Teal accents */}
          <path d="M378,375 L278,375 L238,332 L132,332 L52,332"
            stroke={`rgba(0,210,210,${f(0.028)})`} strokeWidth=".6"/>
          <path d="M430,418 L430,552 L462,584 L462,668 L536,668"
            stroke={`rgba(0,200,218,${f(0.022)})`} strokeWidth=".6"/>
        </g>

        {/* DATA FLOW: animated dash */}
        <g fill="none" strokeLinecap="round">
          <path d="M430,332 L430,268 L368,268 L368,208 L298,208 L218,208 L218,152"
            stroke={`rgba(255,210,60,${f(0.080)})`} strokeWidth="1.4" strokeDasharray="16 110"
            className="cbg-a" style={{animation:'cbg-f1 9s linear infinite'}}/>
          <path d="M836,332 L728,332 L602,332 L562,375 L480,375"
            stroke={`rgba(255,210,60,${f(0.072)})`} strokeWidth="1.2" strokeDasharray="13 95"
            className="cbg-a" style={{animation:'cbg-f2 11s linear infinite'}}/>
          <path d="M52,412 L138,412 L248,412 L288,375 L378,375"
            stroke={`rgba(255,210,60,${f(0.062)})`} strokeWidth="1.0" strokeDasharray="11 85"
            className="cbg-a" style={{animation:'cbg-f1 13s linear infinite 4s'}}/>
          <path d="M536,668 L462,668 L462,584 L430,552 L430,418"
            stroke={`rgba(0,215,210,${f(0.036)})`} strokeWidth="1.0" strokeDasharray="10 72"
            className="cbg-a" style={{animation:'cbg-f2 15s linear infinite 6.5s'}}/>
        </g>

        {/* NODES */}
        {([
          [430,268,2.0],[368,208,1.8],[298,208,1.5],
          [528,252,1.8],[728,332,1.6],[602,332,1.5],
          [458,502,1.5],[582,562,1.8],[368,532,1.5],
          [288,375,1.6],[248,412,1.4],[328,268,1.2],[248,258,1.0],[528,308,1.0],
        ] as [number,number,number][]).map(([x,y,r],i)=>(
          <circle key={i} cx={x} cy={y} r={r}
            fill={`rgba(255,210,60,${f(0.10)})`} className="cbg-a"
            style={{animation:`cbg-nd ${(3.2+(i%4)*.7).toFixed(1)}s ease-in-out ${((i*.35)%2.8).toFixed(1)}s infinite`}}/>
        ))}
        {([
          [462,584,1.2],[430,552,1.0],[238,332,1.0],
        ] as [number,number,number][]).map(([x,y,r],i)=>(
          <circle key={i} cx={x} cy={y} r={r}
            fill={`rgba(0,215,210,${f(0.052)})`} className="cbg-a"
            style={{animation:`cbg-nd ${(4+i*.8).toFixed(1)}s ease-in-out ${(i*1.2).toFixed(1)}s infinite`}}/>
        ))}

        {/* HUD ARCS */}
        <g fill="none">
          <path d="M 188,375 A 242,242 0 0 1 672,375"
            stroke={`rgba(212,175,55,${f(0.020)})`} strokeWidth=".55"/>
          <path d="M 295,278 A 146,146 0 0 1 565,278"
            stroke={`rgba(212,175,55,${f(0.016)})`} strokeWidth=".45"/>
          <path d="M 278,448 A 162,162 0 0 0 582,448"
            stroke={`rgba(212,175,55,${f(0.013)})`} strokeWidth=".40"/>
          {Array.from({length:7},(_,i)=>{
            const deg=-152+i*50, r=242, acx=430, acy=375
            const a=deg*Math.PI/180
            return <line key={i}
              x1={acx+(r-9)*Math.cos(a)} y1={acy+(r-9)*Math.sin(a)}
              x2={acx+r*Math.cos(a)}     y2={acy+r*Math.sin(a)}
              stroke={`rgba(212,175,55,${f(0.024)})`}
              strokeWidth={i%3===0?.9:.4}/>
          })}
        </g>
      </svg>

      {/* Slow scan line */}
      <div className="cbg-a" style={{
        position:'absolute', top:0, bottom:0, left:0, width:'180px',
        background:'linear-gradient(to right,transparent 0%,rgba(212,175,55,0.046) 50%,transparent 100%)',
        animation:'cbg-sc 20s ease-in-out infinite',
      }}/>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export default function ConsoleAssistantPage() {
  const router = useRouter()
  const [showSettings, setShowSettings] = React.useState(false)

  const {
    mode, errorMessage,
    isSession, isStandby, isSpeechSupported,
    startSession, stopSession, handleUtterance,
    voiceSettings, setVoiceSettings,
    voiceEngineMode, disconnectRealtime,
    messages,
  } = useConsoleJarvis()

  const isErr   = mode === 'error'
  const isActive = mode === 'listening'
  const isProc  = mode === 'processing'
  const isSpeak = mode === 'speaking'
  const isConn  = voiceEngineMode === 'realtime-connecting'
  const isReady = voiceEngineMode === 'realtime'
  const cfgKey  = isConn ? 'connecting' : mode as StatusKey

  const cur = STATUS_ITEMS.find(s => s.key === cfgKey) ?? STATUS_ITEMS[0]

  const toggleSession = () => isSession ? stopSession() : startSession()

  // Conversation: last 4 messages
  const recentMsgs = messages.slice(-4)

  // Suppress unused variable warning
  void isSpeechSupported

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100dvh - var(--header-height, 64px))',background:BG,position:'relative',overflow:'hidden',isolation:'isolate'}}>
      <CircuitBackground mode={mode}/>
      <style>{`
        .jp-right{
          display:flex;flex-direction:column;
          width:240px;flex-shrink:0;
          border-left:1px solid ${GBdr};
          background:#030303;overflow-y:auto;
        }
        @media(max-width:880px){.jp-right{display:none!important}}
        @keyframes jconn{0%,100%{opacity:.3}50%{opacity:1}}
        .jqbtn:hover{background:rgba(255,215,0,0.10)!important}
      `}</style>

      {showSettings && (
        <SettingsPanel
          settings={voiceSettings}
          onClose={() => setShowSettings(false)}
          onSave={setVoiceSettings}
        />
      )}

      {/* ── Header ── */}
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'8px 18px',flexShrink:0,
        borderBottom:`1px solid ${GBdr}`,background:'rgba(0,0,0,.88)',zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 7px #4ade80'}}/>
          <span style={{color:GDim,fontSize:9,letterSpacing:'.22em',fontFamily:'monospace'}}>AI ENGINE</span>
          <span style={{color:GDim,fontSize:9,fontFamily:'monospace',opacity:.5}}><Clock/></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {isSession && (
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 12px',borderRadius:20,
              background:'rgba(255,215,0,.14)',border:`1px solid ${GD}`,
              boxShadow:`0 0 12px rgba(255,215,0,.32)`}}>
              <div style={{width:6,height:6,borderRadius:'50%',
                background:isStandby?GDim:'#4ade80',
                animation:'jconn 1.2s ease-in-out infinite'}}/>
              <span style={{color:GB,fontSize:9,fontWeight:700,letterSpacing:'.16em',fontFamily:'monospace'}}>
                {isStandby?'STANDBY':'ACTIVE'}
              </span>
            </div>
          )}
          <Wave active={isActive||isSpeak}/>
          <button onClick={() => setShowSettings(p => !p)}
            style={{color:GDim,background:'none',border:'none',cursor:'pointer',display:'flex',padding:4}}
            aria-label="設定"><Settings style={{width:15,height:15}}/></button>
          <button onClick={() => router.push('/dashboard')}
            style={{color:GDim,background:'none',border:'none',cursor:'pointer',display:'flex',padding:4}}
            aria-label="閉じる"><X style={{width:15,height:15}}/></button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ── Center: JARVIS HUD ── */}
        <main style={{display:'flex',flex:1,flexDirection:'column',overflow:'hidden',padding:'4px 0 4px'}}>

          <JarvisHUD mode={mode} isConnecting={isConn} onClick={toggleSession}/>

          {/* Tap label */}
          <div style={{textAlign:'center',flexShrink:0,padding:'3px 0 2px'}}>
            <span style={{color:isSession?GB:GDim,fontSize:10,fontFamily:'monospace',letterSpacing:'.12em'}}>
              {isSession
                ? (isStandby ? 'スタンバイ中 — 話しかけてください' : 'JARVISをタップして起動 / 停止')
                : 'JARVISをタップして起動 / 停止'}
            </span>
            {isErr && <span style={{color:'#FF5555',fontSize:9,fontFamily:'monospace',marginLeft:8}}>{errorMessage||'接続エラー'}</span>}
          </div>

          {/* Bottom status bar */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:18,
            padding:'4px 16px 3px',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:5,height:5,borderRadius:'50%',
                background:isReady?'#4ade80':isConn?'#FFB800':isErr?'#FF4444':GDim,
                boxShadow:isReady?'0 0 5px #4ade80':isConn?'0 0 5px #FFB800':'none',
                animation:isConn?'jconn 1.2s ease-in-out infinite':undefined}}/>
              <span style={{color:GDim,fontSize:9,fontFamily:'monospace'}}>
                {isReady?'READY':isConn?'CONNECTING':isErr?'ERROR':'STANDBY'}
              </span>
            </div>
            <span style={{color:GBdr,fontSize:9}}>|</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <Mic style={{color:GDim,width:11,height:11}}/>
              <span style={{color:isSession?GD:GDim,fontSize:9,fontWeight:isSession?700:400,fontFamily:'monospace'}}>
                MIC {isSession?'ON':'OFF'}
              </span>
              <div style={{width:5,height:5,borderRadius:'50%',background:isSession?GD:'#555',boxShadow:isSession?`0 0 5px ${GD}`:'none'}}/>
            </div>
            <Wave active={isActive||isSpeak} h={14}/>
            <span style={{color:GB,fontSize:9,fontWeight:700,fontFamily:'monospace',letterSpacing:'.08em'}}>HIKARU AI</span>
          </div>
        </main>

        {/* ── Right Panel ── */}
        <aside className="jp-right">
          <div style={{display:'flex',flexDirection:'column',padding:'16px 16px 12px',flex:1,gap:0}}>

            {/* STATUS: current only */}
            <div style={{marginBottom:16}}>
              <div style={{color:GDim,fontSize:9,fontWeight:700,letterSpacing:'.22em',fontFamily:'monospace',marginBottom:10}}>
                STATUS
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                borderRadius:12,border:`1px solid ${GBdr}`,background:'rgba(255,215,0,.04)'}}>
                <div style={{
                  width:10,height:10,borderRadius:'50%',flexShrink:0,
                  background:cur.dot,
                  boxShadow:`0 0 8px ${cur.dot},0 0 18px ${cur.dot}55`,
                  transition:'all .35s',
                }}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{
                    fontSize:13,fontWeight:700,color:cur.color,
                    fontFamily:'monospace',letterSpacing:'.10em',
                    textShadow:isSession?`0 0 10px ${cur.color}`:undefined,
                    transition:'all .35s',
                  }}>
                    {cur.label}
                  </div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,.55)',marginTop:1}}>{cur.sub}</div>
                </div>
                <Wave active={isActive||isSpeak} h={18}/>
              </div>
              {isReady && (
                <button onClick={disconnectRealtime}
                  style={{marginTop:8,fontSize:9,color:GDim,background:'none',
                    border:`1px solid ${GBdr}`,cursor:'pointer',borderRadius:6,
                    padding:'3px 8px',fontFamily:'monospace',width:'100%'}}>
                  切断
                </button>
              )}
            </div>

            {/* CONVERSATION */}
            <div style={{marginBottom:16,flex:'1 1 auto',overflow:'hidden',display:'flex',flexDirection:'column'}}>
              <div style={{color:GDim,fontSize:9,fontWeight:700,letterSpacing:'.22em',fontFamily:'monospace',marginBottom:10}}>
                CONVERSATION
              </div>
              <div style={{
                flex:1,overflow:'hidden',display:'flex',flexDirection:'column',gap:0,
                maskImage:'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
                WebkitMaskImage:'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
              }}>
                {recentMsgs.length === 0 ? (
                  <div style={{color:'rgba(255,215,0,.28)',fontSize:10,fontStyle:'italic',paddingTop:4}}>
                    まだ会話がありません
                  </div>
                ) : (
                  recentMsgs.map((msg, i) => (
                    <div key={i} style={{
                      marginBottom:10,
                      paddingBottom:8,
                      borderBottom: i < recentMsgs.length - 1
                        ? '1px solid rgba(255,215,0,0.07)' : 'none',
                    }}>
                      <div style={{
                        fontSize:9,fontWeight:700,fontFamily:'monospace',
                        letterSpacing:'.16em',
                        color: msg.role==='user' ? GD : GB,
                        marginBottom:3,
                      }}>
                        {msg.role==='user' ? 'YOU' : 'JARVIS'}
                      </div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,.80)',lineHeight:1.45,overflow:'hidden',maxHeight:'4.35em'}}>
                        {msg.text.length > 130 ? msg.text.slice(0,128) + '…' : msg.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* QUICK ACTION — Console business actions */}
            <div style={{marginBottom:14,flexShrink:0}}>
              <div style={{color:GDim,fontSize:9,fontWeight:700,letterSpacing:'.22em',fontFamily:'monospace',marginBottom:8}}>
                QUICK ACTION
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {QUICK.map(({label, utt, Icon}) => (
                  <button key={label} onClick={() => handleUtterance(utt)}
                    disabled={isActive||isProc}
                    className="jqbtn"
                    style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                      gap:5,padding:'10px 4px',borderRadius:10,
                      border:`1px solid ${GBdr}`,background:'rgba(255,215,0,.04)',
                      color:'rgba(255,255,255,.65)',cursor:'pointer',fontSize:10,
                      opacity:isActive||isProc?.4:1,transition:'background .18s'}}>
                    <Icon style={{color:GDim,width:18,height:18}}/>
                    <span style={{lineHeight:1.3,textAlign:'center'}}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Settings */}
            <button onClick={() => setShowSettings(true)}
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px 0',
                borderRadius:10,border:`1px solid ${GBdr}`,background:'rgba(255,215,0,.04)',
                color:GDim,cursor:'pointer',fontSize:10,fontFamily:'monospace',
                letterSpacing:'.14em',flexShrink:0,transition:'background .18s'}}>
              <Settings style={{width:13,height:13}}/>音声設定
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
