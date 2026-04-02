'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { C } from '@/lib/design'

const TYPES = [
  { value: 'lead_call', label: 'Llamada lead', color: '#22c55e' },
  { value: 'urgent', label: 'Urgente', color: '#ef4444' },
  { value: 'personal', label: 'Personal', color: '#a78bfa' },
  { value: 'medical', label: 'Médica', color: '#06b6d4' },
  { value: 'work', label: 'Trabajo', color: '#C9A84C' },
]

interface Props { date?: string; event?: any; onClose: () => void; onSaved: () => void }

export default function EventModal({ date, event, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [type, setType] = useState(event?.event_type || 'work')
  const [title, setTitle] = useState(event?.title || '')
  const [eventDate, setEventDate] = useState(date || event?.start_time?.split('T')[0] || new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState(event?.start_time ? new Date(event.start_time).toTimeString().slice(0, 5) : '09:00')
  const [endTime, setEndTime] = useState(event?.end_time ? new Date(event.end_time).toTimeString().slice(0, 5) : '09:30')
  const [desc, setDesc] = useState(event?.description || '')
  const [location, setLocation] = useState(event?.location || '')
  const [leadSearch, setLeadSearch] = useState('')
  const [leads, setLeads] = useState<any[]>([])
  const [selectedLead, setSelectedLead] = useState<any>(event?.lead_id ? { id: event.lead_id, name: event.lead_name } : null)
  const [notifyWA, setNotifyWA] = useState(event?.notify_whatsapp ?? true)
  const [notifySMS, setNotifySMS] = useState(event?.notify_sms ?? true)
  const [notifyMins, setNotifyMins] = useState(event?.notify_minutes_before ?? 30)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (leadSearch.length < 2 || !user) { setLeads([]); return }
    // Only search leads belonging to this user
    supabase.from('leads').select('id, name, phone, color_favorito, state').eq('agent_id', user.id).ilike('name', `%${leadSearch}%`).limit(5).then(({ data }) => setLeads(data || []))
  }, [leadSearch, user])

  async function save() {
    if (!title) return
    setSaving(true)
    const start = new Date(`${eventDate}T${startTime}`)
    const end = endTime ? new Date(`${eventDate}T${endTime}`) : null
    const color = TYPES.find(t => t.value === type)?.color || '#C9A84C'

    const payload = {
      title, event_type: type, start_time: start.toISOString(), end_time: end?.toISOString() || null,
      description: desc || null, location: location || null, color,
      lead_id: selectedLead?.id || null, lead_name: selectedLead?.name || null,
      lead_phone: selectedLead?.phone || null, lead_color: selectedLead?.color_favorito || null,
      notify_whatsapp: notifyWA, notify_sms: notifySMS, notify_minutes_before: notifyMins,
      created_via: 'crm', status: 'scheduled',
      agent_id: user?.id || null,
      account_id: user?.account_id || null,
    }

    if (event?.id) {
      // Only update own events
      let q = supabase.from('calendar_events').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', event.id)
      if (user) q = q.eq('agent_id', user.id)
      await q
    } else {
      await supabase.from('calendar_events').insert(payload)
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  const inp = { width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: 'none', fontFamily: C.font, boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: '16px', padding: '24px', width: '440px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ color: C.text, fontSize: '17px', fontWeight: 700, margin: '0 0 18px' }}>{event ? 'Editar evento' : 'Nuevo evento'}</h3>

        {/* Type */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <button key={t.value} onClick={() => setType(t.value)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: type === t.value ? 700 : 400, fontFamily: C.font, cursor: 'pointer', background: type === t.value ? `${t.color}20` : 'transparent', border: `1px solid ${type === t.value ? t.color + '50' : C.border}`, color: type === t.value ? t.color : C.textDim }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: t.color, marginRight: 6 }} />{t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input placeholder="Título del evento *" value={title} onChange={e => setTitle(e.target.value)} style={inp} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={{ ...inp, flex: 1 }} />
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inp, width: '110px' }} />
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inp, width: '110px' }} />
          </div>
          <textarea placeholder="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)} rows={2} style={{ ...inp, resize: 'none' }} />
          <input placeholder="Ubicación / dirección" value={location} onChange={e => setLocation(e.target.value)} style={inp} />

          {/* Lead search */}
          <div style={{ position: 'relative' }}>
            {selectedLead ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...inp, background: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.25)' }}>
                <span style={{ color: '#34d399', fontSize: '12px' }}>👤 {selectedLead.name}</span>
                <button onClick={() => { setSelectedLead(null); setLeadSearch('') }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '14px' }}>×</button>
              </div>
            ) : (
              <input placeholder="Buscar lead..." value={leadSearch} onChange={e => setLeadSearch(e.target.value)} style={inp} />
            )}
            {leads.length > 0 && !selectedLead && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '8px', zIndex: 10, marginTop: '4px', overflow: 'hidden' }}>
                {leads.map(l => (
                  <div key={l.id} onClick={() => { setSelectedLead(l); setLeadSearch(''); setLeads([]) }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', color: C.text, borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(201,168,76,0.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                    {l.name} <span style={{ color: C.textMuted }}>· {l.state || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div style={{ padding: '12px', background: C.surface2, borderRadius: '10px', border: `1px solid ${C.border}` }}>
            <p style={{ color: C.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Notificaciones</p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {[{ label: 'WhatsApp', val: notifyWA, set: setNotifyWA }, { label: 'SMS', val: notifySMS, set: setNotifySMS }].map(n => (
                <label key={n.label} onClick={() => n.set(!n.val)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: n.val ? C.text : C.textMuted }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${n.val ? C.gold : C.border}`, background: n.val ? C.gold : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#07080A' }}>{n.val ? '✓' : ''}</div>
                  {n.label}
                </label>
              ))}
              <select value={notifyMins} onChange={e => setNotifyMins(+e.target.value)} style={{ ...inp, width: 'auto', padding: '5px 8px', fontSize: '11px' }}>
                <option value={15}>15 min antes</option><option value={30}>30 min antes</option><option value={60}>1h antes</option><option value={120}>2h antes</option><option value={1440}>1 día antes</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '18px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim, fontSize: '13px', cursor: 'pointer', fontFamily: C.font }}>Cancelar</button>
          <button onClick={save} disabled={saving || !title} style={{ padding: '10px 24px', borderRadius: '10px', background: title ? 'linear-gradient(135deg, #C9A84C, #8B6E2E)' : 'rgba(201,168,76,0.3)', color: '#07080A', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: C.font }}>{saving ? 'Guardando...' : event ? 'Actualizar' : 'Crear evento'}</button>
        </div>
      </div>
    </div>
  )
}
