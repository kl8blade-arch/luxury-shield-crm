'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C, STAGE_META, scoreColor } from '@/lib/design'

interface Props {
  lead: any
  onClose: () => void
  onStageUpdate?: (id: string, stage: string) => void
}

export default function LeadDetailPanel({ lead, onClose, onStageUpdate }: Props) {
  const [conversations, setConversations] = useState<any[]>([])
  const [reconnectMsg, setReconnectMsg] = useState('')
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [showAllConvos, setShowAllConvos] = useState(false)
  const [loseModal, setLoseModal] = useState(false)
  const [loseReason, setLoseReason] = useState('')

  useEffect(() => {
    if (!lead?.id) return
    loadConversations()
    generateReconnectMessage()
  }, [lead?.id])

  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true })
      .limit(showAllConvos ? 50 : 8)
    setConversations(data || [])
  }

  async function generateReconnectMessage() {
    setLoadingMsg(true)
    try {
      const hoursInactive = Math.round((Date.now() - new Date(lead.updated_at).getTime()) / 3600000)
      const { data: lastMsg } = await supabase
        .from('conversations')
        .select('message')
        .eq('lead_id', lead.id)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const res = await fetch('/api/business-health') // just to test endpoint availability
      // Generate via a simple template since we can't call Claude from client
      const name = lead.name?.split(' ')[0] || ''
      const color = lead.favorite_color || lead.color_favorito || ''
      const msgs = [
        `Hola ${name} 😊 Solo quería saber cómo estás. ¿Tuviste oportunidad de pensar en lo de tu plan de protección?`,
        `${name}, me quedé pensando en nuestra conversación. ¿Hay algo que te genere duda? Con gusto te aclaro 💙`,
        `Hola ${name}! Quería contarte que hay beneficios nuevos disponibles en ${lead.state || 'tu estado'}. ¿Tienes un momento?`,
      ]
      const msg = msgs[Math.floor(Math.random() * msgs.length)] + (color ? `\n\nRecuerda: tu color de seguridad es *${color}* 🎨` : '')
      setReconnectMsg(msg)
    } catch {}
    setLoadingMsg(false)
  }

  async function sendReconnect() {
    if (!reconnectMsg || sending) return
    setSending(true)
    try {
      // Send via WhatsApp webhook simulation
      const phone = lead.phone.startsWith('+') ? lead.phone : `+${lead.phone.replace(/\D/g, '')}`
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          From: `whatsapp:${phone}`,
          Body: '__ADMIN_SEND__' + reconnectMsg,
        }).toString(),
      })
      // Direct Twilio send would be better, but this works for now
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch {}
    setSending(false)
  }

  async function markClosed(stage: string, reason?: string) {
    const updates: any = { stage, fecha_cierre: new Date().toISOString(), resultado_final: stage === 'closed_won' ? 'vendido' : 'perdido' }
    if (reason) updates.agente_feedback = { ...(lead.agente_feedback || {}), motivo_perdida: reason, fecha_reporte: new Date().toISOString() }
    await supabase.from('leads').update(updates).eq('id', lead.id)
    onStageUpdate?.(lead.id, stage)
    setLoseModal(false)
  }

  const meta = STAGE_META[lead.stage] || STAGE_META.unqualified
  const hoursInactive = Math.round((Date.now() - new Date(lead.updated_at || lead.created_at).getTime()) / 3600000)
  const products = (lead.product_opportunities || []) as any[]
  const feedback = lead.agente_feedback as any

  return (
    <div style={{ width: '420px', flexShrink: 0, background: C.surface, borderLeft: `1px solid ${C.border}`, overflowY: 'auto', display: 'flex', flexDirection: 'column', fontFamily: C.font }}>

      {/* Header */}
      <div style={{ padding: '20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #8B6E2E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#07080A' }}>
              {lead.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: 0 }}>{lead.name}</p>
              <p style={{ color: C.textMuted, fontSize: '12px', margin: '2px 0 0' }}>{lead.phone} · {lead.state || '—'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}35` }}>{meta.label}</span>
          <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>{lead.insurance_type || 'Dental'}</span>
          {lead.favorite_color && <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: 'rgba(201,168,76,0.1)', color: C.gold, border: '1px solid rgba(201,168,76,0.25)' }}>🎨 {lead.favorite_color}</span>}
          {hoursInactive > 6 && <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>{hoursInactive}h inactivo</span>}
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>

        {/* Score + Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: scoreColor(lead.score), fontWeight: 800, fontSize: '28px' }}>{lead.score}</span>
            <p style={{ color: C.textMuted, fontSize: '9px', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Score</p>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            {[
              { label: 'Familia', value: lead.quiz_coverage_type || (lead.dependents ? `${lead.dependents} personas` : '—') },
              { label: 'Seguro', value: lead.has_insurance ? 'Sí tiene' : 'No tiene' },
              { label: 'Dentista', value: lead.quiz_dentist_last_visit || '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px' }}>
                <p style={{ color: C.textMuted, fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px' }}>{label}</p>
                <p style={{ color: C.text, fontSize: '11px', fontWeight: 500, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Conversation bubbles */}
        <div>
          <p style={{ color: C.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 10px' }}>Conversación con Sophia</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: showAllConvos ? '500px' : '280px', overflowY: 'auto', padding: '4px' }}>
            {conversations.length === 0 ? (
              <p style={{ color: C.textMuted, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Sin mensajes aún</p>
            ) : conversations.map((msg, i) => {
              const isInbound = msg.direction === 'inbound'
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isInbound ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '10px 14px', borderRadius: isInbound ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isInbound ? 'rgba(96,165,250,0.12)' : 'rgba(201,168,76,0.1)',
                    border: `1px solid ${isInbound ? 'rgba(96,165,250,0.2)' : 'rgba(201,168,76,0.2)'}`,
                  }}>
                    <p style={{ color: C.text, fontSize: '12px', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{msg.message}</p>
                    <p style={{ color: C.textMuted, fontSize: '9px', margin: '4px 0 0', textAlign: isInbound ? 'right' : 'left' }}>
                      {new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={() => { setShowAllConvos(!showAllConvos); setTimeout(loadConversations, 100) }} style={{ width: '100%', padding: '6px', background: 'transparent', border: 'none', color: C.gold, fontSize: '11px', cursor: 'pointer', marginTop: '6px' }}>
            {showAllConvos ? 'Mostrar menos ↑' : 'Ver conversación completa ↓'}
          </button>
        </div>

        {/* Objeciones + Oportunidades */}
        {(feedback?.motivo_perdida || products.length > 1) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {feedback?.motivo_perdida && <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: 600, background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>Objeción: {feedback.motivo_perdida}</span>}
            {products.slice(1).map((p: any, i: number) => (
              <span key={i} style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: 600, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>💰 {p.product}</span>
            ))}
          </div>
        )}

        {/* Reconnection message */}
        <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: '12px', padding: '14px' }}>
          <p style={{ color: C.gold, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Mensaje sugerido</p>
          {loadingMsg ? <p style={{ color: C.textMuted, fontSize: '12px' }}>Generando...</p> : (
            <>
              <p style={{ color: C.text, fontSize: '12px', lineHeight: 1.6, margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>{reconnectMsg}</p>
              <button onClick={sendReconnect} disabled={sending || sent} style={{
                width: '100%', padding: '10px', borderRadius: '10px', cursor: sending ? 'wait' : 'pointer',
                fontFamily: C.font, fontSize: '12px', fontWeight: 700,
                background: sent ? 'rgba(52,211,153,0.15)' : 'linear-gradient(135deg, #25D366, #128C7E)',
                color: sent ? '#34d399' : 'white', border: sent ? '1px solid rgba(52,211,153,0.3)' : 'none',
              }}>{sending ? 'Enviando...' : sent ? '✓ Enviado' : '📱 Enviar por WhatsApp'}</button>
            </>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={() => markClosed('closed_won')} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>✓ Cerrado</button>
        <button onClick={() => setLoseModal(true)} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>✕ Perder</button>
        <a href={`https://wa.me/${lead.phone?.replace(/\D/g, '')}`} target="_blank" style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, textAlign: 'center', textDecoration: 'none', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>📱 WhatsApp</a>
      </div>

      {/* Lose modal */}
      {loseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLoseModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: '16px', padding: '24px', width: '340px' }}>
            <h3 style={{ color: C.text, fontSize: '16px', fontWeight: 700, margin: '0 0 16px' }}>Motivo de pérdida</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {['Precio', 'Ya tiene seguro', 'No califica', 'No responde', 'Otro'].map(r => (
                <button key={r} onClick={() => setLoseReason(r)} style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontFamily: C.font, cursor: 'pointer', textAlign: 'left', background: loseReason === r ? 'rgba(248,113,113,0.12)' : C.surface2, border: `1px solid ${loseReason === r ? 'rgba(248,113,113,0.3)' : C.border}`, color: loseReason === r ? '#f87171' : C.textDim }}>{r}</button>
              ))}
            </div>
            <button onClick={() => loseReason && markClosed('closed_lost', loseReason)} disabled={!loseReason} style={{ width: '100%', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: loseReason ? '#f87171' : 'rgba(248,113,113,0.3)', color: 'white', border: 'none' }}>Confirmar pérdida</button>
          </div>
        </div>
      )}
    </div>
  )
}
