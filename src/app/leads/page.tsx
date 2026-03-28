'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C, STAGE_META, scoreColor, fmtDate } from '@/lib/design'
import { Lead, LeadStage } from '@/types'
import LeadDetailPanel from '@/components/LeadDetailPanel'

const STAGES = [{ value: 'all', label: 'Todas las etapas' }, ...Object.entries(STAGE_META).map(([v, m]) => ({ value: v, label: m.label }))]

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filtered, setFiltered] = useState<Lead[]>([])
  const [selected, setSelected] = useState<Lead | null>(null)
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('all')
  const [loading, setLoading] = useState(true)
  const [focused, setFocused] = useState(false)

  useEffect(() => { loadLeads() }, [])

  useEffect(() => {
    let r = leads
    if (search) { const q = search.toLowerCase(); r = r.filter(l => l.name.toLowerCase().includes(q) || l.phone.includes(q) || (l.email||'').toLowerCase().includes(q)) }
    if (stage !== 'all') r = r.filter(l => l.stage === stage)
    setFiltered(r)
  }, [leads, search, stage])

  async function loadLeads() {
    setLoading(true)
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || []); setLoading(false)
  }

  async function updateStage(id: string, s: string) {
    await supabase.from('leads').update({ stage: s }).eq('id', id)
    setLeads(p => p.map(l => l.id === id ? { ...l, stage: s as LeadStage } : l))
    if (selected?.id === id) setSelected(p => p ? { ...p, stage: s as LeadStage } : null)
  }

  async function updateNotes(id: string, notes: string) {
    await supabase.from('leads').update({ notes }).eq('id', id)
  }

  async function addContact(id: string, n: number) {
    const v = n + 1
    await supabase.from('leads').update({ contact_attempts: v, last_contact: new Date().toISOString() }).eq('id', id)
    setLeads(p => p.map(l => l.id === id ? { ...l, contact_attempts: v } : l))
    if (selected?.id === id) setSelected(p => p ? { ...p, contact_attempts: v } : null)
  }

  const inp = { background: C.surface2, border: `1px solid ${focused ? C.borderGold : C.border}`, borderRadius: '10px', color: C.text, fontSize: '13px', outline: 'none', padding: '10px 14px', transition: 'border-color 0.2s' }

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, fontFamily: C.font, overflow: 'hidden' }}>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '32px 32px 24px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
            <div>
              <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>Mis Leads</h1>
              <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '5px' }}>
                {loading ? 'Cargando...' : `${filtered.length} lead${filtered.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 22px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${C.goldBright}, ${C.gold})`, color: '#07080A', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 20px rgba(201,168,76,0.3)' }}>
              + Nuevo lead
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
              <input type="text" placeholder="Buscar por nombre, teléfono, email..." value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                style={{ ...inp, paddingLeft: '36px', width: '100%', boxSizing: 'border-box' as const }} />
            </div>
            <select value={stage} onChange={e => setStage(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 32px 32px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.textMuted }}>Cargando leads...</div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '60px' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(201,168,76,0.08)', border: '1.5px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '22px' }}>👥</div>
              <h3 style={{ color: C.text, fontSize: '17px', fontWeight: 600, marginBottom: '10px' }}>{search || stage !== 'all' ? 'Sin resultados' : 'Aún no hay leads'}</h3>
              <p style={{ color: C.textMuted, fontSize: '13px', lineHeight: 1.7, maxWidth: '340px', marginBottom: '28px' }}>
                {search || stage !== 'all' ? 'Cambia los filtros o el término de búsqueda.' : 'Cuando alguien llene el formulario de la landing page, aparecerá aquí en tiempo real.'}
              </p>
              {!search && stage === 'all' && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <a href="https://luxuryshieldinsurance.com" target="_blank" style={{ padding: '10px 20px', borderRadius: '10px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: C.gold, fontSize: '13px', fontWeight: 600 }}>Ver landing →</a>
                  <button style={{ padding: '10px 20px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: '13px', cursor: 'pointer' }}>+ Lead manual</button>
                </div>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Nombre', 'Teléfono', 'Estado', 'Seguro', 'Etapa', 'Score', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: C.textMuted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const isSelected = selected?.id === lead.id
                  const meta = STAGE_META[lead.stage] || STAGE_META.unqualified
                  return (
                    <tr key={lead.id} onClick={() => setSelected(isSelected ? null : lead)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', background: isSelected ? 'rgba(201,168,76,0.05)' : 'transparent', borderLeft: isSelected ? `3px solid ${C.gold}` : '3px solid transparent', transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '13px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: C.gold, flexShrink: 0 }}>
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ color: C.text, fontSize: '13px', fontWeight: 600, margin: 0 }}>{lead.name}</p>
                            {lead.ready_to_buy && <p style={{ color: '#f97316', fontSize: '10px', margin: 0 }}>🔥 Listo</p>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 14px', color: C.textDim, fontSize: '13px' }}>{lead.phone}</td>
                      <td style={{ padding: '13px 14px', color: C.textDim, fontSize: '13px' }}>{lead.state || '—'}</td>
                      <td style={{ padding: '13px 14px', color: C.textDim, fontSize: '13px' }}>{lead.insurance_type}</td>
                      <td style={{ padding: '13px 14px' }}>
                        <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, border: `1px solid ${meta.color}35`, background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '13px 14px' }}>
                        <span style={{ color: scoreColor(lead.score), fontWeight: 800, fontSize: '15px' }}>{lead.score}</span>
                      </td>
                      <td style={{ padding: '13px 14px', color: C.textMuted, fontSize: '12px' }}>{fmtDate(lead.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DETAIL PANEL */}
      {selected && (
        <LeadDetailPanel
          lead={selected}
          onClose={() => setSelected(null)}
          onStageUpdate={(id, s) => {
            setLeads(p => p.map(l => l.id === id ? { ...l, stage: s as LeadStage } : l))
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}
