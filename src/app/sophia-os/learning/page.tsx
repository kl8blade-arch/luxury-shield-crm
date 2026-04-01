'use client'
import { useEffect, useState } from 'react'

export default function LearningPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/learning/stats').then(r => r.json()).then(d => { setStats(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#666', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit",sans-serif' }}>Cargando...</div>

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit",sans-serif' }}>
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(167,139,250,0.6)', marginBottom: '6px' }}>SOPHIA OS</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '44px', color: '#F0ECE3', margin: 0 }}>Aprendizaje Colectivo</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Sophia aprende de cada conversacion. Los datos son anonimizados y ningun agente puede ver datos de otro.</p>
        </div>

        {/* Active model */}
        <div style={{ padding: '20px', borderRadius: '16px', background: stats?.activeModel ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.015)', border: `1px solid ${stats?.activeModel ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)'}`, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: stats?.activeModel ? '#34d399' : 'rgba(240,236,227,0.3)', letterSpacing: '0.1em', margin: '0 0 4px' }}>MODELO ACTIVO</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#F0ECE3', margin: 0 }}>
                {stats?.activeModel ? `SophiaModel ${stats.activeModel.version}` : 'Claude Haiku 4.5 (base)'}
              </p>
              {stats?.activeModel?.provider_model_id && <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)', margin: '2px 0 0', fontFamily: 'monospace' }}>{stats.activeModel.provider_model_id}</p>}
            </div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: stats?.activeModel ? '#34d399' : '#fbbf24', boxShadow: `0 0 8px ${stats?.activeModel ? 'rgba(52,211,153,0.5)' : 'rgba(251,191,36,0.5)'}` }} />
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Patrones totales', value: stats?.totalPatterns || 0, color: '#a78bfa' },
            { label: 'Alta calidad', value: stats?.highQualityPatterns || 0, color: '#34d399' },
            { label: 'Convos procesadas', value: stats?.totalProcessed || 0, color: '#60a5fa' },
            { label: 'Modelos entrenados', value: stats?.jobs?.length || 0, color: '#C9A84C' },
          ].map(s => (
            <div key={s.label} style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderBottom: `2px solid ${s.color}30` }}>
              <p style={{ fontSize: '28px', fontWeight: 800, color: s.color, margin: '0 0 4px', fontFamily: '"DM Serif Display",serif' }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
              <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.35)', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* By industry */}
        <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(240,236,227,0.3)', letterSpacing: '0.1em', marginBottom: '12px' }}>PATRONES POR INDUSTRIA</p>
          {(stats?.byIndustry || []).length === 0 ? (
            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.2)' }}>Sin patrones aun. Se generan automaticamente cada noche.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(stats?.byIndustry || []).map((ind: any) => {
                const max = Math.max(...(stats?.byIndustry || []).map((i: any) => i.count || 0), 1)
                return (
                  <div key={ind.industry} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.5)', width: '120px', textTransform: 'capitalize' }}>{ind.industry}</span>
                    <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(ind.count / max) * 100}%`, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)', borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', width: '40px', textAlign: 'right' }}>{ind.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Fine-tuning history */}
        <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(240,236,227,0.3)', letterSpacing: '0.1em', marginBottom: '12px' }}>HISTORIAL DE MODELOS</p>
          {(stats?.jobs || []).length === 0 ? (
            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.2)' }}>Sin modelos entrenados aun. El primer fine-tuning se ejecuta el dia 1 del proximo mes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(stats?.jobs || []).map((job: any) => (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: job.is_active ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.01)', border: `1px solid ${job.is_active ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.03)'}` }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: job.is_active ? '#34d399' : 'rgba(240,236,227,0.4)' }}>{job.version}</span>
                  <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)' }}>{job.training_period}</span>
                  <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)' }}>{job.total_examples} ejemplos</span>
                  {job.estimated_cost_usd && <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)' }}>${job.estimated_cost_usd}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: '10px', padding: '3px 10px', borderRadius: '100px', fontWeight: 600, background: job.is_active ? 'rgba(52,211,153,0.1)' : job.status === 'succeeded' ? 'rgba(96,165,250,0.1)' : 'rgba(251,191,36,0.1)', color: job.is_active ? '#34d399' : job.status === 'succeeded' ? '#60a5fa' : '#fbbf24' }}>
                    {job.is_active ? 'ACTIVO' : job.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last batch */}
        {stats?.lastBatch && (
          <div style={{ padding: '16px 20px', borderRadius: '14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(240,236,227,0.3)', letterSpacing: '0.1em', marginBottom: '8px' }}>ULTIMO BATCH</p>
            <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: 'rgba(240,236,227,0.4)' }}>
              <span>📅 {stats.lastBatch.batch_date}</span>
              <span>💬 {stats.lastBatch.conversations_processed || 0} procesadas</span>
              <span>✨ {stats.lastBatch.patterns_extracted || 0} patrones</span>
              <span style={{ color: stats.lastBatch.status === 'completed' ? '#34d399' : '#fbbf24' }}>{stats.lastBatch.status}</span>
            </div>
          </div>
        )}

        {/* Manual trigger */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button onClick={async () => {
            const res = await fetch('/api/learning/daily-batch')
            const data = await res.json()
            alert(`Batch completado: ${data.stats?.extracted || 0} patrones extraidos de ${data.stats?.processed || 0} conversaciones`)
          }} style={{ padding: '10px 24px', borderRadius: '10px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Forzar batch ahora
          </button>
        </div>
      </div>
    </>
  )
}
