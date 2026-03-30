'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { C, STAGE_META, scoreColor } from '@/lib/design'
import LeadDetailPanel from '@/components/LeadDetailPanel'

const COLS = Object.entries(STAGE_META).filter(([k]) => k !== 'unqualified')

export default function PipelinePage() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [draggedLead, setDraggedLead] = useState<any>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const dragDataRef = useRef<any>(null)

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!ghostRef.current) return
    ghostRef.current.style.left = `${e.clientX - 80}px`
    ghostRef.current.style.top = `${e.clientY - 20}px`
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const col = el?.closest('[data-stage-id]')
    setDragOverStage(col ? col.getAttribute('data-stage-id') : null)
  }, [])

  const onPointerUp = useCallback(async () => {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.body.style.overflow = ''
    if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null }
    const d = dragDataRef.current
    if (d && dragOverStage && dragOverStage !== d.stage) {
      await moveLeadToStage(d.id, dragOverStage)
    }
    setDraggedLead(null); setDragOverStage(null); dragDataRef.current = null
  }, [dragOverStage])

  function startDrag(e: React.PointerEvent, lead: any) {
    e.preventDefault()
    const ghost = document.createElement('div')
    ghost.id = 'drag-ghost'
    ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;opacity:0.85;transform:rotate(2deg) scale(1.03);background:#1a1a2e;border:1px solid rgba(201,168,76,0.4);border-radius:10px;padding:10px 14px;font-size:12px;font-weight:600;color:#f3f4f6;box-shadow:0 12px 40px rgba(0,0,0,0.5);min-width:140px;left:${e.clientX - 70}px;top:${e.clientY - 20}px;`
    ghost.textContent = lead.name
    document.body.appendChild(ghost)
    ghostRef.current = ghost
    dragDataRef.current = lead
    setDraggedLead(lead)
    document.body.style.overflow = 'hidden'
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  useEffect(() => { return () => { document.removeEventListener('pointermove', onPointerMove); document.removeEventListener('pointerup', onPointerUp); const g = document.getElementById('drag-ghost'); if (g) g.remove(); document.body.style.overflow = '' } }, [onPointerMove, onPointerUp])

  useEffect(() => { loadLeads() }, [])

  async function loadLeads() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || []); setLoading(false)
  }

  async function moveLeadToStage(leadId: string, newStage: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))
    const { error } = await supabase.from('leads').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', leadId)
    if (error) { loadLeads(); return }
    fetch('/api/stage-change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, new_stage: newStage, changed_by: 'agent_manual' }) }).catch(() => {})
  }

  const byStage = (key: string) => leads.filter(l => l.stage === key)

  return (
    <div style={{ height: '100vh', background: C.bg, display: 'flex', fontFamily: C.font, overflow: 'hidden' }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '32px 32px 22px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>Pipeline</h1>
            <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '5px' }}>
              {loading ? 'Cargando...' : `${leads.length} leads · Vista Kanban`}
            </p>
          </div>
          {/* Summary pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '480px' }}>
            {COLS.map(([key, meta]) => {
              const count = byStage(key).length
              if (!count) return null
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '100px', background: `${meta.color}12`, border: `1px solid ${meta.color}28`, fontSize: '11px', fontWeight: 600, color: meta.color }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
                  {meta.label} {count}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '20px 12px', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', gap: '12px', height: '100%', minWidth: `${COLS.length * 228}px` }}>
          {COLS.map(([key, meta]) => {
            const stageLeads = byStage(key)
            return (
              <div key={key} data-stage-id={key}
                style={{ width: '216px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: dragOverStage === key ? 'rgba(201,168,76,0.06)' : C.surface, borderRadius: '16px', border: dragOverStage === key ? '1px dashed rgba(201,168,76,0.3)' : `1px solid ${C.border}`, overflow: 'hidden', transition: 'background 0.2s, border 0.2s' }}>

                {/* Column header */}
                <div style={{ padding: '13px 14px 11px', borderBottom: `2px solid ${meta.color}35`, background: `${meta.color}07`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.dot, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ color: meta.color, fontSize: '12px', fontWeight: 700 }}>{meta.label}</span>
                    </div>
                    <span style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}28`, fontSize: '11px', fontWeight: 800, borderRadius: '100px', padding: '1px 8px' }}>
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {loading ? (
                    [1,2].map(i => <div key={i} style={{ height: '76px', borderRadius: '12px', background: C.surface2, opacity: 0.4 }} />)
                  ) : stageLeads.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: `${meta.color}0a`, border: `1px dashed ${meta.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '7px' }}>
                        <span style={{ color: meta.color, opacity: 0.4, fontSize: '14px' }}>·</span>
                      </div>
                      <p style={{ color: C.textMuted, fontSize: '11px', lineHeight: 1.5, margin: 0 }}>Sin leads</p>
                    </div>
                  ) : stageLeads.map(lead => (
                    <div key={lead.id} onClick={() => { if (!dragDataRef.current) setSelected(lead) }}
                      onPointerDown={e => startDrag(e, lead)}
                      style={{ textDecoration: 'none', cursor: 'grab', touchAction: 'none', userSelect: 'none' }}>
                      <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '11px 12px', cursor: 'grab', transition: 'all 0.15s' }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.border = `1px solid ${meta.color}38`; el.style.background = C.surface3 }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.border = `1px solid ${C.border}`; el.style.background = C.surface2 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, minWidth: 0 }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, background: `${meta.color}15`, border: `1px solid ${meta.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: meta.color }}>
                              {lead.name.charAt(0).toUpperCase()}
                            </div>
                            <p style={{ color: C.text, fontSize: '12px', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</p>
                          </div>
                          <span style={{ color: scoreColor(lead.score), fontWeight: 800, fontSize: '13px', flexShrink: 0, marginLeft: '6px' }}>{lead.score}</span>
                        </div>
                        <p style={{ color: C.textMuted, fontSize: '11px', margin: '0 0 5px' }}>{lead.phone}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: C.textMuted, fontSize: '10px', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '100px' }}>{lead.insurance_type}</span>
                          {lead.ready_to_buy && <span style={{ fontSize: '11px' }}>🔥</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
    {selected && (
      <LeadDetailPanel
        lead={selected}
        onClose={() => setSelected(null)}
        onStageUpdate={(id, s) => { setLeads(p => p.map(l => l.id === id ? { ...l, stage: s } : l)); setSelected(null) }}
      />
    )}
    </div>
  )
}
