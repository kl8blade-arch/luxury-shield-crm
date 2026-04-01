'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminPage() {
  const { user, isAdmin } = useAuth()
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (isAdmin) loadAgents() }, [isAdmin])

  async function loadAgents() {
    setLoading(true)
    const { data } = await supabase.from('agents')
      .select('id, name, email, phone, role, status, paid, subscription_plan, tokens_used, tokens_limit, tokens_extra, onboarding_complete, trial_ends_at, uses_own_ai_keys, created_at, account_id')
      .order('created_at', { ascending: false })
    setAgents(data || [])
    setLoading(false)
  }

  if (!isAdmin) return <div style={{ padding: '60px', textAlign: 'center', color: '#f87171', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit",sans-serif' }}>Acceso denegado. Solo administradores.</div>

  const totalAgents = agents.filter(a => a.role !== 'admin').length
  const paidAgents = agents.filter(a => a.paid && a.role !== 'admin').length
  const activeAgents = agents.filter(a => a.status === 'active' && a.role !== 'admin').length

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit",sans-serif' }}>
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(239,68,68,0.6)', marginBottom: '6px' }}>ADMIN</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '44px', color: '#F0ECE3', margin: 0 }}>Panel de Control</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Todos los usuarios del sistema. Solo visible para ti.</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total usuarios', value: totalAgents, color: '#60a5fa' },
            { label: 'Pagados', value: paidAgents, color: '#34d399' },
            { label: 'Activos', value: activeAgents, color: '#C9A84C' },
            { label: 'Pendientes', value: agents.filter(a => a.status === 'pending_payment').length, color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderBottom: `2px solid ${s.color}30` }}>
              <p style={{ fontSize: '28px', fontWeight: 800, color: s.color, margin: '0 0 4px', fontFamily: '"DM Serif Display",serif' }}>{s.value}</p>
              <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.35)', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Agents table */}
        {loading ? <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,227,0.3)' }}>Cargando...</div> : (
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 80px 90px 80px 100px 80px', padding: '12px 16px', background: 'rgba(201,168,76,0.04)', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <span>Nombre</span><span>Email</span><span>Status</span><span>Plan</span><span>Pagado</span><span>Tokens</span><span>IA</span>
            </div>

            {agents.map(a => {
              const tokensRemaining = Math.max(0, (a.tokens_limit || 0) + (a.tokens_extra || 0) - (a.tokens_used || 0))
              const isMe = a.role === 'admin'
              const statusColors: Record<string, string> = { active: '#34d399', pending_payment: '#fbbf24', verified: '#60a5fa', pending: '#f97316', trial_expired: '#f87171', security_blocked: '#f87171' }

              return (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 80px 90px 80px 100px 80px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '12px', color: '#F0ECE3', background: isMe ? 'rgba(201,168,76,0.02)' : 'transparent' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{a.name}</span>
                    {isMe && <span style={{ marginLeft: '6px', fontSize: '9px', padding: '2px 6px', borderRadius: '100px', background: 'rgba(201,168,76,0.1)', color: '#C9A84C', fontWeight: 700 }}>TU</span>}
                    {a.phone && <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', margin: '2px 0 0' }}>{a.phone}</p>}
                  </div>
                  <span style={{ color: 'rgba(240,236,227,0.5)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email}</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: statusColors[a.status] || '#6b7280' }}>{a.status}</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'capitalize', color: 'rgba(240,236,227,0.5)' }}>{a.subscription_plan || 'free'}</span>
                  <span>{a.paid ? <span style={{ color: '#34d399' }}>Si</span> : <span style={{ color: '#f87171' }}>No</span>}</span>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: tokensRemaining > 0 ? '#34d399' : '#f87171' }}>{tokensRemaining}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(240,236,227,0.25)' }}>/{a.tokens_limit || 0}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: a.uses_own_ai_keys ? '#60a5fa' : '#C9A84C' }}>{a.uses_own_ai_keys ? 'Propia' : 'Managed'}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
