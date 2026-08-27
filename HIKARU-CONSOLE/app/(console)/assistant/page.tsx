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

// ─── 03 Holographic Analysis Field ───────────────────────────
// Data points: [cx, cy, r, pulseDelay]
const _DP: [number,number,number,number][] = [
  [118,175,2.5,0],[285,82,1.8,1.5],[518,58,2.2,3.2],[722,118,2.5,0.8],
  [882,195,2.0,2.1],[918,382,2.5,4.0],[848,558,2.0,1.2],[682,648,2.5,5.5],
  [452,702,1.8,0.5],[262,658,2.2,3.8],[92,548,2.5,2.5],[55,378,2.0,0.9],
  [112,222,1.8,4.5],[582,158,2.5,1.8],[352,578,2.0,6.0],
  [762,452,2.5,2.8],[172,422,1.8,5.2],[632,578,2.2,0.3],
]
// Target/lock elements: [cx, cy, size]
const _TGT: [number,number,number][] = [
  [148,138,22],[722,128,18],[140,582,20],[802,558,18],[672,382,16],
]
// Center protection fade
function _hcf(x: number, y: number): number {
  const d = Math.sqrt((x-430)**2+(y-375)**2)
  return d < 120 ? 0.10 : d < 200 ? 0.10+(d-120)/80*0.90 : 1.0
}

function CircuitBackground({ mode }: { mode: string }) {
  const isListen = mode === 'listening'
  const isSpeak  = mode === 'speaking'
  const isProc   = mode === 'processing' || mode === 'working'
  const isIdle   = mode === 'idle'
  const bright   = isListen ? 1.00 : isSpeak ? 0.90 : isProc ? 0.82 : isIdle ? 0.55 : 0.68
  const f = (b: number) => Math.min(1, b * bright).toFixed(3)
  const cyanB = isListen ? 0.22 : 0.07

  return (
    <div aria-hidden="true"
      style={{position:'absolute',inset:0,zIndex:-1,pointerEvents:'none',overflow:'hidden'}}>
      <style>{`
        @keyframes holo-grid    {0%{background-position:0 0}100%{background-position:0 52px}}
        @keyframes holo-scanln  {0%{background-position-y:0}100%{background-position-y:-8px}}
        @keyframes holo-beam    {0%,3%{transform:translateY(-130px)}95%,100%{transform:translateY(1100px)}}
        @keyframes holo-arc-cw  {to{transform:rotate(360deg)}}
        @keyframes holo-arc-ccw {to{transform:rotate(-360deg)}}
        @keyframes holo-pulse   {0%,100%{opacity:.28}50%{opacity:.92}}
        @keyframes holo-pulsebr {0%,100%{opacity:.38}50%{opacity:1}}
        @keyframes holo-glow    {0%,100%{opacity:.58}50%{opacity:1}}
        @keyframes holo-tgt     {0%,100%{opacity:.32}50%{opacity:.75}}
        @keyframes holo-tgtsc   {0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        @keyframes holo-noise   {0%,50%{opacity:.010}25%,75%{opacity:.020}}
        @keyframes holo-fwd     {to{stroke-dashoffset:-380}}
        @keyframes holo-rev     {to{stroke-dashoffset:380}}
        @keyframes holo-ring    {0%{transform:scale(.15);opacity:0}50%{opacity:1}100%{transform:scale(1);opacity:0}}
        @media(prefers-reduced-motion:reduce){.holo-a{animation:none!important}}
      `}</style>

      {/* Base */}
      <div style={{position:'absolute',inset:0,
        background:'radial-gradient(ellipse 70% 80% at 43% 50%,#040300 0%,#020100 52%,#000000 100%)'}}/>

      {/* Layer 1: Deep Perspective Grid */}
      <div style={{position:'absolute',inset:0,overflow:'hidden',
        maskImage:'linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.6) 18%,black 55%,rgba(0,0,0,.35) 82%,transparent 100%)',
        WebkitMaskImage:'linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.6) 18%,black 55%,rgba(0,0,0,.35) 82%,transparent 100%)',
      }}>
        <div className="holo-a" style={{
          position:'absolute',left:'-25%',right:'-25%',top:'-30%',bottom:'-10%',
          backgroundImage:`linear-gradient(rgba(255,210,60,${f(0.055)}) 1px,transparent 1px),linear-gradient(90deg,rgba(255,210,60,${f(0.038)}) 1px,transparent 1px)`,
          backgroundSize:'52px 52px',
          transform:'perspective(620px) rotateX(55deg)',
          transformOrigin:'50% 62%',
          animation:'holo-grid 30s linear infinite',
        }}/>
      </div>

      {/* Layer 2: Horizontal Scan Lines */}
      <div className="holo-a" style={{
        position:'absolute',inset:0,
        backgroundImage:`repeating-linear-gradient(to bottom,rgba(255,216,74,${f(0.030)}) 0px,rgba(255,216,74,${f(0.030)}) 1px,transparent 1px,transparent 8px)`,
        animation:'holo-scanln 9s linear infinite',
      }}/>

      {/* Layer 3: Main Scan Beam */}
      <div className="holo-a" style={{
        position:'absolute',left:0,right:0,top:0,height:'115px',
        background:`linear-gradient(to bottom,transparent 0%,rgba(255,208,55,${f(0.030)}) 22%,rgba(255,215,60,${f(0.095)}) 50%,rgba(255,208,55,${f(0.030)}) 78%,transparent 100%)`,
        animation:'holo-beam 13s ease-in-out infinite',
        willChange:'transform',
      }}/>

      {/* Layer 7: Ambient Glow */}
      <div className="holo-a" style={{
        position:'absolute',left:'13%',top:'2%',width:'60%',height:'96%',
        background:`radial-gradient(circle at 42% 50%,rgba(255,192,0,${f(0.105)}) 0%,rgba(255,165,0,${f(0.038)}) 36%,transparent 68%)`,
        animation:'holo-glow 11s ease-in-out infinite',
      }}/>

      {/* SVG: Arcs, Rings, Nodes, Targets, Flow, Labels */}
      <svg viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice"
        style={{position:'absolute',inset:0,width:'100%',height:'100%',
          maskImage:'linear-gradient(to right,black 0%,black 62%,rgba(0,0,0,.14) 84%,transparent 100%)',
          WebkitMaskImage:'linear-gradient(to right,black 0%,black 62%,rgba(0,0,0,.14) 84%,transparent 100%)',
        }}>
        <defs>
          <radialGradient id="holo-cfade" cx="43%" cy="50%" r="25%" gradientUnits="userSpaceOnUse"
            fx="430" fy="375">
            <stop offset="0%"   stopColor="black" stopOpacity=".88"/>
            <stop offset="100%" stopColor="black" stopOpacity="0"/>
          </radialGradient>
          <mask id="holo-cmask" maskUnits="userSpaceOnUse">
            <rect width="1000" height="750" fill="white"/>
            <rect width="1000" height="750" fill="url(#holo-cfade)"/>
          </mask>
        </defs>

        {/* Layer 4: Analysis Arcs */}
        <g mask="url(#holo-cmask)">
          {/* Outer dim arc — CW 47s, 22% */}
          <circle cx="430" cy="375" r="338" fill="none"
            stroke={`rgba(255,210,55,${f(0.072)})`} strokeWidth="1"
            strokeDasharray="469 1638" className="holo-a"
            style={{transformOrigin:'430px 375px',animation:'holo-arc-cw 47s linear infinite'}}/>
          {/* Mid arc — CCW 65s, 35% */}
          <circle cx="430" cy="375" r="268" fill="none"
            stroke={`rgba(255,218,62,${f(0.088)})`} strokeWidth="1.2"
            strokeDasharray="591 1074" className="holo-a"
            style={{transformOrigin:'430px 375px',animation:'holo-arc-ccw 65s linear infinite'}}/>
          {/* Inner arc — CW 36s, 16% */}
          <circle cx="430" cy="375" r="210" fill="none"
            stroke={`rgba(255,205,50,${f(0.065)})`} strokeWidth=".9"
            strokeDasharray="211 1099" className="holo-a"
            style={{transformOrigin:'430px 375px',animation:'holo-arc-cw 36s linear infinite 8s'}}/>
          {/* Far accent arc — CCW very dim, 10% */}
          <circle cx="430" cy="375" r="380" fill="none"
            stroke={`rgba(255,200,45,${f(0.042)})`} strokeWidth=".6"
            strokeDasharray="239 2149" className="holo-a"
            style={{transformOrigin:'430px 375px',animation:'holo-arc-ccw 82s linear infinite 5s'}}/>
          {/* Cyan accent arc (stronger in listening mode) */}
          <circle cx="430" cy="375" r="295" fill="none"
            stroke={`rgba(0,222,212,${(cyanB*bright).toFixed(3)})`} strokeWidth=".8"
            strokeDasharray="370 1483" className="holo-a"
            style={{transformOrigin:'430px 375px',animation:'holo-arc-cw 55s linear infinite 12s'}}/>
        </g>

        {/* Radar rings — expanding outward from center */}
        {[0,2.5,5].map((delay,i)=>(
          <circle key={i} cx="430" cy="375" r="280" fill="none"
            stroke={`rgba(255,205,50,${f(0.055)})`} strokeWidth=".7" className="holo-a"
            style={{transformOrigin:'430px 375px',
              animation:`holo-ring 7s ease-out ${delay}s infinite`}}/>
        ))}

        {/* Layer 5: Data Points */}
        {_DP.map(([cx,cy,r,delay],i)=>{
          const fade=_hcf(cx,cy)
          const isCyan=i===3||i===9||i===14
          const gc=isCyan?'0,218,208':'255,218,68'
          const sc=isCyan?'0,210,200':'255,205,50'
          return (
            <g key={i} className="holo-a"
              style={{animation:`holo-pulse ${4+i%5}s ease-in-out ${delay}s infinite`}}>
              <circle cx={cx} cy={cy} r={r*2.8}
                fill={`rgba(${sc},${f(0.038*fade)})`}/>
              <circle cx={cx} cy={cy} r={r}
                fill={`rgba(${gc},${f(0.62*fade)})`}
                style={{filter:`drop-shadow(0 0 2.5px rgba(${sc},${f(0.78*fade)}))`}}/>
              {r>=2.0&&<>
                <line x1={cx-r*2.2} y1={cy} x2={cx+r*2.2} y2={cy}
                  stroke={`rgba(${sc},${f(0.38*fade)})`} strokeWidth=".5"/>
                <line x1={cx} y1={cy-r*2.2} x2={cx} y2={cy+r*2.2}
                  stroke={`rgba(${sc},${f(0.38*fade)})`} strokeWidth=".5"/>
              </>}
            </g>
          )
        })}

        {/* Layer 6: Target / Lock Elements */}
        {_TGT.map(([cx,cy,s],i)=>{
          const hs=s/2, arm=s*.30
          return (
            <g key={i} fill="none"
              stroke={`rgba(255,212,58,${f(0.32)})`} strokeWidth=".9"
              className="holo-a"
              style={{transformOrigin:`${cx}px ${cy}px`,
                animation:`holo-tgt ${5+i*1.6}s ease-in-out ${i*1.3}s infinite${i%2===0?`,holo-tgtsc ${8+i*2}s ease-in-out ${i*.7}s infinite`:''}`}}>
              <path d={`M${cx-hs+arm},${cy-hs} L${cx-hs},${cy-hs} L${cx-hs},${cy-hs+arm}`}/>
              <path d={`M${cx+hs-arm},${cy-hs} L${cx+hs},${cy-hs} L${cx+hs},${cy-hs+arm}`}/>
              <path d={`M${cx-hs+arm},${cy+hs} L${cx-hs},${cy+hs} L${cx-hs},${cy+hs-arm}`}/>
              <path d={`M${cx+hs-arm},${cy+hs} L${cx+hs},${cy+hs} L${cx+hs},${cy+hs-arm}`}/>
              <circle cx={cx} cy={cy} r="1.8" fill={`rgba(255,212,58,${f(0.55)})`} stroke="none"/>
            </g>
          )
        })}

        {/* Layer 8: Data Flow */}
        <g fill="none" strokeLinecap="round">
          <path d="M112,222 L118,175 L285,82 L518,58"
            stroke={`rgba(255,228,80,${f(0.24)})`} strokeWidth="1.1"
            strokeDasharray="12 78" className="holo-a"
            style={{animation:'holo-fwd 7s linear infinite'}}/>
          <path d="M722,118 L882,195 L918,382 L848,558"
            stroke={`rgba(255,225,75,${f(0.22)})`} strokeWidth="1.1"
            strokeDasharray="11 72" className="holo-a"
            style={{animation:'holo-rev 9s linear infinite 2s'}}/>
          <path d="M262,658 L92,548 L55,378 L112,222"
            stroke={`rgba(255,220,70,${f(0.20)})`} strokeWidth="1.0"
            strokeDasharray="10 68" className="holo-a"
            style={{animation:'holo-fwd 11s linear infinite 4s'}}/>
          <path d="M452,702 L682,648 L848,558"
            stroke={`rgba(255,225,75,${f(0.20)})`} strokeWidth="1.0"
            strokeDasharray="9 62" className="holo-a"
            style={{animation:'holo-rev 8s linear infinite 6s'}}/>
          <path d="M762,452 L918,382"
            stroke={`rgba(0,215,205,${f(0.20)})`} strokeWidth=".9"
            strokeDasharray="8 52" className="holo-a"
            style={{animation:'holo-fwd 6s linear infinite 1s'}}/>
        </g>

        {/* Layer 7: Micro Data Labels */}
        <g fontFamily="'Courier New',Courier,monospace" letterSpacing="1.8" className="holo-a">
          <g fill={`rgba(255,205,50,${f(0.16)})`} fontSize="7">
            <text x="28" y="52">SCAN // ACTIVE</text>
            <text x="28" y="63">NODE</text>
          </g>
          <g fill={`rgba(255,205,50,${f(0.13)})`} fontSize="7" textAnchor="end">
            <text x="575" y="52">ANALYSIS</text>
            <text x="575" y="63">VOICE</text>
          </g>
          <g fill={`rgba(255,205,50,${f(0.13)})`} fontSize="7">
            <text x="28" y="700">SIGNAL</text>
            <text x="28" y="711">PROCESS</text>
          </g>
          <g fill={`rgba(255,205,50,${f(0.12)})`} fontSize="7" textAnchor="end">
            <text x="575" y="700">SYSTEM</text>
            <text x="575" y="711">NEURAL</text>
          </g>
          <g fill={`rgba(0,205,195,${f(0.12)})`} fontSize="6" textAnchor="end">
            <text x="575" y="382">AI CORE</text>
          </g>
        </g>
      </svg>

      {/* Layer 9: Holographic Noise */}
      <div className="holo-a" style={{
        position:'absolute',inset:0,
        backgroundImage:`repeating-linear-gradient(to bottom,rgba(255,220,80,.008) 0px,transparent 2px,transparent 3px,rgba(0,215,205,.006) 4px,transparent 5px,transparent 8px)`,
        animation:'holo-noise .22s steps(1) infinite',
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
