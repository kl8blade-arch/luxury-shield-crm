'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

const STATUS_META: Record<string, { color: string; glow: string; label: string }> = {
  pending:   { color: '#fbbf24', glow: 'rgba(251,191,36,0.3)', label: 'Pendiente' },
  completed: { color: '#34d399', glow: 'rgba(52,211,153,0.3)', label: 'Completado' },
  cancelled: { color: '#6b7280', glow: 'rgba(107,114,128,0.2)', label: 'Cancelado' },
  overdue:   { color: '#f87171', glow: 'rgba(248,113,113,0.3)', label: 'Vencido' },
  sent:      { color: '#60a5fa', glow: 'rgba(96,165,250,0.3)', label: 'Enviado' },
  failed:    { color: '#f87171', glow: 'rgba(248,113,113,0.3)', label: 'Fallido' },
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<any[]>([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('09:00')
  const [newType, setNewType] = useState('followup')
  const [leadSearch, setLeadSearch] = useState('')
  const [leads, setLeads] = useState<any[]>([])
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { load() }, [filter])
  useEffect(() => {
    if (leadSearch.length < 2) { setLeads([]); return }
    supabase.from('leads').select('id, name, phone, state').ilike('name', `%${leadSearch}%`).limit(5).then(({ data }) => setLeads(data || []))
  }, [leadSearch])

  async function load() {
    setLoading(true)
    let q = supabase.from('reminders').select('*').order('created_at', { ascending: false }).limit(50)
    if (filter === 'pending') q = q.eq('status', 'pending')
    else if (filter === 'completed') q = q.eq('status', 'completed')
    else if (filter === 'overdue') q = q.eq('status', 'pending').lt('scheduled_at', new Date().toISOString())
    const { data } = await q
    setReminders(data || [])
    setLoading(false)
  }

  async function complete(id: string) {
    await supabase.from('reminders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
    setReminders(p => p.map(r => r.id === id ? { ...r, status: 'completed' } : r))
  }

  async function cancel(id: string) {
    await supabase.from('reminders').update({ status: 'cancelled' }).eq('id', id)
    setReminders(p => p.map(r => r.id === id ? { ...r, status: 'cancelled' } : r))
  }

  async function createReminder() {
    if (!newNote) return
    await supabase.from('reminders').insert({
      lead_id: selectedLead?.id || null,
      lead_name: selectedLead?.name || null,
      lead_phone: selectedLead?.phone || null,
      type: newType,
      notes: newNote,
      scheduled_at: newDate && newTime ? new Date(`${newDate}T${newTime}`).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    })
    setNewNote(''); setNewDate(''); setSelectedLead(null); setLeadSearch(''); setShowCreate(false)
    load()
  }

  const isOverdue = (r: any) => r.status === 'pending' && r.scheduled_at && new Date(r.scheduled_at) < new Date()
  const pendingCount = reminders.filter(r => r.status === 'pending').length
  const overdueCount = reminders.filter(r => isOverdue(r)).length

  const fmtDate = (d: string) => {
    if (!d) return '—'
    const date = new Date(d)
    const now = new Date()
    const diff = Math.round((date.getTime() - now.getTime()) / 3600000)
    if (diff > -1 && diff < 1) return 'Ahora'
    if (diff >= 1 && diff < 24) return `En ${diff}h`
    if (diff < 0 && diff > -24) return `Hace ${Math.abs(diff)}h`
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const inp = { width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: '"Outfit","Inter",sans-serif', boxSizing: 'border-box' as const }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative' }}>

        <div style={{ position: 'absolute', top: '-10%', left: '60%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(251,191,36,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>RECORDATORIOS</p>
            <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', fontWeight: 400, color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Seguimiento</h1>
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
              {pendingCount > 0 && <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 600 }}>{pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</span>}
              {overdueCount > 0 && <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>{overdueCount} vencido{overdueCount > 1 ? 's' : ''}</span>}
            </div>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '10px 22px', borderRadius: '12px', background: 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(201,168,76,0.25)', transition: 'all 0.2s' }}>+ Nuevo</button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '16px', padding: '20px', marginBottom: '24px', backdropFilter: 'blur(10px)' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#C9A84C', marginBottom: '14px' }}>Crear recordatorio</p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div style={{ position: 'relative' }}>
                {selectedLead ? (
                  <div style={{ ...inp, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.2)' }}>
                    <span style={{ color: '#6ee7b7', fontSize: '12px' }}>👤 {selectedLead.name}</span>
                    <button onClick={() => { setSelectedLead(null); setLeadSearch('') }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>×</button>
                  </div>
                ) : <input placeholder="Buscar lead..." value={leadSearch} onChange={e => setLeadSearch(e.target.value)} style={inp} />}
                {leads.length > 0 && !selectedLead && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#141420', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', zIndex: 10, marginTop: '4px' }}>
                    {leads.map(l => <div key={l.id} onClick={() => { setSelectedLead(l); setLeadSearch(''); setLeads([]) }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', color: '#F0ECE3', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{l.name} <span style={{ color: '#6b7280' }}>· {l.state}</span></div>)}
                  </div>
                )}
              </div>
              <select value={newType} onChange={e => setNewType(e.target.value)} style={inp}>
                <option value="followup">Seguimiento</option><option value="call">Llamada</option><option value="whatsapp">WhatsApp</option><option value="meeting">Reunión</option>
              </select>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inp} />
              <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={inp} />
            </div>
            <textarea placeholder="Nota o contexto..." value={newNote} onChange={e => setNewNote(e.target.value)} rows={2} style={{ ...inp, resize: 'none', marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 18px', borderRadius: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={createReminder} disabled={!newNote} style={{ padding: '8px 20px', borderRadius: '10px', background: newNote ? '#C9A84C' : 'rgba(201,168,76,0.3)', color: '#06070B', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Crear</button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[{ v: 'pending', l: 'Pendientes' }, { v: 'overdue', l: 'Vencidos' }, { v: 'all', l: 'Todos' }, { v: 'completed', l: 'Completados' }].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)} style={{
              padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: filter === f.v ? 700 : 400,
              fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.02em',
              background: filter === f.v ? 'rgba(201,168,76,0.08)' : 'transparent',
              border: filter === f.v ? '1px solid rgba(201,168,76,0.2)' : '1px solid rgba(255,255,255,0.06)',
              color: filter === f.v ? '#C9A84C' : 'rgba(240,236,227,0.4)',
            }}>{f.l}</button>
          ))}
        </div>

        {/* List */}
        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(240,236,227,0.3)' }}>Cargando...</div> :
        reminders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '16px', opacity: 0.2 }}>◦</div>
            <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '20px', color: 'rgba(240,236,227,0.25)', fontStyle: 'italic' }}>Sin recordatorios</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reminders.map(r => {
              const overdue = isOverdue(r)
              const sk = overdue ? 'overdue' : (r.status || 'pending')
              const sm = STATUS_META[sk] || STATUS_META.pending
              const timeLabel = fmtDate(r.scheduled_at || r.scheduled_for || r.created_at)

              return (
                <div key={r.id} style={{
                  padding: '16px 20px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.015)',
                  border: `1px solid ${overdue ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.04)'}`,
                  borderLeft: `3px solid ${sm.color}`,
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px',
                  transition: 'all 0.2s',
                  boxShadow: overdue ? `0 0 16px ${sm.glow}` : 'none',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)' }}>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#F0ECE3' }}>{r.lead_name || 'Sin lead'}</span>
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: `${sm.color}15`, color: sm.color, letterSpacing: '0.05em' }}>{sm.label}</span>
                      {r.type && <span style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', padding: '1px 6px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>{r.type}</span>}
                    </div>
                    {r.lead_phone && <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)', margin: '0 0 4px' }}>{r.lead_phone}</p>}
                    <p style={{ fontSize: '12px', color: overdue ? '#fca5a5' : 'rgba(201,168,76,0.6)', fontWeight: overdue ? 600 : 400, margin: 0 }}>{timeLabel}</p>
                    {(r.notes || r.message_text) && <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)', marginTop: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', lineHeight: 1.5, fontStyle: 'italic' }}>"{r.notes || r.message_text}"</p>}
                  </div>

                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {r.lead_phone && (
                        <a href={`https://wa.me/${r.lead_phone.replace(/\D/g, '')}`} target="_blank" style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textDecoration: 'none', background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.15)', color: '#4ade80', transition: 'all 0.15s' }}>WA</a>
                      )}
                      <button onClick={() => complete(r.id)} style={{ padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', color: '#6ee7b7', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s' }}>✓</button>
                      <button onClick={() => cancel(r.id)} style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#6b7280', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s' }}>✕</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
