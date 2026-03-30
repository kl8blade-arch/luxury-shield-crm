'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

const CATEGORIES = [
  { key: 'all', label: 'Todos' },
  { key: 'dental', label: 'Dental', color: '#34d399' },
  { key: 'aca', label: 'ACA', color: '#60a5fa' },
  { key: 'vida', label: 'Vida/IUL', color: '#a78bfa' },
  { key: 'medicare', label: 'Medicare', color: '#fbbf24' },
  { key: 'multi', label: 'Multi-Producto', color: '#f97316' },
]

export default function MarketplacePage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [builds, setBuilds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [tab, setTab] = useState<'browse' | 'my_landings'>('browse')
  const [building, setBuilding] = useState<any>(null)
  const [buildAnswer, setBuildAnswer] = useState('')
  const [buildStatus, setBuildStatus] = useState<any>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    let q = supabase.from('landing_templates').select('*').eq('active', true).order('sales_count', { ascending: false })
    if (filter !== 'all') q = q.eq('category', filter)
    const { data: t } = await q
    const { data: b } = await supabase.from('landing_builds').select('*, landing_templates(name, category)').order('created_at', { ascending: false }).limit(20)
    setTemplates(t || [])
    setBuilds(b || [])
    setLoading(false)
  }

  async function startBuild(templateId: string) {
    const res = await fetch('/api/landing-builder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId }),
    })
    const data = await res.json()
    setBuilding(data)
    setBuildStatus(data)
    setTab('my_landings')
  }

  async function submitAnswer() {
    if (!buildAnswer.trim() || !building?.build_id) return
    const res = await fetch('/api/landing-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ build_id: building.build_id, answer: buildAnswer }),
    })
    const data = await res.json()
    setBuildStatus(data)
    setBuildAnswer('')
    if (data.status === 'complete') { setBuilding(null); load() }
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif' }}>

        <div style={{ position: 'absolute', top: '-10%', left: '50%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(201,168,76,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>MARKETPLACE</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Landing Pages</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Elige un template, contesta las preguntas, y tu landing está lista en minutos</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
          {[{ k: 'browse' as const, l: 'Templates' }, { k: 'my_landings' as const, l: `Mis Landings (${builds.filter(b => b.status === 'ready').length})` }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: tab === t.k ? 700 : 400, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: tab === t.k ? 'rgba(201,168,76,0.08)' : 'transparent', color: tab === t.k ? '#C9A84C' : 'rgba(240,236,227,0.4)' }}>{t.l}</button>
          ))}
        </div>

        {tab === 'browse' && (
          <>
            {/* Category filters */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setFilter(c.key)} style={{
                  padding: '7px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: filter === c.key ? 700 : 400,
                  fontFamily: 'inherit', cursor: 'pointer', border: 'none',
                  background: filter === c.key ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',
                  color: filter === c.key ? '#C9A84C' : 'rgba(240,236,227,0.4)',
                }}>{c.label}</button>
              ))}
            </div>

            {/* Templates grid */}
            {loading ? <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,227,0.3)' }}>Cargando...</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {templates.map(t => {
                  const cat = CATEGORIES.find(c => c.key === t.category)
                  const vars = (t.variables as any[]) || []
                  const photoCount = vars.filter((v: any) => v.type === 'photo').length

                  return (
                    <div key={t.id} style={{
                      background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '18px', padding: '24px', position: 'relative', overflow: 'hidden',
                      transition: 'all 0.2s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,0.2)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}>

                      {/* Badge */}
                      <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                        {t.is_free ? (
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>GRATIS</span>
                        ) : (
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>PREMIUM</span>
                        )}
                      </div>

                      {/* Category dot */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat?.color || '#C9A84C' }} />
                        <span style={{ fontSize: '10px', fontWeight: 600, color: cat?.color || '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.category}</span>
                      </div>

                      <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '22px', color: '#F0ECE3', margin: '0 0 8px' }}>{t.name}</h3>

                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                        <span>{vars.length} preguntas</span>
                        <span>{photoCount} fotos</span>
                        <span>{t.sales_count || 0} usos</span>
                        <span>★ {t.rating?.toFixed(1) || '5.0'}</span>
                      </div>

                      {/* Tags */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {(t.tags || []).slice(0, 4).map((tag: string) => (
                          <span key={tag} style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', color: 'rgba(240,236,227,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>{tag}</span>
                        ))}
                      </div>

                      <button onClick={() => startBuild(t.id)} style={{
                        width: '100%', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                        fontFamily: 'inherit', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#06070B',
                        border: 'none', boxShadow: '0 4px 16px rgba(201,168,76,0.2)',
                      }}>Crear mi landing →</button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'my_landings' && (
          <>
            {/* Active build wizard */}
            {buildStatus && buildStatus.status === 'collecting' && (
              <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ color: '#C9A84C', fontSize: '13px', fontWeight: 700 }}>Construyendo landing...</p>
                  <span style={{ color: 'rgba(240,236,227,0.4)', fontSize: '11px' }}>Pregunta {buildStatus.question_number}/{buildStatus.total_questions}</span>
                </div>

                {/* Progress bar */}
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(buildStatus.question_number / buildStatus.total_questions) * 100}%`, background: 'linear-gradient(90deg, #C9A84C, #E2C060)', borderRadius: '2px', transition: 'width 0.3s' }} />
                </div>

                <p style={{ color: '#F0ECE3', fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>{buildStatus.question || buildStatus.message}</p>

                {buildStatus.is_photo ? (
                  <p style={{ color: 'rgba(240,236,227,0.4)', fontSize: '12px', fontStyle: 'italic' }}>📸 Envía la foto por WhatsApp o sube desde tu dispositivo</p>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={buildAnswer} onChange={e => setBuildAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitAnswer()}
                      placeholder="Tu respuesta..." style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', fontSize: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: 'inherit' }} />
                    <button onClick={submitAnswer} style={{ padding: '12px 24px', borderRadius: '12px', background: '#C9A84C', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>→</button>
                  </div>
                )}
              </div>
            )}

            {buildStatus?.status === 'complete' && (
              <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '16px', padding: '24px', marginBottom: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '24px', marginBottom: '8px' }}>✅</p>
                <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '20px', color: '#34d399', margin: '0 0 8px' }}>¡Tu landing está lista!</p>
                <a href={buildStatus.url} target="_blank" style={{ color: '#C9A84C', fontSize: '14px', fontWeight: 600 }}>{buildStatus.url} →</a>
              </div>
            )}

            {/* My builds list */}
            <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '20px', color: '#F0ECE3', margin: '0 0 16px' }}>Mis Landing Pages</h3>

            {builds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ color: 'rgba(240,236,227,0.2)', fontSize: '14px', fontStyle: 'italic' }}>Aún no has creado landings. Ve a Templates y elige una.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                {builds.map(b => {
                  const tmpl = b.landing_templates as any
                  return (
                    <div key={b.id} style={{ padding: '18px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{tmpl?.name || 'Landing'}</span>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: b.status === 'ready' ? 'rgba(52,211,153,0.1)' : b.status === 'collecting_info' ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.05)', color: b.status === 'ready' ? '#34d399' : b.status === 'collecting_info' ? '#fbbf24' : '#6b7280' }}>
                          {b.status === 'ready' ? 'Lista' : b.status === 'collecting_info' ? 'En proceso' : b.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                        {b.visits > 0 && <span>{b.visits} visitas</span>}
                        {b.conversions > 0 && <span>{b.conversions} conversiones</span>}
                        <span>{new Date(b.created_at).toLocaleDateString('es')}</span>
                      </div>
                      {b.slug && b.status === 'ready' && (
                        <a href={`/l/${b.slug}`} target="_blank" style={{ display: 'block', marginTop: '10px', padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', color: '#C9A84C' }}>Ver landing →</a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
