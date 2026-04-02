'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C, STAGE_META, scoreColor, fmtDate } from '@/lib/design'
import { Lead, LeadStage } from '@/types'
import LeadDetailPanel from '@/components/LeadDetailPanel'
import { useAuth } from '@/contexts/AuthContext'
import { scopeQuery } from '@/lib/use-scoped-query'

const STAGES = [{ value: 'all', label: 'Todas las etapas' }, ...Object.entries(STAGE_META).map(([v, m]) => ({ value: v, label: m.label }))]

export default function LeadsPageWrapper() {
  return <Suspense fallback={<div style={{ padding: '48px', textAlign: 'center', color: C.textMuted, background: C.bg, minHeight: '100vh', fontFamily: C.font }}>Cargando...</div>}><LeadsPage /></Suspense>
}

function LeadsPage() {
  const searchParams = useSearchParams()
  const { user, activeAccount } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [filtered, setFiltered] = useState<Lead[]>([])
  const [selected, setSelected] = useState<Lead | null>(null)
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('all')
  const [loading, setLoading] = useState(true)
  const [focused, setFocused] = useState(false)
  const [filterLabel, setFilterLabel] = useState('')
  const [showNewLead, setShowNewLead] = useState(false)
  const [newLead, setNewLead] = useState({
    name: '', phone: '', email: '', state: '', insurance_type: 'Dental', notes: '',
    city: '', zip_code: '', country: 'US', age: '', gender: '', marital_status: '',
    children: '', occupation: '', income_range: '', industry: '',
    referral_source: '', preferred_language: 'es', preferred_contact: 'whatsapp',
    budget_range: '', decision_timeline: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [showMoreFields, setShowMoreFields] = useState(false)

  useEffect(() => { if (user) loadLeads() }, [user])

  // Handle query params from analytics
  useEffect(() => {
    if (!leads.length) return
    const filter = searchParams.get('filter')
    const selectedId = searchParams.get('selected')
    const agent = searchParams.get('agent')
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const closedStages = ['closed_won', 'closed_lost', 'unqualified']

    let r = leads
    let label = ''

    if (filter === 'activos') { r = r.filter(l => !closedStages.includes(l.stage)); label = 'Leads activos' }
    else if (filter === 'cerrados') { r = r.filter(l => l.stage === 'closed_won' && new Date(l.created_at).getTime() > weekAgo); label = 'Cerrados esta semana' }
    else if (filter === 'listo_comprar') { r = r.filter(l => l.ready_to_buy); label = 'Listos para comprar' }
    else if (filter === 'calientes') { r = r.filter(l => l.score >= 75); label = 'Leads calientes (75+)' }
    else if (filter === 'inactivos') { r = r.filter(l => !closedStages.includes(l.stage) && new Date(l.updated_at || l.created_at).getTime() < sixHoursAgo); label = 'Sin actividad >6h' }

    if (agent) { r = r.filter(l => (l.assigned_to || '').toLowerCase().includes(agent)); label = `Leads de ${agent}` }

    if (label) { setFiltered(r); setFilterLabel(label); return }

    // Default filtering
    if (search) { const q = search.toLowerCase(); r = r.filter(l => l.name.toLowerCase().includes(q) || l.phone.includes(q) || (l.email || '').toLowerCase().includes(q)) }
    if (stage !== 'all') r = r.filter(l => l.stage === stage)
    setFiltered(r)
    setFilterLabel('')

    // Auto-select lead if specified
    if (selectedId) {
      const lead = leads.find(l => l.id === selectedId)
      if (lead) setSelected(lead)
    }
  }, [leads, search, stage, searchParams])

  async function loadLeads() {
    setLoading(true)
    const q = supabase.from('leads').select('*').order('created_at', { ascending: false })
    const { data } = await scopeQuery(q, user, 'agent_id', activeAccount?.id)
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

  const emptyLead = {
    name: '', phone: '', email: '', state: '', insurance_type: 'Dental', notes: '',
    city: '', zip_code: '', country: 'US', age: '', gender: '', marital_status: '',
    children: '', occupation: '', income_range: '', industry: '',
    referral_source: '', preferred_language: 'es', preferred_contact: 'whatsapp',
    budget_range: '', decision_timeline: '',
  }

  async function createLead() {
    if (!user || !newLead.name.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const payload: Record<string, any> = {
        name: newLead.name.trim(),
        phone: newLead.phone.trim() || '',
        email: newLead.email.trim() || null,
        state: newLead.state.trim() || null,
        insurance_type: newLead.insurance_type || 'dental',
        notes: newLead.notes.trim() || null,
        agent_id: user.id,
        account_id: user.account_id,
      }
      // Metadata
      if (newLead.city) payload.city = newLead.city.trim()
      if (newLead.zip_code) payload.zip_code = newLead.zip_code.trim()
      if (newLead.country) payload.country = newLead.country.trim()
      if (newLead.age) payload.age = newLead.age
      if (newLead.gender) payload.gender = newLead.gender
      if (newLead.marital_status) payload.marital_status = newLead.marital_status
      if (newLead.children) payload.children = newLead.children
      if (newLead.occupation) payload.occupation = newLead.occupation.trim()
      if (newLead.income_range) payload.income_range = newLead.income_range
      if (newLead.industry) payload.industry = newLead.industry.trim()
      if (newLead.referral_source) payload.referral_source = newLead.referral_source.trim()
      if (newLead.preferred_language) payload.preferred_language = newLead.preferred_language
      if (newLead.preferred_contact) payload.preferred_contact = newLead.preferred_contact
      if (newLead.budget_range) payload.budget_range = newLead.budget_range
      if (newLead.decision_timeline) payload.decision_timeline = newLead.decision_timeline

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error || 'Error al crear lead')
        setSaving(false)
        return
      }
      setShowNewLead(false)
      setShowMoreFields(false)
      setNewLead(emptyLead)
      setSaveError('')
      loadLeads()
    } catch (err: any) {
      setSaveError(err.message || 'Error de conexion')
    }
    setSaving(false)
  }

  async function exportLeads() {
    if (!user) return
    setExporting(true)
    try {
      const params = new URLSearchParams({
        agent_id: user.id,
        account_id: user.account_id || '',
        role: user.role,
        format: 'csv',
      })
      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {}
    setExporting(false)
  }

  const fld = { width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: 'none', fontFamily: C.font, boxSizing: 'border-box' as const }
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
                {loading ? 'Cargando...' : filterLabel ? `${filterLabel} (${filtered.length})` : `${filtered.length} lead${filtered.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={exportLeads} disabled={exporting || leads.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 18px', borderRadius: '10px', border: `1px solid ${C.border}`, cursor: leads.length > 0 ? 'pointer' : 'not-allowed', background: 'rgba(255,255,255,0.02)', color: C.textDim, fontSize: '12px', fontWeight: 600, fontFamily: C.font }}>
                {exporting ? 'Exportando...' : 'Descargar Excel'}
              </button>
              <button onClick={() => { setShowNewLead(true); setSaveError('') }} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 22px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${C.goldBright}, ${C.gold})`, color: '#07080A', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 20px rgba(201,168,76,0.3)', fontFamily: C.font }}>
                + Nuevo lead
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
              <input type="text" placeholder="Buscar por nombre, teléfono, email..." value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                style={{ ...inp, paddingLeft: '36px', width: '100%', boxSizing: 'border-box' as const }} />
            </div>
            <select value={stage} onChange={e => setStage(e.target.value)} style={{ ...inp, cursor: 'pointer', fontFamily: C.font }}>
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
                  <button onClick={() => { setShowNewLead(true); setSaveError('') }} style={{ padding: '10px 20px', borderRadius: '10px', background: `linear-gradient(135deg, ${C.goldBright}, ${C.gold})`, border: 'none', color: '#07080A', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: C.font }}>+ Crear lead manual</button>
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

      {/* NEW LEAD MODAL */}
      {showNewLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowNewLead(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f1115', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '16px', padding: '28px', width: '520px', maxWidth: '95vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
            <h3 style={{ color: '#F0ECE3', fontSize: '18px', fontWeight: 700, margin: '0 0 20px', fontFamily: C.font }}>Nuevo Lead</h3>

            {saveError && (
              <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', fontSize: '12px', color: '#fca5a5' }}>{saveError}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Basic info */}
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '5px', letterSpacing: '0.1em' }}>NOMBRE *</label>
                <input placeholder="Nombre del lead" value={newLead.name} onChange={e => setNewLead(p => ({ ...p, name: e.target.value }))} autoFocus style={fld} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '5px', letterSpacing: '0.1em' }}>TELEFONO</label>
                  <input placeholder="+1 (786) 555-1234" value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} style={fld} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '5px', letterSpacing: '0.1em' }}>EMAIL</label>
                  <input placeholder="email@ejemplo.com" type="email" value={newLead.email} onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))} style={fld} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '5px', letterSpacing: '0.1em' }}>ESTADO</label>
                  <input placeholder="FL, TX, CA..." value={newLead.state} onChange={e => setNewLead(p => ({ ...p, state: e.target.value }))} style={fld} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '5px', letterSpacing: '0.1em' }}>PRODUCTO / INDUSTRIA</label>
                  <select value={newLead.insurance_type} onChange={e => setNewLead(p => ({ ...p, insurance_type: e.target.value }))} style={fld}>
                    <option value="Dental">Dental</option>
                    <option value="IUL">IUL / Vida</option>
                    <option value="Vida">Vida</option>
                    <option value="ACA">ACA / Obamacare</option>
                    <option value="Medicare">Medicare</option>
                    <option value="Auto">Auto</option>
                    <option value="Hogar">Hogar</option>
                    <option value="Bienes Raices">Bienes Raices</option>
                    <option value="Infoproductos">Infoproductos</option>
                    <option value="Dropshipping">Dropshipping</option>
                    <option value="Inversiones">Inversiones</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '5px', letterSpacing: '0.1em' }}>NOTAS</label>
                <textarea placeholder="Notas sobre este lead (opcional)" value={newLead.notes} onChange={e => setNewLead(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...fld, resize: 'none' }} />
              </div>

              {/* Expandable metadata */}
              <button type="button" onClick={() => setShowMoreFields(!showMoreFields)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)', color: '#C9A84C', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: C.font }}>
                <span>Datos demograficos (para Sophia IA)</span>
                <span style={{ fontSize: '14px' }}>{showMoreFields ? '−' : '+'}</span>
              </button>

              {showMoreFields && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize: '10px', color: 'rgba(201,168,76,0.5)', margin: '0 0 4px', letterSpacing: '0.08em' }}>Sophia usa estos datos para mejorar segmentacion y personalizar mensajes</p>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>CIUDAD</label>
                      <input placeholder="Miami, Houston..." value={newLead.city} onChange={e => setNewLead(p => ({ ...p, city: e.target.value }))} style={fld} />
                    </div>
                    <div style={{ width: '100px' }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>ZIP</label>
                      <input placeholder="33101" value={newLead.zip_code} onChange={e => setNewLead(p => ({ ...p, zip_code: e.target.value }))} style={fld} />
                    </div>
                    <div style={{ width: '80px' }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>EDAD</label>
                      <input placeholder="35" type="number" value={newLead.age} onChange={e => setNewLead(p => ({ ...p, age: e.target.value }))} style={fld} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>GENERO</label>
                      <select value={newLead.gender} onChange={e => setNewLead(p => ({ ...p, gender: e.target.value }))} style={fld}>
                        <option value="">--</option>
                        <option value="masculino">Masculino</option>
                        <option value="femenino">Femenino</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>ESTADO CIVIL</label>
                      <select value={newLead.marital_status} onChange={e => setNewLead(p => ({ ...p, marital_status: e.target.value }))} style={fld}>
                        <option value="">--</option>
                        <option value="soltero">Soltero/a</option>
                        <option value="casado">Casado/a</option>
                        <option value="divorciado">Divorciado/a</option>
                        <option value="viudo">Viudo/a</option>
                        <option value="union_libre">Union libre</option>
                      </select>
                    </div>
                    <div style={{ width: '80px' }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>HIJOS</label>
                      <input placeholder="0" type="number" value={newLead.children} onChange={e => setNewLead(p => ({ ...p, children: e.target.value }))} style={fld} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>OCUPACION</label>
                      <input placeholder="Ej: Enfermera, Mecanico, Dueno negocio" value={newLead.occupation} onChange={e => setNewLead(p => ({ ...p, occupation: e.target.value }))} style={fld} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>INDUSTRIA</label>
                      <input placeholder="Salud, Construccion, Tech..." value={newLead.industry} onChange={e => setNewLead(p => ({ ...p, industry: e.target.value }))} style={fld} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>RANGO INGRESO</label>
                      <select value={newLead.income_range} onChange={e => setNewLead(p => ({ ...p, income_range: e.target.value }))} style={fld}>
                        <option value="">--</option>
                        <option value="0-25k">$0 - $25K</option>
                        <option value="25k-50k">$25K - $50K</option>
                        <option value="50k-75k">$50K - $75K</option>
                        <option value="75k-100k">$75K - $100K</option>
                        <option value="100k-150k">$100K - $150K</option>
                        <option value="150k+">$150K+</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>PRESUPUESTO</label>
                      <select value={newLead.budget_range} onChange={e => setNewLead(p => ({ ...p, budget_range: e.target.value }))} style={fld}>
                        <option value="">--</option>
                        <option value="0-50">$0 - $50/mes</option>
                        <option value="50-100">$50 - $100/mes</option>
                        <option value="100-200">$100 - $200/mes</option>
                        <option value="200-500">$200 - $500/mes</option>
                        <option value="500+">$500+/mes</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>REFERIDO POR</label>
                      <input placeholder="Nombre o fuente" value={newLead.referral_source} onChange={e => setNewLead(p => ({ ...p, referral_source: e.target.value }))} style={fld} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>TIMELINE DECISION</label>
                      <select value={newLead.decision_timeline} onChange={e => setNewLead(p => ({ ...p, decision_timeline: e.target.value }))} style={fld}>
                        <option value="">--</option>
                        <option value="inmediato">Inmediato</option>
                        <option value="1_semana">1 semana</option>
                        <option value="1_mes">1 mes</option>
                        <option value="3_meses">3 meses</option>
                        <option value="explorando">Solo explorando</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>IDIOMA</label>
                      <select value={newLead.preferred_language} onChange={e => setNewLead(p => ({ ...p, preferred_language: e.target.value }))} style={fld}>
                        <option value="es">Espanol</option>
                        <option value="en">English</option>
                        <option value="pt">Portugues</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '4px', letterSpacing: '0.1em' }}>CONTACTO PREFERIDO</label>
                      <select value={newLead.preferred_contact} onChange={e => setNewLead(p => ({ ...p, preferred_contact: e.target.value }))} style={fld}>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                        <option value="llamada">Llamada</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowNewLead(false); setShowMoreFields(false) }} style={{ padding: '10px 20px', borderRadius: '10px', background: 'transparent', border: `1px solid ${C.border}`, color: 'rgba(240,236,227,0.4)', fontSize: '13px', cursor: 'pointer', fontFamily: C.font }}>Cancelar</button>
              <button onClick={createLead} disabled={saving || !newLead.name.trim()} style={{ padding: '10px 28px', borderRadius: '10px', background: newLead.name.trim() ? `linear-gradient(135deg, ${C.goldBright}, ${C.gold})` : 'rgba(201,168,76,0.3)', color: '#07080A', fontSize: '13px', fontWeight: 700, border: 'none', cursor: newLead.name.trim() ? 'pointer' : 'not-allowed', fontFamily: C.font, boxShadow: newLead.name.trim() ? '0 4px 16px rgba(201,168,76,0.3)' : 'none' }}>{saving ? 'Guardando...' : 'Crear Lead'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
