'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'
import EventModal from '@/components/EventModal'

const COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  lead_call: { bg: 'rgba(34,197,94,0.15)', border: '#22c55e', text: '#4ade80', label: 'Llamada lead' },
  urgent:    { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#f87171', label: 'Urgente' },
  personal:  { bg: 'rgba(167,139,250,0.15)', border: '#a78bfa', text: '#c4b5fd', label: 'Personal' },
  medical:   { bg: 'rgba(6,182,212,0.15)', border: '#06b6d4', text: '#67e8f9', label: 'Médica' },
  work:      { bg: 'rgba(201,168,76,0.15)', border: '#C9A84C', text: '#fde68a', label: 'Trabajo' },
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([])
  const [current, setCurrent] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [editEvent, setEditEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [showSheet, setShowSheet] = useState(false)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])

  const year = current.getFullYear()
  const month = current.getMonth()
  const today = new Date().toISOString().split('T')[0]

  const loadEvents = useCallback(async () => {
    setLoading(true)
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const { data } = await supabase.from('calendar_events').select('*').gte('start_time', start).lte('start_time', end).eq('status', 'scheduled').order('start_time')
    setEvents(data || [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { loadEvents() }, [loadEvents])

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function eventsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.start_time?.startsWith(dateStr))
  }

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const selectedDayEvents = selectedDate ? events.filter(e => e.start_time?.startsWith(selectedDate)) : events.filter(e => e.start_time?.startsWith(today))
  const monthName = current.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  function openMaps(provider: string, address: string) {
    const enc = encodeURIComponent(address)
    const urls: Record<string, string> = { google: `https://maps.google.com/?q=${enc}`, waze: `https://waze.com/ul?q=${enc}&navigate=yes`, apple: `http://maps.apple.com/?q=${enc}` }
    window.open(urls[provider], '_blank')
  }

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 700, margin: 0 }}>Agenda</h1>
          <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '4px', textTransform: 'capitalize' }}>{monthName}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setCurrent(new Date(year, month - 1))} style={{ padding: '8px 14px', borderRadius: '8px', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer', fontSize: '16px', fontFamily: C.font }}>←</button>
          <button onClick={() => setCurrent(new Date())} style={{ padding: '8px 14px', borderRadius: '8px', background: C.surface2, border: `1px solid ${C.border}`, color: C.gold, cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: C.font }}>Hoy</button>
          <button onClick={() => setCurrent(new Date(year, month + 1))} style={{ padding: '8px 14px', borderRadius: '8px', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer', fontSize: '16px', fontFamily: C.font }}>→</button>
          <button onClick={() => { setEditEvent(null); setShowModal(true) }} style={{ padding: '8px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #C9A84C, #8B6E2E)', color: '#07080A', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: C.font, marginLeft: '8px' }}>+ Evento</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.entries(COLORS).map(([k, v]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: v.text }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.border }} />{v.label}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '20px' }}>
        {/* Calendar grid */}
        <div style={{ flex: 1 }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
            {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '6px' }}>{d}</div>)}
          </div>

          {/* Cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} style={{ minHeight: '90px' }} />
              const ds = dateStr(day)
              const isToday = ds === today
              const isSelected = ds === selectedDate
              const dayEvents = eventsForDay(day)

              return (
                <div key={i} onClick={() => { setSelectedDate(ds); if (isMobile && dayEvents.length > 0) setShowSheet(true) }}
                  style={{
                    minHeight: isMobile ? '48px' : '90px', padding: isMobile ? '3px' : '6px', borderRadius: isMobile ? '8px' : '10px', cursor: 'pointer',
                    background: 'linear-gradient(145deg, #141420, #0e0e1a)',
                    border: isToday ? '1px solid rgba(201,168,76,0.4)' : isSelected ? '1px solid rgba(201,168,76,0.2)' : '1px solid rgba(255,255,255,0.05)',
                    boxShadow: isToday ? '0 0 12px rgba(201,168,76,0.15)' : 'none',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isToday) (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}>
                  <div style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: isToday ? 800 : 500, color: isToday ? C.gold : C.text, marginBottom: isMobile ? '2px' : '4px' }}>{day}</div>
                  {isMobile ? (
                    dayEvents.length > 0 && <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {dayEvents.slice(0, 3).map((ev, j) => { const col = COLORS[ev.event_type] || COLORS.work; return <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: col.border }} /> })}
                    </div>
                  ) : (
                    <>
                      {dayEvents.slice(0, 2).map((ev, j) => { const col = COLORS[ev.event_type] || COLORS.work; return <div key={j} style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '4px', background: col.bg, color: col.text, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `2px solid ${col.border}` }}>{ev.title}</div> })}
                      {dayEvents.length > 2 && <div style={{ fontSize: '8px', color: C.textMuted }}>+{dayEvents.length - 2} más</div>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Side panel — events for selected day */}
        <div style={{ width: isMobile ? '100%' : '300px', flexShrink: 0, display: isMobile ? 'none' : 'block' }}>
          <div style={{ background: 'linear-gradient(145deg, #141420, #0e0e1a)', border: `1px solid ${C.border}`, borderRadius: '16px', padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>
              {selectedDate ? new Date(selectedDate + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Hoy'}
            </h3>

            {selectedDayEvents.length === 0 ? (
              <p style={{ color: C.textMuted, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Sin eventos</p>
            ) : selectedDayEvents.map(ev => {
              const col = COLORS[ev.event_type] || COLORS.work
              const time = new Date(ev.start_time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={ev.id} onClick={() => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)}
                  style={{ padding: '10px 12px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', background: selectedEvent?.id === ev.id ? col.bg : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedEvent?.id === ev.id ? col.border + '50' : 'rgba(255,255,255,0.05)'}`, borderLeft: `3px solid ${col.border}`, transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: C.text }}>{ev.title}</span>
                    <span style={{ fontSize: '10px', color: col.text, fontWeight: 600 }}>{time}</span>
                  </div>
                  {ev.description && <p style={{ fontSize: '11px', color: C.textDim, margin: '0 0 4px' }}>{ev.description}</p>}
                  {ev.lead_name && <span style={{ fontSize: '10px', color: '#34d399' }}>👤 {ev.lead_name}</span>}

                  {/* Expanded detail */}
                  {selectedEvent?.id === ev.id && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
                      {/* Contact actions */}
                      {ev.lead_phone && (
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                          <a href={`https://wa.me/${ev.lead_phone.replace(/\D/g, '')}`} target="_blank" style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>WhatsApp</a>
                          <a href={`sms:+${ev.lead_phone.replace(/\D/g, '')}`} style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}>SMS</a>
                          <a href={`tel:+${ev.lead_phone.replace(/\D/g, '')}`} style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa' }}>Llamar</a>
                        </div>
                      )}

                      {/* Maps */}
                      {ev.location && (
                        <div style={{ marginBottom: '8px' }}>
                          <p style={{ fontSize: '10px', color: C.textMuted, margin: '0 0 4px' }}>📍 {ev.location}</p>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {['google', 'waze', 'apple'].map(p => (
                              <button key={p} onClick={() => openMaps(p, ev.location)} style={{ flex: 1, padding: '5px', borderRadius: '5px', fontSize: '9px', fontWeight: 600, fontFamily: C.font, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.textDim, textTransform: 'capitalize' }}>{p === 'google' ? 'Google Maps' : p === 'waze' ? 'Waze' : 'Apple Maps'}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setEditEvent(ev); setShowModal(true) }} style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, fontFamily: C.font, cursor: 'pointer', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: C.gold }}>Editar</button>
                        <button onClick={async () => { await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('id', ev.id); loadEvents(); setSelectedEvent(null) }} style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, fontFamily: C.font, cursor: 'pointer', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <button onClick={() => { setEditEvent(null); setShowModal(true) }} style={{ width: '100%', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, fontFamily: C.font, cursor: 'pointer', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: C.gold, marginTop: '8px' }}>+ Agregar evento</button>
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && showSheet && selectedDate && (
        <>
          <div onClick={() => setShowSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#141420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px 20px 0 0', padding: '20px', zIndex: 50, maxHeight: '60vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>{new Date(selectedDate + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            {selectedDayEvents.length === 0 ? <p style={{ color: C.textMuted, fontSize: 12, textAlign: 'center' }}>Sin eventos</p> : selectedDayEvents.map(ev => {
              const col = COLORS[ev.event_type] || COLORS.work
              const time = new Date(ev.start_time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={ev.id} style={{ padding: '12px', borderRadius: '10px', marginBottom: '8px', background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.06)`, borderLeft: `3px solid ${col.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{ev.title}</span>
                    <span style={{ fontSize: 11, color: col.text, fontWeight: 600 }}>{time}</span>
                  </div>
                  {ev.lead_name && <span style={{ fontSize: 11, color: '#34d399' }}>👤 {ev.lead_name}</span>}
                  {ev.lead_phone && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <a href={`https://wa.me/${ev.lead_phone.replace(/\D/g, '')}`} target="_blank" style={{ flex: 1, padding: 7, borderRadius: 6, fontSize: 11, fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>WhatsApp</a>
                      <a href={`tel:+${ev.lead_phone.replace(/\D/g, '')}`} style={{ flex: 1, padding: 7, borderRadius: 6, fontSize: 11, fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa' }}>Llamar</a>
                    </div>
                  )}
                  {ev.location && (
                    <button onClick={() => openMaps('google', ev.location)} style={{ width: '100%', marginTop: 6, padding: 7, borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: C.font, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.textDim }}>📍 {ev.location}</button>
                  )}
                </div>
              )
            })}
            <button onClick={() => setShowSheet(false)} style={{ width: '100%', marginTop: 8, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#9ca3af', fontSize: 12, cursor: 'pointer', fontFamily: C.font }}>Cerrar</button>
          </div>
        </>
      )}

      {showModal && <EventModal date={selectedDate || undefined} event={editEvent} onClose={() => { setShowModal(false); setEditEvent(null) }} onSaved={loadEvents} />}
    </div>
  )
}
