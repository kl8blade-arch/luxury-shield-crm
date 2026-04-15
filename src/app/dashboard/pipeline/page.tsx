'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Lead {
  id: string
  name: string
  phone: string
  stage: string
  score: number
  insurance_type: string
  source?: string
  ready_to_buy?: boolean
  ia_active?: boolean
  last_contact?: string
}

interface PipelineStage {
  key: string
  label: string
  color: string
  emoji: string
}

export default function PipelinePage() {
  const { user } = useAuth()
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Record<string, Lead[]>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [sourceStage, setSourceStage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPipeline = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const res = await fetch(`/api/dashboard/pipeline?agentId=${user.id}`)
      if (!res.ok) throw new Error('Failed to fetch pipeline')
      const { data } = await res.json()
      setStages(data.stages)
      setLeads(data.leads)
    } catch (error) {
      console.error('Pipeline fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchPipeline()
    const interval = setInterval(fetchPipeline, 60000)
    return () => clearInterval(interval)
  }, [fetchPipeline])

  const filteredLeads = (stageLeads: Lead[]) =>
    stageLeads.filter(lead => {
      const matchesSearch =
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone.includes(searchTerm)
      return matchesSearch && lead.score >= minScore
    })

  const updateLeadStage = async (leadId: string, newStage: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage, agentId: user?.id }),
      })
      if (!res.ok) throw new Error('Failed to update stage')
      await fetchPipeline()
    } catch (error) {
      console.error('Stage update error:', error)
    }
  }

  const handleDragStart = (lead: Lead, stage: string) => {
    setDraggedLead(lead)
    setSourceStage(stage)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLDivElement).style.opacity = '0.7'
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    ;(e.currentTarget as HTMLDivElement).style.opacity = '1'
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetStage: string) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLDivElement).style.opacity = '1'

    if (!draggedLead || !sourceStage) return
    if (sourceStage === targetStage) return

    // Optimistic update
    setLeads(prev => {
      const updated = { ...prev }
      updated[sourceStage] = updated[sourceStage].filter(l => l.id !== draggedLead.id)
      const movedLead = { ...draggedLead, stage: targetStage }
      updated[targetStage] = [...(updated[targetStage] || []), movedLead]
      return updated
    })

    setDraggedLead(null)
    setSourceStage(null)

    await updateLeadStage(draggedLead.id, targetStage)
  }

  const timeSinceLastContact = (date?: string) => {
    if (!date) return 'Nunca'
    const now = new Date()
    const then = new Date(date)
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
    if (seconds < 60) return 'hace poco'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `hace ${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `hace ${hours}h`
    const days = Math.floor(hours / 24)
    return `hace ${days}d`
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Cargando pipeline...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '100%', overflowX: 'auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>Pipeline Kanban</h1>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #333',
              background: '#050507',
              color: '#fff',
              fontSize: '0.875rem',
            }}
          />
          <input
            type="range"
            min="0"
            max="100"
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            style={{ width: '150px' }}
          />
          <span style={{ whiteSpace: 'nowrap' }}>Score: {minScore}+</span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          overflowX: 'auto',
        }}
      >
        {stages.map(stage => (
          <div
            key={stage.key}
            style={{
              background: '#0a0a0c',
              borderRadius: '0.75rem',
              padding: '1rem',
              minHeight: '500px',
              borderTop: `3px solid ${stage.color}`,
            }}
          >
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{stage.emoji}</span>
              <h3 style={{ margin: 0 }}>{stage.label}</h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  background: stage.color,
                  color: '#000',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '9999px',
                  fontWeight: 'bold',
                }}
              >
                {filteredLeads(leads[stage.key] || []).length}
              </span>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, stage.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                minHeight: '450px',
                transition: 'opacity 0.2s',
              }}
            >
              {filteredLeads(leads[stage.key] || []).map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => handleDragStart(lead, stage.key)}
                  style={{
                    background: '#1a1a1d',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    cursor: 'grab',
                    opacity: draggedLead?.id === lead.id ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = stage.color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <p
                        style={{
                          margin: '0 0 0.5rem 0',
                          fontWeight: '600',
                          fontSize: '0.95rem',
                          color: '#fff',
                        }}
                      >
                        {lead.name}
                      </p>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: '#999' }}>
                        📱 {lead.phone}
                      </p>
                    </div>
                    <div
                      style={{
                        background: `${stage.color}20`,
                        color: stage.color,
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      {lead.score}
                    </div>
                  </div>

                  {lead.insurance_type && (
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#C9A84C' }}>
                      {lead.insurance_type}
                    </p>
                  )}

                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {lead.ready_to_buy && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          background: '#27AE60',
                          color: '#fff',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '0.2rem',
                        }}
                      >
                        💰 Listo
                      </span>
                    )}
                    {lead.ia_active && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          background: '#8E44AD',
                          color: '#fff',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '0.2rem',
                        }}
                      >
                        🤖 Sophia
                      </span>
                    )}
                    {lead.source && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          background: '#2980B9',
                          color: '#fff',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '0.2rem',
                        }}
                      >
                        {lead.source}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      color: '#999',
                    }}
                  >
                    <span>⏱️ {timeSinceLastContact(lead.last_contact)}</span>
                    <a
                      href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#25D366',
                        textDecoration: 'none',
                        fontSize: '0.75rem',
                      }}
                    >
                      WhatsApp →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
