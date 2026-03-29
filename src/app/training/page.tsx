'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

export default function TrainingPage() {
  const [stats, setStats] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genCount, setGenCount] = useState(10)
  const [genResult, setGenResult] = useState<any>(null)
  const [viewConvo, setViewConvo] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ count: total }, { count: approved }, { count: real }, { count: synthetic }] = await Promise.all([
      supabase.from('sophia_training_data').select('id', { count: 'exact', head: true }),
      supabase.from('sophia_training_data').select('id', { count: 'exact', head: true }).eq('approved', true),
      supabase.from('sophia_training_data').select('id', { count: 'exact', head: true }).eq('source', 'real'),
      supabase.from('sophia_training_data').select('id', { count: 'exact', head: true }).eq('source', 'synthetic'),
    ])
    const { data: scores } = await supabase.from('sophia_training_data').select('quality_score, outcome').eq('approved', true)
    const avgScore = scores?.length ? Math.round(scores.reduce((s, r) => s + r.quality_score, 0) / scores.length) : 0
    const closedPct = scores?.length ? Math.round((scores.filter(s => s.outcome === 'cerrado').length / scores.length) * 100) : 0

    setStats({ total: total || 0, approved: approved || 0, real: real || 0, synthetic: synthetic || 0, avgScore, closedPct })

    const { data } = await supabase.from('sophia_training_data').select('id, source, lead_profile, quality_score, outcome, approved, turns_to_close, conversation, created_at').order('created_at', { ascending: false }).limit(50)
    setRecords(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function generate() {
    setGenerating(true); setGenResult(null)
    try {
      const res = await fetch('/api/generate-training-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: genCount }) })
      setGenResult(await res.json())
      load()
    } catch {}
    setGenerating(false)
  }

  const progress = stats ? Math.min(100, Math.round(((stats.approved || 0) / 500) * 100)) : 0

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 700, margin: 0 }}>SophiaModel — Training Data</h1>
        <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '4px' }}>Pipeline de datos para fine-tuning</p>
      </div>

      {loading ? <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted }}>Cargando...</div> : (
        <>
          {/* Progress bar */}
          <div style={{ background: 'linear-gradient(145deg, #141420, #0e0e1a)', border: `1px solid ${C.border}`, borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: C.text, fontSize: '14px', fontWeight: 700 }}>Progreso hacia fine-tuning v1</span>
              <span style={{ color: C.gold, fontSize: '14px', fontWeight: 800 }}>{stats?.approved || 0}/500</span>
            </div>
            <div style={{ height: '10px', background: 'rgba(255,255,255,0.06)', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, #C9A84C, #E2C060)`, borderRadius: '5px', transition: 'width 0.5s' }} />
            </div>
            <p style={{ color: C.textMuted, fontSize: '11px', marginTop: '8px' }}>Faltan {Math.max(0, 500 - (stats?.approved || 0))} conversaciones para SophiaModel v1</p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Total', value: stats?.total || 0, color: '#60a5fa' },
              { label: 'Aprobados', value: stats?.approved || 0, color: '#34d399' },
              { label: 'Reales', value: stats?.real || 0, color: C.gold },
              { label: 'Sintéticos', value: stats?.synthetic || 0, color: '#a78bfa' },
              { label: 'Score prom.', value: stats?.avgScore || 0, color: '#fbbf24' },
              { label: '% Cierres', value: `${stats?.closedPct || 0}%`, color: '#f97316' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'linear-gradient(145deg, #141420, #0e0e1a)', border: `1px solid ${color}25`, borderRadius: '12px', padding: '16px', borderBottom: `2px solid ${color}` }}>
                <p style={{ color: C.textMuted, fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>{label}</p>
                <p style={{ color, fontSize: '24px', fontWeight: 800, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Generate + Export */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ background: 'linear-gradient(145deg, #141420, #0e0e1a)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '12px', padding: '16px', flex: 1, minWidth: '250px' }}>
              <p style={{ color: '#a78bfa', fontSize: '12px', fontWeight: 700, margin: '0 0 10px' }}>Generar datos sintéticos</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={genCount} onChange={e => setGenCount(+e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, fontSize: '13px', fontFamily: C.font }}>
                  <option value={5}>5</option><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
                </select>
                <button onClick={generate} disabled={generating} style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, fontFamily: C.font, cursor: 'pointer', background: generating ? 'rgba(167,139,250,0.2)' : 'linear-gradient(135deg, #a78bfa, #7c3aed)', color: 'white', border: 'none' }}>
                  {generating ? 'Generando...' : `Generar ${genCount}`}
                </button>
                <span style={{ color: C.textMuted, fontSize: '10px' }}>~${(genCount * 0.02).toFixed(2)} est.</span>
              </div>
              {genResult && <p style={{ color: '#34d399', fontSize: '11px', marginTop: '8px' }}>Generados: {genResult.generated} | Score prom: {genResult.avg_quality_score}</p>}
            </div>
            <div style={{ background: 'linear-gradient(145deg, #141420, #0e0e1a)', border: `1px solid ${C.gold}25`, borderRadius: '12px', padding: '16px', minWidth: '200px' }}>
              <p style={{ color: C.gold, fontSize: '12px', fontWeight: 700, margin: '0 0 10px' }}>Exportar dataset</p>
              <a href="/api/export-training?min_score=60" download style={{ display: 'inline-block', padding: '8px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', background: (stats?.approved || 0) >= 100 ? 'linear-gradient(135deg, #C9A84C, #8B6E2E)' : 'rgba(201,168,76,0.2)', color: (stats?.approved || 0) >= 100 ? '#07080A' : C.textMuted, pointerEvents: (stats?.approved || 0) >= 100 ? 'auto' : 'none' }}>
                Descargar .jsonl
              </a>
              <p style={{ color: C.textMuted, fontSize: '10px', marginTop: '6px' }}>{(stats?.approved || 0) >= 100 ? 'Listo para descargar' : `Necesitas 100+ aprobados (tienes ${stats?.approved || 0})`}</p>
            </div>
          </div>

          {/* Records table */}
          <div style={{ background: 'linear-gradient(145deg, #141420, #0e0e1a)', border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
              <h3 style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: 0 }}>Registros ({records.length})</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Fuente', 'Estado', 'Familia', 'Score', 'Resultado', 'Turnos', 'Fecha', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {records.map(r => {
                    const p = r.lead_profile as any
                    return (
                      <tr key={r.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                        <td style={{ padding: '10px 14px' }}><span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: r.source === 'real' ? 'rgba(201,168,76,0.1)' : 'rgba(167,139,250,0.1)', color: r.source === 'real' ? C.gold : '#a78bfa' }}>{r.source}</span></td>
                        <td style={{ padding: '10px 14px', color: C.textDim, fontSize: '12px' }}>{p?.state || '—'}</td>
                        <td style={{ padding: '10px 14px', color: C.textDim, fontSize: '12px' }}>{p?.family || '—'}</td>
                        <td style={{ padding: '10px 14px', color: r.quality_score >= 80 ? '#34d399' : r.quality_score >= 50 ? '#fbbf24' : '#f87171', fontSize: '13px', fontWeight: 700 }}>{r.quality_score}</td>
                        <td style={{ padding: '10px 14px', color: C.textDim, fontSize: '12px' }}>{r.outcome || '—'}</td>
                        <td style={{ padding: '10px 14px', color: C.textDim, fontSize: '12px' }}>{r.turns_to_close || '—'}</td>
                        <td style={{ padding: '10px 14px', color: C.textMuted, fontSize: '11px' }}>{new Date(r.created_at).toLocaleDateString('es')}</td>
                        <td style={{ padding: '10px 14px' }}><button onClick={() => setViewConvo(r)} style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '6px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', cursor: 'pointer', fontFamily: C.font }}>Ver</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Conversation viewer modal */}
          {viewConvo && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setViewConvo(null)}>
              <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: '16px', padding: '24px', width: '500px', maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ color: C.text, fontSize: '16px', fontWeight: 700, margin: 0 }}>Conversación (score: {viewConvo.quality_score})</h3>
                  <button onClick={() => setViewConvo(null)} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(viewConvo.conversation as any[])?.map((m: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: m.role === 'user' ? 'rgba(96,165,250,0.12)' : 'rgba(201,168,76,0.1)', border: `1px solid ${m.role === 'user' ? 'rgba(96,165,250,0.2)' : 'rgba(201,168,76,0.2)'}` }}>
                        <p style={{ color: C.text, fontSize: '12px', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
