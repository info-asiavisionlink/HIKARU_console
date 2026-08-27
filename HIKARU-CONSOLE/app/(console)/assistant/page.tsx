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

const BG   = '#010202'
const GD   = '#FFD700'
const GB   = '#FFE878'
const GDim = 'rgba(255,215,0,0.45)'
const GBdr = 'rgba(255,215,0,0.22)'

const STATUS_ITEMS = [
  { key:'idle',       label:'STANDBY',    sub:'待機中',        color:'#C89010', dot:'#AA7800' },
  { key:'connecting', label:'CONNECTING', sub:'接続中',        color:'#00AFFF', dot:'#00AFFF' },
  { key:'listening',  label:'LISTENING',  sub:'聞いています',  color:'#FFD700', dot:'#FFD700' },
  { key:'processing', label:'THINKING',   sub:'考えています',  color:'#FFB800', dot:'#FFB800' },
  { key:'speaking',   label:'SPEAKING',   sub:'応答しています', color:'#00D860', dot:'#00D860' },
  { key:'error',      label:'ERROR',      sub:'接続エラー',    color:'#FF3030', dot:'#FF3030' },
] as const

type StatusKey = typeof STATUS_ITEMS[number]['key']

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

// ─── Holographic AI Background Data ──────────────────────────
// Pre-computed fluid wave paths (computed once at module load)
const _WDATA: {d:string;dur:number;rev:boolean;op:number;cyan:boolean;sw:number;da:string}[] = (()=>{
  const defs:[number,number,number,number,number,boolean,number,boolean,string][] = [
    [290,30,0.0078,0.00, 18,false,0.28,false,'2.5 7.5'],
    [316,22,0.0092,1.20, 22,true, 0.34,false,'2 6.5'],
    [340,26,0.0085,0.60, 16,false,0.40,false,'3 8'],
    [358,18,0.0105,1.80, 20,true, 0.30,true, '2 6'],
    [373,12,0.0118,2.40, 25,false,0.28,true, '1.5 5'],
    [390,18,0.0105,3.00, 21,true, 0.30,true, '2 6'],
    [408,26,0.0085,2.20, 17,false,0.40,false,'3 8'],
    [432,22,0.0092,1.60, 23,true, 0.34,false,'2 6.5'],
    [458,30,0.0078,0.80, 19,false,0.28,false,'2.5 7.5'],
  ]
  return defs.map(([y,amp,freq,phase,dur,rev,op,cyan,da])=>{
    const pts=[`M0,${y}`]
    for(let x=30;x<=1000;x+=30)
      pts.push(`L${x},${(y+amp*Math.sin(x*freq+phase)).toFixed(1)}`)
    return {d:pts.join(' '),dur,rev,op,cyan,sw:cyan?1.3:1.6,da}
  })
})()

// Bright particle nodes: [cx, cy, r, isCyan, pulseDelay]
const _PNODES:[number,number,number,boolean,number][] = [
  [80,148,3.0,false,0],[192,62,2.8,false,1.5],[352,42,3.2,false,3.0],
  [628,38,3.0,false,0.8],[790,88,2.8,true,2.2],[915,178,3.2,false,4.1],
  [925,342,2.8,true,1.2],[918,435,3.0,false,5.5],[825,558,2.8,false,0.5],
  [698,658,3.2,false,3.5],[452,708,2.5,true,2.0],[275,718,3.0,false,6.0],
  [130,638,2.8,false,1.0],[48,508,3.2,false,4.6],[38,355,2.5,true,2.8],
  [50,228,3.0,false,0.3],[142,105,2.8,false,5.0],[260,158,3.2,false,1.8],
  [395,68,2.5,false,3.2],[518,105,3.0,true,7.0],
]

// Background drift particles: [cx, cy, r, anim, delay]
const _PRT:[number,number,number,string,number][] = [
  [82,145,1.5,'ha-da',0],[195,65,1.8,'ha-db',1.5],[348,42,1.3,'ha-dc',3.0],
  [622,38,1.8,'ha-da',0.8],[785,88,1.5,'ha-dd',2.2],[908,175,1.8,'ha-de',4.1],
  [922,342,1.3,'ha-da',1.2],[915,438,1.5,'ha-db',5.5],[822,558,1.8,'ha-dc',0.5],
  [695,658,1.5,'ha-dd',3.5],[448,705,1.3,'ha-de',2.0],[272,715,1.8,'ha-da',6.0],
  [125,638,1.5,'ha-db',1.0],[45,505,1.8,'ha-dc',4.6],[35,352,1.3,'ha-dd',2.8],
  [48,225,1.5,'ha-de',0.3],[138,102,1.8,'ha-da',5.0],[255,155,1.3,'ha-db',1.8],
  [388,68,1.5,'ha-dc',3.2],[512,102,1.8,'ha-dd',7.0],[648,155,1.3,'ha-de',0.7],
  [812,278,1.5,'ha-da',2.3],[858,415,1.8,'ha-db',4.9],[765,538,1.3,'ha-dc',1.5],
  [598,592,1.5,'ha-dd',3.8],[415,608,1.8,'ha-de',5.3],[262,572,1.3,'ha-da',0.9],
  [135,488,1.5,'ha-db',2.7],[88,382,1.8,'ha-dc',4.3],[115,278,1.3,'ha-dd',1.3],
]

// PERMANENT — no Voice state dependency, all CSS animations
function CircuitBackground({ mode: _mode }: { mode: string }) {
  return (
    <div aria-hidden="true"
      style={{position:'absolute',inset:0,zIndex:-1,pointerEvents:'none',overflow:'hidden'}}>
      <style>{`
        @keyframes ha-grid  {from{transform:perspective(620px) rotateX(62deg) translateY(0)}to{transform:perspective(620px) rotateX(62deg) translateY(60px)}}
        @keyframes ha-glow  {0%,100%{opacity:.58}50%{opacity:1}}
        @keyframes ha-vbeam {0%,100%{opacity:.60}50%{opacity:1}}
        @keyframes ha-cw    {to{transform:rotate(360deg)}}
        @keyframes ha-ccw   {to{transform:rotate(-360deg)}}
        @keyframes ha-pulse {0%,100%{opacity:.28}50%{opacity:.92}}
        @keyframes ha-pbr   {0%,100%{opacity:.42}50%{opacity:1}}
        @keyframes ha-wf    {to{stroke-dashoffset:-400}}
        @keyframes ha-wr    {to{stroke-dashoffset:400}}
        @keyframes ha-da    {0%,100%{transform:translate(0,0)}50%{transform:translate(6px,-8px)}}
        @keyframes ha-db    {0%,100%{transform:translate(0,0)}50%{transform:translate(-7px,5px)}}
        @keyframes ha-dc    {0%,100%{transform:translate(0,0)}50%{transform:translate(4px,9px)}}
        @keyframes ha-dd    {0%,100%{transform:translate(0,0)}50%{transform:translate(-5px,-7px)}}
        @keyframes ha-de    {0%,100%{transform:translate(0,0)}50%{transform:translate(8px,3px)}}
        @media(prefers-reduced-motion:reduce){.ha{animation:none!important}}
      `}</style>

      {/* 1. Dark teal-black base */}
      <div style={{position:'absolute',inset:0,
        background:'radial-gradient(ellipse 65% 78% at 43% 50%,#060d12 0%,#030809 40%,#020405 70%,#010202 100%)'}}/>

      {/* 2. Strong central gold glow */}
      <div className="ha" style={{
        position:'absolute',left:'10%',top:'0',width:'65%',height:'100%',
        background:'radial-gradient(ellipse at 42% 50%,rgba(255,200,40,.30) 0%,rgba(255,178,0,.13) 25%,rgba(255,148,0,.04) 52%,transparent 72%)',
        animation:'ha-glow 10s ease-in-out infinite',
      }}/>

      {/* 3. Vertical energy beam */}
      <div className="ha" style={{
        position:'absolute',top:0,bottom:0,left:'calc(43% - 1px)',width:'2px',
        background:'linear-gradient(to bottom,transparent 0%,rgba(255,215,60,.04) 8%,rgba(255,215,60,.38) 42%,rgba(255,218,65,.55) 50%,rgba(255,215,60,.38) 58%,rgba(255,215,60,.04) 92%,transparent 100%)',
        animation:'ha-vbeam 8s ease-in-out infinite',
      }}/>

      {/* 4. Bottom perspective grid (holographic floor) */}
      <div style={{
        position:'absolute',bottom:0,left:'-12%',right:'-12%',height:'42%',
        overflow:'hidden',
        maskImage:'linear-gradient(to top,black 0%,rgba(0,0,0,.75) 38%,transparent 100%)',
        WebkitMaskImage:'linear-gradient(to top,black 0%,rgba(0,0,0,.75) 38%,transparent 100%)',
      }}>
        <div className="ha" style={{
          position:'absolute',inset:0,
          backgroundImage:'linear-gradient(rgba(255,210,55,.090) 1px,transparent 1px),linear-gradient(90deg,rgba(255,210,55,.070) 1px,transparent 1px)',
          backgroundSize:'60px 60px',
          transformOrigin:'50% 0%',
          animation:'ha-grid 30s linear infinite',
        }}/>
      </div>

      {/* SVG: outer rings + fluid waves + nodes + particles */}
      <svg viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice"
        style={{position:'absolute',inset:0,width:'100%',height:'100%',
          maskImage:'linear-gradient(to right,black 0%,black 60%,rgba(0,0,0,.15) 83%,transparent 100%)',
          WebkitMaskImage:'linear-gradient(to right,black 0%,black 60%,rgba(0,0,0,.15) 83%,transparent 100%)',
        }}>

        {/* ── Outer background rings (beyond ConsoleHikaruCore radius ~330px) ── */}
        <circle cx="430" cy="375" r="362" fill="none"
          stroke="rgba(255,210,52,.082)" strokeWidth="1.2"/>
        <circle cx="430" cy="375" r="408" fill="none"
          stroke="rgba(255,210,52,.062)" strokeWidth="1.0"
          strokeDasharray="12 28" className="ha"
          style={{transformOrigin:'430px 375px',animation:'ha-cw 75s linear infinite'}}/>
        <circle cx="430" cy="375" r="455" fill="none"
          stroke="rgba(255,205,48,.050)" strokeWidth="0.9" className="ha"
          style={{transformOrigin:'430px 375px',animation:'ha-ccw 92s linear infinite'}}/>
        <circle cx="430" cy="375" r="508" fill="none"
          stroke="rgba(0,210,200,.040)" strokeWidth="0.8"
          strokeDasharray="18 45" className="ha"
          style={{transformOrigin:'430px 375px',animation:'ha-cw 65s linear infinite 10s'}}/>
        <circle cx="430" cy="375" r="562" fill="none"
          stroke="rgba(255,200,45,.032)" strokeWidth="0.7" className="ha"
          style={{transformOrigin:'430px 375px',animation:'ha-ccw 88s linear infinite 5s'}}/>

        {/* Corner arcs for spatial depth */}
        <circle cx="50" cy="50" r="382" fill="none"
          stroke="rgba(255,208,50,.068)" strokeWidth="1.1"
          strokeDasharray="478 1912" className="ha"
          style={{transformOrigin:'50px 50px',animation:'ha-cw 72s linear infinite'}}/>
        <circle cx="920" cy="-80" r="452" fill="none"
          stroke="rgba(255,205,48,.055)" strokeWidth="1.0"
          strokeDasharray="562 2268" className="ha"
          style={{transformOrigin:'920px -80px',animation:'ha-ccw 92s linear infinite'}}/>
        <circle cx="-60" cy="830" r="522" fill="none"
          stroke="rgba(255,202,45,.045)" strokeWidth="0.9" className="ha"
          style={{transformOrigin:'-60px 830px',animation:'ha-cw 65s linear infinite 15s'}}/>

        {/* ── FLUID WAVE FIELD (most important visual element) ── */}
        <g fill="none" strokeLinecap="round">
          {_WDATA.map(({d,dur,rev,op,cyan,sw,da},i)=>(
            <path key={i} d={d}
              stroke={`rgba(${cyan?'0,215,205':'255,215,58'},${op})`}
              strokeWidth={sw} strokeDasharray={da}
              className="ha"
              style={{animation:`${rev?'ha-wr':'ha-wf'} ${dur}s linear infinite`}}/>
          ))}
        </g>

        {/* ── Background network lines ── */}
        <g fill="none" stroke="rgba(255,210,52,.18)" strokeWidth=".8">
          <path d="M0,175 L140,230 L255,215"/>
          <path d="M0,418 L82,378 L158,315 L255,295"/>
          <path d="M0,575 L115,538 L182,495"/>
          <path d="M228,0 L262,82 L292,142"/>
          <path d="M415,0 L432,62 L442,130"/>
          <path d="M178,0 L192,52 L212,112"/>
          <path d="M178,750 L212,662 L242,612"/>
          <path d="M315,750 L338,675 L362,622"/>
        </g>

        {/* ── Moving signals ── */}
        <g fill="none" strokeLinecap="round">
          <path d="M0,232 L140,232 L255,215"
            stroke="rgba(255,228,72,.78)" strokeWidth="2.8" strokeDasharray="20 210"
            className="ha" style={{animation:'ha-wf 7s linear infinite'}}/>
          <path d="M0,418 L82,378 L158,315 L255,295"
            stroke="rgba(255,222,65,.74)" strokeWidth="2.8" strokeDasharray="18 225"
            className="ha" style={{animation:'ha-wf 9s linear infinite 2s'}}/>
          <path d="M228,0 L262,82 L292,142"
            stroke="rgba(255,225,68,.72)" strokeWidth="2.8" strokeDasharray="16 162"
            className="ha" style={{animation:'ha-wf 6s linear infinite 4s'}}/>
          <path d="M415,0 L432,62 L442,130"
            stroke="rgba(255,222,65,.70)" strokeWidth="2.8" strokeDasharray="16 142"
            className="ha" style={{animation:'ha-wf 8s linear infinite 1s'}}/>
          <path d="M178,750 L212,662 L242,612"
            stroke="rgba(255,220,62,.70)" strokeWidth="2.8" strokeDasharray="18 158"
            className="ha" style={{animation:'ha-wr 8s linear infinite 3s'}}/>
          <path d="M315,750 L338,675 L362,622"
            stroke="rgba(0,220,210,.65)" strokeWidth="2.5" strokeDasharray="14 158"
            className="ha" style={{animation:'ha-wr 7.5s linear infinite 6s'}}/>
        </g>

        {/* ── BRIGHT PARTICLE NODES ── */}
        {_PNODES.map(([cx,cy,r,cyan,delay],i)=>(
          <g key={i} className="ha"
            style={{animation:`${i%3===0?'ha-pbr':'ha-pulse'} ${3.5+(i%5)*.7}s ease-in-out ${delay}s infinite`}}>
            <circle cx={cx} cy={cy} r={r*2.5}
              fill={`rgba(${cyan?'0,212,202':'255,205,42'},.085)`}/>
            <circle cx={cx} cy={cy} r={r}
              fill={`rgba(${cyan?'0,228,218':'255,230,72'},.88)`}
              style={{filter:`drop-shadow(0 0 4px rgba(${cyan?'0,212,202':'255,210,55'},1))`}}/>
            {r>=3.0&&<>
              <line x1={cx-r*1.8} y1={cy} x2={cx+r*1.8} y2={cy}
                stroke={`rgba(${cyan?'0,215,205':'255,210,55'},.38)`} strokeWidth=".6"/>
              <line x1={cx} y1={cy-r*1.8} x2={cx} y2={cy+r*1.8}
                stroke={`rgba(${cyan?'0,215,205':'255,210,55'},.38)`} strokeWidth=".6"/>
            </>}
          </g>
        ))}

        {/* ── BACKGROUND DRIFT PARTICLES ── */}
        {_PRT.map(([cx,cy,r,anim,delay],i)=>(
          <circle key={i} cx={cx} cy={cy} r={r}
            fill={i%5===0?'rgba(0,215,205,.38)':'rgba(255,220,65,.32)'}
            className="ha"
            style={{animation:`${anim} ${11+(i%8)*1.5}s ease-in-out ${delay}s infinite`}}/>
        ))}
      </svg>
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

  const recentMsgs = messages.slice(-4)

  void isSpeechSupported

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100dvh - var(--header-height, 64px))',background:BG,position:'relative',overflow:'hidden',isolation:'isolate'}}>
      <CircuitBackground mode={mode}/>
      <style>{`
        .jp-right{
          display:flex;flex-direction:column;
          width:240px;flex-shrink:0;
          border-left:1px solid ${GBdr};
          background:rgba(3,4,5,.92);overflow-y:auto;
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
                      marginBottom:10,paddingBottom:8,
                      borderBottom: i < recentMsgs.length - 1 ? '1px solid rgba(255,215,0,0.07)' : 'none',
                    }}>
                      <div style={{fontSize:9,fontWeight:700,fontFamily:'monospace',letterSpacing:'.16em',
                        color: msg.role==='user' ? GD : GB,marginBottom:3}}>
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
