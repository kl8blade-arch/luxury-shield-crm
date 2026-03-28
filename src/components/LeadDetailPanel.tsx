'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { C, STAGE_META, scoreColor } from '@/lib/design'

interface Props { lead: any; onClose: () => void; onStageUpdate?: (id: string, stage: string) => void }
type Mode = 'sophia' | 'manual'

function getTempColor(s: number) { return s >= 85 ? '#ef4444' : s >= 70 ? '#f59e0b' : s >= 50 ? '#22c55e' : '#3b82f6' }
function getTempLabel(s: number) { return s >= 90 ? 'Listo para cerrar' : s >= 75 ? 'Muy caliente' : s >= 60 ? 'Caliente' : s >= 40 ? 'Tibio' : 'Frío' }
function getTempPhase(s: number) { return s >= 90 ? 5 : s >= 75 ? 4 : s >= 60 ? 3 : s >= 45 ? 2 : s >= 25 ? 1 : 0 }

const PHASES = ['Frío', 'Conectando', 'Calificado', 'Interesado', 'Caliente', 'Listo']

export default function LeadDetailPanel({ lead, onClose, onStageUpdate }: Props) {
  const [conversations, setConversations] = useState<any[]>([])
  const [mode, setMode] = useState<Mode>((lead.conversation_mode === 'coaching' ? 'manual' : lead.conversation_mode as Mode) || 'sophia')
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const [coaching, setCoaching] = useState<any>(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachEnabled, setCoachEnabled] = useState(() => { try { return localStorage.getItem('coaching_enabled') !== 'false' } catch { return true } })
  const [lastProcessedMsgId, setLastProcessedMsgId] = useState<string | null>(null)
  const [heatScore, setHeatScore] = useState(lead.score || 50)
  const [showAllConvos, setShowAllConvos] = useState(false)
  const [loseModal, setLoseModal] = useState(false)
  const [loseReason, setLoseReason] = useState('')
  const [coachMessages, setCoachMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: `Listo. Conozco toda la conversación con ${lead.name || 'el lead'}. Score: ${lead.score || 50}/100. ¿En qué te ayudo?` }
  ])
  const [coachInput, setCoachInput] = useState('')
  const [coachChatLoading, setCoachChatLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [tick, setTick] = useState(0)
  const chatRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const coachChatRef = useRef<HTMLDivElement>(null)
  const lastMsgIdRef = useRef<string | null>(null)
  const coachEnabledRef = useRef(coachEnabled)

  const products = (lead.product_opportunities || []) as any[]
  const meta = STAGE_META[lead.stage] || STAGE_META.unqualified
  const hoursInactive = Math.round((Date.now() - new Date(lead.updated_at || lead.created_at).getTime()) / 3600000)
  const showCoachPanel = coachEnabled // Independent of mode
  const currentPhase = getTempPhase(heatScore)

  // Keep ref in sync
  useEffect(() => { coachEnabledRef.current = coachEnabled }, [coachEnabled])

  // Stable message loader
  const loadMessages = useCallback(async () => {
    if (!lead?.id) return
    const { data: msgs } = await supabase.from('conversations').select('*').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(50)
    if (!msgs?.length) return

    const lastMsg = msgs[msgs.length - 1]
    if (lastMsg.id !== lastMsgIdRef.current) {
      lastMsgIdRef.current = lastMsg.id
      setConversations(msgs)
      setLastUpdated(new Date())
      setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, 100)

      // Trigger coaching on new inbound
      if (lastMsg.direction === 'inbound' && coachEnabledRef.current) {
        triggerCoaching(lastMsg.message)
      }
    }
  }, [lead?.id])

  // Initial load
  useEffect(() => { if (lead?.id) { loadMessages(); loadLatestCoaching() } }, [lead?.id, loadMessages])

  // Persist coaching preference
  useEffect(() => { try { localStorage.setItem('coaching_enabled', String(coachEnabled)) } catch {} }, [coachEnabled])

  // Polling every 2.5s — stable, no stale closures
  useEffect(() => {
    if (!lead?.id) return
    const interval = setInterval(loadMessages, 2500)
    return () => clearInterval(interval)
  }, [lead?.id, loadMessages])

  // Tick counter for live indicator
  useEffect(() => {
    const t = setInterval(() => setTick(c => c + 1), 1000)
    return () => clearInterval(t)
  }, [])

  async function loadLatestCoaching() {
    const { data } = await supabase.from('coaching_sessions').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(1)
    if (data?.[0]) { setCoaching(data[0]); setHeatScore(data[0].heat_score || lead.score || 50) }
  }

  async function triggerCoaching(lastMessage: string) {
    setCoachLoading(true)
    try {
      const res = await fetch('/api/coaching', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id, last_message: lastMessage,
          conversation_history: conversations,
          lead_context: { name: lead.name, state: lead.state, family: lead.quiz_coverage_type, color: lead.favorite_color || lead.color_favorito, score: lead.score },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setCoaching(data)
        setHeatScore(data.heat?.score || data.heat_score || heatScore)
      }
    } catch {}
    setCoachLoading(false)
  }

  async function changeMode(newMode: Mode) {
    setMode(newMode)
    const dbMode = newMode === 'manual' && coachEnabled ? 'coaching' : newMode
    await supabase.from('leads').update({ conversation_mode: dbMode }).eq('id', lead.id)
  }

  async function sendAgentMessage() {
    if (!msgInput.trim() || sending) return
    setSending(true)
    try {
      await fetch('/api/agent-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: lead.id, message: msgInput.trim() }) })
      setMsgInput('')
      setTimeout(loadMessages, 500)
    } catch {}
    setSending(false)
  }

  async function askCoach(question: string) {
    if (!question.trim() || coachChatLoading) return
    const updated = [...coachMessages, { role: 'user', content: question }]
    setCoachMessages(updated)
    setCoachInput('')
    setCoachChatLoading(true)
    try {
      const { data: hist } = await supabase.from('conversations').select('direction, message, created_at').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(30)
      const res = await fetch('/api/coach-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question, coach_history: updated,
          lead_context: { lead_id: lead.id, name: lead.name, state: lead.state, family: lead.quiz_coverage_type, last_dentist: lead.quiz_dentist_last_visit, has_insurance: lead.quiz_has_insurance, color: lead.favorite_color || lead.color_favorito, score: lead.score, stage: lead.stage, hours_inactive: hoursInactive, product_opportunities: lead.product_opportunities },
          conversation_history: hist || [],
        }),
      })
      const data = await res.json()
      setCoachMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch { setCoachMessages(prev => [...prev, { role: 'assistant', content: 'Error al consultar. Intenta de nuevo.' }]) }
    setCoachChatLoading(false)
  }

  useEffect(() => { coachChatRef.current?.scrollTo(0, coachChatRef.current.scrollHeight) }, [coachMessages])

  async function markClosed(stage: string, reason?: string) {
    const updates: any = { stage, fecha_cierre: new Date().toISOString(), resultado_final: stage === 'closed_won' ? 'vendido' : 'perdido' }
    if (reason) updates.agente_feedback = { ...(lead.agente_feedback || {}), motivo_perdida: reason, fecha_reporte: new Date().toISOString() }
    await supabase.from('leads').update(updates).eq('id', lead.id)
    onStageUpdate?.(lead.id, stage)
    setLoseModal(false)
  }

  const modeColors: Record<Mode, string> = { sophia: C.gold, manual: '#60a5fa' }

  return (
    <div style={{ width: showCoachPanel ? '560px' : '420px', flexShrink: 0, background: C.surface, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', fontFamily: C.font, overflow: 'hidden', transition: 'width 0.3s' }}>

      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `linear-gradient(135deg, ${modeColors[mode]}, ${modeColors[mode]}80)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#07080A' }}>{lead.name?.charAt(0).toUpperCase()}</div>
            <div>
              <p style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: 0 }}>{lead.name}</p>
              <p style={{ color: C.textMuted, fontSize: '11px', margin: '1px 0 0' }}>{lead.phone} · {lead.state || '—'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '16px', padding: '4px' }}>✕</button>
        </div>

        {/* Mode selector */}
        <div style={{ display: 'flex', gap: '4px', background: C.surface2, borderRadius: '8px', padding: '3px' }}>
          {(['sophia', 'manual'] as Mode[]).map(m => (
            <button key={m} onClick={() => changeMode(m)} style={{
              flex: 1, padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: mode === m ? 700 : 400,
              fontFamily: C.font, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: mode === m ? `${modeColors[m]}18` : 'transparent', color: mode === m ? modeColors[m] : C.textMuted,
            }}>{m === 'sophia' ? 'Sophia IA' : 'Manual'}</button>
          ))}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
          <span style={{ padding: '2px 7px', borderRadius: '100px', fontSize: '9px', fontWeight: 600, background: meta.bg, color: meta.color }}>{meta.label}</span>
          {lead.favorite_color && <span style={{ padding: '2px 7px', borderRadius: '100px', fontSize: '9px', fontWeight: 600, background: 'rgba(201,168,76,0.1)', color: C.gold }}>🎨 {lead.favorite_color}</span>}
          <span style={{ padding: '2px 7px', borderRadius: '100px', fontSize: '9px', fontWeight: 600, color: scoreColor(lead.score), background: `${scoreColor(lead.score)}15` }}>{lead.score}pts</span>
          {hoursInactive > 6 && <span style={{ padding: '2px 7px', borderRadius: '100px', fontSize: '9px', fontWeight: 600, background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>{hoursInactive}h</span>}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Chat column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Chat header with live indicator */}
          <div style={{ padding: '4px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <span style={{ fontSize: '9px', color: C.textMuted }}>Conversación</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.5)', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '8px', color: C.textMuted }}>{lastUpdated ? `${Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000))}s` : '...'}</span>
            </div>
          </div>
          <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {conversations.length === 0 ? <p style={{ color: C.textMuted, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Sin mensajes</p> : conversations.map((msg, i) => {
              const isIn = msg.direction === 'inbound'
              const isAgent = msg.ai_summary?.includes('agente') || msg.ai_summary?.includes('manualmente')
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isIn ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '85%', padding: '7px 11px', borderRadius: isIn ? '11px 11px 3px 11px' : '11px 11px 11px 3px', background: isIn ? 'rgba(96,165,250,0.12)' : isAgent ? 'rgba(168,85,247,0.1)' : 'rgba(201,168,76,0.1)', border: `1px solid ${isIn ? 'rgba(96,165,250,0.2)' : isAgent ? 'rgba(168,85,247,0.2)' : 'rgba(201,168,76,0.2)'}` }}>
                    {!isIn && <p style={{ fontSize: '8px', fontWeight: 700, color: isAgent ? '#a855f7' : C.gold, margin: '0 0 1px' }}>{isAgent ? 'Agente' : 'Sophia'}</p>}
                    <p style={{ color: C.text, fontSize: '11px', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{msg.message}</p>
                    <p style={{ color: C.textMuted, fontSize: '7px', margin: '2px 0 0', textAlign: isIn ? 'right' : 'left' }}>{new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>
          <button onClick={() => { setShowAllConvos(!showAllConvos); setTimeout(loadMessages, 100) }} style={{ padding: '3px', background: 'transparent', border: 'none', color: C.gold, fontSize: '9px', cursor: 'pointer' }}>{showAllConvos ? '↑ Menos' : '↓ Ver todo'}</button>

          {/* Temperature bar — always visible */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Temperatura</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: getTempColor(heatScore) }}>{heatScore}/100 — {getTempLabel(heatScore)}</span>
            </div>
            <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${heatScore}%`, background: 'linear-gradient(90deg, #3b82f6 0%, #22c55e 40%, #f59e0b 70%, #ef4444 100%)', borderRadius: '3px', transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ display: 'flex', gap: '3px', marginTop: '5px', flexWrap: 'wrap' }}>
              {PHASES.map((phase, i) => (
                <span key={phase} style={{
                  fontSize: '8px', padding: '1px 6px', borderRadius: '10px',
                  fontWeight: currentPhase === i ? 700 : 400,
                  background: currentPhase === i ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                  color: currentPhase === i ? '#fbbf24' : '#4b5563',
                  border: currentPhase === i ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                }}>{currentPhase === i ? `▶ ${phase}` : phase}</span>
              ))}
            </div>
          </div>

          {/* Coaching toggle (visible in ALL modes) + Agent input (manual only) */}
          <div style={{ padding: '8px 14px', borderTop: `1px solid ${C.border}` }}>
            <div onClick={() => setCoachEnabled(!coachEnabled)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', background: coachEnabled ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${coachEnabled ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', marginBottom: mode === 'manual' ? '8px' : '0', cursor: 'pointer' }}>
              <div style={{ width: '30px', height: '16px', borderRadius: '8px', background: coachEnabled ? '#a855f7' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: coachEnabled ? '#fff' : 'rgba(255,255,255,0.4)', position: 'absolute', top: '2px', left: coachEnabled ? '16px' : '2px', transition: 'all 0.2s' }} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: coachEnabled ? '#a855f7' : C.textMuted }}>Coaching IA {coachLoading ? '(analizando...)' : ''}</span>
            </div>
            {mode === 'manual' && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAgentMessage()}
                  placeholder="Escribe un mensaje..." style={{ flex: 1, padding: '8px 11px', borderRadius: '8px', fontSize: '12px', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: 'none', fontFamily: C.font }} />
                <button onClick={sendAgentMessage} disabled={sending} style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: '#60a5fa', color: '#07080A', border: 'none', opacity: sending ? 0.5 : 1 }}>{sending ? '...' : '→'}</button>
              </div>
            )}
          </div>
        </div>

        {/* Coaching sidebar */}
        {showCoachPanel && (
          <div style={{ width: '190px', borderLeft: `1px solid ${C.border}`, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>

            <button onClick={() => { const lastIn = conversations.filter(m => m.direction === 'inbound').pop(); if (lastIn) triggerCoaching(lastIn.message) }} disabled={coachLoading} style={{ width: '100%', padding: '7px', borderRadius: '7px', fontSize: '9px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
              {coachLoading ? 'Analizando...' : '🧠 Analizar'}
            </button>

            {/* Close signal */}
            {(coaching?.heat?.momento_cierre || coaching?.close_signal) && (
              <div style={{ padding: '8px', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '8px', textAlign: 'center', boxShadow: '0 0 10px rgba(201,168,76,0.2)' }}>
                <p style={{ fontSize: '10px', fontWeight: 800, color: C.gold, margin: 0 }}>PIDE LA LLAMADA</p>
                <p style={{ fontSize: '8px', color: C.textDim, margin: '2px 0 0' }}>{coaching?.heat?.razon || ''}</p>
              </div>
            )}

            {coaching && (
              <>
                {/* Suggested response */}
                <div style={{ padding: '8px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: '8px' }}>
                  <p style={{ fontSize: '8px', fontWeight: 700, color: '#a855f7', margin: '0 0 3px', textTransform: 'uppercase' }}>Respuesta sugerida</p>
                  <p style={{ fontSize: '10px', color: C.text, lineHeight: 1.5, margin: '0 0 5px' }}>{coaching.suggested_response || '—'}</p>
                  <button onClick={() => setMsgInput(coaching.suggested_response || '')} style={{ width: '100%', padding: '4px', borderRadius: '5px', fontSize: '8px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7' }}>Usar esta</button>
                </div>

                {/* Objection */}
                {(coaching.objection?.tiene_objecion || coaching.objection_detected?.tiene_objecion) && (
                  <div style={{ padding: '8px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: '8px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 700, color: '#f87171', margin: '0 0 2px', textTransform: 'uppercase' }}>Objeción: {(coaching.objection || coaching.objection_detected)?.tipo}</p>
                    <p style={{ fontSize: '9px', color: C.textDim, margin: '0 0 3px' }}>{(coaching.objection || coaching.objection_detected)?.objecion_exacta}</p>
                    <p style={{ fontSize: '9px', color: '#34d399', margin: 0 }}>→ {(coaching.objection || coaching.objection_detected)?.respuesta_sugerida}</p>
                  </div>
                )}

                {/* Facts */}
                {(coaching.facts || coaching.relevant_facts) && (
                  <div style={{ padding: '8px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: '8px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 700, color: '#34d399', margin: '0 0 3px', textTransform: 'uppercase' }}>Datos útiles</p>
                    <p style={{ fontSize: '9px', color: C.textDim, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{coaching.facts || coaching.relevant_facts}</p>
                  </div>
                )}
              </>
            )}

            {products.length > 1 && (
              <div style={{ padding: '8px', background: C.surface2, borderRadius: '8px', border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: '8px', fontWeight: 700, color: C.textMuted, margin: '0 0 3px', textTransform: 'uppercase' }}>Cross-sell</p>
                {products.slice(1).map((p: any, i: number) => <p key={i} style={{ fontSize: '9px', color: '#34d399', margin: '2px 0' }}>💰 {p.product}</p>)}
              </div>
            )}

            {/* Coach Chat */}
            <div style={{ background: '#12121a', border: '1px solid rgba(167,139,250,0.12)', borderRadius: '10px', padding: '10px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px' }}>💬</span>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pregúntale al Coach</span>
                {coachChatLoading && <span style={{ fontSize: '8px', color: '#a78bfa', marginLeft: 'auto' }}>pensando...</span>}
              </div>

              <div ref={coachChatRef} style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                {coachMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: '#a78bfa', flexShrink: 0 }}>IA</div>
                    )}
                    <div style={{
                      maxWidth: '88%', padding: '6px 9px', fontSize: '10px', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                      borderRadius: msg.role === 'user' ? '9px 3px 9px 9px' : '3px 9px 9px 9px',
                      background: msg.role === 'user' ? 'rgba(59,130,246,0.1)' : 'rgba(167,139,250,0.08)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.15)' : 'rgba(167,139,250,0.15)'}`,
                      color: '#e5e7eb',
                    }}>
                      {msg.content}
                      {msg.role === 'assistant' && msg.content.includes('"') && (
                        <button onClick={() => {
                          const match = msg.content.match(/"([^"]+)"/)?.[1]
                          if (match) setMsgInput(match)
                        }} style={{ display: 'block', marginTop: '4px', padding: '3px 8px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '5px', fontSize: '8px', fontWeight: 600, color: '#a78bfa', cursor: 'pointer', width: '100%', textAlign: 'center' }}>
                          Copiar mensaje sugerido →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {coachChatLoading && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: '#a78bfa', flexShrink: 0 }}>IA</div>
                    <div style={{ padding: '8px 12px', borderRadius: '3px 9px 9px 9px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)', fontSize: '14px', color: '#a78bfa' }}>...</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '5px', marginBottom: '6px' }}>
                <input value={coachInput} onChange={e => setCoachInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && askCoach(coachInput)}
                  placeholder="Ej: ¿qué le digo?" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '7px', padding: '6px 9px', fontSize: '10px', color: '#f3f4f6', outline: 'none', fontFamily: C.font }} />
                <button onClick={() => askCoach(coachInput)} disabled={coachChatLoading} style={{ padding: '6px 10px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '7px', fontSize: '12px', color: '#a78bfa', cursor: 'pointer', fontWeight: 600 }}>→</button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {['¿Qué le digo?', '¿Cómo manejo el precio?', '¿Es momento de cerrar?'].map(q => (
                  <button key={q} onClick={() => askCoach(q)} style={{ fontSize: '8px', padding: '3px 7px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#9ca3af', cursor: 'pointer', whiteSpace: 'nowrap' }}>{q}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '5px', flexShrink: 0 }}>
        <button onClick={() => markClosed('closed_won')} style={{ flex: 1, padding: '7px', borderRadius: '7px', fontSize: '10px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>✓ Cerrado</button>
        <button onClick={() => setLoseModal(true)} style={{ flex: 1, padding: '7px', borderRadius: '7px', fontSize: '10px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>✕ Perder</button>
        <a href={`https://wa.me/${lead.phone?.replace(/\D/g, '')}`} target="_blank" style={{ flex: 1, padding: '7px', borderRadius: '7px', fontSize: '10px', fontWeight: 700, textAlign: 'center', textDecoration: 'none', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>📱 WA</a>
      </div>

      {loseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLoseModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: '14px', padding: '20px', width: '300px' }}>
            <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>Motivo de pérdida</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' }}>
              {['Precio', 'Ya tiene seguro', 'No califica', 'No responde', 'Otro'].map(r => (
                <button key={r} onClick={() => setLoseReason(r)} style={{ padding: '8px 10px', borderRadius: '7px', fontSize: '12px', fontFamily: C.font, cursor: 'pointer', textAlign: 'left', background: loseReason === r ? 'rgba(248,113,113,0.12)' : C.surface2, border: `1px solid ${loseReason === r ? 'rgba(248,113,113,0.3)' : C.border}`, color: loseReason === r ? '#f87171' : C.textDim }}>{r}</button>
              ))}
            </div>
            <button onClick={() => loseReason && markClosed('closed_lost', loseReason)} disabled={!loseReason} style={{ width: '100%', padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: loseReason ? '#f87171' : 'rgba(248,113,113,0.3)', color: 'white', border: 'none' }}>Confirmar</button>
          </div>
        </div>
      )}
    </div>
  )
}
