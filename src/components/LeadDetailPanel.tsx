'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { C, STAGE_META, scoreColor } from '@/lib/design'

interface Props { lead: any; onClose: () => void; onStageUpdate?: (id: string, stage: string) => void }

type Mode = 'sophia' | 'manual' | 'coaching'

export default function LeadDetailPanel({ lead, onClose, onStageUpdate }: Props) {
  const [conversations, setConversations] = useState<any[]>([])
  const [mode, setMode] = useState<Mode>((lead.conversation_mode as Mode) || 'sophia')
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const [coaching, setCoaching] = useState<any>(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const [showAllConvos, setShowAllConvos] = useState(false)
  const [loseModal, setLoseModal] = useState(false)
  const [loseReason, setLoseReason] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (lead?.id) { loadConversations(); loadCoaching() } }, [lead?.id])
  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight) }, [conversations])

  async function loadConversations() {
    const { data } = await supabase.from('conversations').select('*').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(showAllConvos ? 50 : 12)
    setConversations(data || [])
  }

  async function loadCoaching() {
    const { data } = await supabase.from('coaching_sessions').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(1)
    if (data?.[0]) setCoaching(data[0])
  }

  async function changeMode(newMode: Mode) {
    setMode(newMode)
    await supabase.from('leads').update({ conversation_mode: newMode }).eq('id', lead.id)
  }

  async function sendAgentMessage() {
    if (!msgInput.trim() || sending) return
    setSending(true)
    try {
      await fetch('/api/agent-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, message: msgInput.trim() }),
      })
      setMsgInput('')
      setTimeout(loadConversations, 500)
    } catch {}
    setSending(false)
  }

  async function requestCoaching() {
    setCoachLoading(true)
    const lastInbound = conversations.filter(m => m.direction === 'inbound').pop()
    try {
      const res = await fetch('/api/coaching', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id, last_message: lastInbound?.message || '',
          conversation_history: conversations,
          lead_context: { name: lead.name, state: lead.state, family: lead.quiz_coverage_type, color: lead.favorite_color || lead.color_favorito, score: lead.score },
        }),
      })
      if (res.ok) { setCoaching(await res.json()); loadCoaching() }
    } catch {}
    setCoachLoading(false)
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

  const modeColors: Record<Mode, string> = { sophia: C.gold, manual: '#60a5fa', coaching: '#a855f7' }
  const modeLabels: Record<Mode, string> = { sophia: 'Sophia IA', manual: 'Manual', coaching: 'Coaching IA' }

  const heatColor = coaching?.heat?.score >= 80 ? '#34d399' : coaching?.heat?.score >= 50 ? '#fbbf24' : '#f87171'

  return (
    <div style={{ width: mode === 'coaching' ? '520px' : '420px', flexShrink: 0, background: C.surface, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', fontFamily: C.font, overflow: 'hidden', transition: 'width 0.3s' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: `linear-gradient(135deg, ${modeColors[mode]}, ${modeColors[mode]}80)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: '#07080A' }}>{lead.name?.charAt(0).toUpperCase()}</div>
            <div>
              <p style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: 0 }}>{lead.name}</p>
              <p style={{ color: C.textMuted, fontSize: '11px', margin: '2px 0 0' }}>{lead.phone} · {lead.state || '—'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
        </div>

        {/* Mode selector */}
        <div style={{ display: 'flex', gap: '4px', background: C.surface2, borderRadius: '10px', padding: '3px' }}>
          {(['sophia', 'manual', 'coaching'] as Mode[]).map(m => (
            <button key={m} onClick={() => changeMode(m)} style={{
              flex: 1, padding: '7px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: mode === m ? 700 : 400,
              fontFamily: C.font, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: mode === m ? `${modeColors[m]}18` : 'transparent',
              color: mode === m ? modeColors[m] : C.textMuted,
              boxShadow: mode === m ? `0 0 8px ${modeColors[m]}20` : 'none',
            }}>{modeLabels[m]}</button>
          ))}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
          <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 600, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}35` }}>{meta.label}</span>
          {lead.favorite_color && <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 600, background: 'rgba(201,168,76,0.1)', color: C.gold }}>🎨 {lead.favorite_color}</span>}
          <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 600, color: scoreColor(lead.score), background: `${scoreColor(lead.score)}15` }}>{lead.score} pts</span>
          {hoursInactive > 6 && <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 600, background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>{hoursInactive}h</span>}
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Chat column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Conversation bubbles */}
          <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {conversations.length === 0 ? (
              <p style={{ color: C.textMuted, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Sin mensajes</p>
            ) : conversations.map((msg, i) => {
              const isInbound = msg.direction === 'inbound'
              const isAgent = msg.ai_summary?.includes('agente') || msg.ai_summary?.includes('manualmente')
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isInbound ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '8px 12px', borderRadius: isInbound ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    background: isInbound ? 'rgba(96,165,250,0.12)' : isAgent ? 'rgba(168,85,247,0.1)' : 'rgba(201,168,76,0.1)',
                    border: `1px solid ${isInbound ? 'rgba(96,165,250,0.2)' : isAgent ? 'rgba(168,85,247,0.2)' : 'rgba(201,168,76,0.2)'}`,
                  }}>
                    {!isInbound && <p style={{ fontSize: '9px', fontWeight: 700, color: isAgent ? '#a855f7' : C.gold, margin: '0 0 2px' }}>{isAgent ? 'Agente' : 'Sophia'}</p>}
                    <p style={{ color: C.text, fontSize: '12px', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{msg.message}</p>
                    <p style={{ color: C.textMuted, fontSize: '8px', margin: '3px 0 0', textAlign: isInbound ? 'right' : 'left' }}>{new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <button onClick={() => { setShowAllConvos(!showAllConvos); setTimeout(loadConversations, 100) }} style={{ padding: '4px', background: 'transparent', border: 'none', color: C.gold, fontSize: '10px', cursor: 'pointer' }}>{showAllConvos ? '↑ Menos' : '↓ Ver todo'}</button>

          {/* Agent input (manual/coaching mode) */}
          {(mode === 'manual' || mode === 'coaching') && (
            <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px' }}>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAgentMessage()}
                placeholder="Escribe un mensaje..." style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', fontSize: '12px', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: 'none', fontFamily: C.font }} />
              <button onClick={sendAgentMessage} disabled={sending} style={{ padding: '9px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: modeColors[mode], color: '#07080A', border: 'none', opacity: sending ? 0.5 : 1 }}>
                {sending ? '...' : '→'}
              </button>
            </div>
          )}
        </div>

        {/* Coaching sidebar (only in coaching mode) */}
        {mode === 'coaching' && (
          <div style={{ width: '200px', borderLeft: `1px solid ${C.border}`, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>

            <button onClick={requestCoaching} disabled={coachLoading} style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
              {coachLoading ? 'Analizando...' : '🧠 Analizar ahora'}
            </button>

            {coaching && (
              <>
                {/* Heat meter */}
                <div style={{ padding: '10px', background: C.surface2, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>Temperatura</span>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: heatColor }}>{coaching.heat?.score || coaching.heat_score || 50}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${coaching.heat?.score || coaching.heat_score || 50}%`, background: heatColor, borderRadius: '2px', transition: 'width 0.5s' }} />
                  </div>
                  <p style={{ fontSize: '9px', color: C.textMuted, margin: '4px 0 0', textTransform: 'capitalize' }}>{coaching.heat?.fase || '—'}</p>
                </div>

                {/* Close signal */}
                {(coaching.heat?.momento_cierre || coaching.close_signal) && (
                  <div style={{ padding: '10px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '10px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', fontWeight: 800, color: C.gold, margin: 0 }}>PIDE LA LLAMADA</p>
                    <p style={{ fontSize: '9px', color: C.textDim, margin: '3px 0 0' }}>{coaching.heat?.razon || ''}</p>
                  </div>
                )}

                {/* Suggested response */}
                <div style={{ padding: '10px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: '10px' }}>
                  <p style={{ fontSize: '9px', fontWeight: 700, color: '#a855f7', margin: '0 0 4px', textTransform: 'uppercase' }}>Respuesta sugerida</p>
                  <p style={{ fontSize: '11px', color: C.text, lineHeight: 1.5, margin: '0 0 6px' }}>{coaching.suggested_response || '—'}</p>
                  <button onClick={() => setMsgInput(coaching.suggested_response || '')} style={{ width: '100%', padding: '5px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7' }}>Usar esta</button>
                </div>

                {/* Objection */}
                {(coaching.objection?.tiene_objecion || coaching.objection_detected?.tiene_objecion) && (
                  <div style={{ padding: '10px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: '10px' }}>
                    <p style={{ fontSize: '9px', fontWeight: 700, color: '#f87171', margin: '0 0 3px', textTransform: 'uppercase' }}>Objeción: {(coaching.objection || coaching.objection_detected)?.tipo}</p>
                    <p style={{ fontSize: '10px', color: C.textDim, margin: '0 0 4px' }}>{(coaching.objection || coaching.objection_detected)?.objecion_exacta}</p>
                    <p style={{ fontSize: '10px', color: '#34d399', margin: 0 }}>{(coaching.objection || coaching.objection_detected)?.respuesta_sugerida}</p>
                  </div>
                )}

                {/* Facts */}
                {(coaching.facts || coaching.relevant_facts) && (
                  <div style={{ padding: '10px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: '10px' }}>
                    <p style={{ fontSize: '9px', fontWeight: 700, color: '#34d399', margin: '0 0 4px', textTransform: 'uppercase' }}>Datos útiles</p>
                    <p style={{ fontSize: '10px', color: C.textDim, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{coaching.facts || coaching.relevant_facts}</p>
                  </div>
                )}
              </>
            )}

            {/* Cross-sell opportunities */}
            {products.length > 1 && (
              <div style={{ padding: '10px', background: C.surface2, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, margin: '0 0 4px', textTransform: 'uppercase' }}>Oportunidades</p>
                {products.slice(1).map((p: any, i: number) => (
                  <p key={i} style={{ fontSize: '10px', color: '#34d399', margin: '2px 0' }}>💰 {p.product}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button onClick={() => markClosed('closed_won')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>✓ Cerrado</button>
        <button onClick={() => setLoseModal(true)} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>✕ Perder</button>
        <a href={`https://wa.me/${lead.phone?.replace(/\D/g, '')}`} target="_blank" style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, textAlign: 'center', textDecoration: 'none', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>📱 WA</a>
      </div>

      {/* Lose modal */}
      {loseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLoseModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: '16px', padding: '24px', width: '320px' }}>
            <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>Motivo de pérdida</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              {['Precio', 'Ya tiene seguro', 'No califica', 'No responde', 'Otro'].map(r => (
                <button key={r} onClick={() => setLoseReason(r)} style={{ padding: '9px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: C.font, cursor: 'pointer', textAlign: 'left', background: loseReason === r ? 'rgba(248,113,113,0.12)' : C.surface2, border: `1px solid ${loseReason === r ? 'rgba(248,113,113,0.3)' : C.border}`, color: loseReason === r ? '#f87171' : C.textDim }}>{r}</button>
              ))}
            </div>
            <button onClick={() => loseReason && markClosed('closed_lost', loseReason)} disabled={!loseReason} style={{ width: '100%', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: loseReason ? '#f87171' : 'rgba(248,113,113,0.3)', color: 'white', border: 'none' }}>Confirmar</button>
          </div>
        </div>
      )}
    </div>
  )
}
