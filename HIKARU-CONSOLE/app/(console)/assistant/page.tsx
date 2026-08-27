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

// ─── JARVIS Iron Man HUD Background ──────────────────────────

const _JCX=430, _JCY=375  // SVG center, matches ConsoleHikaruCore position

// Ring tick marks: [x1,y1, x2,y2, isCyan, isMajor]
const _JTICKS:[number,number,number,number,boolean,boolean][] = (()=>{
  const out:[number,number,number,number,boolean,boolean][] = []
  const rings:[number,number,boolean][] = [
    [365,15,false],[422,12,true],[480,18,false],[535,10,true]
  ]
  for(const [r,step,cyan] of rings){
    for(let d=0;d<360;d+=step){
      const a=d*Math.PI/180, major=d%(step*4)===0
      const len=major?10:5
      out.push([
        _JCX+r*Math.cos(a), _JCY+r*Math.sin(a),
        _JCX+(r+len)*Math.cos(a), _JCY+(r+len)*Math.sin(a),
        cyan, major,
      ])
    }
  }
  return out
})()

// Radial arms: line segments from inner ring edge to outer boundary
const _JARMS:{x1:number;y1:number;x2:number;y2:number;op:number;cyan:boolean;dash:boolean}[] = (()=>{
  const degs=[0,22.5,45,67.5,90,112.5,135,157.5,180,202.5,225,247.5,270,292.5,315,337.5]
  return degs.map((deg,i)=>{
    const a=deg*Math.PI/180, r1=365, r2=i%4===0?575:i%2===0?538:508
    return {
      x1:_JCX+r1*Math.cos(a), y1:_JCY+r1*Math.sin(a),
      x2:_JCX+r2*Math.cos(a), y2:_JCY+r2*Math.sin(a),
      op:i%4===0?.22:i%2===0?.13:.08,
      cyan:i%4===1||i%4===3,
      dash:i%4!==0,
    }
  })
})()

// Bright HUD nodes: on rings + scattered outer
const _JNODES:[number,number,number,boolean,number][] = (()=>{
  const out:[number,number,number,boolean,number][] = []
  const ringDefs:[number,number,boolean][] = [[365,45,false],[422,60,true],[480,40,false]]
  for(const [r,step,cyan] of ringDefs){
    for(let d=0;d<360;d+=step){
      const a=d*Math.PI/180
      out.push([_JCX+r*Math.cos(a),_JCY+r*Math.sin(a),d%(step*3)===0?2.8:1.8,cyan,d*0.025])
    }
  }
  const outer:[number,number,number,boolean,number][] = [
    [80,148,2.5,false,0],[192,62,2.2,false,1.5],[350,44,2.8,false,3.0],
    [626,40,2.5,false,0.8],[788,90,2.2,true,2.2],[912,180,2.8,false,4.1],
    [924,344,2.2,true,1.2],[916,434,2.5,false,5.5],[824,558,2.2,false,0.5],
    [696,656,2.5,false,3.5],[450,706,2.0,true,2.0],[273,718,2.5,false,6.0],
  ]
  out.push(...outer)
  return out
})()

// Drift particles: [cx, cy, r, anim, delay]
const _JPRT:[number,number,number,string,number][] = [
  [82,145,1.2,'jv-da',0],[195,65,1.4,'jv-db',1.5],[348,42,1.0,'jv-dc',3.0],
  [622,38,1.4,'jv-da',0.8],[785,88,1.2,'jv-dd',2.2],[908,175,1.4,'jv-de',4.1],
  [922,342,1.0,'jv-da',1.2],[915,438,1.2,'jv-db',5.5],[822,558,1.4,'jv-dc',0.5],
  [695,658,1.2,'jv-dd',3.5],[448,705,1.0,'jv-de',2.0],[272,715,1.4,'jv-da',6.0],
  [125,638,1.2,'jv-db',1.0],[45,505,1.4,'jv-dc',4.6],[35,352,1.0,'jv-dd',2.8],
  [48,225,1.2,'jv-de',0.3],[138,102,1.4,'jv-da',5.0],[255,155,1.0,'jv-db',1.8],
  [388,68,1.2,'jv-dc',3.2],[512,102,1.4,'jv-dd',7.0],[648,155,1.0,'jv-de',0.7],
  [812,278,1.2,'jv-da',2.3],[858,415,1.4,'jv-db',4.9],[765,538,1.0,'jv-dc',1.5],
]

// PERMANENT — no Voice state dependency, all CSS animations
function CircuitBackground({ mode: _mode }: { mode: string }) {
  return (
    <div aria-hidden="true"
      style={{position:'absolute',inset:0,zIndex:-1,pointerEvents:'none',overflow:'hidden'}}>
      <style>{`
        @keyframes jv-cw    {to{transform:rotate(360deg)}}
        @keyframes jv-ccw   {to{transform:rotate(-360deg)}}
        @keyframes jv-sweep {to{transform:rotate(360deg)}}
        @keyframes jv-pulse {0%,100%{opacity:.15}50%{opacity:.82}}
        @keyframes jv-pbr   {0%,100%{opacity:.35}50%{opacity:1}}
        @keyframes jv-glow  {0%,100%{opacity:.52}50%{opacity:1}}
        @keyframes jv-scan  {0%{transform:translateY(0)}100%{transform:translateY(100vh)}}
        @keyframes jv-da    {0%,100%{transform:translate(0,0)}50%{transform:translate(5px,-7px)}}
        @keyframes jv-db    {0%,100%{transform:translate(0,0)}50%{transform:translate(-6px,5px)}}
        @keyframes jv-dc    {0%,100%{transform:translate(0,0)}50%{transform:translate(4px,8px)}}
        @keyframes jv-dd    {0%,100%{transform:translate(0,0)}50%{transform:translate(-5px,-6px)}}
        @keyframes jv-de    {0%,100%{transform:translate(0,0)}50%{transform:translate(7px,3px)}}
        @keyframes jv-wf    {to{stroke-dashoffset:-400}}
        @keyframes jv-wr    {to{stroke-dashoffset:400}}
        @media(prefers-reduced-motion:reduce){.jv{animation:none!important}}
      `}</style>

      {/* 1. Deep navy-black base */}
      <div style={{position:'absolute',inset:0,
        background:'radial-gradient(ellipse 70% 80% at 43% 50%,#060f1c 0%,#030a14 42%,#010609 72%,#010202 100%)'}}/>

      {/* 2. Cyan arc-reactor core glow */}
      <div className="jv" style={{
        position:'absolute',left:'10%',top:'0',width:'60%',height:'100%',
        background:'radial-gradient(ellipse at 43% 50%,rgba(0,175,255,.20) 0%,rgba(0,120,210,.08) 32%,rgba(0,65,155,.02) 58%,transparent 78%)',
        animation:'jv-glow 9s ease-in-out infinite',
      }}/>

      {/* 3. Gold warm core accent */}
      <div className="jv" style={{
        position:'absolute',left:'18%',top:'8%',width:'50%',height:'84%',
        background:'radial-gradient(ellipse at 43% 50%,rgba(255,190,30,.11) 0%,rgba(255,145,0,.03) 35%,transparent 60%)',
        animation:'jv-glow 13s ease-in-out infinite 4s',
      }}/>

      {/* 4. Tech grid (subtle) */}
      <div style={{
        position:'absolute',inset:0,
        backgroundImage:'linear-gradient(rgba(0,165,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(0,165,255,.022) 1px,transparent 1px)',
        backgroundSize:'60px 60px',
        maskImage:'radial-gradient(ellipse 70% 80% at 43% 50%,rgba(0,0,0,.45) 0%,rgba(0,0,0,.80) 50%,black 100%)',
        WebkitMaskImage:'radial-gradient(ellipse 70% 80% at 43% 50%,rgba(0,0,0,.45) 0%,rgba(0,0,0,.80) 50%,black 100%)',
      }}/>

      {/* 5. Radar sweep — conic gradient rotating from JARVIS center */}
      <div className="jv" style={{
        position:'absolute',
        left:'calc(43% - 540px)',top:'calc(50% - 540px)',
        width:'1080px',height:'1080px',
        background:'conic-gradient(from 0deg,transparent 0deg,transparent 320deg,rgba(0,190,255,.06) 345deg,rgba(0,210,255,.20) 356deg,rgba(0,195,255,.08) 360deg)',
        borderRadius:'50%',
        animation:'jv-sweep 8s linear infinite',
        mixBlendMode:'screen',
      }}/>

      {/* 6. Horizontal scan line */}
      <div className="jv" style={{
        position:'absolute',left:0,right:0,top:0,height:'1px',
        background:'linear-gradient(to right,transparent 0%,rgba(0,195,255,.04) 18%,rgba(0,210,255,.22) 43%,rgba(0,195,255,.04) 70%,transparent 100%)',
        animation:'jv-scan 13s linear infinite',
      }}/>

      {/* SVG: rings + ticks + arms + HUD panels + signals + nodes + particles */}
      <svg viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice"
        style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>

        {/* ── Outer ghost rings ── */}
        <circle cx={_JCX} cy={_JCY} r="562" fill="none"
          stroke="rgba(0,175,255,.050)" strokeWidth="0.8"
          strokeDasharray="15 38" className="jv"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jv-cw 95s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="618" fill="none"
          stroke="rgba(255,208,45,.032)" strokeWidth="0.6" className="jv"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jv-ccw 118s linear infinite'}}/>

        {/* ── Technical rings with varied dash ── */}
        <circle cx={_JCX} cy={_JCY} r="535" fill="none"
          stroke="rgba(0,168,255,.062)" strokeWidth="0.9"
          strokeDasharray="22 58" className="jv"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jv-cw 72s linear infinite 5s'}}/>
        <circle cx={_JCX} cy={_JCY} r="480" fill="none"
          stroke="rgba(255,208,48,.068)" strokeWidth="1.0"
          strokeDasharray="8 20" className="jv"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jv-ccw 58s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="422" fill="none"
          stroke="rgba(0,182,255,.082)" strokeWidth="1.1"
          strokeDasharray="5 14" className="jv"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jv-cw 48s linear infinite 2s'}}/>
        <circle cx={_JCX} cy={_JCY} r="365" fill="none"
          stroke="rgba(255,208,48,.075)" strokeWidth="1.0"/>

        {/* ── Corner HUD brackets ── */}
        <path d="M18,18 L18,58 M18,18 L58,18" fill="none" stroke="rgba(0,190,255,.50)" strokeWidth="1.5"/>
        <path d="M982,18 L982,58 M982,18 L942,18" fill="none" stroke="rgba(0,190,255,.50)" strokeWidth="1.5"/>
        <path d="M18,732 L18,692 M18,732 L58,732" fill="none" stroke="rgba(0,190,255,.50)" strokeWidth="1.5"/>
        <path d="M982,732 L982,692 M982,732 L942,732" fill="none" stroke="rgba(0,190,255,.50)" strokeWidth="1.5"/>
        <path d="M32,32 L32,48 M32,32 L48,32" fill="none" stroke="rgba(255,208,48,.32)" strokeWidth="0.8"/>
        <path d="M968,32 L968,48 M968,32 L952,32" fill="none" stroke="rgba(255,208,48,.32)" strokeWidth="0.8"/>
        <path d="M32,718 L32,702 M32,718 L48,718" fill="none" stroke="rgba(255,208,48,.32)" strokeWidth="0.8"/>
        <path d="M968,718 L968,702 M968,718 L952,718" fill="none" stroke="rgba(255,208,48,.32)" strokeWidth="0.8"/>

        {/* ── Ring tick marks ── */}
        {_JTICKS.map(([x1,y1,x2,y2,cyan,major],i)=>(
          <line key={i}
            x1={x1.toFixed(1)} y1={y1.toFixed(1)}
            x2={x2.toFixed(1)} y2={y2.toFixed(1)}
            stroke={cyan?`rgba(0,195,255,${major?.40:.18})`:`rgba(255,208,48,${major?.36:.15})`}
            strokeWidth={major?.9:.5}/>
        ))}

        {/* ── Radial arms ── */}
        {_JARMS.map(({x1,y1,x2,y2,op,cyan,dash},i)=>(
          <line key={i}
            x1={x1.toFixed(1)} y1={y1.toFixed(1)}
            x2={x2.toFixed(1)} y2={y2.toFixed(1)}
            stroke={`rgba(${cyan?'0,195,255':'255,208,48'},${op})`}
            strokeWidth={i%4===0?.8:.5}
            strokeDasharray={dash?'2 8':undefined}/>
        ))}

        {/* ── HUD data panels ── */}
        <g fontFamily="'Courier New',Courier,monospace" letterSpacing="1.5">
          <rect x="24" y="40" width="104" height="40" rx="2"
            fill="rgba(0,175,255,.04)" stroke="rgba(0,175,255,.22)" strokeWidth=".7"/>
          <text x="32" y="54" fill="rgba(0,200,255,.88)" fontSize="7">SYSTEM // ONLINE</text>
          <text x="32" y="66" fill="rgba(0,200,255,.62)" fontSize="6">AI CORE ACTIVE</text>
          <rect x="24" y="86" width="80" height="18" rx="2"
            fill="rgba(0,175,255,.03)" stroke="rgba(0,175,255,.15)" strokeWidth=".6"/>
          <text x="32" y="98" fill="rgba(0,200,255,.68)" fontSize="6">SIGNAL LOCK</text>
          <rect x="24" y="684" width="96" height="48" rx="2"
            fill="rgba(0,175,255,.04)" stroke="rgba(0,175,255,.20)" strokeWidth=".7"/>
          <text x="32" y="698" fill="rgba(0,200,255,.85)" fontSize="7">VOICE LINK</text>
          <text x="32" y="709" fill="rgba(0,200,255,.60)" fontSize="6">ANALYSIS</text>
          <text x="32" y="720" fill="rgba(255,210,50,.55)" fontSize="6">HIKARU AI</text>
        </g>

        {/* ── Background network lines ── */}
        <g fill="none" strokeWidth=".8">
          <path d="M0,178 L140,232 L258,218" stroke="rgba(0,182,255,.16)"/>
          <path d="M0,420 L82,380 L158,318 L258,298" stroke="rgba(0,182,255,.14)"/>
          <path d="M0,578 L115,540 L182,498" stroke="rgba(0,182,255,.14)"/>
          <path d="M228,0 L262,82 L292,145" stroke="rgba(255,208,48,.16)"/>
          <path d="M415,0 L432,62 L442,132" stroke="rgba(255,208,48,.16)"/>
          <path d="M178,0 L192,52 L212,115" stroke="rgba(0,182,255,.12)"/>
          <path d="M178,750 L212,665 L242,615" stroke="rgba(0,182,255,.14)"/>
          <path d="M315,750 L338,678 L362,625" stroke="rgba(255,208,48,.12)"/>
        </g>

        {/* ── Moving data signals ── */}
        <g fill="none" strokeLinecap="round">
          <path d="M0,232 L140,232 L258,218"
            stroke="rgba(0,220,255,.80)" strokeWidth="2.2" strokeDasharray="18 208"
            className="jv" style={{animation:'jv-wf 7s linear infinite'}}/>
          <path d="M0,420 L82,380 L158,318 L258,298"
            stroke="rgba(255,228,72,.72)" strokeWidth="2.2" strokeDasharray="16 222"
            className="jv" style={{animation:'jv-wf 9s linear infinite 2s'}}/>
          <path d="M228,0 L262,82 L292,145"
            stroke="rgba(0,215,255,.70)" strokeWidth="2.2" strokeDasharray="14 160"
            className="jv" style={{animation:'jv-wf 6s linear infinite 4s'}}/>
          <path d="M415,0 L432,62 L442,132"
            stroke="rgba(255,225,68,.68)" strokeWidth="2.2" strokeDasharray="14 140"
            className="jv" style={{animation:'jv-wf 8s linear infinite 1s'}}/>
          <path d="M178,750 L212,665 L242,615"
            stroke="rgba(0,210,255,.68)" strokeWidth="2.0" strokeDasharray="16 155"
            className="jv" style={{animation:'jv-wr 8s linear infinite 3s'}}/>
          <path d="M315,750 L338,678 L362,625"
            stroke="rgba(255,220,62,.65)" strokeWidth="2.0" strokeDasharray="14 155"
            className="jv" style={{animation:'jv-wr 7.5s linear infinite 6s'}}/>
        </g>

        {/* ── Bright HUD nodes ── */}
        {_JNODES.map(([cx,cy,r,cyan,delay],i)=>(
          <g key={i} className="jv"
            style={{animation:`${i%3===0?'jv-pbr':'jv-pulse'} ${3+(i%5)*.6}s ease-in-out ${delay}s infinite`}}>
            <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={r*2.2}
              fill={`rgba(${cyan?'0,205,255':'255,205,45'},.08)`}/>
            <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={r}
              fill={`rgba(${cyan?'0,225,255':'255,230,72'},.90)`}
              style={{filter:`drop-shadow(0 0 3px rgba(${cyan?'0,210,255':'255,215,55'},1))`}}/>
          </g>
        ))}

        {/* ── Drift particles ── */}
        {_JPRT.map(([cx,cy,r,anim,delay],i)=>(
          <circle key={i} cx={cx} cy={cy} r={r}
            fill={i%4===0?'rgba(0,212,255,.38)':i%3===0?'rgba(255,220,65,.32)':'rgba(0,188,255,.28)'}
            className="jv"
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
