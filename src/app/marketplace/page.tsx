'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'
import FileUpload from '@/components/FileUpload'

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
  const [buildAnswer, setBuildAnswer] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Wizard state
  const [wizardActive, setWizardActive] = useState(false)
  const [wizardBuildId, setWizardBuildId] = useState<string | null>(null)
  const [wizardQuestion, setWizardQuestion] = useState('')
  const [wizardQNum, setWizardQNum] = useState(0)
  const [wizardTotal, setWizardTotal] = useState(0)
  const [wizardIsPhoto, setWizardIsPhoto] = useState(false)
  const [wizardComplete, setWizardComplete] = useState(false)
  const [wizardUrl, setWizardUrl] = useState('')
  const [wizardError, setWizardError] = useState('')

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
    setSubmitting(true)
    setWizardError('')
    try {
      const res = await fetch('/api/landing-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId }),
      })
      const data = await res.json()
      if (!res.ok) { setWizardError(data.error || 'Error al iniciar'); setSubmitting(false); return }

      setWizardBuildId(data.build_id)
      setWizardQuestion(data.first_question || data.message || 'Nombre de tu agencia')
      setWizardQNum(1)
      setWizardTotal(data.total_questions || 5)
      setWizardIsPhoto(data.first_type === 'photo')
      setWizardComplete(false)
      setWizardActive(true)
      setTab('my_landings')
    } catch { setWizardError('Error de conexion') }
    setSubmitting(false)
  }

  async function submitAnswer() {
    if (!buildAnswer.trim() || !wizardBuildId) return
    setSubmitting(true)
    setWizardError('')
    try {
      const res = await fetch('/api/landing-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ build_id: wizardBuildId, answer: buildAnswer }),
      })
      const data = await res.json()
      if (!res.ok) { setWizardError(data.error || 'Error'); setSubmitting(false); return }

      setBuildAnswer('')
      setPhotoPreview(null)

      if (data.status === 'complete') {
        setWizardComplete(true)
        setWizardUrl(data.url || '')
        setWizardActive(false)
        load()
      } else {
        setWizardQuestion(data.question || data.message || 'Siguiente...')
        setWizardQNum(data.question_number || wizardQNum + 1)
        setWizardTotal(data.total_questions || wizardTotal)
        setWizardIsPhoto(data.is_photo || false)
      }
    } catch { setWizardError('Error de conexion') }
    setSubmitting(false)
  }

  function handleFileUpload(file: File, dataUrl?: string) {
    if (dataUrl) {
      setPhotoPreview(dataUrl)
      setBuildAnswer(dataUrl)
    }
  }

  // Resume a build that was left incomplete
  async function resumeBuild(buildId: string) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/landing-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ build_id: buildId }),
      })
      const data = await res.json()
      if (data.status === 'complete') {
        setWizardComplete(true)
        setWizardUrl(data.url || '')
        load()
      } else {
        setWizardBuildId(buildId)
        setWizardQuestion(data.question || data.message || 'Siguiente...')
        setWizardQNum(data.question_number || 1)
        setWizardTotal(data.total_questions || 5)
        setWizardIsPhoto(data.is_photo || false)
        setWizardComplete(false)
        setWizardActive(true)
      }
    } catch {}
    setSubmitting(false)
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
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Elige un template, contesta las preguntas, y tu landing esta lista en minutos</p>
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

            {loading ? <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,227,0.3)' }}>Cargando...</div> : templates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ fontSize: '48px', opacity: 0.15, marginBottom: '12px' }}>🌐</p>
                <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '18px', color: 'rgba(240,236,227,0.25)', fontStyle: 'italic' }}>No hay templates disponibles en esta categoria</p>
                <p style={{ color: 'rgba(240,236,227,0.15)', fontSize: '13px', marginTop: '8px' }}>Prueba otra categoria o contacta al admin</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {templates.map(t => {
                  const cat = CATEGORIES.find(c => c.key === t.category)
                  const vars = (t.variables as any[]) || []
                  const photoCount = vars.filter((v: any) => v.type === 'photo').length

                  return (
                    <div key={t.id} style={{
                      background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '18px', padding: '24px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,0.2)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}>

                      <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                        {t.is_free ? (
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>GRATIS</span>
                        ) : (
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>PREMIUM</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat?.color || '#C9A84C' }} />
                        <span style={{ fontSize: '10px', fontWeight: 600, color: cat?.color || '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.category}</span>
                      </div>

                      <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '22px', color: '#F0ECE3', margin: '0 0 8px' }}>{t.name}</h3>
                      {t.hook && <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: '0 0 12px', lineHeight: 1.4 }}>{t.hook}</p>}

                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                        <span>{vars.length} preguntas</span>
                        {photoCount > 0 && <span>{photoCount} fotos</span>}
                        <span>{t.sales_count || 0} usos</span>
                      </div>

                      {(t.tags || []).length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '16px' }}>
                          {(t.tags || []).slice(0, 4).map((tag: string) => (
                            <span key={tag} style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', color: 'rgba(240,236,227,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>{tag}</span>
                          ))}
                        </div>
                      )}

                      <button onClick={() => startBuild(t.id)} disabled={submitting} style={{
                        width: '100%', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                        fontFamily: 'inherit', cursor: submitting ? 'wait' : 'pointer',
                        background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#06070B',
                        border: 'none', boxShadow: '0 4px 16px rgba(201,168,76,0.2)',
                      }}>Crear mi landing &rarr;</button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'my_landings' && (
          <>
            {/* ═══ ACTIVE WIZARD ═══ */}
            {wizardActive && (
              <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ color: '#C9A84C', fontSize: '13px', fontWeight: 700 }}>Construyendo landing...</p>
                  <span style={{ color: 'rgba(240,236,227,0.4)', fontSize: '11px' }}>Pregunta {wizardQNum}/{wizardTotal}</span>
                </div>

                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(wizardQNum / wizardTotal) * 100}%`, background: 'linear-gradient(90deg, #C9A84C, #E2C060)', borderRadius: '2px', transition: 'width 0.3s' }} />
                </div>

                <p style={{ color: '#F0ECE3', fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>{wizardQuestion}</p>

                {wizardError && <p style={{ color: '#fca5a5', fontSize: '12px', marginBottom: '8px' }}>{wizardError}</p>}

                {wizardIsPhoto ? (
                  <div>
                    {/* Photo upload area */}
                    {photoPreview ? (
                      <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                        <img src={photoPreview} alt="Preview" style={{ maxHeight: '160px', borderRadius: '12px', border: '2px solid rgba(201,168,76,0.3)' }} />
                        <p style={{ fontSize: '11px', color: '#34d399', marginTop: '6px' }}>Foto lista</p>
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <FileUpload accept="image/*" onFile={handleFileUpload} style={{
                        flex: 1, padding: '16px', borderRadius: '12px', textAlign: 'center',
                        background: 'rgba(201,168,76,0.04)', border: '2px dashed rgba(201,168,76,0.2)',
                        color: '#C9A84C', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      }}>
                        <span style={{ fontSize: '20px' }}>📸</span>
                        <span>{photoPreview ? 'Cambiar foto' : 'Seleccionar de galeria'}</span>
                      </FileUpload>
                      <button onClick={() => { setBuildAnswer('saltar'); setPhotoPreview(null); submitAnswer() }}
                        style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,236,227,0.4)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        Saltar
                      </button>
                    </div>
                    {photoPreview && (
                      <button onClick={() => { setPhotoPreview(null); submitAnswer() }} style={{
                        width: '100%', marginTop: '10px', padding: '12px', borderRadius: '12px',
                        background: '#C9A84C', color: '#06070B', fontSize: '13px', fontWeight: 700,
                        border: 'none', cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
                      }}>
                        {submitting ? 'Subiendo...' : 'Usar esta foto \u2192'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={buildAnswer} onChange={e => setBuildAnswer(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitAnswer()}
                      placeholder="Tu respuesta..."
                      style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', fontSize: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: 'inherit' }} />
                    <button onClick={submitAnswer} disabled={submitting || !buildAnswer.trim()} style={{
                      padding: '12px 24px', borderRadius: '12px', background: submitting ? 'rgba(201,168,76,0.3)' : '#C9A84C',
                      color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none',
                      cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
                    }}>{submitting ? '...' : '\u2192'}</button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ COMPLETION BANNER ═══ */}
            {wizardComplete && wizardUrl && (
              <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '16px', padding: '24px', marginBottom: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '24px', marginBottom: '8px' }}>&#10003;</p>
                <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '20px', color: '#34d399', margin: '0 0 8px' }}>Tu landing esta lista!</p>
                <a href={wizardUrl} target="_blank" style={{ color: '#C9A84C', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>{wizardUrl} &rarr;</a>
                <div style={{ marginTop: '12px' }}>
                  <button onClick={() => setWizardComplete(false)} style={{ padding: '8px 20px', borderRadius: '8px', background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,236,227,0.4)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
                </div>
              </div>
            )}

            {/* ═══ BUILDS LIST ═══ */}
            <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '20px', color: '#F0ECE3', margin: '0 0 16px' }}>Mis Landing Pages</h3>

            {builds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontSize: '48px', opacity: 0.15, marginBottom: '12px' }}>🌐</p>
                <p style={{ color: 'rgba(240,236,227,0.2)', fontSize: '14px', fontStyle: 'italic' }}>Aun no has creado landings. Ve a Templates y elige una.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                {builds.map(b => {
                  const tmpl = b.landing_templates as any
                  const isReady = b.status === 'ready'
                  const isInProgress = b.status === 'collecting_info'
                  return (
                    <div key={b.id} style={{ padding: '18px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{tmpl?.name || 'Landing'}</span>
                        <span style={{
                          fontSize: '10px', padding: '2px 8px', borderRadius: '100px',
                          background: isReady ? 'rgba(52,211,153,0.1)' : isInProgress ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.05)',
                          color: isReady ? '#34d399' : isInProgress ? '#fbbf24' : '#6b7280',
                        }}>
                          {isReady ? 'Lista' : isInProgress ? 'En proceso' : b.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                        {b.visits > 0 && <span>{b.visits} visitas</span>}
                        {b.conversions > 0 && <span>{b.conversions} conversiones</span>}
                        <span>{new Date(b.created_at).toLocaleDateString('es')}</span>
                      </div>
                      {isReady && b.slug && (
                        <a href={`/l/${b.slug}`} target="_blank" style={{ display: 'block', marginTop: '10px', padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textAlign: 'center', textDecoration: 'none', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', color: '#C9A84C' }}>Ver landing &rarr;</a>
                      )}
                      {isInProgress && (
                        <button onClick={() => resumeBuild(b.id)} style={{ display: 'block', width: '100%', marginTop: '10px', padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textAlign: 'center', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24', cursor: 'pointer', fontFamily: 'inherit' }}>Continuar &rarr;</button>
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
