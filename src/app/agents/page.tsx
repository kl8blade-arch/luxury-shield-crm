'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

/*
  SQL para tabla agents (ejecutar en Supabase si no existe):

  CREATE TABLE IF NOT EXISTS agents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    name text NOT NULL,
    email text,
    phone text,
    role text DEFAULT 'agent',
    plan text DEFAULT 'basic',
    status text DEFAULT 'active',
    credits integer DEFAULT 0,
    avatar_url text
  );
*/

interface Agent {
  id: string
  name: string
  email: string
  phone: string
  role: string
  plan: string
  status: string
  credits: number
  created_at: string
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'agent', plan: 'basic' })
  const [agentStats, setAgentStats] = useState<Record<string, { leads: number; won: number }>>({})

  useEffect(() => { loadAgents() }, [])

  async function loadAgents() {
    setLoading(true)
    const { data } = await supabase.from('agents').select('*').order('created_at', { ascending: false })
    const agentList = data || []
    setAgents(agentList)

    // Load stats per agent
    const statsMap: Record<string, { leads: number; won: number }> = {}
    for (const agent of agentList) {
      const [{ count: leads }, { count: won }] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('agent_id', agent.id),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('agent_id', agent.id).eq('stage', 'closed_won'),
      ])
      statsMap[agent.id] = { leads: leads || 0, won: won || 0 }
    }
    setAgentStats(statsMap)
    setLoading(false)
  }

  async function addAgent() {
    if (!form.name) return
    await supabase.from('agents').insert({ ...form, status: 'active', credits: 0 })
    setForm({ name: '', email: '', phone: '', role: 'agent', plan: 'basic' })
    setShowModal(false)
    loadAgents()
  }

  const planColors: Record<string, string> = { elite: '#C9A84C', builder: '#a78bfa', basic: '#60a5fa', free: '#9ca3af' }
  const statusColors: Record<string, string> = { active: '#34d399', inactive: '#f87171' }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px',
    background: C.surface2, border: `1px solid ${C.border}`, color: C.text,
    outline: 'none', fontFamily: C.font,
  }

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Agentes</h1>
          <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '4px' }}>Gestiona tu equipo de ventas</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: 'linear-gradient(135deg, #C9A84C, #8B6E2E)', color: '#07080A',
            border: 'none', borderRadius: '10px', padding: '10px 20px',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: C.font,
          }}
        >+ Agregar agente</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Total agentes', value: agents.length, color: '#60a5fa', icon: '👥' },
          { label: 'Activos', value: agents.filter(a => a.status === 'active').length, color: '#34d399', icon: '✅' },
          { label: 'Leads esta semana', value: Object.values(agentStats).reduce((s, v) => s + v.leads, 0), color: '#fbbf24', icon: '⚡' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{
            background: C.surface, border: `1px solid ${color}25`, borderRadius: '16px',
            padding: '20px 22px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color, opacity: 0.55 }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={{ color: C.textMuted, fontSize: '10px', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', margin: 0 }}>{label}</p>
              <span style={{ fontSize: '16px', opacity: 0.7 }}>{icon}</span>
            </div>
            <p style={{ color, fontSize: '34px', fontWeight: 800, lineHeight: 1, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: 0 }}>Equipo</h2>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted, fontSize: '14px' }}>Cargando...</div>
        ) : agents.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '14px', opacity: 0.5 }}>👤</div>
            <p style={{ color: C.text, fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Sin agentes</p>
            <p style={{ color: C.textMuted, fontSize: '13px' }}>Agrega tu primer agente para comenzar.</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr', padding: '10px 24px', borderBottom: `1px solid ${C.border}` }}>
              {['Nombre', 'Email', 'Teléfono', 'Plan', 'Status', 'Leads', 'Ventas'].map(h => (
                <p key={h} style={{ color: C.textMuted, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>{h}</p>
              ))}
            </div>
            {agents.map((agent, i) => (
              <div key={agent.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr',
                padding: '14px 24px', alignItems: 'center',
                borderBottom: i < agents.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #C9A84C, #8B6E2E)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 800, color: '#07080A', flexShrink: 0,
                  }}>{agent.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <p style={{ color: C.text, fontSize: '13px', fontWeight: 600, margin: 0 }}>{agent.name}</p>
                    <p style={{ color: C.textMuted, fontSize: '11px', margin: 0 }}>{agent.role}</p>
                  </div>
                </div>
                <p style={{ color: C.textDim, fontSize: '13px', margin: 0 }}>{agent.email || '—'}</p>
                <p style={{ color: C.textDim, fontSize: '13px', margin: 0 }}>{agent.phone || '—'}</p>
                <span style={{
                  display: 'inline-block', fontSize: '11px', fontWeight: 700,
                  padding: '3px 10px', borderRadius: '100px',
                  background: `${planColors[agent.plan] || '#9ca3af'}18`,
                  color: planColors[agent.plan] || '#9ca3af',
                  border: `1px solid ${planColors[agent.plan] || '#9ca3af'}30`,
                  textTransform: 'capitalize',
                }}>{agent.plan}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColors[agent.status] || '#9ca3af' }} />
                  <span style={{ color: statusColors[agent.status] || '#9ca3af', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' }}>{agent.status}</span>
                </div>
                <p style={{ color: C.textDim, fontSize: '14px', fontWeight: 700, margin: 0 }}>{agentStats[agent.id]?.leads || 0}</p>
                <p style={{ color: '#34d399', fontSize: '14px', fontWeight: 700, margin: 0 }}>{agentStats[agent.id]?.won || 0}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Agent Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: '20px',
            padding: '32px', width: '420px', maxWidth: '90vw',
          }}>
            <h3 style={{ color: C.text, fontSize: '18px', fontWeight: 700, margin: '0 0 24px' }}>Agregar agente</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input placeholder="Nombre completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              <input placeholder="Teléfono (+1...)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inputStyle}>
                <option value="agent">Agente</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
              </select>
              <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} style={inputStyle}>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="builder">Builder</option>
                <option value="elite">Elite</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{
                background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '10px',
                padding: '10px 20px', color: C.textDim, fontSize: '13px', cursor: 'pointer', fontFamily: C.font,
              }}>Cancelar</button>
              <button onClick={addAgent} style={{
                background: 'linear-gradient(135deg, #C9A84C, #8B6E2E)', color: '#07080A',
                border: 'none', borderRadius: '10px', padding: '10px 20px',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: C.font,
              }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
