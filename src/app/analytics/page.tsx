'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C, scoreColor, STAGE_META } from '@/lib/design'

const CARD = {
  background: 'linear-gradient(145deg, #141420, #0e0e1a)',
  border: `1px solid ${C.border}`,
  borderRadius: '16px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
  transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
}

const hoverCard = (e: React.MouseEvent, on: boolean) => {
  const el = e.currentTarget as HTMLDivElement
  el.style.transform = on ? 'translateY(-2px)' : 'translateY(0)'
  el.style.borderColor = on ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.07)'
}

function HealthRing({ score, size = 120 }: { score: number; size?: number }) {
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171'
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s ease-out', filter: `drop-shadow(0 0 6px ${color}80)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '34px', fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: '9px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>/ 100</span>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [health, setHealth] = useState<any>(null)
  const [atRisk, setAtRisk] = useState<any[]>([])
  const [agentStats, setAgentStats] = useState<any[]>([])
  const [topArgs, setTopArgs] = useState<any[]>([])
  const [topObjs, setTopObjs] = useState<any[]>([])
  const [heatmap, setHeatmap] = useState<number[]>(Array(24).fill(0))
  const [loading, setLoading] = useState(true)
  const [hoveredHour, setHoveredHour] = useState<number | null>(null)
  const [waking, setWaking] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try { const hRes = await fetch('/api/business-health'); if (hRes.ok) setHealth(await hRes.json()) } catch {}

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: risk } = await supabase.from('leads').select('id, name, stage, state, updated_at, score')
      .not('stage', 'in', '("closed_won","closed_lost","unqualified")').lt('updated_at', sixHoursAgo).gte('created_at', monthAgo).order('updated_at', { ascending: true }).limit(10)
    setAtRisk(risk || [])

    const { data: agents } = await supabase.from('agents').select('id, name')
    if (agents) {
      const stats = []
      for (const agent of agents) {
        const [{ count: assigned }, { count: won }] = await Promise.all([
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agent_id', agent.id).gte('created_at', weekAgo),
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agent_id', agent.id).eq('stage', 'closed_won').gte('fecha_cierre', weekAgo),
        ])
        stats.push({ ...agent, assigned: assigned || 0, won: won || 0, rate: assigned ? Math.round(((won || 0) / (assigned || 1)) * 100) : 0, commission: (won || 0) * 45 })
      }
      setAgentStats(stats)
    }

    const { data: learnings } = await supabase.from('sophia_learnings').select('argumentos_ganadores').order('created_at', { ascending: false }).limit(20)
    if (learnings) {
      const argCount: Record<string, number> = {}
      for (const l of learnings) { for (const a of (l.argumentos_ganadores as string[] || [])) { argCount[a] = (argCount[a] || 0) + 1 } }
      setTopArgs(Object.entries(argCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([arg, count]) => ({ arg, count })))
    }

    const { data: feedbacks } = await supabase.from('leads').select('agente_feedback').not('agente_feedback', 'is', null).gte('updated_at', monthAgo)
    if (feedbacks) {
      const objCount: Record<string, number> = {}
      for (const f of feedbacks) { const fb = f.agente_feedback as any; if (fb?.motivo_perdida) objCount[fb.motivo_perdida] = (objCount[fb.motivo_perdida] || 0) + 1 }
      setTopObjs(Object.entries(objCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([obj, count]) => ({ obj, count })))
    }

    const { data: msgs } = await supabase.from('conversations').select('created_at').eq('direction', 'inbound').gte('created_at', weekAgo)
    if (msgs) { const hours = Array(24).fill(0); for (const m of msgs) { hours[new Date(m.created_at).getHours()]++ }; setHeatmap(hours) }

    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const peakHour = heatmap.indexOf(Math.max(...heatmap))
  const maxHeat = Math.max(...heatmap, 1)
  const AGENT_COLORS: Record<string, string> = { 'Carlos Silva': '#C9A84C', 'Lina Rodríguez': '#a855f7' }

  async function wakeUpLead(leadId: string) {
    setWaking(leadId)
    try {
      const { data: lead } = await supabase.from('leads').select('phone, name').eq('id', leadId).single()
      if (lead?.phone) {
        await fetch('/api/agent-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, message: `Hola ${lead.name?.split(' ')[0] || ''} 😊 Solo quería saber cómo estás. ¿Tuviste oportunidad de pensar en lo de tu plan de protección?` }) })
      }
    } catch {}
    setTimeout(() => setWaking(null), 2000)
  }

  const KPI_CARDS = [
    { label: 'Leads activos', value: health?.metrics?.active_leads || 0, color: '#60a5fa', filter: 'activos' },
    { label: 'Tasa cierre', value: `${health?.metrics?.close_rate || 0}%`, color: '#34d399', filter: 'cerrados' },
    { label: 'Sophia conv.', value: `${health?.metrics?.sophia_conversion || 0}%`, color: '#a78bfa', filter: 'listo_comprar' },
    { label: 'Leads calientes', value: health?.metrics?.hot_leads || 0, color: '#f97316', filter: 'calientes' },
  ]

  const actionsRef = useState<HTMLDivElement | null>(null)

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Analytics & Inteligencia</h1>
        <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '4px' }}>Sala de control — Luxury Shield Insurance</p>
      </div>

      {loading ? <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted }}>Cargando...</div> : (
        <>
          {/* ── Health + KPIs ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ ...CARD, padding: '28px 24px', textAlign: 'center', cursor: 'pointer' }}
              onClick={() => document.getElementById('actions-section')?.scrollIntoView({ behavior: 'smooth' })}
              onMouseEnter={e => hoverCard(e, true)} onMouseLeave={e => hoverCard(e, false)}>
              <HealthRing score={health?.score || 0} />
              <p style={{ color: C.text, fontSize: '13px', fontWeight: 700, margin: '14px 0 0' }}>Salud del negocio</p>
              <p style={{ color: C.textMuted, fontSize: '11px', margin: '4px 0 0', textTransform: 'capitalize' }}>{health?.status || '—'}</p>
              <p style={{ color: C.gold, fontSize: '9px', margin: '6px 0 0' }}>Click para ver acciones →</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {KPI_CARDS.map(({ label, value, color, filter }) => (
                <div key={label} onClick={() => router.push(`/leads?filter=${filter}`)}
                  style={{ ...CARD, padding: '18px', position: 'relative', overflow: 'hidden', borderBottom: `2px solid ${color}`, cursor: 'pointer' }}
                  onMouseEnter={e => hoverCard(e, true)} onMouseLeave={e => hoverCard(e, false)}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color, opacity: 0.55 }} />
                  <p style={{ color: C.textMuted, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 10px' }}>{label}</p>
                  <p style={{ color, fontSize: '28px', fontWeight: 800, lineHeight: 1, margin: 0 }}>{value}</p>
                  <p style={{ color: C.textMuted, fontSize: '8px', margin: '8px 0 0' }}>Ver leads →</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Actions + At Risk ── */}
          <div id="actions-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ ...CARD, padding: '20px' }}>
              <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Acciones prioritarias</h3>
              {(health?.actions || []).length === 0 ? <p style={{ color: C.textMuted, fontSize: '13px' }}>Todo en orden</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(health?.actions || []).map((a: string, i: number) => {
                    const isInactive = a.includes('sin actividad')
                    const isCierre = a.includes('cierre')
                    return (
                      <div key={i} onClick={() => router.push(isInactive ? '/leads?filter=inactivos' : isCierre ? '/leads?filter=cerrados' : '/leads')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(248,113,113,0.12)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(248,113,113,0.06)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171', flexShrink: 0, boxShadow: '0 0 8px rgba(239,68,68,0.6)' }} />
                        <span style={{ color: C.textDim, fontSize: '12px', flex: 1 }}>{a}</span>
                        <span style={{ color: '#f87171', fontSize: '10px', fontWeight: 600 }}>→</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div style={{ ...CARD, padding: '20px' }}>
              <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Leads en riesgo ({atRisk.length})</h3>
              {atRisk.length === 0 ? <p style={{ color: '#34d399', fontSize: '13px' }}>Ninguno en riesgo</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                  {atRisk.map(l => {
                    const hours = Math.round((Date.now() - new Date(l.updated_at).getTime()) / 3600000)
                    const urgency = hours > 24 ? '#f87171' : hours > 12 ? '#fbbf24' : '#f97316'
                    const meta = STAGE_META[l.stage] || STAGE_META.unqualified
                    return (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(248,113,113,0.04)', borderRadius: '8px', borderLeft: `3px solid ${urgency}`, cursor: 'pointer', transition: 'background 0.15s' }}
                        onClick={() => router.push(`/leads?selected=${l.id}`)}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(201,168,76,0.05)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(248,113,113,0.04)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: C.text, fontSize: '13px', fontWeight: 600 }}>{l.name}</span>
                            <span style={{ color: C.textMuted, fontSize: '10px' }}>{l.state}</span>
                          </div>
                          <span style={{ fontSize: '9px', color: meta.color, background: meta.bg, padding: '1px 6px', borderRadius: '100px', marginTop: '2px', display: 'inline-block' }}>{meta.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ color: urgency, fontSize: '11px', fontWeight: 600 }}>{hours}h</span>
                          <button onClick={(e) => { e.stopPropagation(); wakeUpLead(l.id) }}
                            style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', fontFamily: C.font, background: waking === l.id ? 'rgba(52,211,153,0.15)' : 'rgba(201,168,76,0.1)', border: `1px solid ${waking === l.id ? 'rgba(52,211,153,0.3)' : 'rgba(201,168,76,0.25)'}`, color: waking === l.id ? '#34d399' : C.gold }}>
                            {waking === l.id ? '✓' : 'Despertar'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Agent Performance ── */}
          <div style={{ ...CARD, padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Performance por agente (esta semana)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {agentStats.map(a => {
                const accentColor = AGENT_COLORS[a.name] || C.gold
                return (
                  <div key={a.id} onClick={() => router.push(`/leads?agent=${a.name.split(' ')[0].toLowerCase()}`)}
                    style={{ padding: '18px', background: 'linear-gradient(145deg, rgba(20,20,32,0.8), rgba(14,14,26,0.8))', border: `1px solid ${accentColor}25`, borderRadius: '14px', boxShadow: `0 4px 20px rgba(0,0,0,0.3)`, transition: 'transform 0.2s, border-color 0.2s', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = `${accentColor}50` }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = `${accentColor}25` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `linear-gradient(135deg, ${accentColor}, ${accentColor}80)`, border: `2px solid ${accentColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: '#07080A', boxShadow: `0 0 12px ${accentColor}40` }}>{a.name.charAt(0)}</div>
                      <div>
                        <p style={{ color: accentColor, fontSize: '14px', fontWeight: 700, margin: 0 }}>{a.name}</p>
                        <p style={{ color: C.textMuted, fontSize: '9px', margin: '1px 0 0' }}>Ver leads →</p>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div><p style={{ color: C.textMuted, fontSize: '10px', margin: 0 }}>LEADS</p><p style={{ color: C.text, fontSize: '20px', fontWeight: 800, margin: 0 }}>{a.assigned}</p></div>
                      <div><p style={{ color: C.textMuted, fontSize: '10px', margin: 0 }}>CIERRES</p><p style={{ color: '#34d399', fontSize: '20px', fontWeight: 800, margin: 0 }}>{a.won}</p></div>
                      <div><p style={{ color: C.textMuted, fontSize: '10px', margin: 0 }}>TASA</p><p style={{ color: scoreColor(a.rate), fontSize: '20px', fontWeight: 800, margin: 0 }}>{a.rate}%</p></div>
                      <div><p style={{ color: C.textMuted, fontSize: '10px', margin: 0 }}>COMISIÓN</p><p style={{ color: accentColor, fontSize: '20px', fontWeight: 800, margin: 0 }}>${a.commission}</p></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Arguments + Objections ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ ...CARD, padding: '20px' }}>
              <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Argumentos que cierran</h3>
              {topArgs.length === 0 ? <p style={{ color: C.textMuted, fontSize: '13px' }}>Aún sin datos</p> : topArgs.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < topArgs.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ color: C.textDim, fontSize: '12px', flex: 1 }}>{a.arg}</span>
                  <span style={{ color: '#34d399', fontSize: '11px', fontWeight: 700, background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: '100px' }}>{a.count}x</span>
                </div>
              ))}
            </div>
            <div style={{ ...CARD, padding: '20px' }}>
              <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Objeciones frecuentes</h3>
              {topObjs.length === 0 ? <p style={{ color: C.textMuted, fontSize: '13px' }}>Aún sin datos</p> : topObjs.map((o, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < topObjs.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ color: C.textDim, fontSize: '12px', flex: 1 }}>{o.obj}</span>
                  <span style={{ color: '#f87171', fontSize: '11px', fontWeight: 700, background: 'rgba(248,113,113,0.1)', padding: '2px 8px', borderRadius: '100px' }}>{o.count}x</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Heatmap ── */}
          <div style={{ ...CARD, padding: '20px' }}>
            <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Actividad por hora (últimos 7 días)</h3>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'end', height: '80px' }}>
              {heatmap.map((count, hour) => {
                const isPeak = count === Math.max(...heatmap) && count > 0
                const isHovered = hoveredHour === hour
                return (
                  <div key={hour} onClick={() => router.push(`/leads?hora=${hour}`)}
                    onMouseEnter={() => setHoveredHour(hour)} onMouseLeave={() => setHoveredHour(null)}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', position: 'relative' }}>
                    {isHovered && count > 0 && (
                      <div style={{ position: 'absolute', bottom: '100%', marginBottom: '4px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '3px 8px', fontSize: '9px', color: C.text, whiteSpace: 'nowrap', zIndex: 10 }}>
                        {hour}:00 — {count} msgs
                      </div>
                    )}
                    <div style={{
                      width: '100%', height: `${Math.max(4, (count / maxHeat) * 70)}px`,
                      background: isPeak ? `linear-gradient(180deg, ${C.gold}, ${C.goldDim})` : isHovered ? 'rgba(201,168,76,0.5)' : `rgba(201,168,76,${0.15 + (count / maxHeat) * 0.6})`,
                      borderRadius: '3px 3px 0 0', transition: 'height 0.3s, background 0.15s',
                      boxShadow: isPeak ? `0 0 10px ${C.gold}50` : 'none',
                    }} />
                    <span style={{ fontSize: '8px', color: isPeak ? C.gold : C.textMuted, fontWeight: isPeak ? 700 : 400 }}>{hour}</span>
                  </div>
                )
              })}
            </div>
            <p style={{ color: C.textMuted, fontSize: '11px', marginTop: '10px' }}>Mejor hora para campañas: <span style={{ color: C.gold, fontWeight: 700 }}>{peakHour}:00</span> · Click en una hora para ver leads</p>
          </div>
        </>
      )}
    </div>
  )
}
