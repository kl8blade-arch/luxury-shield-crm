'use client'
// src/app/dashboard/pipeline/page.tsx — Pipeline Kanban + LeadDetailPanel

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Lead {
  id: string; name: string; phone: string; stage: string
  score: number; insurance_type: string; created_at: string
  last_contact: string | null; source: string | null
  city: string | null; state: string | null
  ready_to_buy: boolean; ia_active: boolean; notes: string | null
}

interface LeadDetail extends Lead {
  email: string | null; age: number | null; gender: string | null
  score_recommendation: string | null; next_action: string | null
  next_action_date: string | null; sold_product: string | null
  contact_attempts: number; preferred_language: string | null
  budget_range: string | null; occupation: string | null
  pain_points: string[] | null; objections: string[] | null
  conversation_mode: string | null; campaign_name: string | null
}

interface Conversation {
  id: string; message: string; direction: string
  channel: string; created_at: string
  sentiment: string | null; ai_summary: string | null
}

interface Reminder {
  id: string; type: string; scheduled_at: string
  notes: string | null; status: string
}

interface Stage { key: string; label: string; color: string; emoji: string }
interface PipelineData { stages: Stage[]; leads: Record<string, Lead[]>; total: number }

// ── Helpers ────────────────────────────────────────────────────────────────────
const scoreColor = (s: number) => s >= 75 ? '#00E5A0' : s >= 50 ? '#FFB930' : '#FF4757'

function timeAgo(date: string | null) {
  if (!date) return '—'
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `${days}d atrás`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#00E5A0', interested: '#00D4FF',
  neutral: '#888', negative: '#FF4757', not_interested: '#FF4757',
}

const T = {
  bg: '#0d0820', panel: 'rgba(255,255,255,0.05)',
  border: 'rgba(149,76,233,0.18)', text: '#f0eaff',
  muted: 'rgba(200,180,255,0.45)', accent: '#9B59B6',
  green: '#00E5A0', red: '#FF4757', gold: '#FFB930', cyan: '#00D4FF',
}

// ── LeadDetailPanel ────────────────────────────────────────────────────────────
function LeadDetailPanel({
  leadId, agentId, stages,
  onClose, onStageChange,
}: {
  leadId: string; agentId: string
  stages: Stage[]
  onClose: () => void
  onStageChange: (leadId: string, newStage: string) => void
}) {
  const [detail, setDetail]     = useState<LeadDetail | null>(null)
  const [convs,  setConvs]      = useState<Conversation[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading]   = useState(true)
  const [notes,   setNotes]     = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [activeTab, setActiveTab] = useState<'info'|'convs'|'notas'>('info')

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/leads/${leadId}/detail?agentId=${agentId}`)
        if (!r.ok) return
        const { data } = await r.json()
        setDetail(data.lead)
        setConvs(data.convs ?? [])
        setReminders(data.reminders ?? [])
        setNotes(data.lead.notes ?? '')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [leadId, agentId])

  const saveNotes = async () => {
    if (!detail) return
    setSavingNotes(true)
    try {
      await fetch(`/api/leads/${leadId}/detail`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, agentId }),
      })
    } finally {
      setSavingNotes(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.muted }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
        <div style={{ fontSize: 12 }}>Cargando...</div>
      </div>
    </div>
  )

  if (!detail) return null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Panel header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${T.accent},${T.cyan})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
          {detail.name[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 2 }}>{detail.name}</div>
          <div style={{ fontSize: 10, color: T.muted }}>{detail.insurance_type} · {detail.source ?? '—'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(detail.score) }}>{detail.score}</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: `1px solid ${T.border}`, cursor: 'pointer', color: T.muted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 8 }}>
        <a href={`https://wa.me/${detail.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
          style={{ flex: 1, padding: '7px', background: '#25D36618', border: '1px solid #25D36630', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#25D366', textDecoration: 'none', textAlign: 'center', cursor: 'pointer' }}>
          💬 WhatsApp
        </a>
        <a href={`tel:${detail.phone}`}
          style={{ flex: 1, padding: '7px', background: `${T.cyan}18`, border: `1px solid ${T.cyan}30`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: T.cyan, textDecoration: 'none', textAlign: 'center', cursor: 'pointer' }}>
          📞 Llamar
        </a>
      </div>

      {/* Stage change */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 6 }}>Cambiar etapa</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {stages.map(s => (
            <button key={s.key} onClick={() => onStageChange(leadId, s.key)}
              style={{ padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: detail.stage === s.key ? `${s.color}25` : 'transparent', border: `1px solid ${detail.stage === s.key ? s.color : T.border}`, color: detail.stage === s.key ? s.color : T.muted }}>
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
        {([['info','📋 Info'],['convs','💬 Historial'],['notas','📝 Notas']] as const).map(([id,lbl]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ flex: 1, padding: '9px', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: activeTab === id ? `${T.accent}15` : 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === id ? T.accent : 'transparent'}`, color: activeTab === id ? T.accent : T.muted }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Teléfono',        val: detail.phone },
              { label: 'Email',           val: detail.email },
              { label: 'Ciudad/Estado',   val: [detail.city, detail.state].filter(Boolean).join(', ') || null },
              { label: 'Edad',            val: detail.age ? `${detail.age} años` : null },
              { label: 'Ocupación',       val: detail.occupation },
              { label: 'Presupuesto',     val: detail.budget_range },
              { label: 'Idioma',          val: detail.preferred_language },
              { label: 'Intentos de contacto', val: detail.contact_attempts ? `${detail.contact_attempts}` : '0' },
              { label: 'Campaña',         val: detail.campaign_name },
              { label: 'Último contacto', val: timeAgo(detail.last_contact) },
              { label: 'Creado',          val: fmtDate(detail.created_at) },
              { label: 'Próxima acción',  val: detail.next_action },
            ].filter(f => f.val).map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 11, color: T.muted }}>{f.label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.text, textAlign: 'right', maxWidth: '60%' }}>{f.val}</span>
              </div>
            ))}

            {/* Badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {detail.ready_to_buy && <span style={{ fontSize: 10, padding: '2px 8px', background: '#00E5A020', borderRadius: 10, color: '#00E5A0', fontWeight: 700 }}>⚡ Listo para comprar</span>}
              {detail.ia_active && <span style={{ fontSize: 10, padding: '2px 8px', background: `${T.accent}20`, borderRadius: 10, color: T.accent, fontWeight: 700 }}>🤖 Sophia activa</span>}
            </div>

            {/* Objections */}
            {detail.objections && detail.objections.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 6 }}>Objeciones detectadas</div>
                {detail.objections.map((o, i) => (
                  <div key={i} style={{ fontSize: 11, padding: '4px 8px', background: `${T.red}10`, borderLeft: `2px solid ${T.red}`, borderRadius: 4, marginBottom: 4, color: T.text }}>{o}</div>
                ))}
              </div>
            )}

            {/* Reminders */}
            {reminders.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 6 }}>Recordatorios</div>
                {reminders.map((r, i) => (
                  <div key={i} style={{ padding: '8px', background: `${T.gold}10`, border: `1px solid ${T.gold}20`, borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.gold }}>{r.type}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>{fmtDate(r.scheduled_at)}</div>
                    {r.notes && <div style={{ fontSize: 10, color: T.text, marginTop: 2 }}>{r.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONVERSATIONS TAB */}
        {activeTab === 'convs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {convs.length === 0
              ? <div style={{ textAlign: 'center', color: T.muted, fontSize: 12, padding: '24px 0' }}>Sin conversaciones registradas</div>
              : convs.map((c, i) => (
                <div key={i} style={{ padding: '10px', background: c.direction === 'inbound' ? 'rgba(255,255,255,0.04)' : `${T.accent}08`, border: `1px solid ${c.direction === 'inbound' ? T.border : T.accent + '20'}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: c.direction === 'inbound' ? T.green : T.cyan, fontWeight: 700 }}>
                        {c.direction === 'inbound' ? '← Lead' : '→ Tú'}
                      </span>
                      <span style={{ fontSize: 9, color: T.muted }}>{c.channel}</span>
                      {c.sentiment && (
                        <span style={{ fontSize: 8, padding: '1px 5px', background: `${SENTIMENT_COLOR[c.sentiment] ?? '#888'}18`, borderRadius: 8, color: SENTIMENT_COLOR[c.sentiment] ?? '#888', fontWeight: 700 }}>{c.sentiment}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 9, color: T.muted }}>{fmtDate(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.text, lineHeight: 1.6 }}>{c.message || c.ai_summary || '—'}</div>
                </div>
              ))
            }
          </div>
        )}

        {/* NOTAS TAB */}
        {activeTab === 'notas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Escribe tus notas sobre este lead..."
              rows={8}
              style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.text, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box' }}
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              style={{ padding: '8px', background: `${T.accent}20`, border: `1px solid ${T.accent}40`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: T.accent, cursor: savingNotes ? 'default' : 'pointer', opacity: savingNotes ? 0.6 : 1 }}
            >
              {savingNotes ? 'Guardando...' : '💾 Guardar notas'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pipeline Page ──────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const { user } = useAuth()
  const [data,        setData]        = useState<PipelineData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [dragging,    setDragging]    = useState<Lead | null>(null)
  const [dragOver,    setDragOver]    = useState<string | null>(null)
  const [updating,    setUpdating]    = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [search,      setSearch]      = useState('')
  const [filterScore, setFilterScore] = useState(0)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const dragLeadRef = useRef<Lead | null>(null)

  const fetchPipeline = useCallback(async () => {
    if (!user?.id) return
    try {
      const r = await fetch(`/api/dashboard/pipeline?agentId=${user.id}`)
      if (!r.ok) throw new Error('Error cargando pipeline')
      const { data } = await r.json()
      setData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchPipeline() }, [fetchPipeline])

  const onDragStart = (lead: Lead) => { setDragging(lead); dragLeadRef.current = lead }
  const onDragOver  = (e: React.DragEvent, k: string) => { e.preventDefault(); setDragOver(k) }
  const onDragEnd   = () => { setDragging(null); setDragOver(null); dragLeadRef.current = null }

  const onDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault()
    const lead = dragLeadRef.current
    if (!lead || lead.stage === targetStage || !user?.id) { setDragging(null); setDragOver(null); return }
    setData(prev => {
      if (!prev) return prev
      const nl = { ...prev.leads }
      nl[lead.stage]   = nl[lead.stage].filter(l => l.id !== lead.id)
      nl[targetStage]  = [{ ...lead, stage: targetStage }, ...(nl[targetStage] ?? [])]
      return { ...prev, leads: nl }
    })
    setDragging(null); setDragOver(null); setUpdating(lead.id)
    try {
      const r = await fetch(`/api/leads/${lead.id}/stage`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stage: targetStage, agentId: user.id }),
      })
      if (!r.ok) throw new Error('Error')
    } catch { await fetchPipeline() }
    finally { setUpdating(null) }
  }

  // Stage change from detail panel
  const handleStageChange = async (leadId: string, newStage: string) => {
    if (!user?.id) return
    // Find current stage
    let currentStage = ''
    data?.stages.forEach(s => {
      if (data.leads[s.key]?.find(l => l.id === leadId)) currentStage = s.key
    })
    if (!currentStage || currentStage === newStage) return
    setData(prev => {
      if (!prev) return prev
      const lead = prev.leads[currentStage]?.find(l => l.id === leadId)
      if (!lead) return prev
      const nl = { ...prev.leads }
      nl[currentStage] = nl[currentStage].filter(l => l.id !== leadId)
      nl[newStage]     = [{ ...lead, stage: newStage }, ...(nl[newStage] ?? [])]
      return { ...prev, leads: nl }
    })
    setUpdating(leadId)
    try {
      await fetch(`/api/leads/${leadId}/stage`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stage: newStage, agentId: user.id }),
      })
    } finally { setUpdating(null) }
  }

  const filterLeads = (leads: Lead[]) => leads.filter(l => {
    const ms = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
    return ms && l.score >= filterScore
  })

  if (loading) return <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}><div style={{ textAlign: 'center', color: T.muted }}><div style={{ fontSize: 32 }}>🎯</div><div>Cargando pipeline...</div></div></div>
  if (error)   return <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: T.red }}>⚠️ {error}</div></div>
  if (!data)   return null

  const totalLeads = data.stages.reduce((sum, s) => sum + (data.leads[s.key]?.length ?? 0), 0)

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'SF Pro Display',system-ui,sans-serif", color: T.text, display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div style={{ background: 'rgba(13,8,32,0.9)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 20 }}>🎯</div>
        <div><div style={{ fontSize: 15, fontWeight: 800 }}>Pipeline Kanban</div><div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: 'uppercase' }}>{totalLeads} leads activos</div></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..." style={{ flex: 1, maxWidth: 300, padding: '7px 14px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.text, outline: 'none', fontFamily: 'inherit' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: T.muted }}>Score:</span>
          <select value={filterScore} onChange={e => setFilterScore(Number(e.target.value))} style={{ padding: '5px 8px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, color: T.text, cursor: 'pointer' }}>
            {[0,25,50,75].map(v => <option key={v} value={v} style={{ background: '#0d0820' }}>{v === 0 ? 'Todos' : `${v}+`}</option>)}
          </select>
        </div>
        <button onClick={fetchPipeline} style={{ padding: '7px 14px', background: `${T.accent}20`, border: `1px solid ${T.accent}40`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: T.accent, cursor: 'pointer' }}>↺</button>
        {selectedId && <button onClick={() => setSelectedId(null)} style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, color: T.muted, cursor: 'pointer' }}>✕ Cerrar panel</button>}
      </div>

      {/* SUMMARY BAR */}
      <div style={{ padding: '8px 20px', display: 'flex', gap: 8, overflowX: 'auto', borderBottom: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.02)' }}>
        {data.stages.map(stage => {
          const count = filterLeads(data.leads[stage.key] ?? []).length
          return <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: `${stage.color}15`, border: `1px solid ${stage.color}30`, borderRadius: 20, flexShrink: 0 }}><span style={{ fontSize: 11 }}>{stage.emoji}</span><span style={{ fontSize: 10, color: stage.color, fontWeight: 700 }}>{stage.label}</span><span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{count}</span></div>
        })}
      </div>

      {/* MAIN AREA: board + detail panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* KANBAN BOARD */}
        <div style={{ flex: 1, display: 'flex', gap: 10, padding: '12px 16px', overflowX: 'auto', alignItems: 'flex-start' }}>
          {data.stages.map(stage => {
            const leads = filterLeads(data.leads[stage.key] ?? [])
            const isDragTarget = dragOver === stage.key
            return (
              <div key={stage.key} onDragOver={e => onDragOver(e, stage.key)} onDrop={e => onDrop(e, stage.key)} onDragLeave={() => setDragOver(null)}
                style={{ minWidth: 210, width: 210, flexShrink: 0, background: isDragTarget ? `${stage.color}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${isDragTarget ? stage.color : T.border}`, borderRadius: 14, transition: 'all 0.15s', boxShadow: isDragTarget ? `0 0 20px ${stage.color}30` : 'none' }}>
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>{stage.emoji}</span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 11, fontWeight: 800, color: stage.color }}>{stage.label}</div></div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${stage.color}20`, border: `1px solid ${stage.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: stage.color }}>{leads.length}</div>
                </div>
                {isDragTarget && dragging?.stage !== stage.key && <div style={{ margin: 8, padding: '10px', borderRadius: 8, border: `2px dashed ${stage.color}`, textAlign: 'center', fontSize: 11, color: stage.color, fontWeight: 700 }}>Soltar aquí →</div>}
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 7, minHeight: 50 }}>
                  {leads.length === 0 && !isDragTarget && <div style={{ padding: '14px 8px', textAlign: 'center', fontSize: 11, color: T.muted }}>Sin leads</div>}
                  {leads.map(lead => {
                    const isSelected     = selectedId === lead.id
                    const isUpdating     = updating === lead.id
                    const isDraggingThis = dragging?.id === lead.id
                    return (
                      <div key={lead.id} draggable onDragStart={() => onDragStart(lead)} onDragEnd={onDragEnd}
                        onClick={() => setSelectedId(isSelected ? null : lead.id)}
                        style={{ background: isSelected ? `${T.accent}18` : isDraggingThis ? 'rgba(155,89,182,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isSelected ? T.accent : isDraggingThis ? T.accent : T.border}`, borderRadius: 10, padding: '9px 11px', cursor: 'pointer', opacity: isDraggingThis ? 0.5 : isUpdating ? 0.7 : 1, transition: 'all 0.15s', userSelect: 'none', boxShadow: isSelected ? `0 0 12px ${T.accent}30` : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, flex: 1, marginRight: 4 }}>{lead.name}</div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: scoreColor(lead.score), flexShrink: 0 }}>{lead.score}</div>
                        </div>
                        <div style={{ fontSize: 10, color: T.muted, marginBottom: 5 }}>{lead.insurance_type}</div>
                        <div style={{ fontSize: 10, color: T.cyan, marginBottom: 5, fontFamily: 'monospace' }}>{lead.phone}</div>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {lead.ready_to_buy && <span style={{ fontSize: 8, padding: '1px 5px', background: '#00E5A020', borderRadius: 8, color: '#00E5A0', fontWeight: 700 }}>⚡</span>}
                          {lead.ia_active    && <span style={{ fontSize: 8, padding: '1px 5px', background: `${T.accent}20`, borderRadius: 8, color: T.accent, fontWeight: 700 }}>🤖</span>}
                          {lead.source       && <span style={{ fontSize: 8, padding: '1px 5px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, color: T.muted }}>{lead.source}</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7, paddingTop: 5, borderTop: `1px solid ${T.border}` }}>
                          <span style={{ fontSize: 9, color: T.muted }}>{timeAgo(lead.last_contact)}</span>
                          {isUpdating && <span style={{ fontSize: 9, color: T.gold }}>Guardando...</span>}
                          {isSelected && <span style={{ fontSize: 9, color: T.accent, fontWeight: 700 }}>Panel abierto →</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* LEAD DETAIL PANEL — slide in from right */}
        {selectedId && user?.id && (
          <div style={{ width: 340, flexShrink: 0, background: 'rgba(13,8,40,0.97)', borderLeft: `1px solid ${T.border}`, backdropFilter: 'blur(20px)', overflow: 'hidden', animation: 'slideIn 0.2s ease' }}>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
            <LeadDetailPanel
              leadId={selectedId}
              agentId={user.id}
              stages={data.stages}
              onClose={() => setSelectedId(null)}
              onStageChange={handleStageChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
