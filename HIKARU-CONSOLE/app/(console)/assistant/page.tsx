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

// ─── Permanent Holographic Background ────────────────────────
// Particle positions: [cx, cy, r, animName, delay]
const _PRT: [number,number,number,string,number][] = [
  [82,145,1.8,'holo-da',0],[195,65,2.0,'holo-db',1.5],[348,42,1.5,'holo-dc',3.0],
  [622,38,2.0,'holo-da',0.8],[785,88,1.8,'holo-dd',2.2],[908,175,2.0,'holo-de',4.1],
  [922,342,1.5,'holo-da',1.2],[915,438,1.8,'holo-db',5.5],[822,558,2.0,'holo-dc',0.5],
  [695,658,1.8,'holo-dd',3.5],[448,705,1.5,'holo-de',2.0],[272,715,2.0,'holo-da',6.0],
  [125,638,1.8,'holo-db',1.0],[45,505,2.0,'holo-dc',4.6],[35,352,1.5,'holo-dd',2.8],
  [48,225,1.8,'holo-de',0.3],[138,102,2.0,'holo-da',5.0],[255,155,1.5,'holo-db',1.8],
  [388,68,1.8,'holo-dc',3.2],[512,102,2.0,'holo-dd',7.0],[648,155,1.5,'holo-de',0.7],
  [812,278,1.8,'holo-da',2.3],[858,415,2.0,'holo-db',4.9],[765,538,1.5,'holo-dc',1.5],
  [598,592,1.8,'holo-dd',3.8],[415,608,2.0,'holo-de',5.3],[262,572,1.5,'holo-da',0.9],
  [135,488,1.8,'holo-db',2.7],[88,382,2.0,'holo-dc',4.3],[115,278,1.5,'holo-dd',1.3],
]

// PERMANENT — no Voice state dependency, all CSS animations
function CircuitBackground({ mode: _mode }: { mode: string }) {
  return (
    <div aria-hidden="true"
      style={{position:'absolute',inset:0,zIndex:-1,pointerEvents:'none',overflow:'hidden'}}>
      <style>{`
        @keyframes holo-grid  {from{background-position:0 0}to{background-position:0 60px}}
        @keyframes holo-sd1   {0%,4%{transform:translateY(-180px)}93%,100%{transform:translateY(1300px)}}
        @keyframes holo-sd2   {0%,6%{transform:translateY(-150px)}90%,100%{transform:translateY(1300px)}}
        @keyframes holo-su1   {0%,4%{transform:translateY(1300px)} 93%,100%{transform:translateY(-150px)}}
        @keyframes holo-sr1   {0%,4%{transform:translateX(-220px)}92%,100%{transform:translateX(1600px)}}
        @keyframes holo-sr2   {0%,5%{transform:translateX(-180px)}92%,100%{transform:translateX(1600px)}}
        @keyframes holo-cw    {to{transform:rotate(360deg)}}
        @keyframes holo-ccw   {to{transform:rotate(-360deg)}}
        @keyframes holo-pulse {0%,100%{opacity:.30}50%{opacity:.95}}
        @keyframes holo-pbr   {0%,100%{opacity:.42}50%{opacity:1}}
        @keyframes holo-glow  {0%,100%{opacity:.60}50%{opacity:1}}
        @keyframes holo-panel {0%,18%{opacity:0}28%,78%{opacity:1}90%,100%{opacity:0}}
        @keyframes holo-fwd   {to{stroke-dashoffset:-500}}
        @keyframes holo-rev   {to{stroke-dashoffset:500}}
        @keyframes holo-da    {0%,100%{transform:translate(0,0)}50%{transform:translate(6px,-8px)}}
        @keyframes holo-db    {0%,100%{transform:translate(0,0)}50%{transform:translate(-7px,5px)}}
        @keyframes holo-dc    {0%,100%{transform:translate(0,0)}50%{transform:translate(4px,9px)}}
        @keyframes holo-dd    {0%,100%{transform:translate(0,0)}50%{transform:translate(-5px,-7px)}}
        @keyframes holo-de    {0%,100%{transform:translate(0,0)}50%{transform:translate(8px,3px)}}
        @media(prefers-reduced-motion:reduce){.ha{animation:none!important}}
      `}</style>

      {/* Base */}
      <div style={{position:'absolute',inset:0,
        background:'radial-gradient(ellipse 68% 78% at 43% 50%,#040300 0%,#020100 50%,#000000 100%)'}}/>

      {/* ── Layer 1: Perspective Grid ── */}
      <div style={{position:'absolute',inset:0,overflow:'hidden',
        maskImage:'linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.55) 15%,black 50%,rgba(0,0,0,.40) 80%,transparent 100%)',
        WebkitMaskImage:'linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.55) 15%,black 50%,rgba(0,0,0,.40) 80%,transparent 100%)',
      }}>
        <div className="ha" style={{
          position:'absolute',left:'-30%',right:'-30%',top:'-40%',bottom:'-5%',
          backgroundImage:'linear-gradient(rgba(255,210,55,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(255,210,55,.072) 1px,transparent 1px)',
          backgroundSize:'60px 60px',
          transform:'perspective(680px) rotateX(56deg)',
          transformOrigin:'50% 65%',
          animation:'holo-grid 32s linear infinite',
        }}/>
      </div>

      {/* ── Layer 2a: Main Holographic Sweep (large glowing band, top→bottom) ── */}
      <div className="ha" style={{
        position:'absolute',left:0,right:0,top:0,height:'180px',
        background:'linear-gradient(to bottom,transparent 0%,rgba(255,215,58,.035) 18%,rgba(255,220,62,.22) 50%,rgba(255,215,58,.035) 82%,transparent 100%)',
        animation:'holo-sd1 14s ease-in-out infinite',
        willChange:'transform',
      }}/>

      {/* ── Layer 2b: Second Scan (cyan, different speed) ── */}
      <div className="ha" style={{
        position:'absolute',left:0,right:0,top:0,height:'120px',
        background:'linear-gradient(to bottom,transparent 0%,rgba(0,218,208,.022) 20%,rgba(0,225,215,.13) 50%,rgba(0,218,208,.022) 80%,transparent 100%)',
        animation:'holo-sd2 21s ease-in-out infinite 8s',
        willChange:'transform',
      }}/>

      {/* ── Layer 2c: Bottom-up scan ── */}
      <div className="ha" style={{
        position:'absolute',left:0,right:0,bottom:0,height:'140px',
        background:'linear-gradient(to top,transparent 0%,rgba(255,212,55,.025) 22%,rgba(255,218,60,.16) 50%,rgba(255,212,55,.025) 78%,transparent 100%)',
        animation:'holo-su1 19s ease-in-out infinite 3s',
        willChange:'transform',
      }}/>

      {/* ── Layer 2d: Horizontal scan left→right ── */}
      <div className="ha" style={{
        position:'absolute',top:0,bottom:0,left:0,width:'130px',
        background:'linear-gradient(to right,transparent 0%,rgba(255,212,55,.020) 22%,rgba(255,218,60,.12) 50%,rgba(255,212,55,.020) 78%,transparent 100%)',
        animation:'holo-sr1 26s ease-in-out infinite 5s',
        willChange:'transform',
      }}/>

      {/* ── Layer 2e: Second horizontal scan ── */}
      <div className="ha" style={{
        position:'absolute',top:0,bottom:0,left:0,width:'100px',
        background:'linear-gradient(to right,transparent 0%,rgba(255,215,60,.018) 25%,rgba(255,222,65,.10) 50%,rgba(255,215,60,.018) 75%,transparent 100%)',
        animation:'holo-sr2 38s ease-in-out infinite 18s',
        willChange:'transform',
      }}/>

      {/* ── Ambient Glow ── */}
      <div className="ha" style={{
        position:'absolute',left:'12%',top:'2%',width:'60%',height:'96%',
        background:'radial-gradient(circle at 42% 50%,rgba(255,195,0,.13) 0%,rgba(255,172,0,.045) 36%,transparent 66%)',
        animation:'holo-glow 10s ease-in-out infinite',
      }}/>

      {/* ── SVG: Network / Arcs / Signals / Particles / HUD ── */}
      <svg viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice"
        style={{position:'absolute',inset:0,width:'100%',height:'100%',
          maskImage:'linear-gradient(to right,black 0%,black 60%,rgba(0,0,0,.14) 84%,transparent 100%)',
          WebkitMaskImage:'linear-gradient(to right,black 0%,black 60%,rgba(0,0,0,.14) 84%,transparent 100%)',
        }}>

        {/* ── Background network lines ── */}
        <g fill="none">
          <g stroke="rgba(255,210,55,.22)" strokeWidth="1">
            <path d="M0,175 L148,232 L262,215"/>
            <path d="M0,415 L85,378 L162,315 L262,295"/>
            <path d="M0,575 L118,538 L185,495"/>
            <path d="M85,135 L162,175 L242,185"/>
            <path d="M0,278 L75,258 L135,238"/>
          </g>
          <g stroke="rgba(255,210,55,.14)" strokeWidth=".7">
            <path d="M0,318 L55,302 L115,295"/>
            <path d="M40,485 L95,460 L142,435"/>
            <path d="M0,638 L82,618 L152,595"/>
            <path d="M118,78 L182,108 L225,128"/>
            <path d="M15,718 L75,698 L145,668"/>
          </g>
          <g stroke="rgba(255,210,55,.20)" strokeWidth="1">
            <path d="M232,0 L265,85 L295,145"/>
            <path d="M418,0 L435,65 L445,132"/>
            <path d="M178,0 L195,55 L215,115"/>
            <path d="M315,0 L332,62 L355,122"/>
          </g>
          <g stroke="rgba(255,210,55,.18)" strokeWidth=".9">
            <path d="M182,750 L215,665 L245,615"/>
            <path d="M318,750 L340,678 L365,625"/>
            <path d="M452,750 L455,680 L458,622"/>
          </g>
          <g stroke="rgba(255,210,55,.11)" strokeWidth=".7">
            <path d="M818,155 L750,215 L695,245"/>
            <path d="M858,385 L795,375 L728,355"/>
            <path d="M842,522 L775,505 L712,485"/>
          </g>
        </g>

        {/* ── MOVING DATA SIGNALS (bright, clearly visible) ── */}
        <g fill="none" strokeLinecap="round">
          <path d="M0,232 L148,232 L262,215"
            stroke="rgba(255,228,72,.80)" strokeWidth="2.8"
            strokeDasharray="20 210" className="ha"
            style={{animation:'holo-fwd 7s linear infinite'}}/>
          <path d="M0,415 L85,378 L162,315 L262,295"
            stroke="rgba(255,222,65,.76)" strokeWidth="2.8"
            strokeDasharray="18 225" className="ha"
            style={{animation:'holo-fwd 9s linear infinite 2s'}}/>
          <path d="M232,0 L265,85 L295,145"
            stroke="rgba(255,225,68,.75)" strokeWidth="2.8"
            strokeDasharray="16 165" className="ha"
            style={{animation:'holo-fwd 6s linear infinite 4s'}}/>
          <path d="M418,0 L435,65 L445,132"
            stroke="rgba(255,222,65,.72)" strokeWidth="2.8"
            strokeDasharray="16 145" className="ha"
            style={{animation:'holo-fwd 8s linear infinite 1s'}}/>
          <path d="M182,750 L215,665 L245,615"
            stroke="rgba(255,220,62,.72)" strokeWidth="2.8"
            strokeDasharray="18 162" className="ha"
            style={{animation:'holo-rev 8s linear infinite 3s'}}/>
          <path d="M318,750 L340,678 L365,625"
            stroke="rgba(255,222,65,.70)" strokeWidth="2.5"
            strokeDasharray="16 145" className="ha"
            style={{animation:'holo-rev 7.5s linear infinite 6s'}}/>
          <path d="M842,522 L775,505 L712,485"
            stroke="rgba(255,218,62,.68)" strokeWidth="2.5"
            strokeDasharray="15 185" className="ha"
            style={{animation:'holo-rev 10s linear infinite 5s'}}/>
          <path d="M858,385 L795,375 L728,355"
            stroke="rgba(0,220,210,.68)" strokeWidth="2.5"
            strokeDasharray="14 165" className="ha"
            style={{animation:'holo-rev 11s linear infinite 1.5s'}}/>
          <path d="M0,575 L118,538 L185,495"
            stroke="rgba(255,218,62,.70)" strokeWidth="2.5"
            strokeDasharray="16 168" className="ha"
            style={{animation:'holo-fwd 8.5s linear infinite 7s'}}/>
          <path d="M178,0 L195,55 L215,115"
            stroke="rgba(0,218,208,.65)" strokeWidth="2.2"
            strokeDasharray="14 135" className="ha"
            style={{animation:'holo-fwd 5.5s linear infinite 2.5s'}}/>
        </g>

        {/* ── NETWORK JUNCTION NODES ── */}
        {([
          [148,232],[262,215],[85,378],[162,315],[262,295],[118,538],[185,495],
          [265,85],[295,145],[435,65],[445,132],[215,665],[245,615],[340,678],[365,625],
          [750,215],[695,245],[795,375],[728,355],[775,505],[712,485],
        ] as [number,number][]).map(([x,y],i)=>(
          <g key={i} className="ha"
            style={{animation:`holo-pulse ${4+(i%5)*.8}s ease-in-out ${(i*.55)%6}s infinite`}}>
            <circle cx={x} cy={y} r={i%4===0?4.0:i%3===0?3.2:2.8}
              fill="rgba(255,222,70,.72)"
              style={{filter:'drop-shadow(0 0 3px rgba(255,210,55,.90))'}}/>
            {i%4===0&&<>
              <line x1={x-6} y1={y} x2={x+6} y2={y} stroke="rgba(255,215,60,.50)" strokeWidth=".6"/>
              <line x1={x} y1={y-6} x2={x} y2={y+6} stroke="rgba(255,215,60,.50)" strokeWidth=".6"/>
            </>}
          </g>
        ))}

        {/* ── BRIGHT ACCENT NODES ── */}
        {([
          [148,232,false],[265,85,false],[435,65,true],[215,665,false],[795,375,true],
        ] as [number,number,boolean][]).map(([x,y,cyan],i)=>(
          <g key={i} className="ha"
            style={{animation:`holo-pbr ${3+(i*.7)}s ease-in-out ${i*1.2}s infinite`}}>
            <circle cx={x} cy={y} r="10"
              fill={`rgba(${cyan?'0,212,202':'255,205,42'},.10)`}/>
            <circle cx={x} cy={y} r="4.5"
              fill={`rgba(${cyan?'0,228,218':'255,232,75'},.88)`}
              style={{filter:`drop-shadow(0 0 5px rgba(${cyan?'0,212,202':'255,215,58'},1))`}}/>
          </g>
        ))}

        {/* ── BACKGROUND ARCS (at screen CORNERS/EDGES, not JARVIS center) ── */}
        <circle cx="40" cy="40" r="385" fill="none"
          stroke="rgba(255,210,52,.075)" strokeWidth="1.3"
          strokeDasharray="483 1940" className="ha"
          style={{transformOrigin:'40px 40px',animation:'holo-cw 72s linear infinite'}}/>
        <circle cx="920" cy="-80" r="455" fill="none"
          stroke="rgba(255,210,52,.062)" strokeWidth="1.1"
          strokeDasharray="570 2284" className="ha"
          style={{transformOrigin:'920px -80px',animation:'holo-ccw 92s linear infinite'}}/>
        <circle cx="-65" cy="825" r="525" fill="none"
          stroke="rgba(255,210,50,.058)" strokeWidth="1.1"
          strokeDasharray="657 2641" className="ha"
          style={{transformOrigin:'-65px 825px',animation:'holo-cw 65s linear infinite 15s'}}/>
        <circle cx="885" cy="375" r="425" fill="none"
          stroke="rgba(0,212,202,.048)" strokeWidth="1"
          strokeDasharray="533 2134" className="ha"
          style={{transformOrigin:'885px 375px',animation:'holo-ccw 85s linear infinite 8s'}}/>
        <circle cx="295" cy="195" r="342" fill="none"
          stroke="rgba(255,205,48,.062)" strokeWidth="1"
          strokeDasharray="429 1719" className="ha"
          style={{transformOrigin:'295px 195px',animation:'holo-cw 58s linear infinite 20s'}}/>

        {/* ── FLOATING PARTICLES (30, full screen) ── */}
        {_PRT.map(([cx,cy,r,anim,delay],i)=>(
          <circle key={i} cx={cx} cy={cy} r={r}
            fill={i%5===0?'rgba(0,215,205,.42)':'rgba(255,220,65,.38)'}
            className="ha"
            style={{animation:`${anim} ${11+(i%8)*1.5}s ease-in-out ${delay}s infinite`}}/>
        ))}

        {/* ── MICRO HUD PANELS (fade in/out independently) ── */}
        <g fontFamily="'Courier New',Courier,monospace" letterSpacing="2">
          <g className="ha" style={{animation:'holo-panel 14s ease-in-out 0s infinite'}}>
            <rect x="24" y="38" width="92" height="32" rx="2"
              fill="rgba(255,210,52,.04)" stroke="rgba(255,210,52,.22)" strokeWidth=".7"/>
            <text x="32" y="52" fill="rgba(255,210,52,.88)" fontSize="7">SCAN // ACTIVE</text>
            <text x="32" y="63" fill="rgba(255,210,52,.68)" fontSize="6">NODE</text>
          </g>
          <g className="ha" style={{animation:'holo-panel 18s ease-in-out 6s infinite'}}>
            <rect x="24" y="80" width="70" height="18" rx="2"
              fill="rgba(255,210,52,.04)" stroke="rgba(255,210,52,.18)" strokeWidth=".6"/>
            <text x="32" y="92" fill="rgba(255,210,52,.75)" fontSize="6">SIGNAL</text>
          </g>
          <g className="ha" style={{animation:'holo-panel 16s ease-in-out 4s infinite'}}>
            <rect x="24" y="688" width="88" height="42" rx="2"
              fill="rgba(255,210,52,.04)" stroke="rgba(255,210,52,.20)" strokeWidth=".7"/>
            <text x="32" y="702" fill="rgba(255,210,52,.82)" fontSize="7">PROCESS</text>
            <text x="32" y="713" fill="rgba(255,210,52,.65)" fontSize="6">SYSTEM</text>
            <text x="32" y="723" fill="rgba(0,215,205,.60)" fontSize="6">NEURAL</text>
          </g>
          <g className="ha" style={{animation:'holo-panel 20s ease-in-out 10s infinite'}}>
            <rect x="478" y="38" width="84" height="30" rx="2"
              fill="rgba(255,210,52,.04)" stroke="rgba(255,210,52,.18)" strokeWidth=".6"/>
            <text x="486" y="52" fill="rgba(255,210,52,.82)" fontSize="7">ANALYSIS</text>
            <text x="486" y="63" fill="rgba(0,215,205,.68)" fontSize="6">VOICE LINK</text>
          </g>
          <g className="ha" style={{animation:'holo-panel 22s ease-in-out 8s infinite'}}>
            <text x="578" y="380" fill="rgba(255,210,52,.72)" fontSize="7" textAnchor="end">AI CORE</text>
          </g>
          <g className="ha" style={{animation:'holo-panel 12s ease-in-out 3s infinite'}}>
            <rect x="318" y="698" width="74" height="30" rx="2"
              fill="rgba(255,210,52,.04)" stroke="rgba(255,210,52,.16)" strokeWidth=".6"/>
            <text x="326" y="712" fill="rgba(255,210,52,.76)" fontSize="7">VOICE</text>
            <text x="326" y="722" fill="rgba(255,210,52,.58)" fontSize="6">ANALYSIS</text>
          </g>
        </g>
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
