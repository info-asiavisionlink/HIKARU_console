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

// ─── JARVIS Gold Holographic HUD ──────────────────────────────

const _JCX=430, _JCY=375   // SVG center
const _JFY=545              // Floor projection center Y

// Arc path helper — computes SVG arc command for a segment on a ring
function _arc(r:number,a0:number,a1:number):string{
  const s=a0*Math.PI/180, e=a1*Math.PI/180, lg=a1-a0>180?1:0
  return `M${(_JCX+r*Math.cos(s)).toFixed(1)},${(_JCY+r*Math.sin(s)).toFixed(1)} A${r},${r} 0 ${lg},1 ${(_JCX+r*Math.cos(e)).toFixed(1)},${(_JCY+r*Math.sin(e)).toFixed(1)}`
}

// Gold/Cyan arc segments: {d, op, sw, cyan, dur (rotation s), ccw}
const _GSEGS:{d:string;op:number;sw:number;cyan:boolean;dur:number;ccw:boolean}[] = (()=>{
  const out:{d:string;op:number;sw:number;cyan:boolean;dur:number;ccw:boolean}[] = []
  // r=282: 4 bright arcs, medium speed
  for(let i=0;i<4;i++) out.push({d:_arc(282,i*90-4,i*90+32),op:.65,sw:2.8,cyan:false,dur:36,ccw:i%2===1})
  // r=318: 8 short segments, fast accent
  for(let i=0;i<8;i++) out.push({d:_arc(318,i*45+4,i*45+19),op:.55,sw:2.2,cyan:false,dur:20,ccw:i%2===0})
  // r=355: 6 segments, medium
  for(let i=0;i<6;i++) out.push({d:_arc(355,i*60+8,i*60+19),op:.40,sw:1.5,cyan:false,dur:50,ccw:i%3!==0})
  // r=392: 3 cyan accent arcs
  for(let i=0;i<3;i++) out.push({d:_arc(392,i*120+15,i*120+34),op:.48,sw:1.6,cyan:true,dur:30,ccw:i%2===1})
  // r=435: 4 gold segments, slow
  for(let i=0;i<4;i++) out.push({d:_arc(435,i*90+12,i*90+34),op:.30,sw:1.2,cyan:false,dur:68,ccw:i%2===0})
  // r=480: 3 segments, slow
  for(let i=0;i<3;i++) out.push({d:_arc(480,i*120+6,i*120+20),op:.20,sw:0.9,cyan:false,dur:92,ccw:true})
  // r=525: 2 large cyan arcs, very slow
  out.push({d:_arc(525,12,58),op:.28,sw:1.2,cyan:true,dur:82,ccw:false})
  out.push({d:_arc(525,192,238),op:.22,sw:1.0,cyan:true,dur:96,ccw:true})
  return out
})()

// Particles: [cx, cy, r, anim, delay, isCyan]
const _GPTS:[number,number,number,string,number,boolean][] = [
  [82,148,1.0,'jg-da',0,false],[195,68,1.2,'jg-db',1.2,false],[348,45,0.8,'jg-dc',2.8,false],
  [625,40,1.1,'jg-da',0.6,false],[788,92,0.9,'jg-dd',2.0,false],[912,182,1.2,'jg-de',3.8,false],
  [922,345,0.8,'jg-da',1.0,false],[918,438,1.0,'jg-db',5.2,false],[825,562,1.1,'jg-dc',0.4,false],
  [698,660,1.0,'jg-dd',3.2,false],[452,708,0.8,'jg-de',1.8,false],[275,720,1.2,'jg-da',5.8,false],
  [128,640,1.0,'jg-db',0.8,false],[48,510,1.1,'jg-dc',4.2,false],[38,356,0.8,'jg-dd',2.5,false],
  [52,230,1.0,'jg-de',0.2,false],[140,108,1.2,'jg-da',4.8,false],[258,160,0.9,'jg-db',1.6,false],
  [392,70,1.0,'jg-dc',3.0,false],[515,108,1.1,'jg-dd',6.8,false],[650,158,0.8,'jg-de',0.5,false],
  [815,280,1.0,'jg-da',2.0,false],[860,418,1.2,'jg-db',4.6,false],[768,540,0.9,'jg-dc',1.3,false],
  [602,595,1.0,'jg-dd',3.6,false],[418,612,1.1,'jg-de',5.0,false],[265,575,0.8,'jg-da',0.7,false],
  [138,492,1.0,'jg-db',2.4,false],[90,385,1.2,'jg-dc',4.0,false],[118,282,0.9,'jg-dd',1.1,false],
  // bright gold highlights
  [430,193,1.8,'jg-da',0,false],[278,313,1.5,'jg-db',2.0,false],[582,313,1.5,'jg-dc',1.0,false],
  [278,437,1.5,'jg-dd',3.0,false],[582,437,1.5,'jg-de',4.0,false],
  // cyan accents (few)
  [435,65,1.3,'jg-da',7.0,true],[790,375,1.1,'jg-db',3.5,true],[430,680,1.2,'jg-dc',1.8,true],
  [70,375,1.0,'jg-dd',5.5,true],
]

// Floor ellipses: [rx, ry, opacity, strokeWidth, isCyan]
const _GFLOOR:[number,number,number,number,boolean][] = [
  [42, 8, 0.82,1.8,false],[68, 13,0.72,1.6,false],[98, 18,0.62,1.5,false],
  [132,24,0.54,1.4,false],[170,30,0.46,1.3,false],[212,38,0.36,1.2,false],
  [258,46,0.26,1.0,false],[308,55,0.17,0.8,false],[362,65,0.10,0.6,false],
  [158,28,0.22,0.9,true],[248,44,0.15,0.7,true],
]

// (old tick/arm/node/particle data removed — replaced by _GSEGS/_GPTS/_GFLOOR)




// PERMANENT — Voice state independent, all CSS animations
function CircuitBackground({ mode: _mode }: { mode: string }) {
  return (
    <div aria-hidden="true"
      style={{position:'absolute',inset:0,zIndex:-1,pointerEvents:'none',overflow:'hidden'}}>
      <style>{`
        @keyframes jg-cw   {to{transform:rotate(360deg)}}
        @keyframes jg-ccw  {to{transform:rotate(-360deg)}}
        @keyframes jg-pulse{0%,100%{opacity:.18}50%{opacity:.88}}
        @keyframes jg-pbr  {0%,100%{opacity:.38}50%{opacity:1}}
        @keyframes jg-glow {0%,100%{opacity:.55}50%{opacity:1}}
        @keyframes jg-beam {0%,100%{opacity:.60}50%{opacity:1}}
        @keyframes jg-floor{0%,100%{opacity:.55}50%{opacity:.88}}
        @keyframes jg-da   {0%,100%{transform:translate(0,0)}50%{transform:translate(4px,-6px)}}
        @keyframes jg-db   {0%,100%{transform:translate(0,0)}50%{transform:translate(-5px,4px)}}
        @keyframes jg-dc   {0%,100%{transform:translate(0,0)}50%{transform:translate(3px,7px)}}
        @keyframes jg-dd   {0%,100%{transform:translate(0,0)}50%{transform:translate(-4px,-5px)}}
        @keyframes jg-de   {0%,100%{transform:translate(0,0)}50%{transform:translate(6px,2px)}}
        @media(prefers-reduced-motion:reduce){.jg{animation:none!important}}
      `}</style>

      {/* BACK LAYER */}

      {/* 1. Near-black base — micro gold tint only at center */}
      <div style={{position:'absolute',inset:0,
        background:'radial-gradient(ellipse 62% 72% at 43% 50%,#030604 0%,#020403 28%,#010202 68%,#010202 100%)'}}/>

      {/* 2. Gold core ambient glow — primary light source */}
      <div className="jg" style={{
        position:'absolute',left:'4%',top:'3%',width:'64%',height:'94%',
        background:'radial-gradient(ellipse at 43% 50%,rgba(255,192,20,.24) 0%,rgba(255,165,0,.10) 26%,rgba(255,128,0,.03) 50%,transparent 70%)',
        animation:'jg-glow 11s ease-in-out infinite',
      }}/>

      {/* 3. Secondary gold breathing halo */}
      <div className="jg" style={{
        position:'absolute',left:'12%',top:'8%',width:'56%',height:'84%',
        background:'radial-gradient(ellipse at 43% 50%,rgba(255,212,42,.13) 0%,rgba(255,180,8,.04) 36%,transparent 62%)',
        animation:'jg-glow 8s ease-in-out infinite 2.5s',
      }}/>

      {/* 4. Gold vertical energy axis — 1-2px core + soft glow */}
      <div style={{
        position:'absolute',top:0,bottom:0,left:'calc(43% - 12px)',width:'24px',
        background:'linear-gradient(to bottom,transparent 0%,rgba(255,210,48,.00) 8%,rgba(255,212,50,.07) 38%,rgba(255,216,55,.16) 50%,rgba(255,212,50,.07) 62%,rgba(255,210,48,.00) 92%,transparent 100%)',
      }}/>
      <div className="jg" style={{
        position:'absolute',top:0,bottom:0,left:'calc(43% - 1px)',width:'2px',
        background:'linear-gradient(to bottom,transparent 0%,rgba(255,212,50,.05) 8%,rgba(255,218,58,.42) 38%,rgba(255,222,62,.62) 50%,rgba(255,218,58,.42) 62%,rgba(255,210,45,.12) 84%,rgba(255,205,38,.28) 94%,rgba(255,200,35,.08) 100%)',
        animation:'jg-beam 9s ease-in-out infinite',
      }}/>

      {/* 5. Cyan energy beam — center downward to floor */}
      <div className="jg" style={{
        position:'absolute',top:'52%',bottom:0,left:'calc(43% - 22px)',width:'44px',
        background:'linear-gradient(to bottom,rgba(0,198,218,.24) 0%,rgba(0,188,212,.18) 25%,rgba(0,175,205,.10) 60%,rgba(0,162,198,.04) 100%)',
        maskImage:'linear-gradient(to bottom,black 0%,rgba(0,0,0,.6) 55%,transparent 100%)',
        WebkitMaskImage:'linear-gradient(to bottom,black 0%,rgba(0,0,0,.6) 55%,transparent 100%)',
        filter:'blur(4px)',
        animation:'jg-beam 7s ease-in-out infinite 1s',
      }}/>
      <div style={{
        position:'absolute',top:'52%',bottom:0,left:'calc(43% - 1px)',width:'2px',
        background:'linear-gradient(to bottom,rgba(0,208,228,.58) 0%,rgba(0,192,218,.38) 35%,rgba(0,178,210,.16) 72%,transparent 100%)',
      }}/>

      {/* SVG — all ring/floor/particle layers */}
      <svg viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice"
        style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>

        {/* ── BACK: faint outer ghost rings ── */}
        <circle cx={_JCX} cy={_JCY} r="578" fill="none"
          stroke="rgba(255,200,38,.042)" strokeWidth="0.7"
          strokeDasharray="22 55" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-cw 100s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="628" fill="none"
          stroke="rgba(255,195,32,.028)" strokeWidth="0.5" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-ccw 125s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="528" fill="none"
          stroke="rgba(255,200,40,.035)" strokeWidth="0.6"
          strokeDasharray="32 85" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-ccw 88s linear infinite 6s'}}/>

        {/* ── MID: main holographic HUD rings ── */}
        <circle cx={_JCX} cy={_JCY} r="482" fill="none"
          stroke="rgba(255,205,44,.058)" strokeWidth="0.8" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-cw 78s linear infinite 3s'}}/>
        <circle cx={_JCX} cy={_JCY} r="450" fill="none"
          stroke="rgba(255,208,46,.075)" strokeWidth="0.9"
          strokeDasharray="14 32" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-ccw 62s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="418" fill="none"
          stroke="rgba(255,210,48,.092)" strokeWidth="1.0" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-cw 50s linear infinite 1.5s'}}/>
        <circle cx={_JCX} cy={_JCY} r="385" fill="none"
          stroke="rgba(255,213,50,.112)" strokeWidth="1.1"/>
        <circle cx={_JCX} cy={_JCY} r="358" fill="none"
          stroke="rgba(255,215,52,.128)" strokeWidth="1.2" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-ccw 44s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="332" fill="none"
          stroke="rgba(255,218,55,.148)" strokeWidth="1.4" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-cw 36s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="308" fill="none"
          stroke="rgba(255,220,58,.168)" strokeWidth="1.5"/>
        <circle cx={_JCX} cy={_JCY} r="288" fill="none"
          stroke="rgba(255,222,62,.145)" strokeWidth="1.2"
          strokeDasharray="5 10" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-ccw 29s linear infinite'}}/>
        {/* Inner glow ring — thicker, brightest background ring */}
        <circle cx={_JCX} cy={_JCY} r="270" fill="none"
          stroke="rgba(255,225,65,.210)" strokeWidth="2.2" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-cw 23s linear infinite'}}/>
        <circle cx={_JCX} cy={_JCY} r="270" fill="none"
          stroke="rgba(255,218,52,.065)" strokeWidth="10"/>

        {/* ── ROTATING ARC SEGMENTS (gold + cyan accents) ── */}
        {_GSEGS.map(({d,op,sw,cyan,dur,ccw},i)=>(
          <path key={i} d={d} fill="none"
            stroke={`rgba(${cyan?'0,202,222':'255,214,54'},${op})`}
            strokeWidth={sw} strokeLinecap="round" className="jg"
            style={{
              transformOrigin:`${_JCX}px ${_JCY}px`,
              animation:`${ccw?'jg-ccw':'jg-cw'} ${dur}s linear infinite ${(i*.65)%5}s`,
              filter:`drop-shadow(0 0 ${cyan?2:3}px rgba(${cyan?'0,198,218':'255,210,48'},${op*.75}))`,
            }}/>
        ))}

        {/* ── FLOOR: holographic projection ── */}
        <g className="jg" style={{animation:'jg-floor 14s ease-in-out infinite'}}>
          {/* Radial lines on floor (8 directions) */}
          {([0,22.5,45,67.5,90,112.5,135,157.5] as number[]).map((deg,i)=>{
            const a=deg*Math.PI/180, r=348
            return (
              <line key={i}
                x1={_JCX} y1={_JFY}
                x2={(_JCX+r*Math.cos(a)).toFixed(1)}
                y2={(_JFY+r*0.18*Math.sin(a)).toFixed(1)}
                stroke={`rgba(${i%4===1?'0,198,215':'255,208,48'},.${i%3===0?'09':'06'})`}
                strokeWidth="0.6"/>
            )
          })}
          {/* Concentric floor ellipses */}
          {_GFLOOR.map(([rx,ry,op,sw,cyan],i)=>(
            <ellipse key={i} cx={_JCX} cy={_JFY} rx={rx} ry={ry} fill="none"
              stroke={`rgba(${cyan?'0,198,215':'255,208,48'},${op})`}
              strokeWidth={sw}
              style={{filter:`drop-shadow(0 1px ${cyan?2:3}px rgba(${cyan?'0,192,212':'255,200,42'},${op*.45}))`}}/>
          ))}
          {/* Floor center bright point */}
          <circle cx={_JCX} cy={_JFY} r="4.0" fill="rgba(255,220,60,.90)"
            style={{filter:'drop-shadow(0 0 7px rgba(255,210,48,1))'}}/>
          <circle cx={_JCX} cy={_JFY} r="10" fill="rgba(255,215,50,.14)"/>
        </g>

        {/* ── Minimal background network (very faint) ── */}
        <g fill="none" stroke="rgba(255,205,46,.058)" strokeWidth="0.6">
          <path d="M0,188 L122,238 L242,222"/>
          <path d="M0,432 L75,388 L145,328 L242,308"/>
          <path d="M245,0 L270,75 L294,140"/>
          <path d="M250,750 L275,665 L298,615"/>
        </g>
        {/* 2 bright moving signals only */}
        <path d="M0,238 L122,238 L242,222" fill="none"
          stroke="rgba(255,224,64,.58)" strokeWidth="1.8" strokeDasharray="16 212"
          strokeLinecap="round" className="jg"
          style={{animation:'jg-cw 7s linear infinite',strokeDashoffset:0}}/>
        <path d="M245,0 L270,75 L294,140" fill="none"
          stroke="rgba(0,208,224,.52)" strokeWidth="1.8" strokeDasharray="14 148"
          strokeLinecap="round" className="jg"
          style={{animation:'jg-ccw 6s linear infinite 3s',strokeDashoffset:0}}/>

        {/* ── PARTICLES ── */}
        {_GPTS.map(([cx,cy,r,anim,delay,cyan],i)=>(
          <circle key={i} cx={cx} cy={cy} r={r}
            fill={`rgba(${cyan?'0,198,218':r>=1.5?'255,224,66':'255,214,54'},${r>=1.5?.72:.44})`}
            className="jg"
            style={{
              animation:`${anim} ${12+(i%7)*1.4}s ease-in-out ${delay}s infinite`,
              filter:`drop-shadow(0 0 ${r>=1.5?3:2}px rgba(${cyan?'0,194,214':'255,208,48'},${r>=1.5?.80:.48}))`,
            }}/>
        ))}

        {/* ── FRONT: inner ring bright arcs (sweeping) ── */}
        <circle cx={_JCX} cy={_JCY} r="270" fill="none"
          stroke="rgba(255,228,70,.48)" strokeWidth="1.0"
          strokeDasharray="50 320" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-cw 19s linear infinite 1s'}}/>
        <circle cx={_JCX} cy={_JCY} r="270" fill="none"
          stroke="rgba(255,228,70,.40)" strokeWidth="1.0"
          strokeDasharray="32 338" className="jg"
          style={{transformOrigin:`${_JCX}px ${_JCY}px`,animation:'jg-ccw 16s linear infinite'}}/>
        {/* energy contact points at top/bottom of inner ring */}
        <circle cx={_JCX} cy={_JCY-270} r="4.2" fill="rgba(255,226,66,.92)"
          className="jg" style={{animation:'jg-pbr 4s ease-in-out infinite'}}/>
        <circle cx={_JCX} cy={_JCY-270} r="11" fill="rgba(255,215,50,.12)"/>
        <circle cx={_JCX} cy={_JCY+270} r="4.2" fill="rgba(255,226,66,.92)"
          className="jg" style={{animation:'jg-pbr 4s ease-in-out infinite 2s'}}/>
        <circle cx={_JCX} cy={_JCY+270} r="11" fill="rgba(255,215,50,.12)"/>
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
