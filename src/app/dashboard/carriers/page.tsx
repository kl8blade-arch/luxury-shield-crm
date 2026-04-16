'use client'
// src/app/dashboard/carriers/page.tsx
// Configuración de carriers activos por agencia

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Carrier {
  id: string
  name: string
  short_name: string | null
  lines: string[]
  states_available: string[]
  phone_agents: string | null
  contracting_url: string | null
  notes: string | null
  isActive: boolean
  config: {
    agent_code: string | null
    contract_level: string | null
  } | null
}

const T = {
  bg:     '#0d0820',
  panel:  'rgba(255,255,255,0.05)',
  border: 'rgba(149,76,233,0.18)',
  text:   '#f0eaff',
  muted:  'rgba(200,180,255,0.45)',
  accent: '#9B59B6',
  green:  '#00E5A0',
  red:    '#FF4757',
  gold:   '#FFB930',
  cyan:   '#00D4FF',
}

const LINE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  dental:            { label: 'Dental',        color: '#00D4FF', icon: '🦷' },
  vision:            { label: 'Visión',         color: '#9B59B6', icon: '👁️' },
  aca:               { label: 'ACA/Salud',      color: '#27AE60', icon: '🏥' },
  iul:               { label: 'IUL',            color: '#8E44AD', icon: '💎' },
  term_life:         { label: 'Vida Término',   color: '#2980B9', icon: '🛡️' },
  final_expense:     { label: 'Gastos Finales', color: '#E67E22', icon: '🕊️' },
  accident:          { label: 'Accidentes',     color: '#E74C3C', icon: '⚡' },
  hospital_indemnity:{ label: 'Hospitalización',color: '#16A085', icon: '🏨' },
  cancer:            { label: 'Cáncer',         color: '#C0392B', icon: '🎗️' },
  critical_illness:  { label: 'Enf. Críticas',  color: '#D35400', icon: '❤️‍🩹' },
  medicare_advantage:{ label: 'Medicare',       color: '#1A5276', icon: '👴' },
  medicaid:          { label: 'Medicaid',       color: '#17A589', icon: '🏛️' },
  annuity:           { label: 'Anualidad',      color: '#7D6608', icon: '📈' },
}

export default function CarriersPage() {
  const { user } = useAuth()
  const [carriers,   setCarriers]   = useState<Carrier[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [filterLine, setFilterLine] = useState('all')
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editCode,   setEditCode]   = useState('')
  const [editLevel,  setEditLevel]  = useState('')

  const fetchCarriers = useCallback(async () => {
    if (!user?.id) return
    try {
      const r = await fetch(`/api/dashboard/carriers?agentId=${user.id}`)
      if (!r.ok) return
      const { data } = await r.json()
      setCarriers(data ?? [])
    } catch (e) {
      console.error('[Carriers]', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchCarriers() }, [fetchCarriers])

  const toggleCarrier = async (carrierId: string, currentActive: boolean) => {
    if (!user?.id) return
    setSaving(carrierId)
    try {
      await fetch('/api/dashboard/carriers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: user.id, carrierId, active: !currentActive }),
      })
      setCarriers(prev => prev.map(c => c.id === carrierId ? { ...c, isActive: !currentActive } : c))
    } finally {
      setSaving(null)
    }
  }

  const saveConfig = async (carrierId: string) => {
    if (!user?.id) return
    setSaving(carrierId)
    try {
      const carrier = carriers.find(c => c.id === carrierId)
      await fetch('/api/dashboard/carriers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: user.id, carrierId,
          active: carrier?.isActive ?? false,
          agentCode: editCode,
          contractLevel: editLevel,
        }),
      })
      setCarriers(prev => prev.map(c => c.id === carrierId
        ? { ...c, config: { agent_code: editCode, contract_level: editLevel } }
        : c
      ))
      setEditingId(null)
    } finally {
      setSaving(null)
    }
  }

  // All unique lines for filter
  const allLines = Array.from(new Set(carriers.flatMap(c => c.lines))).sort()

  const filtered = carriers.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.lines.some(l => l.includes(search.toLowerCase()))
    const matchLine = filterLine === 'all' || c.lines.includes(filterLine)
    return matchSearch && matchLine
  })

  const activeCount = carriers.filter(c => c.isActive).length

  if (loading) return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: T.muted }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div><div>Cargando carriers...</div></div>
    </div>
  )

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'SF Pro Display',system-ui,sans-serif", color: T.text }}>

      {/* HEADER */}
      <div style={{ background: 'rgba(13,8,32,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.border}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 20 }}>🏢</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Carriers Activos</div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: 'uppercase' }}>
              {activeCount} activos · {carriers.length} disponibles
            </div>
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar carrier..."
            style={{ flex: 1, maxWidth: 260, padding: '7px 14px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.text, outline: 'none', fontFamily: 'inherit' }}
          />

          {/* Line filter */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
            <button onClick={() => setFilterLine('all')} style={{ padding: '4px 10px', background: filterLine === 'all' ? `${T.accent}20` : 'transparent', border: `1px solid ${filterLine === 'all' ? T.accent : T.border}`, borderRadius: 14, fontSize: 9, fontWeight: 700, color: filterLine === 'all' ? T.accent : T.muted, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Todos
            </button>
            {allLines.map(line => {
              const cfg = LINE_CONFIG[line]
              if (!cfg) return null
              return (
                <button key={line} onClick={() => setFilterLine(line)}
                  style={{ padding: '4px 10px', background: filterLine === line ? `${cfg.color}20` : 'transparent', border: `1px solid ${filterLine === line ? cfg.color : T.border}`, borderRadius: 14, fontSize: 9, fontWeight: 700, color: filterLine === line ? cfg.color : T.muted, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {cfg.icon} {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* INFO BANNER */}
      <div style={{ margin: '16px 20px 0', padding: '10px 16px', background: `${T.accent}10`, border: `1px solid ${T.accent}25`, borderRadius: 10, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
        💡 Activa los carriers con los que tienes contrato. Sophia solo mencionará los productos de carriers activos en sus conversaciones con leads.
      </div>

      {/* CARRIERS GRID */}
      <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {filtered.map(carrier => {
          const isEditing  = editingId === carrier.id
          const isSaving   = saving === carrier.id

          return (
            <div key={carrier.id} style={{ background: carrier.isActive ? `${T.green}08` : T.panel, border: `1px solid ${carrier.isActive ? T.green + '30' : T.border}`, borderRadius: 14, overflow: 'hidden', transition: 'all 0.2s' }}>

              {/* Card header */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Active toggle */}
                <button
                  onClick={() => toggleCarrier(carrier.id, carrier.isActive)}
                  disabled={isSaving}
                  style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', border: 'none', background: carrier.isActive ? T.green : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s', flexShrink: 0, opacity: isSaving ? 0.6 : 1 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: carrier.isActive ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 0.2s' }}/>
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 4 }}>{carrier.name}</div>

                  {/* Lines of business */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {carrier.lines.map(line => {
                      const cfg = LINE_CONFIG[line]
                      if (!cfg) return null
                      return (
                        <span key={line} style={{ fontSize: 8, padding: '2px 6px', background: `${cfg.color}15`, borderRadius: 8, color: cfg.color, fontWeight: 700 }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {carrier.isActive && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green, boxShadow: `0 0 8px ${T.green}`, flexShrink: 0, marginTop: 4 }}/>
                )}
              </div>

              {/* Notes */}
              {carrier.notes && (
                <div style={{ padding: '0 16px 10px', fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
                  {carrier.notes}
                </div>
              )}

              {/* Config section (only if active) */}
              {carrier.isActive && (
                <div style={{ borderTop: `1px solid ${T.border}`, padding: '10px 16px', background: 'rgba(255,255,255,0.02)' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        value={editCode}
                        onChange={e => setEditCode(e.target.value)}
                        placeholder="Tu código de agente (ej: AG123456)"
                        style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, color: T.text, outline: 'none', fontFamily: 'inherit' }}
                      />
                      <input
                        value={editLevel}
                        onChange={e => setEditLevel(e.target.value)}
                        placeholder="Nivel de contrato (ej: Street, Senior, Exec)"
                        style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, color: T.text, outline: 'none', fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => saveConfig(carrier.id)} disabled={isSaving}
                          style={{ flex: 1, padding: '7px', background: `${T.green}20`, border: `1px solid ${T.green}40`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: T.green, cursor: 'pointer' }}>
                          {isSaving ? 'Guardando...' : '💾 Guardar'}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          style={{ padding: '7px 12px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, color: T.muted, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        {carrier.config?.agent_code
                          ? <div style={{ fontSize: 11, color: T.text }}>Código: <strong>{carrier.config.agent_code}</strong>{carrier.config.contract_level ? ` · ${carrier.config.contract_level}` : ''}</div>
                          : <div style={{ fontSize: 11, color: T.muted }}>Sin código de agente</div>
                        }
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => { setEditingId(carrier.id); setEditCode(carrier.config?.agent_code ?? ''); setEditLevel(carrier.config?.contract_level ?? '') }}
                          style={{ padding: '4px 10px', background: `${T.accent}15`, border: `1px solid ${T.accent}30`, borderRadius: 8, fontSize: 10, fontWeight: 700, color: T.accent, cursor: 'pointer' }}>
                          ✏️ Editar
                        </button>
                        {carrier.contracting_url && (
                          <a href={carrier.contracting_url} target="_blank" rel="noreferrer"
                            style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 10, color: T.muted, textDecoration: 'none' }}>
                            🔗 Portal
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Phone agent (if active) */}
              {carrier.isActive && carrier.phone_agents && (
                <div style={{ padding: '6px 16px 10px', fontSize: 10, color: T.muted }}>
                  📞 Soporte agente: {carrier.phone_agents}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
