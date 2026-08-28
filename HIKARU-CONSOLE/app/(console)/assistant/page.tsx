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

// ─── JARVIS Mystic Holographic AI Core ───────────────────────

const _JCX=430, _JCY=375, _JFY=548

function _arc(r:number,a0:number,a1:number):string{
  const s=a0*Math.PI/180, e=a1*Math.PI/180, lg=a1-a0>180?1:0
  return `M${(_JCX+r*Math.cos(s)).toFixed(1)},${(_JCY+r*Math.sin(s)).toFixed(1)} A${r},${r} 0 ${lg},1 ${(_JCX+r*Math.cos(e)).toFixed(1)},${(_JCY+r*Math.sin(e)).toFixed(1)}`
}

// Fluid wave particle ribbons — pre-computed sinusoidal paths
const _FW:{d:string;op:number;sw:number;da:string;dur:number;rev:boolean;cyan:boolean}[] = (()=>{
  const out:{d:string;op:number;sw:number;da:string;dur:number;rev:boolean;cyan:boolean}[] = []
  function wp(y0:number,y1:number,amp:number,freq:number,phase:number):string{
    const pts:string[]=[]
    for(let x=0;x<=1000;x+=18){
      const y=(y0+(y1-y0)*x/1000)+amp*Math.sin(x*freq+phase)
      pts.push(`${x===0?'M':'L'}${x},${y.toFixed(1)}`)
    }
    return pts.join(' ')
  }
  // top group (y~85–225, gold + cyan)
  const T:[number,number,number,number,number,number,number,string,number,boolean,boolean][]=[
    [95, 112,55,0.0055,0.0, .48,1.6,'2 8',   22,false,false],
    [112,128,46,0.0060,1.2, .38,1.3,'1.5 7', 27,true, false],
    [128,142,38,0.0065,2.4, .27,1.0,'1 9',   31,false,false],
    [80, 98, 65,0.0050,3.6, .18,0.8,'1 12',  38,true, false],
    [104,120,52,0.0058,0.8, .30,1.1,'1.5 9', 29,false,true ],
    [148,158,28,0.0072,1.6, .14,0.7,'1 13',  44,true, true ],
  ]
  // bottom group (y~510–680, gold + cyan)
  const B:[number,number,number,number,number,number,number,string,number,boolean,boolean][]=[
    [552,528,46,0.0058,0.8, .42,1.5,'2 8',   25,true, false],
    [570,546,38,0.0063,2.0, .32,1.2,'1.5 7', 29,false,false],
    [588,562,30,0.0068,3.2, .22,0.9,'1 9',   33,true, false],
    [538,512,54,0.0052,1.6, .16,0.7,'1 12',  40,false,false],
    [560,536,42,0.0060,4.0, .26,1.0,'1.5 9', 27,true, true ],
  ]
  for(const [y0,y1,amp,freq,phase,op,sw,da,dur,rev,cyan] of [...T,...B])
    out.push({d:wp(y0,y1,amp,freq,phase),op,sw,da,dur,rev,cyan})
  return out
})()

// Arc segments: gold + cyan, varying rotation speeds
const _GSEGS:{d:string;op:number;sw:number;cyan:boolean;dur:number;ccw:boolean}[] = (()=>{
  const out:{d:string;op:number;sw:number;cyan:boolean;dur:number;ccw:boolean}[] = []
  for(let i=0;i<4;i++) out.push({d:_arc(278,i*90-5,i*90+30),op:.62,sw:2.6,cyan:false,dur:34,ccw:i%2===1})
  for(let i=0;i<8;i++) out.push({d:_arc(312,i*45+4,i*45+18),op:.50,sw:2.0,cyan:false,dur:20,ccw:i%2===0})
  for(let i=0;i<6;i++) out.push({d:_arc(348,i*60+8,i*60+18),op:.36,sw:1.4,cyan:false,dur:48,ccw:i%3!==0})
  for(let i=0;i<3;i++) out.push({d:_arc(385,i*120+15,i*120+32),op:.44,sw:1.5,cyan:true, dur:30,ccw:i%2===1})
  for(let i=0;i<4;i++) out.push({d:_arc(428,i*90+12,i*90+32),op:.26,sw:1.1,cyan:false,dur:65,ccw:i%2===0})
  for(let i=0;i<3;i++) out.push({d:_arc(472,i*120+6,i*120+20),op:.17,sw:0.8,cyan:false,dur:90,ccw:true})
  out.push({d:_arc(518,10,55),op:.25,sw:1.1,cyan:true,dur:80,ccw:false})
  out.push({d:_arc(518,190,235),op:.19,sw:0.9,cyan:true,dur:95,ccw:true})
  return out
})()

// Neural network: [x1,y1,x2,y2, lineOp, sigDur, isCyan, lineLen]
const _NN:[number,number,number,number,number,number,boolean,number][] = [
  [138,188,245,242, 0.12,4.8,false,120],
  [245,242,315,268, 0.10,3.6,true,  75],
  [715,192,625,245, 0.12,5.2,false,104],
  [625,245,552,268, 0.10,4.0,true,  77],
  [142,458,248,415, 0.10,4.2,false,114],
  [715,452,618,410, 0.10,5.0,true, 106],
  [382,148,430,112, 0.12,3.2,false, 60],
  [478,148,430,112, 0.10,3.8,false, 60],
]
// Neural nodes: [cx,cy,r,isCyan,delay]
const _NND:[number,number,number,boolean,number][] = [
  [138,188,2.8,false,0],[245,242,2.2,true,1.5],[315,268,2.8,false,3.0],
  [715,192,2.8,false,0.8],[625,245,2.2,true,2.2],[552,268,2.5,false,4.5],
  [142,458,2.8,false,1.0],[248,415,2.2,false,2.8],
  [715,452,2.8,false,0.5],[618,410,2.2,true,3.5],
  [430,112,3.2,false,2.0],[382,148,2.5,false,1.2],[478,148,2.5,false,0.3],
]

// Particles: [cx, cy, r, anim, delay, isCyan]
const _GPTS:[number,number,number,string,number,boolean][] = [
  [82,148,1.0,'jm-da',0,false],[195,68,1.2,'jm-db',1.2,false],[348,45,0.8,'jm-dc',2.8,false],
  [625,40,1.1,'jm-da',0.6,false],[788,92,0.9,'jm-dd',2.0,false],[912,182,1.2,'jm-de',3.8,false],
  [922,345,0.8,'jm-da',1.0,false],[918,438,1.0,'jm-db',5.2,false],[825,562,1.1,'jm-dc',0.4,false],
  [698,660,1.0,'jm-dd',3.2,false],[452,708,0.8,'jm-de',1.8,false],[275,720,1.2,'jm-da',5.8,false],
  [128,640,1.0,'jm-db',0.8,false],[48,510,1.1,'jm-dc',4.2,false],[38,356,0.8,'jm-dd',2.5,false],
  [52,230,1.0,'jm-de',0.2,false],[140,108,1.2,'jm-da',4.8,false],[258,160,0.9,'jm-db',1.6,false],
  [392,70,1.0,'jm-dc',3.0,false],[515,108,1.1,'jm-dd',6.8,false],[650,158,0.8,'jm-de',0.5,false],
  [815,280,1.0,'jm-da',2.0,false],[860,418,1.2,'jm-db',4.6,false],[768,540,0.9,'jm-dc',1.3,false],
  [602,595,1.0,'jm-dd',3.6,false],[418,612,1.1,'jm-de',5.0,false],[265,575,0.8,'jm-da',0.7,false],
  [138,492,1.0,'jm-db',2.4,false],[90,385,1.2,'jm-dc',4.0,false],[118,282,0.9,'jm-dd',1.1,false],
  [430,193,1.8,'jm-da',0,false],[278,313,1.5,'jm-db',2.0,false],[582,313,1.5,'jm-dc',1.0,false],
  [278,437,1.5,'jm-dd',3.0,false],[582,437,1.5,'jm-de',4.0,false],
  [435,65,1.3,'jm-da',7.0,true],[790,375,1.1,'jm-db',3.5,true],[430,680,1.2,'jm-dc',1.8,true],
  [70,375,1.0,'jm-dd',5.5,true],[355,92,0.9,'jm-de',2.8,true],
]

// Floor ellipses: [rx, ry, opacity, strokeWidth, isCyan]
const _GFLOOR:[number,number,number,number,boolean][] = [
  [42, 8, 0.88,1.8,false],[70, 13,0.78,1.6,false],[102,18,0.68,1.5,false],
  [140,24,0.56,1.4,false],[182,30,0.44,1.3,false],[228,38,0.32,1.2,false],
  [278,46,0.22,1.0,false],[335,55,0.14,0.8,false],[395,65,0.08,0.6,false],
  [162,28,0.25,0.9,true],[252,44,0.18,0.7,true],
]

// (old tick/arm/node/particle data removed — replaced by _GSEGS/_GPTS/_GFLOOR)




// PERMANENT — background runs independently of voice state; mode used for subtle highlights only
function CircuitBackground({ mode }: { mode: string }) {
  const isListen = mode==='listening'
  const isSpeak  = mode==='speaking'
  const isProc   = mode==='processing'
  return (
    <div aria-hidden="true"
      style={{position:'absolute',inset:0,zIndex:-1,pointerEvents:'none',overflow:'hidden'}}>
      <style>{`
        @keyframes jm-cw    {to{transform:rotate(360deg)}}
        @keyframes jm-ccw   {to{transform:rotate(-360deg)}}
        @keyframes jm-pulse {0%,100%{opacity:.18}50%{opacity:.90}}
        @keyframes jm-pbr   {0%,100%{opacity:.40}50%{opacity:1}}
        @keyframes jm-glow  {0%,100%{opacity:.52}50%{opacity:1}}
        @keyframes jm-beam  {0%,100%{opacity:.58}50%{opacity:1}}
        @keyframes jm-floor {0%,100%{opacity:.58}50%{opacity:.92}}
        @keyframes jm-da    {0%,100%{transform:translate(0,0)}50%{transform:translate(4px,-6px)}}
        @keyframes jm-db    {0%,100%{transform:translate(0,0)}50%{transform:translate(-5px,4px)}}
        @keyframes jm-dc    {0%,100%{transform:translate(0,0)}50%{transform:translate(3px,7px)}}
        @keyframes jm-dd    {0%,100%{transform:translate(0,0)}50%{transform:translate(-4px,-5px)}}
        @keyframes jm-de    {0%,100%{transform:translate(0,0)}50%{transform:translate(6px,2px)}}
        @keyframes jm-wf    {to{stroke-dashoffset:-300}}
        @keyframes jm-wr    {to{stroke-dashoffset:300}}
        @keyframes jm-sig   {to{stroke-dashoffset:-268}}
        @keyframes jm-ripple{0%{transform:scale(0.01);opacity:.75}100%{transform:scale(1);opacity:0}}
        @media(prefers-reduced-motion:reduce){.jm{animation:none!important}}
      `}</style>

      {/* ── BACK LAYER ── */}

      {/* 1. Deep black base — micro gold tint at center only */}
      <div style={{position:'absolute',inset:0,
        background:'radial-gradient(ellipse 58% 68% at 43% 50%,#030604 0%,#020403 22%,#010302 55%,#010202 100%)'}}/>

      {/* 2. Gold ambient glow — primary light, state-reactive */}
      <div className="jm" style={{
        position:'absolute',left:'3%',top:'2%',width:'66%',height:'96%',
        background:`radial-gradient(ellipse at 43% 50%,rgba(255,192,22,${isSpeak?.28:isListen?.21:.16}) 0%,rgba(255,165,0,.07) 28%,rgba(255,128,0,.02) 52%,transparent 72%)`,
        animation:'jm-glow 11s ease-in-out infinite',
        transition:'background 1.2s ease',
      }}/>

      {/* 3. Secondary breathing halo */}
      <div className="jm" style={{
        position:'absolute',left:'10%',top:'8%',width:'58%',height:'84%',
        background:`radial-gradient(ellipse at 43% 50%,rgba(255,212,42,${isSpeak?.15:isProc?.12:.09}) 0%,rgba(255,180,8,.03) 38%,transparent 62%)`,
        animation:'jm-glow 8s ease-in-out infinite 2.5s',
        transition:'background 1.2s ease',
      }}/>

      {/* 4. Gold vertical energy axis */}
      <div style={{
        position:'absolute',top:0,bottom:0,left:'calc(43% - 14px)',width:'28px',
        background:'linear-gradient(to bottom,transparent 0%,rgba(255,210,48,.00) 8%,rgba(255,212,50,.07) 36%,rgba(255,216,55,.18) 50%,rgba(255,212,50,.07) 64%,rgba(255,210,48,.00) 92%,transparent 100%)',
      }}/>
      <div className="jm" style={{
        position:'absolute',top:0,bottom:0,left:'calc(43% - 1px)',width:'2px',
        background:'linear-gradient(to bottom,transparent 0%,rgba(255,212,50,.04) 8%,rgba(255,218,58,.40) 36%,rgba(255,222,65,.62) 50%,rgba(255,218,58,.40) 64%,rgba(255,210,45,.10) 84%,rgba(255,205,38,.24) 94%,rgba(255,200,35,.08) 100%)',
        animation:'jm-beam 9s ease-in-out infinite',
      }}/>

      {/* 5. Cyan projection beam — center downward to floor */}
      <div className="jm" style={{
        position:'absolute',top:'51%',bottom:0,left:'calc(43% - 24px)',width:'48px',
        background:`linear-gradient(to bottom,rgba(0,200,220,${isListen?.32:.22}) 0%,rgba(0,188,212,.15) 30%,rgba(0,175,205,.07) 65%,rgba(0,162,198,.02) 100%)`,
        maskImage:'linear-gradient(to bottom,black 0%,rgba(0,0,0,.6) 55%,transparent 100%)',
        WebkitMaskImage:'linear-gradient(to bottom,black 0%,rgba(0,0,0,.6) 55%,transparent 100%)',
        filter:'blur(4px)',animation:'jm-beam 7s ease-in-out infinite 1s',
        transition:'background 1.2s ease',
      }}/>
      <div style={{
        position:'absolute',top:'51%',bottom:0,left:'calc(43% - 1px)',width:'2px',
        background:'linear-gradient(to bottom,rgba(0,210,230,.60) 0%,rgba(0,195,220,.38) 32%,rgba(0,178,210,.14) 70%,transparent 100%)',
      }}/>

      {/* ── SVG ── */}
      <svg viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice"
        style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>

        {/* ── BACK: ghost outer rings ── */}
        <circle cx={_JCX} cy={_JCY} r="582" fill="none"
          stroke="rgba(255,200,38,.038)" strokeWidth="0.6"
          strokeDasharray="24 62" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-cw 105s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="635" fill="none"
          stroke="rgba(255,195,32,.022)" strokeWidth="0.5" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-ccw 132s linear infinite'}}/>

        {/* ── BACK: Fluid wave particle ribbons ── */}
        {_FW.map(({d,op,sw,da,dur,rev,cyan},i)=>(
          <path key={i} d={d} fill="none"
            stroke={`rgba(${cyan?'0,200,215':'255,214,54'},${op})`}
            strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={da} className="jm"
            style={{animation:`${rev?'jm-wr':'jm-wf'} ${dur}s linear infinite ${(i*.88)%6}s`}}/>
        ))}

        {/* ── BACK: Neural network lines + traveling signals ── */}
        {_NN.map(([x1,y1,x2,y2,lineOp,sigDur,cyan,len],i)=>(
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={`rgba(${cyan?'0,200,215':'255,210,50'},${lineOp})`}
              strokeWidth="0.7"/>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={`rgba(${cyan?'0,215,225':'255,222,62'},.82)`}
              strokeWidth="1.5" strokeLinecap="round"
              strokeDasharray={`4 ${len+4}`} className="jm"
              style={{animation:`jm-sig ${sigDur}s linear infinite ${(i*.72)%4}s`}}/>
          </g>
        ))}

        {/* Neural nodes */}
        {_NND.map(([cx,cy,r,cyan,delay],i)=>(
          <g key={i} className="jm"
            style={{animation:`${i%3===0?'jm-pbr':'jm-pulse'} ${3+(i%4)*.7}s ease-in-out ${delay}s infinite`}}>
            <circle cx={cx} cy={cy} r={r*2.2}
              fill={`rgba(${cyan?'0,205,220':'255,205,45'},.08)`}/>
            <circle cx={cx} cy={cy} r={r}
              fill={`rgba(${cyan?'0,225,235':'255,228,68'},.94)`}
              style={{filter:`drop-shadow(0 0 3px rgba(${cyan?'0,210,222':'255,212,50'},1))`}}/>
          </g>
        ))}

        {/* ── MID: main HUD rings — hierarchy of brightness ── */}
        <circle cx={_JCX} cy={_JCY} r="488" fill="none"
          stroke="rgba(255,205,44,.052)" strokeWidth="0.8" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-cw 82s linear infinite 3s'}}/>
        <circle cx={_JCX} cy={_JCY} r="455" fill="none"
          stroke="rgba(255,208,46,.070)" strokeWidth="0.9"
          strokeDasharray="16 38" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-ccw 66s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="422" fill="none"
          stroke="rgba(255,210,48,.088)" strokeWidth="1.0" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-cw 54s linear infinite 1.5s'}}/>
        <circle cx={_JCX} cy={_JCY} r="390" fill="none"
          stroke="rgba(255,213,50,.108)" strokeWidth="1.1"/>
        <circle cx={_JCX} cy={_JCY} r="362" fill="none"
          stroke="rgba(255,215,52,.126)" strokeWidth="1.2" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-ccw 47s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="338" fill="none"
          stroke="rgba(255,218,55,.145)" strokeWidth="1.4" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-cw 40s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="315" fill="none"
          stroke="rgba(255,220,58,.165)" strokeWidth="1.5"/>
        <circle cx={_JCX} cy={_JCY} r="293" fill="none"
          stroke="rgba(255,222,62,.140)" strokeWidth="1.2"
          strokeDasharray="6 14" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-ccw 32s linear infinite'}}/>
        {/* Inner glow ring */}
        <circle cx={_JCX} cy={_JCY} r="274" fill="none"
          stroke={`rgba(255,225,65,${isSpeak?.26:isProc?.22:.212})`}
          strokeWidth="2.5" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-cw 25s linear infinite',transition:'stroke .8s ease'}}/>
        <circle cx={_JCX} cy={_JCY} r="274" fill="none"
          stroke="rgba(255,218,52,.060)" strokeWidth="14"/>

        {/* ── MID: rotating arc segments ── */}
        {_GSEGS.map(({d,op,sw,cyan,dur,ccw},i)=>(
          <path key={i} d={d} fill="none"
            stroke={`rgba(${cyan?'0,202,222':'255,214,54'},${op})`}
            strokeWidth={sw} strokeLinecap="round" className="jm"
            style={{
              transformOrigin:`${_JCX}px ${_JCY}px`,
              animation:`${ccw?'jm-ccw':'jm-cw'} ${dur}s linear infinite ${(i*.62)%5}s`,
              filter:`drop-shadow(0 0 ${cyan?2:3}px rgba(${cyan?'0,198,218':'255,210,48'},${op*.75}))`,
            }}/>
        ))}

        {/* ── FLOOR: holographic projection platform ── */}
        <g className="jm" style={{animation:'jm-floor 14s ease-in-out infinite'}}>
          {([0,22.5,45,67.5,90,112.5,135,157.5] as number[]).map((deg,i)=>{
            const a=deg*Math.PI/180, r=385
            return (
              <line key={i} x1={_JCX} y1={_JFY}
                x2={(_JCX+r*Math.cos(a)).toFixed(1)}
                y2={(_JFY+r*0.18*Math.sin(a)).toFixed(1)}
                stroke={`rgba(${i%4===1?'0,200,215':'255,208,48'},.${i%3===0?'09':'06'})`}
                strokeWidth="0.6"/>
            )
          })}
          {_GFLOOR.map(([rx,ry,op,sw,cyan],i)=>(
            <ellipse key={i} cx={_JCX} cy={_JFY} rx={rx} ry={ry} fill="none"
              stroke={`rgba(${cyan?'0,200,215':'255,208,48'},${op})`}
              strokeWidth={sw}
              style={{filter:`drop-shadow(0 1px ${cyan?2:3}px rgba(${cyan?'0,195,212':'255,200,42'},${op*.4}))`}}/>
          ))}
          {/* Scanner ripple rings */}
          <circle cx={_JCX} cy={_JFY} r="385" fill="none"
            stroke="rgba(0,200,215,.55)" strokeWidth="1.2" className="jm"
            style={{transformOrigin:`${_JCX}px ${_JFY}px`,animation:'jm-ripple 8s ease-out infinite'}}/>
          <circle cx={_JCX} cy={_JFY} r="385" fill="none"
            stroke="rgba(255,208,48,.45)" strokeWidth="1.0" className="jm"
            style={{transformOrigin:`${_JCX}px ${_JFY}px`,animation:'jm-ripple 8s ease-out infinite 4s'}}/>
          {/* Floor center bright point */}
          <circle cx={_JCX} cy={_JFY} r="4.8" fill="rgba(255,220,60,.94)"
            style={{filter:'drop-shadow(0 0 8px rgba(255,210,48,1))'}}/>
          <circle cx={_JCX} cy={_JFY} r="12" fill="rgba(255,215,50,.14)"/>
        </g>

        {/* ── BACK: particles ── */}
        {_GPTS.map(([cx,cy,r,anim,delay,cyan],i)=>(
          <circle key={i} cx={cx} cy={cy} r={r}
            fill={`rgba(${cyan?'0,198,218':r>=1.5?'255,224,66':'255,214,54'},${r>=1.5?.74:.44})`}
            className="jm"
            style={{
              animation:`${anim} ${12+(i%7)*1.4}s ease-in-out ${delay}s infinite`,
              filter:`drop-shadow(0 0 ${r>=1.5?3:2}px rgba(${cyan?'0,194,214':'255,208,48'},${r>=1.5?.82:.50}))`,
            }}/>
        ))}

        {/* ── FRONT: inner ring sweep arcs (state-sensitive) ── */}
        <circle cx={_JCX} cy={_JCY} r="274" fill="none"
          stroke={`rgba(255,228,70,${isSpeak?.55:isListen?.46:.38})`}
          strokeWidth="1.0" strokeDasharray="58 330" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-cw 21s linear infinite 1s',transition:'stroke .8s ease'}}/>
        <circle cx={_JCX} cy={_JCY} r="274" fill="none"
          stroke={`rgba(255,228,70,${isProc?.48:isSpeak?.50:.34})`}
          strokeWidth="1.0" strokeDasharray="38 350" className="jm"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jm-ccw 18s linear infinite',transition:'stroke .8s ease'}}/>
        {/* Energy contact points */}
        <circle cx={_JCX} cy={_JCY-274} r="4.8" fill="rgba(255,226,66,.95)"
          className="jm" style={{animation:'jm-pbr 4s ease-in-out infinite'}}/>
        <circle cx={_JCX} cy={_JCY-274} r="13" fill="rgba(255,215,50,.11)"/>
        <circle cx={_JCX} cy={_JCY+274} r="4.8" fill="rgba(255,226,66,.95)"
          className="jm" style={{animation:'jm-pbr 4s ease-in-out infinite 2s'}}/>
        <circle cx={_JCX} cy={_JCY+274} r="13" fill="rgba(255,215,50,.11)"/>
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
