'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C, scoreColor, fmtDate } from '@/lib/design'
import { useAuth } from '@/contexts/AuthContext'
import { scopeQuery } from '@/lib/use-scoped-query'

const CARDS = [
  { key: 'total_leads', label: 'Total leads', color: '#60a5fa', icon: '👥' },
  { key: 'new_leads', label: 'Sin contactar', color: '#fbbf24', icon: '⚡' },
  { key: 'ready_to_buy', label: 'Listos para comprar', color: '#34d399', icon: '🔥' },
  { key: 'pending_reminders', label: 'Recordatorios hoy', color: '#f97316', icon: '🔔' },
  { key: 'closed_won', label: 'Cerrados este mes', color: '#a78bfa', icon: '✅' },
  { key: 'avg_score', label: 'Score promedio', color: '#f472b6', icon: '⭐' },
  { key: 'crossselling', label: 'Cross-selling', color: '#e879f9', icon: '💰' },
  { key: 'tokens', label: 'Tokens IA', color: '#C9A84C', icon: '🛡️' },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number>>({})
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const { user, activeAccount, isViewingSubAccount } = useAuth()

  useEffect(() => { if (user) loadData() }, [user, activeAccount?.id])
  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])

  async function loadData() {
    setLoading(true)
    try {
      const s = (q: any) => scopeQuery(q, user, 'agent_id', activeAccount?.id)
      const [{ count: total }, { count: newL }, { count: ready }, { count: reminders }, { count: closed }, { count: cross }, { data: agent }, { data: scores }, { data: recent }] = await Promise.all([
        s(supabase.from('leads').select('*', { count: 'exact', head: true })),
        s(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('stage', 'new')),
        s(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('ready_to_buy', true)),
        supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        s(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('stage', 'closed_won')),
        s(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('for_crossselling', true)),
        supabase.from('agents').select('credits, tokens_used, tokens_limit, tokens_extra').eq('id', user?.id).single(),
        s(supabase.from('leads').select('score')),
        s(supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(8)),
      ])
      const sc = (scores || []).map((l: any) => l.score).filter(Boolean)
      const avg = sc.length ? Math.round(sc.reduce((a: number, b: number) => a + b, 0) / sc.length) : 0
      const tokensRemaining = Math.max(0, (agent?.tokens_limit || 0) + (agent?.tokens_extra || 0) - (agent?.tokens_used || 0))
      setStats({ total_leads: total || 0, new_leads: newL || 0, ready_to_buy: ready || 0, pending_reminders: reminders || 0, tokens: tokensRemaining, closed_won: closed || 0, avg_score: avg, crossselling: cross || 0 })
      setLeads(recent || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative' }}>

        <div style={{ position: 'absolute', top: '-15%', right: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ marginBottom: '36px' }}>
          <p style={{ color: 'rgba(201,168,76,0.5)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', marginBottom: '8px' }}>{greeting.toUpperCase()}</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>{isViewingSubAccount ? activeAccount?.name : (user?.name || 'Dashboard')}</h1>
          {isViewingSubAccount && <p style={{ color: '#34d399', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>Sub-cuenta · {activeAccount?.industry}</p>}
          <p style={{ color: 'rgba(240,236,227,0.3)', fontSize: '13px', marginTop: '8px' }}>
            {now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px', marginBottom: '32px' }}>
          {CARDS.map(({ key, label, color, icon }) => (
            <div key={key} style={{
              background: 'rgba(255,255,255,0.012)', border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: '14px', padding: isMobile ? '14px' : '20px 22px',
              position: 'relative', overflow: 'hidden', transition: 'all 0.2s', cursor: 'default',
              borderBottom: `2px solid ${color}30`,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${color}20` }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.012)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>{label}</p>
                <span style={{ fontSize: '14px', opacity: 0.5 }}>{icon}</span>
              </div>
              <p style={{ color: loading ? 'rgba(240,236,227,0.2)' : color, fontSize: isMobile ? '28px' : '34px', fontWeight: 800, lineHeight: 1, margin: 0, fontFamily: '"DM Serif Display",serif' }}>
                {loading ? '—' : (stats[key] ?? 0).toLocaleString('es')}
              </p>
            </div>
          ))}
        </div>

        {/* Recent leads */}
        <div style={{ background: 'rgba(255,255,255,0.012)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '18px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontFamily: '"DM Serif Display",serif', color: '#F0ECE3', fontSize: '18px', fontWeight: 400, margin: 0 }}>Leads recientes</h2>
              <p style={{ color: 'rgba(240,236,227,0.3)', fontSize: '12px', marginTop: '3px' }}>Últimos leads recibidos</p>
            </div>
            <a href="/leads" style={{ color: '#C9A84C', fontSize: '12px', fontWeight: 600, textDecoration: 'none', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', padding: '6px 14px', borderRadius: '8px', transition: 'all 0.15s' }}>Ver todos →</a>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(240,236,227,0.2)' }}>Cargando...</div>
          ) : leads.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '14px', opacity: 0.2 }}>◦</div>
              <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '18px', color: 'rgba(240,236,227,0.2)', fontStyle: 'italic' }}>Aún no hay leads</p>
              <p style={{ color: 'rgba(240,236,227,0.15)', fontSize: '13px', marginTop: '8px' }}>Cuando alguien llene el formulario, aparecerá aquí.</p>
            </div>
          ) : (
            <div>
              {!isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 0.6fr 0.6fr', padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {['Nombre', 'Teléfono', 'Estado', 'Seguro', 'Score', 'Fecha'].map(h => (
                    <p key={h} style={{ color: 'rgba(240,236,227,0.2)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>{h}</p>
                  ))}
                </div>
              )}
              {leads.map((lead: any, i: number) => (
                <a key={lead.id} href="/leads" style={{ textDecoration: 'none' }}>
                  <div style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 0.6fr 0.6fr', padding: isMobile ? '12px 16px' : '14px 24px', borderBottom: i < leads.length - 1 ? '1px solid rgba(255,255,255,0.025)' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s', gap: isMobile ? '10px' : undefined, flexWrap: isMobile ? 'wrap' : undefined }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#C9A84C', flexShrink: 0 }}>{lead.name?.charAt(0).toUpperCase()}</div>
                      <div>
                        <p style={{ color: '#F0ECE3', fontSize: '13px', fontWeight: 600, margin: 0 }}>{lead.name}</p>
                        {lead.ready_to_buy && <p style={{ color: '#f97316', fontSize: '10px', margin: 0 }}>🔥 Listo</p>}
                      </div>
                    </div>
                    {!isMobile && <>
                      <p style={{ color: 'rgba(240,236,227,0.4)', fontSize: '13px', margin: 0 }}>{lead.phone}</p>
                      <p style={{ color: 'rgba(240,236,227,0.4)', fontSize: '13px', margin: 0 }}>{lead.state || '—'}</p>
                      <p style={{ color: 'rgba(240,236,227,0.4)', fontSize: '13px', margin: 0 }}>{lead.insurance_type}</p>
                      <p style={{ color: scoreColor(lead.score), fontSize: '14px', fontWeight: 700, margin: 0, fontFamily: '"DM Serif Display",serif' }}>{lead.score}</p>
                      <p style={{ color: 'rgba(240,236,227,0.25)', fontSize: '12px', margin: 0 }}>{fmtDate(lead.created_at)}</p>
                    </>}
                    {isMobile && <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>{lead.state}</span>
                      <span style={{ fontSize: '11px', color: scoreColor(lead.score), fontWeight: 700 }}>{lead.score}pts</span>
                    </div>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
