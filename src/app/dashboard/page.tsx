'use client'
// app/(dashboard)/page.tsx — SophiaOS Command Center v2
// Reemplaza tu dashboard actual. Requiere: npm install recharts

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Stats {
  activeLeads: number; leadsThisMonth: number
  closedWonMonth: number; closedWonTotal: number
  conversionRate: number; avgLeadScore: number
  mrrReal: number; mrrTotal: number
  commissionsMonth: number; commissionsTotal: number
  pipeline: { stage: string; count: number; key: string }[]
  sparkline: { dia: string; leads: number }[]
  commissionTrend: { mes: string; comisiones: number }[]
  sophiaConversationsToday: number
  sophiaLive: { id: string; lead_name: string; lead_phone: string; message: string; created_at: string; sentiment: string }[]
  upcomingEvents: { id: string; title: string; start_time: string; event_type: string; lead_name: string; status: string }[]
  doctorAppointments: { id: string; doctor_name: string; specialty: string; scheduled_at: string; status: string; lead_name: string; in_network: boolean }[]
  doctorApptsCount: number
}

// ── Themes ─────────────────────────────────────────────────────────────────────
const DARK = {
  bg: 'linear-gradient(135deg,#0d0820 0%,#130a2e 50%,#0a1628 100%)',
  panel: 'rgba(255,255,255,0.05)', border: 'rgba(149,76,233,0.18)',
  text: '#f0eaff', muted: 'rgba(200,180,255,0.45)',
  accent: '#9B59B6', cyan: '#00D4FF', green: '#00E5A0',
  gold: '#FFB930', red: '#FF4757',
  blur: 'blur(20px)', shadow: '0 8px 32px rgba(0,0,0,0.4)',
}
const LIGHT = {
  bg: 'linear-gradient(135deg,#f0ebff 0%,#e8f4ff 50%,#f5f0ff 100%)',
  panel: 'rgba(255,255,255,0.78)', border: 'rgba(124,58,237,0.12)',
  text: '#1a0a3d', muted: 'rgba(80,50,120,0.5)',
  accent: '#7c3aed', cyan: '#0891b2', green: '#059669',
  gold: '#d97706', red: '#dc2626',
  blur: 'blur(16px)', shadow: '0 4px 20px rgba(100,50,200,0.08)',
}

const PIPE_COLORS = ['#00D4FF','#9B59B6','#FFB930','#FF6B6B','#00E5A0','#E91E8C','#27AE60','#2980B9']

// ── SVG Ring ───────────────────────────────────────────────────────────────────
function Ring({ pct, size=80, stroke=7, color, bg, value, label }:
  { pct:number; size?:number; stroke?:number; color:string; bg:string; value:string; label?:string }) {
  const r = (size - stroke * 2) / 2
  const c = 2 * Math.PI * r
  const d = (Math.min(Math.max(pct,0),100) / 100) * c
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${d} ${c}`} strokeLinecap="round"
          style={{ filter:`drop-shadow(0 0 6px ${color}90)`, transition:'stroke-dasharray 1.2s ease' }}/>
      </svg>
      <div style={{ position:'absolute',inset:0, display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1 }}>
        <span style={{ fontSize:size>65?14:10, fontWeight:900, color, fontVariantNumeric:'tabular-nums' }}>{value}</span>
        {label && <span style={{ fontSize:8, color:'rgba(200,180,255,0.4)', textAlign:'center', maxWidth:size-16, lineHeight:1.2 }}>{label}</span>}
      </div>
    </div>
  )
}

// ── Analog Clock ───────────────────────────────────────────────────────────────
function Clock({ t, T }: { t:Date; T:typeof DARK }) {
  const S=110, cx=S/2, cy=S/2, r=S/2-4
  const deg = (v:number) => v * Math.PI / 180
  const hand = (angle:number, len:number, color:string, w:number) => {
    const a = deg(angle - 90)
    return <line x1={cx} y1={cy} x2={cx+Math.cos(a)*len} y2={cy+Math.sin(a)*len}
      stroke={color} strokeWidth={w} strokeLinecap="round"/>
  }
  return (
    <svg width={S} height={S}>
      <circle cx={cx} cy={cy} r={r} fill="rgba(149,76,233,0.08)" stroke={T.border} strokeWidth={1}/>
      {Array.from({length:12},(_,i)=>{
        const a = deg(i/12*360 - 90)
        return <line key={i} x1={cx+Math.cos(a)*(r-4)} y1={cy+Math.sin(a)*(r-4)}
          x2={cx+Math.cos(a)*(r-10)} y2={cy+Math.sin(a)*(r-10)}
          stroke={T.muted} strokeWidth={i%3===0?2:1}/>
      })}
      {hand((t.getHours()%12+t.getMinutes()/60)/12*360, r*.5, T.text, 3)}
      {hand((t.getMinutes()+t.getSeconds()/60)/60*360, r*.7, T.accent, 2)}
      {hand(t.getSeconds()/60*360, r*.85, T.cyan, 1)}
      <circle cx={cx} cy={cy} r={3} fill={T.accent} style={{ filter:`drop-shadow(0 0 4px ${T.accent})` }}/>
    </svg>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────────
function Card({ children, T, sx={}, glow='' }:
  { children:React.ReactNode; T:typeof DARK; sx?:React.CSSProperties; glow?:string }) {
  return (
    <div style={{
      background:T.panel, border:`1px solid ${T.border}`, borderRadius:16, padding:14,
      backdropFilter:T.blur, WebkitBackdropFilter:T.blur,
      boxShadow: glow ? `${T.shadow},0 0 20px ${glow}` : T.shadow, ...sx,
    }}>
      {children}
    </div>
  )
}

function SL({ children, T }: { children:React.ReactNode; T:typeof DARK }) {
  return <div style={{ fontSize:9, fontWeight:700, letterSpacing:3, color:T.muted, textTransform:'uppercase', marginBottom:8 }}>{children}</div>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Tip({ active, payload, label, T }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'rgba(13,8,32,0.95)', border:`1px solid ${T.border}`, borderRadius:8, padding:'8px 12px', backdropFilter:'blur(12px)' }}>
      {label && <div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>{label}</div>}
      {payload.map((p:{ name:string; value:number; color:string },i:number) => (
        <div key={i} style={{ fontSize:12, fontWeight:700, color:p.color }}>
          {p.name}: {typeof p.value==='number' ? p.value.toLocaleString('es-US') : p.value}
        </div>
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function CommandCenter() {
  const { user } = useAuth()
  const router = useRouter()
  const [dark, setDark]       = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('sophiaos-theme')
    if (saved !== null) return saved === 'dark'
    return new Date().getHours() < 7 || new Date().getHours() >= 19
  })
  const [time, setTime]       = useState(new Date())
  const [stats, setStats]     = useState<Stats|null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'overview'|'pipeline'|'sophia'|'citas'>('overview')
  const timerRef              = useRef<ReturnType<typeof setInterval>|null>(null)
  const T = dark ? DARK : LIGHT

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Data fetch
  const fetchStats = useCallback(async () => {
    if (!user?.id) return
    try {
      const r = await fetch(`/api/dashboard/stats?agentId=${user.id}`)
      if (!r.ok) return
      const { data } = await r.json()
      setStats(data)
    } catch (e) {
      console.error('[Dashboard]', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user?.id) return
    fetchStats()
    timerRef.current = setInterval(fetchStats, 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [user?.id, fetchStats])

  const pad = (n:number) => String(n).padStart(2,'0')

  if (loading) return (
    <div style={{ background:T.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🤖</div>
        <div style={{ fontSize:14, color:T.muted }}>Cargando SophiaOS...</div>
      </div>
    </div>
  )

  if (!stats) return null
  const s = stats
  const META_GOAL  = 8000
  const mrrPct     = Math.min(Math.round((s.mrrReal / META_GOAL) * 100), 100)
  const bgRing     = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const KPIS = [
    { label:'Comisión / Mes', val:`$${s.mrrReal.toLocaleString()}`, pct:mrrPct, color:T.accent, sub:`Meta $${META_GOAL.toLocaleString()}`, up:true, delta:`+${s.closedWonMonth} cierres` },
    { label:'Leads Activos',  val:String(s.activeLeads), pct:Math.min(Math.round(s.activeLeads/50*100),100), color:T.cyan, sub:`${s.leadsThisMonth} este mes`, up:true, delta:`+${s.leadsThisMonth}` },
    { label:'Tasa de Cierre', val:`${s.conversionRate}%`, pct:s.conversionRate, color:T.green, sub:'Industria ~8%', up:s.conversionRate>8, delta:s.conversionRate>8?'↑ Por encima':'↓ Por debajo' },
    { label:'Sophia Hoy',     val:String(s.sophiaConversationsToday), pct:Math.min(s.sophiaConversationsToday*10,100), color:T.gold, sub:'Conversaciones activas', up:s.sophiaConversationsToday>0, delta:s.sophiaConversationsToday>0?'⚡ Activa':'💤 Sin msgs' },
  ]

  return (
    <div style={{ background:T.bg, minHeight:'100vh', fontFamily:"'SF Pro Display',system-ui,sans-serif", color:T.text, position:'relative' }}>
      {/* bg orbs */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 20% 20%,rgba(149,76,233,0.12) 0%,transparent 60%)' }}/>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 80% 80%,rgba(0,212,255,0.08) 0%,transparent 60%)' }}/>
      </div>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div style={{
        position:'sticky', top:0, zIndex:100,
        background: dark?'rgba(13,8,32,0.88)':'rgba(240,235,255,0.88)',
        backdropFilter:T.blur, WebkitBackdropFilter:T.blur,
        borderBottom:`1px solid ${T.border}`, padding:'0 20px',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, height:54 }}>

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`linear-gradient(135deg,${T.accent},${T.cyan})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:`0 4px 12px ${T.accent}40` }}>🤖</div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, letterSpacing:1 }}>SophiaOS</div>
              <div style={{ fontSize:8, color:T.muted, letterSpacing:2, textTransform:'uppercase' }}>Command Center</div>
            </div>
          </div>

          {/* Nav */}
          <div style={{ display:'flex', gap:2, marginLeft:12, overflowX:'auto' }}>
            {([['overview','📊 Dashboard'],['pipeline','🎯 Pipeline'],['sophia','🤖 Sophia'],['citas','📅 Citas']] as const).map(([id,lbl]) => (
              <button key={id} onClick={()=>id==='pipeline'?router.push('/dashboard/pipeline'):setTab(id)} style={{
                background: tab===id?`${T.accent}20`:'transparent',
                border:`1px solid ${tab===id?T.accent:'transparent'}`,
                borderRadius:8, padding:'5px 12px', cursor:'pointer',
                fontSize:11, fontWeight:600, color:tab===id?T.text:T.muted, whiteSpace:'nowrap',
              }}>{lbl}</button>
            ))}
          </div>

          {/* Right controls */}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
            {/* Digital clock */}
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:18, fontWeight:900, fontVariantNumeric:'tabular-nums', letterSpacing:2, color:T.cyan, fontFamily:'monospace', textShadow:`0 0 12px ${T.cyan}60` }}>
                {pad(time.getHours())}:{pad(time.getMinutes())}:{pad(time.getSeconds())}
              </div>
              <div style={{ fontSize:9, color:T.muted, letterSpacing:1 }}>
                {time.toLocaleDateString('es-US',{weekday:'short',month:'short',day:'numeric'})} · EST
              </div>
            </div>

            {/* Sophia status */}
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:`${T.green}15`, border:`1px solid ${T.green}30`, borderRadius:20 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:T.green, boxShadow:`0 0 8px ${T.green}` }}/>
              <span style={{ fontSize:10, fontWeight:700, color:T.green }}>Sophia</span>
            </div>

            {/* Dark/light toggle */}
            <button onClick={() => {
              const newDark = !dark
              setDark(newDark)
              localStorage.setItem('sophiaos-theme', newDark ? 'dark' : 'light')
            }} style={{
              width:52, height:28, borderRadius:14, cursor:'pointer', border:'none',
              background: dark?`linear-gradient(135deg,${T.accent},${T.cyan})`:'linear-gradient(135deg,#fbbf24,#f59e0b)',
              position:'relative', transition:'background 0.3s',
              boxShadow: dark?`0 0 12px ${T.accent}40`:'0 0 12px rgba(251,191,36,0.4)',
            }}>
              <div style={{ position:'absolute', top:3, left:dark?26:3, width:22, height:22, borderRadius:11, background:'#fff', transition:'left 0.3s', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>
                {dark?'🌙':'☀️'}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── ONBOARDING BLOCKER ───────────────────────────────────────────── */}
      {user && !user.onboarding_complete && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(5,5,7,0.97)',
          display:'flex', alignItems:'center', justifyContent:'center',
          backdropFilter:'blur(4px)',
        }}>
          <div style={{ textAlign:'center', maxWidth:480, padding:'40px 24px' }}>
            <div style={{ fontSize:60, marginBottom:20 }}>⚙️</div>
            <h2 style={{ fontSize:28, fontWeight:800, color:T.text, marginBottom:12, marginTop:0 }}>¡Casi listo!</h2>
            <p style={{ fontSize:14, color:T.muted, lineHeight:1.6, marginBottom:24 }}>
              Necesitamos algunos datos para activar a Sophia en tu negocio y empezar a vender.
            </p>
            <button
              onClick={() => router.push('/onboarding')}
              style={{
                padding:'12px 28px',
                fontSize:14,
                fontWeight:700,
                borderRadius:10,
                border:'none',
                cursor:'pointer',
                background:`linear-gradient(135deg,${T.accent},${T.cyan})`,
                color:'#fff',
                boxShadow:`0 4px 12px ${T.accent}40`,
              }}
            >
              Configurar ahora →
            </button>
          </div>
        </div>
      )}

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div style={{ position:'relative', zIndex:1, padding:'14px 18px 40px' }}>

        {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
        {tab==='overview' && <>

          {/* ROW 1: Clock + 4 KPI rings + Sophia mini */}
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:12, marginBottom:12, alignItems:'stretch' }}>

            {/* Analog clock */}
            <Card T={T} glow={`${T.accent}40`} sx={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, minWidth:150 }}>
              <Clock t={time} T={T}/>
              <div style={{ fontSize:10, color:T.muted, letterSpacing:2, textTransform:'uppercase' }}>Miami · EST</div>
              <div style={{ display:'flex', gap:6 }}>
                {[
                  { lbl:'Activos', val:s.activeLeads,    c:T.green },
                  { lbl:'Cierres', val:s.closedWonMonth, c:T.gold  },
                ].map((b,i) => (
                  <div key={i} style={{ padding:'2px 8px', background:`${b.c}18`, border:`1px solid ${b.c}30`, borderRadius:8, fontSize:9, color:b.c, fontWeight:700 }}>
                    {b.val} {b.lbl}
                  </div>
                ))}
              </div>
            </Card>

            {/* 4 KPI rings */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {KPIS.map((m,i) => (
                <Card key={i} T={T} glow={`${m.color}30`} sx={{ display:'flex', alignItems:'center', gap:12 }}>
                  <Ring pct={m.pct} size={72} stroke={7} color={m.color} bg={bgRing} value={m.val}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <SL T={T}>{m.label}</SL>
                    <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>{m.sub}</div>
                    <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', background:`${m.up?T.green:T.red}15`, border:`1px solid ${m.up?T.green:T.red}25`, borderRadius:20 }}>
                      <span style={{ fontSize:10, fontWeight:800, color:m.up?T.green:T.red }}>{m.delta}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Sophia live mini */}
            <Card T={T} sx={{ minWidth:190, display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:T.green, boxShadow:`0 0 8px ${T.green}` }}/>
                <SL T={T}>Sophia Live</SL>
                {s.sophiaConversationsToday>0 &&
                  <div style={{ marginLeft:'auto', padding:'1px 6px', background:`${T.red}20`, borderRadius:8, fontSize:9, color:T.red, fontWeight:700 }}>
                    {s.sophiaConversationsToday}
                  </div>
                }
              </div>
              {s.sophiaLive.slice(0,3).map((msg,i) => (
                <div key={i} style={{ marginBottom:8, padding:'7px 10px', background:dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)', borderRadius:8, borderLeft:`2px solid ${T.border}` }}>
                  <div style={{ fontSize:11, fontWeight:700, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{msg.lead_name || msg.lead_phone}</div>
                  <div style={{ fontSize:10, color:T.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{msg.message || '—'}</div>
                </div>
              ))}
              {s.sophiaLive.length===0 && <div style={{ fontSize:12, color:T.muted, textAlign:'center', padding:'12px 0' }}>💤 Sin mensajes hoy</div>}
              <div style={{ marginTop:'auto', paddingTop:10, borderTop:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9, color:T.muted, marginBottom:2 }}>TOTAL COMISIONES</div>
                <div style={{ fontSize:20, fontWeight:900, color:T.accent }}>${s.mrrTotal.toLocaleString()}</div>
              </div>
            </Card>
          </div>

          {/* ROW 2: Commission area chart + Pipeline donut + Goal ring */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 240px 210px', gap:12, marginBottom:12 }}>

            {/* Area chart */}
            <Card T={T} glow={`${T.accent}25`}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div>
                  <SL T={T}>Comisiones Reales — Últimos 6 Meses</SL>
                  <div style={{ fontSize:22, fontWeight:900 }}>
                    ${s.mrrReal.toLocaleString()}
                    <span style={{ fontSize:12, color:T.green, fontWeight:700, marginLeft:8 }}>este mes</span>
                  </div>
                </div>
                <div style={{ fontSize:10, color:T.muted }}>{s.commissionsTotal} pólizas totales</div>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={s.commissionTrend} margin={{ top:0,right:0,left:-20,bottom:0 }}>
                  <defs>
                    <linearGradient id="gCA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={T.accent} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                  <XAxis dataKey="mes" tick={{ fontSize:9, fill:T.muted }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:T.muted }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<Tip T={T}/>}/>
                  <Area type="monotone" dataKey="comisiones" name="Comisiones $" stroke={T.accent} strokeWidth={2} fill="url(#gCA)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Donut pipeline */}
            <Card T={T}>
              <SL T={T}>Pipeline Total</SL>
              <div style={{ position:'relative', display:'flex', justifyContent:'center' }}>
                <ResponsiveContainer width={170} height={155}>
                  <PieChart>
                    <Pie data={s.pipeline.filter(p=>p.count>0)} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={72} paddingAngle={3}
                      dataKey="count" startAngle={90} endAngle={-270} nameKey="stage">
                      {s.pipeline.map((_,i) => (
                        <Cell key={i} fill={PIPE_COLORS[i%PIPE_COLORS.length]}
                          style={{ filter:`drop-shadow(0 0 5px ${PIPE_COLORS[i%PIPE_COLORS.length]}60)`, outline:'none' }}/>
                      ))}
                    </Pie>
                    <Tooltip content={<Tip T={T}/>}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:900 }}>{s.activeLeads}</div>
                  <div style={{ fontSize:8, color:T.muted }}>leads</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:4 }}>
                {s.pipeline.slice(0,5).map((p,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:PIPE_COLORS[i%PIPE_COLORS.length], flexShrink:0 }}/>
                    <div style={{ fontSize:10, color:T.muted, flex:1 }}>{p.stage}</div>
                    <div style={{ fontSize:11, fontWeight:800 }}>{p.count}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Goal ring + bars */}
            <Card T={T} glow={`${T.cyan}25`}>
              <SL T={T}>Meta del Mes</SL>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
                <Ring pct={mrrPct} size={110} stroke={12} color={T.accent} bg={bgRing} value={`${mrrPct}%`} label="completado"/>
              </div>
              <div style={{ textAlign:'center', marginBottom:12 }}>
                <div style={{ fontSize:18, fontWeight:900 }}>${s.mrrReal.toLocaleString()}</div>
                <div style={{ fontSize:10, color:T.muted }}>de $8,000 · faltan ${Math.max(0,8000-s.mrrReal).toLocaleString()}</div>
              </div>
              {[
                { lbl:'Score promedio', pct:s.avgLeadScore, val:`${s.avgLeadScore}pts`, c:T.cyan },
                { lbl:'Tasa cierre',    pct:s.conversionRate, val:`${s.conversionRate}%`, c:T.green },
                { lbl:'Pólizas mes',    pct:Math.min(s.commissionsMonth*10,100), val:String(s.commissionsMonth), c:T.gold },
              ].map((p,i) => (
                <div key={i} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:9, color:T.muted }}>{p.lbl}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:p.c }}>{p.val}</span>
                  </div>
                  <div style={{ height:4, background:bgRing, borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${p.pct}%`, background:p.c, borderRadius:2, boxShadow:`0 0 6px ${p.c}60`, transition:'width 1s' }}/>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* ROW 3: Sparkline + Calendar events */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Card T={T}>
              <SL T={T}>Leads — Últimos 7 Días</SL>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={s.sparkline} margin={{ top:0,right:0,left:-20,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                  <XAxis dataKey="dia" tick={{ fontSize:9, fill:T.muted }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:T.muted }} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip content={<Tip T={T}/>}/>
                  <Bar dataKey="leads" name="Leads" fill={T.accent} radius={[4,4,0,0]} maxBarSize={22}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card T={T}>
              <SL T={T}>Próximos Eventos — Calendario</SL>
              {s.upcomingEvents.length===0
                ? <div style={{ fontSize:12, color:T.muted, textAlign:'center', padding:'20px 0' }}>📅 Sin eventos próximos</div>
                : s.upcomingEvents.map((ev,i) => (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 0', borderBottom:i<s.upcomingEvents.length-1?`1px solid ${T.border}`:'none' }}>
                    <div style={{ padding:'4px 8px', background:`${T.accent}18`, borderRadius:6, fontSize:9, fontWeight:700, color:T.accent, flexShrink:0 }}>
                      {new Date(ev.start_time).toLocaleDateString('es-US',{month:'short',day:'numeric'})}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</div>
                      {ev.lead_name && <div style={{ fontSize:10, color:T.muted }}>{ev.lead_name}</div>}
                    </div>
                    <div style={{ fontSize:10, color:T.muted, flexShrink:0 }}>
                      {new Date(ev.start_time).toLocaleTimeString('es-US',{hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                ))
              }
            </Card>
          </div>
        </>}

        {/* ── PIPELINE ──────────────────────────────────────────────────── */}
        {tab==='pipeline' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10 }}>
            {s.pipeline.map((stage,i) => (
              <Card key={i} T={T} glow={`${PIPE_COLORS[i%PIPE_COLORS.length]}30`} sx={{ textAlign:'center' }}>
                <div style={{ height:80, background:`${PIPE_COLORS[i%PIPE_COLORS.length]}15`, border:`1px solid ${PIPE_COLORS[i%PIPE_COLORS.length]}30`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
                  <span style={{ fontSize:32, fontWeight:900, color:PIPE_COLORS[i%PIPE_COLORS.length] }}>{stage.count}</span>
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:T.text }}>{stage.stage}</div>
              </Card>
            ))}
          </div>
        )}

        {/* ── SOPHIA ────────────────────────────────────────────────────── */}
        {tab==='sophia' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Card T={T}>
              <SL T={T}>Sophia — Métricas</SL>
              {[
                { label:'Conversaciones hoy',    val:String(s.sophiaConversationsToday), color:T.green },
                { label:'Score promedio leads',  val:`${s.avgLeadScore}pts`,             color:T.cyan  },
                { label:'Tasa de conversión',    val:`${s.conversionRate}%`,             color:T.accent},
                { label:'Cerrados este mes',     val:String(s.closedWonMonth),            color:T.gold  },
                { label:'Total comisiones',      val:`$${s.mrrTotal.toLocaleString()}`,  color:T.green },
              ].map((st,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:i<4?`1px solid ${T.border}`:'none' }}>
                  <div style={{ fontSize:12, color:T.muted }}>{st.label}</div>
                  <div style={{ fontSize:20, fontWeight:900, color:st.color }}>{st.val}</div>
                </div>
              ))}
            </Card>
            <Card T={T}>
              <SL T={T}>Conversaciones de Hoy</SL>
              {s.sophiaLive.length===0
                ? <div style={{ fontSize:12, color:T.muted, textAlign:'center', padding:'20px 0' }}>💤 Sin mensajes hoy</div>
                : s.sophiaLive.map((msg,i) => (
                  <div key={i} style={{ marginBottom:10, padding:'10px', background:dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)', borderRadius:8, borderLeft:`2px solid ${T.border}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <div style={{ fontSize:12, fontWeight:700 }}>{msg.lead_name || msg.lead_phone}</div>
                      <div style={{ fontSize:9, color:T.muted }}>{new Date(msg.created_at).toLocaleTimeString('es-US',{hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                    <div style={{ fontSize:11, color:T.muted, lineHeight:1.5 }}>{msg.message || '—'}</div>
                  </div>
                ))
              }
            </Card>
          </div>
        )}

        {/* ── SOPHIACITA ────────────────────────────────────────────────── */}
        {tab==='citas' && (
          <Card T={T}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <SL T={T}>SophiaCita — Citas Médicas</SL>
              <div style={{ padding:'3px 10px', background:`${T.accent}20`, border:`1px solid ${T.accent}30`, borderRadius:10, fontSize:10, color:T.accent, fontWeight:700 }}>
                {s.doctorApptsCount} citas
              </div>
            </div>
            {s.doctorAppointments.length===0 ? (
              <div style={{ padding:32, textAlign:'center', background:dark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)', borderRadius:12, border:`1px dashed ${T.border}` }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📅</div>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>SophiaCita lista para integrar</div>
                <div style={{ fontSize:12, color:T.muted, lineHeight:1.7, maxWidth:400, margin:'0 auto' }}>
                  La tabla <code>doctor_appointments</code> ya está creada en Supabase. <br/>
                  Integra NexHealth API + NPI Registry para activar las citas en vivo.
                </div>
              </div>
            ) : (
              s.doctorAppointments.map((apt,i) => (
                <div key={i} style={{ display:'flex', gap:12, alignItems:'center', padding:'12px', marginBottom:8, background:dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)', borderRadius:10, border:`1px solid ${T.border}` }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:`${T.cyan}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🩺</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{apt.doctor_name}</div>
                    <div style={{ fontSize:11, color:T.muted }}>{apt.specialty} · {apt.lead_name}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:T.cyan }}>{new Date(apt.scheduled_at).toLocaleDateString('es-US',{weekday:'short',month:'short',day:'numeric'})}</div>
                    <div style={{ fontSize:10, color:T.muted }}>{new Date(apt.scheduled_at).toLocaleTimeString('es-US',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                  <div style={{ padding:'3px 8px', background:apt.in_network?`${T.green}20`:`${T.red}20`, borderRadius:8, fontSize:9, fontWeight:700, color:apt.in_network?T.green:T.red, flexShrink:0 }}>
                    {apt.in_network?'In-Network':'OON'}
                  </div>
                </div>
              ))
            )}
          </Card>
        )}

      </div>
    </div>
  )
}
