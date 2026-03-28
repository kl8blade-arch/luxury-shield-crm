'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { C, scoreColor } from '@/lib/design'

export default function AnalyticsPage() {
  const [health, setHealth] = useState<any>(null)
  const [atRisk, setAtRisk] = useState<any[]>([])
  const [agentStats, setAgentStats] = useState<any[]>([])
  const [topArgs, setTopArgs] = useState<any[]>([])
  const [topObjs, setTopObjs] = useState<any[]>([])
  const [heatmap, setHeatmap] = useState<number[]>(Array(24).fill(0))
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)

    // Business health
    try {
      const hRes = await fetch('/api/business-health')
      if (hRes.ok) setHealth(await hRes.json())
    } catch {}

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // At-risk leads
    const { data: risk } = await supabase.from('leads').select('id, name, stage, state, updated_at')
      .not('stage', 'in', '("closed_won","closed_lost","unqualified")').lt('updated_at', sixHoursAgo).gte('created_at', monthAgo).order('updated_at', { ascending: true }).limit(10)
    setAtRisk(risk || [])

    // Agent performance
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

    // Top arguments from learnings
    const { data: learnings } = await supabase.from('sophia_learnings').select('argumentos_ganadores, frase_clave').order('created_at', { ascending: false }).limit(20)
    if (learnings) {
      const argCount: Record<string, number> = {}
      for (const l of learnings) {
        const args = l.argumentos_ganadores as string[] || []
        for (const a of args) { argCount[a] = (argCount[a] || 0) + 1 }
      }
      setTopArgs(Object.entries(argCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([arg, count]) => ({ arg, count })))
    }

    // Top objections
    const { data: feedbacks } = await supabase.from('leads').select('agente_feedback').not('agente_feedback', 'is', null).gte('updated_at', monthAgo)
    if (feedbacks) {
      const objCount: Record<string, number> = {}
      for (const f of feedbacks) {
        const fb = f.agente_feedback as any
        if (fb?.motivo_perdida) { objCount[fb.motivo_perdida] = (objCount[fb.motivo_perdida] || 0) + 1 }
      }
      setTopObjs(Object.entries(objCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([obj, count]) => ({ obj, count })))
    }

    // Heatmap — messages by hour
    const { data: msgs } = await supabase.from('conversations').select('created_at').eq('direction', 'inbound').gte('created_at', weekAgo)
    if (msgs) {
      const hours = Array(24).fill(0)
      for (const m of msgs) { hours[new Date(m.created_at).getHours()]++ }
      setHeatmap(hours)
    }

    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const peakHour = heatmap.indexOf(Math.max(...heatmap))
  const maxHeat = Math.max(...heatmap, 1)

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Analytics & Inteligencia</h1>
        <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '4px' }}>Sala de control — Luxury Shield Insurance</p>
      </div>

      {loading ? <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted }}>Cargando...</div> : (
        <>
          {/* ── Health Score + Top Metrics ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', marginBottom: '24px' }}>
            {/* Score gauge */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', margin: '0 auto 12px', border: `4px solid ${health?.score >= 80 ? '#34d399' : health?.score >= 60 ? '#fbbf24' : '#f87171'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: health?.score >= 80 ? '#34d399' : health?.score >= 60 ? '#fbbf24' : '#f87171' }}>{health?.score || 0}</span>
              </div>
              <p style={{ color: C.text, fontSize: '13px', fontWeight: 700, margin: 0 }}>Salud del negocio</p>
              <p style={{ color: C.textMuted, fontSize: '11px', margin: '4px 0 0', textTransform: 'capitalize' }}>{health?.status || '—'}</p>
            </div>
            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Leads activos', value: health?.metrics?.active_leads || 0, color: '#60a5fa' },
                { label: 'Tasa cierre', value: `${health?.metrics?.close_rate || 0}%`, color: '#34d399' },
                { label: 'Sophia conv.', value: `${health?.metrics?.sophia_conversion || 0}%`, color: '#a78bfa' },
                { label: 'Leads calientes', value: health?.metrics?.hot_leads || 0, color: '#f97316' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: C.surface, border: `1px solid ${color}25`, borderRadius: '14px', padding: '18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color, opacity: 0.55 }} />
                  <p style={{ color: C.textMuted, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 10px' }}>{label}</p>
                  <p style={{ color, fontSize: '28px', fontWeight: 800, lineHeight: 1, margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Actions + At Risk ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {/* Actions */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px' }}>
              <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Acciones prioritarias</h3>
              {(health?.actions || []).length === 0 ? <p style={{ color: C.textMuted, fontSize: '13px' }}>Todo en orden</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(health?.actions || []).map((a: string, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '10px' }}>
                      <span style={{ color: '#f87171', fontSize: '12px' }}>⚠️</span>
                      <span style={{ color: C.textDim, fontSize: '12px' }}>{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* At risk */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px' }}>
              <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Leads en riesgo ({atRisk.length})</h3>
              {atRisk.length === 0 ? <p style={{ color: '#34d399', fontSize: '13px' }}>Ninguno en riesgo</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {atRisk.map(l => {
                    const hours = Math.round((Date.now() - new Date(l.updated_at).getTime()) / 3600000)
                    return (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(248,113,113,0.04)', borderRadius: '8px' }}>
                        <div>
                          <span style={{ color: C.text, fontSize: '13px', fontWeight: 600 }}>{l.name}</span>
                          <span style={{ color: C.textMuted, fontSize: '11px', marginLeft: '8px' }}>{l.state}</span>
                        </div>
                        <span style={{ color: '#f87171', fontSize: '11px', fontWeight: 600 }}>{hours}h sin actividad</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Agent Performance ── */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Performance por agente (esta semana)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {agentStats.map(a => (
                <div key={a.id} style={{ padding: '16px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '12px' }}>
                  <p style={{ color: C.gold, fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>{a.name}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><p style={{ color: C.textMuted, fontSize: '10px', margin: 0 }}>LEADS</p><p style={{ color: C.text, fontSize: '20px', fontWeight: 800, margin: 0 }}>{a.assigned}</p></div>
                    <div><p style={{ color: C.textMuted, fontSize: '10px', margin: 0 }}>CIERRES</p><p style={{ color: '#34d399', fontSize: '20px', fontWeight: 800, margin: 0 }}>{a.won}</p></div>
                    <div><p style={{ color: C.textMuted, fontSize: '10px', margin: 0 }}>TASA</p><p style={{ color: scoreColor(a.rate), fontSize: '20px', fontWeight: 800, margin: 0 }}>{a.rate}%</p></div>
                    <div><p style={{ color: C.textMuted, fontSize: '10px', margin: 0 }}>COMISIÓN</p><p style={{ color: C.gold, fontSize: '20px', fontWeight: 800, margin: 0 }}>${a.commission}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Arguments + Objections ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px' }}>
              <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Argumentos que cierran</h3>
              {topArgs.length === 0 ? <p style={{ color: C.textMuted, fontSize: '13px' }}>Aún sin datos</p> : topArgs.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < topArgs.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ color: C.textDim, fontSize: '12px', flex: 1 }}>{a.arg}</span>
                  <span style={{ color: '#34d399', fontSize: '11px', fontWeight: 700, background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: '100px' }}>{a.count}x</span>
                </div>
              ))}
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px' }}>
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
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px' }}>
            <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Actividad por hora (últimos 7 días)</h3>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'end', height: '80px' }}>
              {heatmap.map((count, hour) => (
                <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '100%', height: `${Math.max(4, (count / maxHeat) * 70)}px`, background: count === Math.max(...heatmap) ? C.gold : `rgba(201,168,76,${0.15 + (count / maxHeat) * 0.6})`, borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                  <span style={{ fontSize: '8px', color: C.textMuted }}>{hour}</span>
                </div>
              ))}
            </div>
            <p style={{ color: C.textMuted, fontSize: '11px', marginTop: '10px' }}>Mejor hora para campañas: <span style={{ color: C.gold, fontWeight: 700 }}>{peakHour}:00</span></p>
          </div>
        </>
      )}
    </div>
  )
}
