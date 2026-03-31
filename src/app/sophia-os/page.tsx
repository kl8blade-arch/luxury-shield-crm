'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'
import { useAuth } from '@/contexts/AuthContext'

export default function SophiaOSPage() {
  const { user, activeAccount, isViewingSubAccount } = useAuth()
  const [memories, setMemories] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [knowledge, setKnowledge] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'memory' | 'skills' | 'knowledge' | 'agents' | 'sources' | 'commands'>('agents')

  useEffect(() => { load() }, [activeAccount?.id])

  async function load() {
    setLoading(true)
    // Filter agents by active account (sub-account sees only its own agents)
    let agentQuery = supabase.from('sophia_agents').select('*').order('created_at', { ascending: false })
    if (isViewingSubAccount && activeAccount?.id) {
      agentQuery = agentQuery.eq('account_id', activeAccount.id)
    } else {
      agentQuery = agentQuery.is('account_id', null)
    }

    const [{ data: m }, { data: s }, { data: k }, { data: a }, { data: src }] = await Promise.all([
      supabase.from('sophia_memory').select('*').eq('active', true).order('importance', { ascending: false }),
      supabase.from('sophia_skills').select('*').order('active', { ascending: false }),
      supabase.from('sophia_knowledge').select('*').eq('active', true).order('created_at', { ascending: false }),
      agentQuery,
      supabase.from('sophia_training_sources').select('*').order('created_at', { ascending: false }).limit(20),
    ])
    setMemories(m || []); setSkills(s || []); setKnowledge(k || []); setAgents(a || []); setSources(src || [])
    setLoading(false)
  }

  async function toggleSkill(id: string, active: boolean) {
    await supabase.from('sophia_skills').update({ active: !active }).eq('id', id)
    load()
  }

  async function deleteItem(table: string, id: string) {
    await supabase.from(table).update({ active: false }).eq('id', id)
    load()
  }

  const tabs = [
    { key: 'agents' as const, label: `Agentes IA (${agents.length})` },
    { key: 'sources' as const, label: `Fuentes (${sources.length})` },
    { key: 'memory' as const, label: `Memoria (${memories.length})` },
    { key: 'skills' as const, label: `Skills (${skills.length})` },
    { key: 'knowledge' as const, label: `Conocimiento (${knowledge.length})` },
    { key: 'commands' as const, label: 'Comandos' },
  ]

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 700, margin: 0 }}>Sophia OS</h1>
        <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '4px' }}>Sistema maestro — Memoria, Skills y Agentes</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: C.surface, borderRadius: '10px', padding: '3px', border: `1px solid ${C.border}`, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: tab === t.key ? 700 : 400,
            fontFamily: C.font, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
            background: tab === t.key ? 'rgba(201,168,76,0.1)' : 'transparent', color: tab === t.key ? C.gold : C.textDim,
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted }}>Cargando...</div> : (
        <div style={{ background: 'linear-gradient(145deg, #141420, #0e0e1a)', border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px' }}>

          {tab === 'memory' && (
            <>
              <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>Memoria permanente</h3>
              {memories.length === 0 ? <p style={{ color: C.textMuted, fontSize: '13px' }}>Vacía. Envía "recuerda que..." por WhatsApp.</p> :
                memories.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '6px', border: `1px solid ${C.border}` }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '10px', color: C.gold, fontWeight: 600, marginRight: '8px' }}>[{m.category}]</span>
                      <span style={{ fontSize: '12px', color: C.text }}>{m.value}</span>
                    </div>
                    <button onClick={() => deleteItem('sophia_memory', m.id)} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', cursor: 'pointer', fontFamily: C.font }}>×</button>
                  </div>
                ))
              }
            </>
          )}

          {tab === 'skills' && (
            <>
              <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>Skills de Sophia</h3>
              {skills.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', marginBottom: '8px', border: `1px solid ${s.active ? 'rgba(52,211,153,0.2)' : C.border}` }}>
                  <div onClick={() => toggleSkill(s.id, s.active)} style={{ width: '36px', height: '20px', borderRadius: '10px', background: s.active ? '#34d399' : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: s.active ? '#fff' : 'rgba(255,255,255,0.4)', position: 'absolute', top: '2px', left: s.active ? '18px' : '2px', transition: 'all 0.2s' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: s.active ? C.text : C.textMuted, fontSize: '13px', fontWeight: 600, margin: 0 }}>{s.name}</p>
                    <p style={{ color: C.textMuted, fontSize: '11px', margin: '2px 0 0' }}>{s.description}</p>
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'knowledge' && (
            <>
              <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>Conocimiento aprendido</h3>
              {knowledge.length === 0 ? <p style={{ color: C.textMuted, fontSize: '13px' }}>Vacío. Envía "aprende esto:..." o un PDF por WhatsApp.</p> :
                knowledge.map(k => (
                  <div key={k.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', marginBottom: '8px', border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{k.title}</span>
                      <button onClick={() => deleteItem('sophia_knowledge', k.id)} style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '9px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', cursor: 'pointer', fontFamily: C.font }}>×</button>
                    </div>
                    <p style={{ fontSize: '11px', color: C.textDim, lineHeight: 1.5, margin: 0 }}>{k.embedding_summary || k.content?.substring(0, 150)}</p>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                      {k.tags?.map((t: string) => <span key={t} style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '100px', background: 'rgba(201,168,76,0.1)', color: C.gold }}>{t}</span>)}
                    </div>
                  </div>
                ))
              }
            </>
          )}

          {tab === 'agents' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: 0 }}>Agentes IA Especializados</h3>
                  <p style={{ color: C.textMuted, fontSize: '11px', marginTop: '4px' }}>Sophia orquesta y delega a cada experto según el tema</p>
                </div>
              </div>
              {agents.length === 0 ? <p style={{ color: C.textMuted, fontSize: '13px' }}>Sin agentes.</p> :
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {agents.map(a => {
                    const typeColors: Record<string, string> = { product_expert: '#34d399', general: '#60a5fa', custom: '#a78bfa' }
                    const color = typeColors[a.agent_type] || '#C9A84C'
                    return (
                      <div key={a.id} style={{ padding: '18px', background: 'rgba(255,255,255,0.015)', borderRadius: '14px', border: `1px solid ${a.active ? color + '25' : 'rgba(255,255,255,0.04)'}`, borderLeft: `3px solid ${a.active ? color : 'rgba(255,255,255,0.08)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <p style={{ color, fontSize: '15px', fontWeight: 700, margin: 0 }}>{a.name}</p>
                            <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '11px', margin: '2px 0 0' }}>{a.agent_type}</p>
                          </div>
                          <div onClick={async () => { await supabase.from('sophia_agents').update({ active: !a.active }).eq('id', a.id); load() }}
                            style={{ width: '34px', height: '18px', borderRadius: '9px', background: a.active ? color : 'rgba(255,255,255,0.08)', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: a.active ? '#fff' : 'rgba(255,255,255,0.3)', position: 'absolute', top: '2px', left: a.active ? '18px' : '2px', transition: 'all 0.2s' }} />
                          </div>
                        </div>
                        <p style={{ color: 'rgba(240,236,227,0.45)', fontSize: '12px', margin: '0 0 10px', lineHeight: 1.5 }}>{a.purpose}</p>
                        {a.trigger_keywords?.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            {a.trigger_keywords.slice(0, 6).map((kw: string) => (
                              <span key={kw} style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '100px', background: `${color}10`, color: `${color}90`, border: `1px solid ${color}20` }}>{kw}</span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: 'rgba(240,236,227,0.25)' }}>
                          <span>{a.conversations_handled || 0} conversaciones</span>
                          <span>{Math.round((a.success_rate || 0) * 100)}% éxito</span>
                        </div>
                        <details style={{ marginTop: '10px' }}><summary style={{ color: C.textMuted, fontSize: '10px', cursor: 'pointer' }}>Ver prompt</summary>
                          <pre style={{ fontSize: '9px', color: 'rgba(240,236,227,0.3)', whiteSpace: 'pre-wrap', marginTop: '6px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto' }}>{a.system_prompt?.substring(0, 600)}</pre>
                        </details>
                      </div>
                    )
                  })}
                </div>
              }
            </>
          )}

          {tab === 'sources' && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>Fuentes de Entrenamiento</h3>
                <p style={{ color: C.textMuted, fontSize: '11px' }}>Envía PDFs, documentos o URLs por WhatsApp desde tu número maestro</p>
              </div>
              <div style={{ padding: '20px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '12px', marginBottom: '16px' }}>
                <p style={{ color: '#C9A84C', fontSize: '12px', fontWeight: 600, margin: '0 0 8px' }}>Cómo entrenar a Sophia</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { icon: '📄', text: 'Envía un PDF por WhatsApp → Sophia extrae el conocimiento' },
                    { icon: '🎤', text: 'Envía un audio → "aprende esto: [información]"' },
                    { icon: '💬', text: 'Escribe "aprende esto: [datos del producto]"' },
                    { icon: '🧠', text: 'Escribe "recuerda que [instrucción permanente]"' },
                    { icon: '🤖', text: 'Escribe "crea un agente para [producto/carrier]"' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.5)', lineHeight: 1.5 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              {sources.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '16px', color: 'rgba(240,236,227,0.2)', fontStyle: 'italic' }}>Sin fuentes de entrenamiento</p>
                  <p style={{ color: 'rgba(240,236,227,0.15)', fontSize: '12px', marginTop: '6px' }}>Envía tu primer PDF o documento por WhatsApp</p>
                </div>
              ) : sources.map(s => (
                <div key={s.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.015)', borderRadius: '10px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{s.source_type === 'pdf' ? '📄' : s.source_type === 'url' ? '🌐' : s.source_type === 'audio' ? '🎤' : '📝'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#F0ECE3', fontSize: '13px', fontWeight: 600, margin: 0 }}>{s.title}</p>
                    {s.file_name && <p style={{ color: 'rgba(240,236,227,0.3)', fontSize: '10px', margin: '2px 0 0' }}>{s.file_name}</p>}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '100px', background: s.processed ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', color: s.processed ? '#34d399' : '#fbbf24' }}>{s.processed ? 'Procesado' : 'Pendiente'}</span>
                      <span style={{ fontSize: '10px', color: 'rgba(240,236,227,0.25)' }}>{new Date(s.created_at).toLocaleDateString('es')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'commands' && (
            <>
              <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>Comandos de WhatsApp</h3>
              <p style={{ color: C.textMuted, fontSize: '12px', marginBottom: '14px' }}>Envía estos comandos al +17722772510 desde el número maestro (+17869435656):</p>
              {[
                { cmd: '"aprende esto: [información]"', desc: 'Sophia aprende nueva información' },
                { cmd: '"recuerda que [instrucción]"', desc: 'Guarda en memoria permanente' },
                { cmd: '"olvida [tema]"', desc: 'Elimina conocimiento' },
                { cmd: '"activa skill [nombre]"', desc: 'Activa una habilidad' },
                { cmd: '"desactiva skill [nombre]"', desc: 'Desactiva una habilidad' },
                { cmd: '"muéstrame tu memoria"', desc: 'Lista recuerdos activos' },
                { cmd: '"qué skills tienes?"', desc: 'Lista habilidades' },
                { cmd: '"simula [escenario]"', desc: 'Prueba una conversación' },
                { cmd: '"crea un agente para [propósito]"', desc: 'Crea un agente IA nuevo' },
                { cmd: '[Enviar PDF]', desc: 'Sophia extrae conocimiento del documento' },
                { cmd: '[Enviar audio]', desc: 'Sophia transcribe y procesa' },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderBottom: i < 10 ? `1px solid ${C.border}` : 'none' }}>
                  <code style={{ fontSize: '11px', color: C.gold, fontWeight: 600, minWidth: '220px' }}>{c.cmd}</code>
                  <span style={{ fontSize: '11px', color: C.textDim }}>{c.desc}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
