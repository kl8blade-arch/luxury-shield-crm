'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C, fmtDateTime } from '@/lib/design'
import { Reminder } from '@/types'

const TYPE_ICON: Record<string, string> = { call: '📞', whatsapp: '💬', email: '📧', meeting: '👥', followup: '🔄' }
const TYPE_LABEL: Record<string, string> = { call: 'Llamada', whatsapp: 'WhatsApp', email: 'Email', meeting: 'Reunión', followup: 'Seguimiento' }
const STATUS_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  label: 'Pendiente'  },
  completed: { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  label: 'Completado' },
  cancelled: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Cancelado'  },
  overdue:   { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)',  label: 'Vencido'    },
}

const FILTERS = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'all', label: 'Todos' },
  { value: 'completed', label: 'Completados' },
  { value: 'cancelled', label: 'Cancelados' },
]

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    let q = supabase.from('reminders').select('*').order('scheduled_at')
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setReminders(data || [])
    setLoading(false)
  }

  async function complete(id: string) {
    await supabase.from('reminders').update({ status: 'completed' }).eq('id', id)
    setReminders(p => p.map(r => r.id === id ? { ...r, status: 'completed' } : r))
  }

  async function cancel(id: string) {
    await supabase.from('reminders').update({ status: 'cancelled' }).eq('id', id)
    setReminders(p => p.map(r => r.id === id ? { ...r, status: 'cancelled' } : r))
  }

  const isOverdue = (r: Reminder) => r.status === 'pending' && new Date(r.scheduled_at) < new Date()

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>Recordatorios</h1>
          <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '5px' }}>{reminders.length} recordatorio{reminders.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              style={{ padding: '8px 16px', borderRadius: '10px', border: filter === f.value ? '1px solid rgba(201,168,76,0.3)' : `1px solid ${C.border}`, background: filter === f.value ? 'rgba(201,168,76,0.1)' : 'transparent', color: filter === f.value ? C.goldBright : C.textMuted, fontSize: '12px', fontWeight: filter === f.value ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: C.textMuted }}>Cargando...</div>
        ) : reminders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.5 }}>🔔</div>
            <p style={{ color: C.text, fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Sin recordatorios</p>
            <p style={{ color: C.textMuted, fontSize: '13px' }}>Los recordatorios aparecerán aquí cuando los crees desde un lead.</p>
          </div>
        ) : reminders.map(r => {
          const overdue = isOverdue(r)
          const statusKey = overdue ? 'overdue' : r.status
          const sm = STATUS_META[statusKey]
          return (
            <div key={r.id} style={{ background: C.surface, border: `1px solid ${overdue ? 'rgba(249,115,22,0.3)' : C.border}`, borderRadius: '16px', padding: '18px 22px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: 0 }}>
                {/* Icon */}
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: overdue ? 'rgba(249,115,22,0.1)' : C.surface2, border: `1px solid ${overdue ? 'rgba(249,115,22,0.25)' : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  {TYPE_ICON[r.type] || '📌'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' }}>
                    <p style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: 0 }}>{r.lead_name}</p>
                    <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '100px', fontSize: '10px', fontWeight: 700, background: sm.bg, border: `1px solid ${sm.border}`, color: sm.color }}>
                      {sm.label}
                    </span>
                    <span style={{ color: C.textMuted, fontSize: '11px', background: C.surface2, padding: '2px 8px', borderRadius: '100px', border: `1px solid ${C.border}` }}>
                      {TYPE_LABEL[r.type]}
                    </span>
                  </div>
                  <p style={{ color: C.textDim, fontSize: '12px', margin: '0 0 6px' }}>{r.lead_phone}</p>
                  <p style={{ color: overdue ? '#f97316' : C.textMuted, fontSize: '12px', fontWeight: overdue ? 600 : 400, margin: 0 }}>
                    🕐 {fmtDateTime(r.scheduled_at)}
                  </p>
                  {r.ai_context && (
                    <p style={{ color: C.textMuted, fontSize: '12px', marginTop: '10px', background: C.surface2, padding: '10px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, fontStyle: 'italic', lineHeight: 1.6 }}>
                      "{r.ai_context}"
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => complete(r.id)}
                    style={{ padding: '8px 14px', borderRadius: '9px', cursor: 'pointer', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399', fontSize: '12px', fontWeight: 700, transition: 'all 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(52,211,153,0.18)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(52,211,153,0.1)'}
                  >✓ Completar</button>
                  <button onClick={() => cancel(r.id)}
                    style={{ padding: '8px 14px', borderRadius: '9px', cursor: 'pointer', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontSize: '12px', fontWeight: 700, transition: 'all 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.15)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.08)'}
                  >✕ Cancelar</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
