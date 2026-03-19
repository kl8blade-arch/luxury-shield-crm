'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C, scoreColor, fmtDate } from '@/lib/design'

const CARDS = [
  { key: 'total_leads',       label: 'Total leads',          color: '#60a5fa', icon: '👥' },
  { key: 'new_leads',         label: 'Sin contactar',         color: '#fbbf24', icon: '⚡' },
  { key: 'ready_to_buy',      label: 'Listos para comprar',   color: '#34d399', icon: '🔥' },
  { key: 'pending_reminders', label: 'Recordatorios hoy',     color: '#f97316', icon: '🔔' },
  { key: 'closed_won',        label: 'Cerrados este mes',     color: '#a78bfa', icon: '✅' },
  { key: 'avg_score',         label: 'Score promedio',        color: '#f472b6', icon: '⭐' },
  { key: 'crossselling',      label: 'Cross-selling',         color: '#e879f9', icon: '💰' },
  { key: 'credits',           label: 'Créditos disponibles',  color: '#C9A84C', icon: '🛡️' },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number>>({})
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [
        { count: total }, { count: newL }, { count: ready },
        { count: reminders }, { count: closed }, { count: cross },
        { data: agent }, { data: scores }, { data: recent },
      ] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('stage', 'new'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('ready_to_buy', true),
        supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('stage', 'closed_won'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('for_crossselling', true),
        supabase.from('agents').select('credits').eq('email', 'kl8blade@gmail.com').single(),
        supabase.from('leads').select('score'),
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(8),
      ])
      const sc = (scores || []).map((l: any) => l.score).filter(Boolean)
      const avg = sc.length ? Math.round(sc.reduce((a: number, b: number) => a + b, 0) / sc.length) : 0
      setStats({ total_leads: total||0, new_leads: newL||0, ready_to_buy: ready||0, pending_reminders: reminders||0, credits: agent?.credits||0, closed_won: closed||0, avg_score: avg, crossselling: cross||0 })
      setLeads(recent || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <p style={{ color: C.textMuted, fontSize: '13px', marginBottom: '4px' }}>{greeting} 👋</p>
        <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.4px', marginBottom: '4px' }}>Carlos Silva</h1>
        <p style={{ color: C.textMuted, fontSize: '13px' }}>
          {now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats grid 2x4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '32px' }}>
        {CARDS.map(({ key, label, color, icon }) => (
          <div key={key} style={{
            background: C.surface, border: `1px solid ${color}25`,
            borderRadius: '16px', padding: '20px 22px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color, opacity: 0.55 }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={{ color: C.textMuted, fontSize: '10px', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', margin: 0 }}>{label}</p>
              <span style={{ fontSize: '16px', opacity: 0.7 }}>{icon}</span>
            </div>
            <p style={{ color: loading ? C.textMuted : color, fontSize: '34px', fontWeight: 800, lineHeight: 1, margin: 0 }}>
              {loading ? '—' : (stats[key] ?? 0).toLocaleString('es')}
            </p>
          </div>
        ))}
      </div>

      {/* Recent leads table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: 0 }}>Leads recientes</h2>
            <p style={{ color: C.textMuted, fontSize: '12px', marginTop: '3px' }}>Últimos leads recibidos</p>
          </div>
          <a href="/leads" style={{ color: C.gold, fontSize: '12px', fontWeight: 600, textDecoration: 'none', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', padding: '6px 14px', borderRadius: '8px' }}>
            Ver todos →
          </a>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted, fontSize: '14px' }}>Cargando...</div>
        ) : leads.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '14px', opacity: 0.5 }}>📭</div>
            <p style={{ color: C.text, fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Aún no hay leads</p>
            <p style={{ color: C.textMuted, fontSize: '13px', lineHeight: 1.7, maxWidth: '320px', margin: '0 auto 20px' }}>
              Cuando alguien llene el formulario de la landing page, aparecerá aquí en tiempo real.
            </p>
            <a href="https://luxuryshieldinsurance.com" target="_blank" style={{
              display: 'inline-block', color: C.gold, fontSize: '13px', fontWeight: 600,
              background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.22)',
              padding: '10px 20px', borderRadius: '10px',
            }}>Ver landing page →</a>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 0.6fr 0.6fr', padding: '10px 24px', borderBottom: `1px solid ${C.border}` }}>
              {['Nombre','Teléfono','Estado','Seguro','Score','Fecha'].map(h => (
                <p key={h} style={{ color: C.textMuted, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>{h}</p>
              ))}
            </div>
            {leads.map((lead: any, i: number) => (
              <a key={lead.id} href="/leads" style={{ textDecoration: 'none' }}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 0.6fr 0.6fr', padding: '14px 24px', borderBottom: i < leads.length-1 ? `1px solid rgba(255,255,255,0.03)` : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: C.gold, flexShrink: 0 }}>
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ color: C.text, fontSize: '13px', fontWeight: 600, margin: 0 }}>{lead.name}</p>
                      {lead.ready_to_buy && <p style={{ color: '#f97316', fontSize: '10px', margin: 0 }}>🔥 Listo</p>}
                    </div>
                  </div>
                  <p style={{ color: C.textDim, fontSize: '13px', margin: 0 }}>{lead.phone}</p>
                  <p style={{ color: C.textDim, fontSize: '13px', margin: 0 }}>{lead.state || '—'}</p>
                  <p style={{ color: C.textDim, fontSize: '13px', margin: 0 }}>{lead.insurance_type}</p>
                  <p style={{ color: scoreColor(lead.score), fontSize: '14px', fontWeight: 700, margin: 0 }}>{lead.score}</p>
                  <p style={{ color: C.textMuted, fontSize: '12px', margin: 0 }}>{fmtDate(lead.created_at)}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
