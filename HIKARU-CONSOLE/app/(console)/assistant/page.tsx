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

// ─── Network Background — neural network / holographic ────────
// Static data outside component: zero-recreation cost
const _FAR: [number,number][] = [
  [58,45],[168,72],[292,40],[510,30],[672,52],[838,40],[945,88],
  [952,195],[882,318],[942,482],[858,598],[782,675],[638,718],[478,722],
  [318,698],[178,672],[65,618],[38,478],[42,285],[108,162],
]
const _MID: [number,number][] = [
  [118,142],[248,118],[372,92],[588,108],[728,132],[868,172],
  [918,345],[872,468],[742,572],[602,632],[438,652],[288,625],
  [142,548],[78,418],[92,258],[186,198],[318,182],[488,175],
  [625,198],[762,228],[808,395],[724,482],[552,492],[378,472],
  [228,448],[152,338],
]
const _NEAR: [number,number][] = [
  [182,132],[542,85],[885,232],[875,532],[518,645],[192,528],[102,318],[682,378],
]
const _FEDG: [number,number][] = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],
  [9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,19],[19,0],
  [0,18],[2,17],[4,8],[9,12],[13,16],
]
const _MEDG: [number,number][] = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],
  [12,13],[13,14],[14,15],[15,0],[15,1],[0,14],[14,16],[2,16],[16,17],[17,3],[17,18],
  [18,4],[18,19],[5,19],[19,6],[20,7],[20,21],[21,8],[21,22],[22,9],[22,23],
  [23,10],[23,24],[24,11],[24,13],[25,13],[25,14],[25,24],[25,15],
]
const _FLOWS: [number,number,number,number,number,boolean][] = [
  [0,15,14,8,0,true],[5,6,7,6,2.5,false],[10,11,12,7.5,5,true],
  [2,3,4,9,1.5,false],[19,20,21,6.5,4,true],[23,24,13,10,7,false],
]
const _PARTS: [number,number,number,number,number][] = [
  [88,200,1.2,0,0],[195,80,1.0,1.5,1],[340,55,1.5,3,2],[620,38,1.2,0.8,3],
  [790,95,1.0,2.5,0],[910,180,1.3,4,1],[925,350,1.1,1.2,2],[905,440,1.2,5.5,3],
  [820,560,1.0,0.5,0],[695,660,1.3,3.5,1],[530,700,1.1,2,2],[375,710,1.2,6,3],
  [230,685,1.0,1,0],[115,600,1.4,4.5,1],[55,500,1.1,2.8,2],[48,370,1.2,0.3,3],
  [62,240,1.0,5,0],[140,108,1.3,1.8,1],[270,165,1.1,3.2,2],[455,140,1.2,6.5,3],
  [650,160,1.0,0.7,0],[810,285,1.4,2.2,1],[855,410,1.1,4.8,2],[760,535,1.2,1.5,3],
  [580,598,1.0,3.8,0],[415,610,1.3,5.2,1],[268,570,1.1,0.9,2],[142,488,1.2,2.7,3],
  [98,388,1.0,4.2,0],[130,288,1.3,1.3,1],[225,225,1.1,6.8,2],[348,145,1.2,2.0,3],
  [525,108,1.0,3.5,0],[688,128,1.4,5.8,1],[828,195,1.1,0.5,2],[895,295,1.2,4.0,3],
]
const _DRFT = ['nwbg-drift-a','nwbg-drift-b','nwbg-drift-c','nwbg-drift-d']
// Central protection zone fade: dim nodes/lines near JARVIS core (cx=430,cy=375)
function _cf(x: number, y: number): number {
  const d = Math.sqrt((x-430)**2+(y-375)**2)
  return d < 110 ? 0.12 : d < 185 ? 0.12+(d-110)/75*0.88 : 1.0
}
function _fp(ia: number, ib: number, ic: number): string {
  return `M${_MID[ia][0]},${_MID[ia][1]} L${_MID[ib][0]},${_MID[ib][1]} L${_MID[ic][0]},${_MID[ic][1]}`
}

function CircuitBackground({ mode }: { mode: string }) {
  const bright = (mode==='listening'||mode==='speaking') ? 1.40
               : (mode==='processing'||mode==='working')  ? 1.20 : 1.0
  const f = (b: number) => Math.min(1, b*bright).toFixed(3)

  return (
    <div aria-hidden="true"
      style={{position:'absolute',inset:0,zIndex:-1,pointerEvents:'none',overflow:'hidden'}}>
      <style>{`
        @keyframes nwbg-pulse    {0%,100%{opacity:.22}40%{opacity:.78}80%{opacity:.50}}
        @keyframes nwbg-pulse-br {0%,100%{opacity:.32}45%{opacity:.92}80%{opacity:.60}}
        @keyframes nwbg-flow-fwd {to{stroke-dashoffset:-600}}
        @keyframes nwbg-flow-rev {to{stroke-dashoffset:600}}
        @keyframes nwbg-drift-a  {0%{transform:translate(0,0)}50%{transform:translate(4px,-6px)}100%{transform:translate(0,0)}}
        @keyframes nwbg-drift-b  {0%{transform:translate(0,0)}50%{transform:translate(-5px,4px)}100%{transform:translate(0,0)}}
        @keyframes nwbg-drift-c  {0%{transform:translate(0,0)}50%{transform:translate(3px,6px)}100%{transform:translate(0,0)}}
        @keyframes nwbg-drift-d  {0%{transform:translate(0,0)}50%{transform:translate(-4px,-4px)}100%{transform:translate(0,0)}}
        @keyframes nwbg-breath   {0%,100%{opacity:.72}50%{opacity:1}}
        @keyframes nwbg-glow     {0%,100%{opacity:.58}50%{opacity:1}}
        @keyframes nwbg-scan     {0%{opacity:0;left:-15%}18%{opacity:1}82%{opacity:.45}100%{opacity:0;left:118%}}
        @media(prefers-reduced-motion:reduce){.nwbg-a{animation:none!important}}
      `}</style>

      {/* Base: deep space black */}
      <div style={{position:'absolute',inset:0,
        background:'radial-gradient(ellipse 65% 75% at 43% 50%,#050400 0%,#030200 45%,#010000 100%)'}}/>

      {/* Subtle radial energy — very dim gold glow behind JARVIS core */}
      <div className="nwbg-a" style={{
        position:'absolute',left:'16%',top:'4%',width:'55%',height:'92%',
        background:'radial-gradient(circle at 42% 50%,rgba(255,190,0,.12) 0%,rgba(255,160,0,.04) 38%,transparent 68%)',
        animation:'nwbg-glow 14s ease-in-out infinite',
      }}/>

      {/* SVG: main network */}
      <svg viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice"
        style={{position:'absolute',inset:0,width:'100%',height:'100%',
          maskImage:'linear-gradient(to right,black 0%,black 60%,rgba(0,0,0,.15) 83%,transparent 100%)',
          WebkitMaskImage:'linear-gradient(to right,black 0%,black 60%,rgba(0,0,0,.15) 83%,transparent 100%)',
        }}>

        {/* Layer 1: Far — very dark, 22s breath */}
        <g className="nwbg-a" style={{animation:'nwbg-breath 22s ease-in-out 0s infinite'}}>
          {_FEDG.map(([a,b],i)=>{
            const fade=Math.min(_cf(_FAR[a][0],_FAR[a][1]),_cf(_FAR[b][0],_FAR[b][1]))
            return <line key={i}
              x1={_FAR[a][0]} y1={_FAR[a][1]} x2={_FAR[b][0]} y2={_FAR[b][1]}
              stroke={`rgba(255,201,40,${f(0.14*fade)})`} strokeWidth=".6"/>
          })}
          {_FAR.map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r={1.3}
              fill={`rgba(255,201,40,${f(0.25*_cf(x,y))})`} className="nwbg-a"
              style={{animation:`nwbg-pulse ${6+i%5}s ease-in-out ${((i*.72)%9).toFixed(1)}s infinite`}}/>
          ))}
        </g>

        {/* Layer 2: Mid — main network, 16s breath */}
        <g className="nwbg-a" style={{animation:'nwbg-breath 16s ease-in-out 2.5s infinite'}}>
          {_MEDG.map(([a,b],i)=>{
            if(a>=_MID.length||b>=_MID.length) return null
            const fade=Math.min(_cf(_MID[a][0],_MID[a][1]),_cf(_MID[b][0],_MID[b][1]))
            return <line key={i}
              x1={_MID[a][0]} y1={_MID[a][1]} x2={_MID[b][0]} y2={_MID[b][1]}
              stroke={`rgba(255,216,74,${f(0.24*fade)})`} strokeWidth=".9"/>
          })}
          {_MID.map(([x,y],i)=>{
            const fade=_cf(x,y)
            return <circle key={i} cx={x} cy={y} r={i<6?2.5:i<18?2.0:1.8}
              fill={`rgba(255,216,74,${f(0.42*fade)})`} className="nwbg-a"
              style={{animation:`nwbg-pulse ${4+i%7}s ease-in-out ${((i*.42)%10).toFixed(1)}s infinite`}}/>
          })}
        </g>

        {/* Data flow — 6 paths, staggered timing */}
        {_FLOWS.map(([ia,ib,ic,dur,delay,fwd],fi)=>{
          const fade=_cf(_MID[ib][0],_MID[ib][1])
          return <path key={fi} d={_fp(ia,ib,ic)} fill="none"
            stroke={`rgba(255,232,109,${f(0.40*fade)})`}
            strokeWidth="1.6" strokeDasharray="14 85" strokeLinecap="round"
            className="nwbg-a"
            style={{animation:`${fwd?'nwbg-flow-fwd':'nwbg-flow-rev'} ${dur}s linear ${delay}s infinite`}}/>
        })}

        {/* Layer 3: Near bright accent nodes, 11s breath */}
        <g className="nwbg-a" style={{animation:'nwbg-breath 11s ease-in-out 1s infinite'}}>
          {_NEAR.map(([x,y],i)=>{
            const fade=_cf(x,y)
            const r=i<3?4.5:3.5
            return (
              <g key={i} className="nwbg-a"
                style={{animation:`nwbg-pulse-br ${3+i%4}s ease-in-out ${((i*.85)%6).toFixed(1)}s infinite`}}>
                <circle cx={x} cy={y} r={r*2.2} fill={`rgba(255,190,0,${f(0.08*fade)})`}/>
                <circle cx={x} cy={y} r={r}
                  fill={`rgba(255,232,109,${f(0.70*fade)})`}
                  style={{filter:`drop-shadow(0 0 4px rgba(255,210,60,${f(0.90*fade)}))`}}/>
              </g>
            )
          })}
        </g>

        {/* Digital particles — slow drift */}
        {_PARTS.map(([cx,cy,r,delay,dt],i)=>(
          <circle key={i} cx={cx} cy={cy} r={r}
            fill={`rgba(255,210,60,${f(0.30*_cf(cx,cy))})`} className="nwbg-a"
            style={{animation:`${_DRFT[dt]??_DRFT[0]} ${9+i%9}s ease-in-out ${delay}s infinite`}}/>
        ))}

        {/* Micro HUD labels — decorative only, very dim */}
        <g fill={`rgba(255,200,40,${f(0.070)})`}
          fontFamily="'Courier New',Courier,monospace" fontSize="7" letterSpacing="2">
          <text x="35"  y="442">NETWORK</text>
          <text x="842" y="335">AI CORE</text>
          <text x="65"  y="588">DATA STREAM</text>
          <text x="775" y="182">NEURAL LINK</text>
          <text x="308" y="46" >SYSTEM</text>
          <text x="545" y="728">VOICE LINK</text>
        </g>
      </svg>

      {/* Slow horizontal scan sweep */}
      <div className="nwbg-a" style={{
        position:'absolute',top:0,bottom:0,left:0,width:'200px',
        background:'linear-gradient(to right,transparent 0%,rgba(255,200,40,.060) 50%,transparent 100%)',
        animation:'nwbg-scan 28s ease-in-out infinite',
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
