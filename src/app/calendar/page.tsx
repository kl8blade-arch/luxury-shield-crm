'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'
import EventModal from '@/components/EventModal'

const COLORS: Record<string, { bg: string; border: string; text: string; label: string; glow: string }> = {
  lead_call: { bg: 'rgba(34,197,94,0.08)', border: '#22c55e', text: '#6ee7b7', label: 'Llamada', glow: 'rgba(34,197,94,0.3)' },
  urgent:    { bg: 'rgba(239,68,68,0.08)', border: '#ef4444', text: '#fca5a5', label: 'Urgente', glow: 'rgba(239,68,68,0.3)' },
  personal:  { bg: 'rgba(167,139,250,0.08)', border: '#a78bfa', text: '#ddd6fe', label: 'Personal', glow: 'rgba(167,139,250,0.3)' },
  medical:   { bg: 'rgba(6,182,212,0.08)', border: '#06b6d4', text: '#a5f3fc', label: 'Médica', glow: 'rgba(6,182,212,0.3)' },
  work:      { bg: 'rgba(201,168,76,0.08)', border: '#C9A84C', text: '#fde68a', label: 'Trabajo', glow: 'rgba(201,168,76,0.3)' },
}

const DAYS = ['D', 'L', 'M', 'Mi', 'J', 'V', 'S']
const DAYS_FULL = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

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

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function eventsForDay(day: number) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.start_time?.startsWith(ds))
  }

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const selectedDayEvents = selectedDate ? events.filter(e => e.start_time?.startsWith(selectedDate)) : events.filter(e => e.start_time?.startsWith(today))
  const monthLabel = current.toLocaleDateString('es-ES', { month: 'long' })
  const totalEvents = events.length

  function openMaps(provider: string, address: string) {
    const enc = encodeURIComponent(address)
    const urls: Record<string, string> = { google: `https://maps.google.com/?q=${enc}`, waze: `https://waze.com/ul?q=${enc}&navigate=yes`, apple: `http://maps.apple.com/?q=${enc}` }
    window.open(urls[provider], '_blank')
  }

  return (
    <>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>

      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative', overflow: 'hidden' }}>

        {/* Ambient background glow */}
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(167,139,250,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* ── HEADER ── */}
        <div style={{ position: 'relative', marginBottom: isMobile ? '24px' : '36px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>AGENDA · {year}</p>
              <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '38px' : '52px', fontWeight: 400, color: '#F0ECE3', margin: 0, lineHeight: 1, textTransform: 'capitalize', letterSpacing: '-0.02em' }}>
                {monthLabel}
              </h1>
              <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.35)', marginTop: '8px' }}>
                {totalEvents} evento{totalEvents !== 1 ? 's' : ''} este mes
              </p>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button onClick={() => setCurrent(new Date(year, month - 1))} style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,236,227,0.5)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.08)'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)'; e.currentTarget.style.color = '#C9A84C' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(240,236,227,0.5)' }}>‹</button>
              <button onClick={() => setCurrent(new Date())} style={{ padding: '10px 18px', borderRadius: '12px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', color: '#C9A84C', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', letterSpacing: '0.05em', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.12)'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.06)'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.15)' }}>Hoy</button>
              <button onClick={() => setCurrent(new Date(year, month + 1))} style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,236,227,0.5)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.08)'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)'; e.currentTarget.style.color = '#C9A84C' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(240,236,227,0.5)' }}>›</button>
              <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.06)', margin: '0 6px' }} />
              <button onClick={() => { setEditEvent(null); setShowModal(true) }} style={{ padding: '10px 22px', borderRadius: '12px', background: 'linear-gradient(135deg, #C9A84C 0%, #A8893A 100%)', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em', boxShadow: '0 4px 20px rgba(201,168,76,0.25), inset 0 1px 0 rgba(255,255,255,0.15)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,168,76,0.25), inset 0 1px 0 rgba(255,255,255,0.15)' }}>+ Nuevo evento</button>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '20px', flexWrap: 'wrap' }}>
            {Object.entries(COLORS).map(([k, v]) => (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 500, color: 'rgba(240,236,227,0.4)', letterSpacing: '0.03em' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.border, boxShadow: `0 0 6px ${v.glow}` }} />{v.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── MAIN LAYOUT ── */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '16px' : '24px', position: 'relative' }}>

          {/* Calendar Grid */}
          <div style={{ flex: 1 }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? '3px' : '5px', marginBottom: isMobile ? '3px' : '5px' }}>
              {(isMobile ? DAYS : DAYS_FULL).map((d, i) => (
                <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: i === 0 || i === 6 ? 'rgba(201,168,76,0.3)' : 'rgba(240,236,227,0.2)', padding: '8px 0' }}>{d}</div>
              ))}
            </div>

            {/* Cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? '3px' : '5px' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} style={{ minHeight: isMobile ? '44px' : '88px', borderRadius: '10px', background: 'rgba(255,255,255,0.008)' }} />
                const ds = dateStr(day)
                const isToday = ds === today
                const isSelected = ds === selectedDate
                const dayEvents = eventsForDay(day)
                const isWeekend = (firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6

                return (
                  <div key={i} onClick={() => { setSelectedDate(ds); setSelectedEvent(null); if (isMobile && dayEvents.length > 0) setShowSheet(true) }}
                    style={{
                      minHeight: isMobile ? '44px' : '88px',
                      padding: isMobile ? '4px' : '8px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      position: 'relative',
                      background: isToday ? 'rgba(201,168,76,0.06)' : isSelected ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.012)',
                      border: isToday ? '1px solid rgba(201,168,76,0.25)' : isSelected ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.03)',
                      boxShadow: isToday ? '0 0 20px rgba(201,168,76,0.08), inset 0 1px 0 rgba(201,168,76,0.1)' : 'inset 0 1px 0 rgba(255,255,255,0.02)',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={e => { const el = e.currentTarget; if (!isToday) { el.style.background = 'rgba(255,255,255,0.035)'; el.style.borderColor = 'rgba(255,255,255,0.08)'; el.style.transform = 'translateY(-1px)' } }}
                    onMouseLeave={e => { const el = e.currentTarget; if (!isToday) { el.style.background = isSelected ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.012)'; el.style.borderColor = isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'; el.style.transform = 'translateY(0)' } }}>

                    {/* Day number */}
                    <div style={{
                      fontSize: isMobile ? '12px' : '14px',
                      fontWeight: isToday ? 800 : 500,
                      color: isToday ? '#C9A84C' : isWeekend ? 'rgba(240,236,227,0.3)' : 'rgba(240,236,227,0.7)',
                      marginBottom: isMobile ? '1px' : '6px',
                      fontFamily: isToday ? '"DM Serif Display",serif' : 'inherit',
                    }}>{day}</div>

                    {/* Events */}
                    {isMobile ? (
                      dayEvents.length > 0 && (
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                          {dayEvents.slice(0, 3).map((ev, j) => {
                            const col = COLORS[ev.event_type] || COLORS.work
                            return <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: col.border, boxShadow: `0 0 4px ${col.glow}` }} />
                          })}
                        </div>
                      )
                    ) : (
                      <>
                        {dayEvents.slice(0, 2).map((ev, j) => {
                          const col = COLORS[ev.event_type] || COLORS.work
                          return (
                            <div key={j} style={{
                              fontSize: '10px', fontWeight: 500,
                              padding: '3px 6px', borderRadius: '5px',
                              background: col.bg, color: col.text,
                              marginBottom: '3px',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              borderLeft: `2px solid ${col.border}`,
                              backdropFilter: 'blur(4px)',
                            }}>{ev.title}</div>
                          )
                        })}
                        {dayEvents.length > 2 && <div style={{ fontSize: '9px', color: 'rgba(201,168,76,0.5)', fontWeight: 600, paddingLeft: '2px' }}>+{dayEvents.length - 2}</div>}
                      </>
                    )}

                    {/* Today gold line */}
                    {isToday && <div style={{ position: 'absolute', bottom: 0, left: '15%', right: '15%', height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', borderRadius: '1px' }} />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── SIDE PANEL ── */}
          {!isMobile && (
            <div style={{ width: '320px', flexShrink: 0 }}>
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '20px',
                padding: '24px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 12px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                position: 'sticky', top: '20px',
              }}>
                {/* Selected day header */}
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(201,168,76,0.5)', marginBottom: '6px' }}>
                    {selectedDate ? new Date(selectedDate + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase() : 'HOY'}
                  </p>
                  <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '28px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>
                    {selectedDate ? new Date(selectedDate + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                  </h2>
                </div>

                {/* Separator */}
                <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(201,168,76,0.2), transparent)', marginBottom: '20px' }} />

                {/* Events */}
                {selectedDayEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>◦</div>
                    <p style={{ color: 'rgba(240,236,227,0.25)', fontSize: '13px', fontWeight: 300, fontStyle: 'italic' }}>Sin eventos programados</p>
                    <button onClick={() => { setEditEvent(null); setShowModal(true) }} style={{ marginTop: '16px', padding: '8px 20px', borderRadius: '10px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', color: '#C9A84C', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>+ Crear evento</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedDayEvents.map(ev => {
                      const col = COLORS[ev.event_type] || COLORS.work
                      const time = new Date(ev.start_time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                      const isExpanded = selectedEvent?.id === ev.id

                      return (
                        <div key={ev.id} onClick={() => setSelectedEvent(isExpanded ? null : ev)}
                          style={{
                            padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
                            background: isExpanded ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
                            border: `1px solid ${isExpanded ? col.border + '30' : 'rgba(255,255,255,0.04)'}`,
                            borderLeft: `3px solid ${col.border}`,
                            boxShadow: isExpanded ? `0 4px 20px rgba(0,0,0,0.3), 0 0 12px ${col.glow}` : 'none',
                            transition: 'all 0.25s ease',
                          }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F0ECE3', lineHeight: 1.3 }}>{ev.title}</span>
                            <span style={{ fontSize: '11px', color: col.text, fontWeight: 600, fontFamily: '"DM Serif Display",serif', flexShrink: 0, marginLeft: '8px' }}>{time}</span>
                          </div>
                          {ev.description && <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)', margin: '2px 0 0', lineHeight: 1.4 }}>{ev.description}</p>}
                          {ev.lead_name && <div style={{ marginTop: '6px', fontSize: '11px', color: '#6ee7b7', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e' }} />{ev.lead_name}</div>}

                          {isExpanded && (
                            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              {ev.lead_phone && (
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                  <a href={`https://wa.me/${ev.lead_phone.replace(/\D/g, '')}`} target="_blank" style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', color: '#4ade80', transition: 'all 0.15s' }}>WhatsApp</a>
                                  <a href={`sms:+${ev.lead_phone.replace(/\D/g, '')}`} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#93c5fd', transition: 'all 0.15s' }}>SMS</a>
                                  <a href={`tel:+${ev.lead_phone.replace(/\D/g, '')}`} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#c4b5fd', transition: 'all 0.15s' }}>Llamar</a>
                                </div>
                              )}
                              {ev.location && (
                                <div style={{ marginBottom: '10px' }}>
                                  <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)', margin: '0 0 6px', fontStyle: 'italic' }}>📍 {ev.location}</p>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    {[{ k: 'google', l: 'Google Maps' }, { k: 'waze', l: 'Waze' }, { k: 'apple', l: 'Apple' }].map(p => (
                                      <button key={p.k} onClick={e => { e.stopPropagation(); openMaps(p.k, ev.location) }} style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '9px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(240,236,227,0.4)', transition: 'all 0.15s' }}>{p.l}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={e => { e.stopPropagation(); setEditEvent(ev); setShowModal(true) }} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', color: '#C9A84C' }}>Editar</button>
                                <button onClick={async e => { e.stopPropagation(); await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('id', ev.id); loadEvents(); setSelectedEvent(null) }} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5' }}>Cancelar</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── MOBILE BOTTOM SHEET ── */}
        {isMobile && showSheet && selectedDate && (
          <>
            <div onClick={() => setShowSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 49 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(180deg, #16161F 0%, #0D0D14 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px 24px 0 0', padding: '20px', zIndex: 50, maxHeight: '65vh', overflowY: 'auto', boxShadow: '0 -12px 48px rgba(0,0,0,0.6)' }}>
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 18px' }} />
              <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '20px', color: '#F0ECE3', marginBottom: '16px' }}>
                {new Date(selectedDate + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              {selectedDayEvents.length === 0 ? <p style={{ color: 'rgba(240,236,227,0.3)', fontSize: 13, textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>Sin eventos</p> : selectedDayEvents.map(ev => {
                const col = COLORS[ev.event_type] || COLORS.work
                const time = new Date(ev.start_time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={ev.id} style={{ padding: '14px', borderRadius: '14px', marginBottom: '10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: `3px solid ${col.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#F0ECE3' }}>{ev.title}</span>
                      <span style={{ fontSize: 12, color: col.text, fontWeight: 600, fontFamily: '"DM Serif Display",serif' }}>{time}</span>
                    </div>
                    {ev.lead_name && <div style={{ fontSize: 12, color: '#6ee7b7', marginBottom: 8 }}>👤 {ev.lead_name}</div>}
                    {ev.lead_phone && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <a href={`https://wa.me/${ev.lead_phone.replace(/\D/g, '')}`} target="_blank" style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', color: '#4ade80' }}>WhatsApp</a>
                        <a href={`tel:+${ev.lead_phone.replace(/\D/g, '')}`} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#c4b5fd' }}>Llamar</a>
                      </div>
                    )}
                    {ev.location && <button onClick={() => openMaps('google', ev.location)} style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(240,236,227,0.4)' }}>📍 {ev.location}</button>}
                  </div>
                )
              })}
              <button onClick={() => setShowSheet(false)} style={{ width: '100%', marginTop: 8, padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: 'rgba(240,236,227,0.35)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
            </div>
          </>
        )}

        {showModal && <EventModal date={selectedDate || undefined} event={editEvent} onClose={() => { setShowModal(false); setEditEvent(null) }} onSaved={loadEvents} />}
      </div>
    </>
  )
}
