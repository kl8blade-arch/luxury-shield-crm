'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

export default function SophiaOSPage() {
  const [memories, setMemories] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [knowledge, setKnowledge] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'memory' | 'skills' | 'knowledge' | 'agents' | 'commands'>('memory')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: m }, { data: s }, { data: k }, { data: a }] = await Promise.all([
      supabase.from('sophia_memory').select('*').eq('active', true).order('importance', { ascending: false }),
      supabase.from('sophia_skills').select('*').order('active', { ascending: false }),
      supabase.from('sophia_knowledge').select('*').eq('active', true).order('created_at', { ascending: false }),
      supabase.from('sophia_agents').select('*').order('created_at', { ascending: false }),
    ])
    setMemories(m || []); setSkills(s || []); setKnowledge(k || []); setAgents(a || [])
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
    { key: 'memory' as const, label: 'Memoria', count: memories.length },
    { key: 'skills' as const, label: 'Skills', count: skills.length },
    { key: 'knowledge' as const, label: 'Conocimiento', count: knowledge.length },
    { key: 'agents' as const, label: 'Agentes', count: agents.length },
    { key: 'commands' as const, label: 'Comandos', count: 0 },
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
          }}>{t.label}{t.count > 0 ? ` (${t.count})` : ''}</button>
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
              <h3 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>Agentes creados</h3>
              {agents.length === 0 ? <p style={{ color: C.textMuted, fontSize: '13px' }}>Sin agentes. Envía "crea un agente para..." por WhatsApp.</p> :
                agents.map(a => (
                  <div key={a.id} style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', marginBottom: '8px', border: `1px solid ${a.active ? 'rgba(167,139,250,0.2)' : C.border}` }}>
                    <p style={{ color: '#a78bfa', fontSize: '14px', fontWeight: 700, margin: '0 0 4px' }}>{a.name}</p>
                    <p style={{ color: C.textDim, fontSize: '12px', margin: '0 0 8px' }}>{a.purpose}</p>
                    <details><summary style={{ color: C.textMuted, fontSize: '11px', cursor: 'pointer' }}>Ver prompt</summary>
                      <pre style={{ fontSize: '10px', color: C.textDim, whiteSpace: 'pre-wrap', marginTop: '8px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>{a.system_prompt?.substring(0, 500)}</pre>
                    </details>
                  </div>
                ))
              }
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
