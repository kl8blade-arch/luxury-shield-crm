'use client'
import { useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const PRODUCT_OPTIONS = [
  { key: 'dental', label: 'Dental', icon: '🦷', color: '#60a5fa' },
  { key: 'aca', label: 'ACA / Obamacare', icon: '🏥', color: '#34d399' },
  { key: 'vida', label: 'Vida / IUL', icon: '💰', color: '#C9A84C' },
  { key: 'medicare', label: 'Medicare', icon: '🏛️', color: '#a78bfa' },
  { key: 'suplementario', label: 'Suplementario', icon: '➕', color: '#f97316' },
  { key: 'auto', label: 'Auto', icon: '🚗', color: '#ef4444' },
  { key: 'hogar', label: 'Hogar / Property', icon: '🏠', color: '#06b6d4' },
  { key: 'otro', label: 'Otro', icon: '📋', color: '#6b7280' },
]

export default function SetupPage() {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Pre-fill from registration
  const [companyName, setCompanyName] = useState('')
  const [agencyUrl, setAgencyUrl] = useState('')
  const [noWebsite, setNoWebsite] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Products
  const [products, setProducts] = useState<string[]>([])

  // Preferences
  const [language, setLanguage] = useState('es')
  const [states, setStates] = useState('')

  const totalSteps = 3

  function toggleProduct(key: string) {
    setProducts(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = '' // reset
  }

  async function handleFinish() {
    if (!user) return
    setLoading(true)

    const update: any = {
      company_name: companyName || null,
      agency_url: noWebsite ? null : (agencyUrl || null),
      products,
      licensed_states: states.split(',').map(s => s.trim()).filter(Boolean),
      onboarding_complete: true,
      wa_onboarding_step: 'done',
    }
    if (logoPreview) update.profile_photo = logoPreview

    await supabase.from('agents').update(update).eq('id', user.id)

    if (user.account_id) {
      const accUpdate: any = {}
      if (logoPreview) accUpdate.logo_url = logoPreview
      if (companyName) accUpdate.name = companyName
      if (Object.keys(accUpdate).length) await supabase.from('accounts').update(accUpdate).eq('id', user.account_id)
    }

    const updated = { ...user, onboarding_complete: true }
    localStorage.setItem('ls_auth', JSON.stringify(updated))
    window.location.href = '/dashboard'
  }

  const inp: React.CSSProperties = { width: '100%', padding: '14px 18px', borderRadius: '12px', fontSize: '15px', fontFamily: '"Outfit",sans-serif', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700&family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050507', fontFamily: '"Outfit",sans-serif', position: 'relative', overflow: 'hidden', padding: '24px 16px' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />

        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleLogoFile} style={{ display: 'none' }} />

        <div style={{ width: '520px', maxWidth: '94vw', position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.5)', marginBottom: '8px' }}>PASO {step} DE {totalSteps}</p>
            <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '30px', fontWeight: 300, color: '#F0ECE3', margin: '0 0 8px' }}>Configura tu CRM</h1>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>Hola {user?.name?.split(' ')[0] || ''}! Solo unos detalles mas.</p>
            {/* Progress */}
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '16px' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ width: '60px', height: '4px', borderRadius: '2px', background: step >= i ? 'linear-gradient(90deg, #C9A84C, #34d399)' : 'rgba(255,255,255,0.06)', transition: 'all 0.3s' }} />
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '32px 28px', backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

            {/* ═══ STEP 1: Agency info ═══ */}
            {step === 1 && (
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F0ECE3', margin: '0 0 4px' }}>Tu agencia</h2>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '24px' }}>Personaliza tu CRM con tu marca</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Logo */}
                  <div>
                    <label style={lbl}>Logo <span style={{ opacity: 0.5 }}>(opcional)</span></label>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div onClick={() => fileRef.current?.click()} style={{
                        width: '72px', height: '72px', borderRadius: '16px', cursor: 'pointer',
                        background: logoPreview ? 'none' : 'rgba(201,168,76,0.04)',
                        border: `2px dashed ${logoPreview ? 'rgba(52,211,153,0.3)' : 'rgba(201,168,76,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
                        transition: 'all 0.2s',
                      }}>
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '24px', opacity: 0.4 }}>📷</span>
                        )}
                      </div>
                      <div>
                        <button onClick={() => fileRef.current?.click()} style={{
                          padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
                          color: '#C9A84C', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '4px', display: 'block',
                        }}>
                          {logoPreview ? 'Cambiar logo' : 'Subir logo'}
                        </button>
                        <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.25)', margin: 0 }}>PNG, JPG. Aparecera en tu CRM.</p>
                      </div>
                    </div>
                  </div>

                  {/* Company name */}
                  <div>
                    <label style={lbl}>Nombre de tu agencia <span style={{ opacity: 0.5 }}>(opcional)</span></label>
                    <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ej: Miami Insurance Group" style={inp} />
                  </div>

                  {/* URL with "no tengo" option */}
                  <div>
                    <label style={lbl}>Pagina web</label>
                    {noWebsite ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.35)' }}>No tengo pagina web</span>
                        <button onClick={() => setNoWebsite(false)} style={{ marginLeft: 'auto', fontSize: '11px', color: '#C9A84C', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Agregar URL</button>
                      </div>
                    ) : (
                      <div>
                        <input type="url" value={agencyUrl} onChange={e => setAgencyUrl(e.target.value)} placeholder="https://miagencia.com" style={inp} />
                        <button onClick={() => { setNoWebsite(true); setAgencyUrl('') }} style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginTop: '6px', padding: 0 }}>No tengo pagina web</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ STEP 2: Products ═══ */}
            {step === 2 && (
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F0ECE3', margin: '0 0 4px' }}>Que vendes?</h2>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '24px' }}>Sophia se configura segun tus productos</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {PRODUCT_OPTIONS.map(p => {
                    const selected = products.includes(p.key)
                    return (
                      <div key={p.key} onClick={() => toggleProduct(p.key)} style={{
                        padding: '16px', borderRadius: '14px', cursor: 'pointer',
                        background: selected ? `${p.color}08` : 'rgba(255,255,255,0.015)',
                        border: `1px solid ${selected ? p.color + '40' : 'rgba(255,255,255,0.06)'}`,
                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px',
                      }}>
                        <span style={{ fontSize: '22px' }}>{p.icon}</span>
                        <span style={{ fontSize: '13px', fontWeight: selected ? 600 : 400, color: selected ? p.color : '#F0ECE3' }}>{p.label}</span>
                        {selected && <span style={{ marginLeft: 'auto', color: p.color, fontSize: '14px' }}>&#10003;</span>}
                      </div>
                    )
                  })}
                </div>
                {products.length === 0 && <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.25)', textAlign: 'center', marginTop: '12px' }}>Selecciona al menos uno para continuar</p>}
              </div>
            )}

            {/* ═══ STEP 3: Preferences ═══ */}
            {step === 3 && (
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F0ECE3', margin: '0 0 4px' }}>Ultimos detalles</h2>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '24px' }}>Personaliza la experiencia de Sophia</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={lbl}>Idioma principal de tus clientes</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                      {[
                        { key: 'es', label: 'Espanol', flag: '🇪🇸' },
                        { key: 'en', label: 'English', flag: '🇺🇸' },
                        { key: 'zh', label: 'Mandarin', flag: '🇨🇳' },
                        { key: 'ht', label: 'Creole', flag: '🇭🇹' },
                      ].map(l => (
                        <div key={l.key} onClick={() => setLanguage(l.key)} style={{
                          padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                          background: language === l.key ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${language === l.key ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                          <span style={{ fontSize: '18px' }}>{l.flag}</span>
                          <p style={{ fontSize: '12px', color: language === l.key ? '#C9A84C' : 'rgba(240,236,227,0.4)', margin: '4px 0 0', fontWeight: language === l.key ? 600 : 400 }}>{l.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={lbl}>Estados donde vendes <span style={{ opacity: 0.5 }}>(opcional)</span></label>
                    <input type="text" value={states} onChange={e => setStates(e.target.value)} placeholder="FL, TX, CA, NY" style={inp} />
                  </div>
                </div>

                {/* Summary */}
                <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'rgba(52,211,153,0.03)', border: '1px solid rgba(52,211,153,0.12)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', letterSpacing: '0.1em', margin: '0 0 8px' }}>TU CRM INCLUYE</p>
                  {[
                    'Sophia IA vendiendo 24/7 por WhatsApp',
                    `${products.length} producto${products.length !== 1 ? 's' : ''} configurado${products.length !== 1 ? 's' : ''}`,
                    'Pipeline inteligente + Lead scoring',
                    'Coaching en tiempo real',
                  ].map(f => (
                    <div key={f} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#34d399', fontSize: '11px' }}>&#10003;</span>
                      <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.45)' }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)} style={{
                  flex: 1, padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
                  fontFamily: 'inherit', background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(240,236,227,0.4)', cursor: 'pointer',
                }}>Atras</button>
              )}
              {step < totalSteps ? (
                <button onClick={() => {
                  if (step === 2 && products.length === 0) return
                  setStep(s => s + 1)
                }} disabled={step === 2 && products.length === 0} style={{
                  flex: 2, padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                  fontFamily: 'inherit', letterSpacing: '0.02em',
                  background: (step === 2 && products.length === 0) ? 'rgba(201,168,76,0.15)' : 'linear-gradient(135deg, #C9A84C, #A8893A)',
                  color: (step === 2 && products.length === 0) ? 'rgba(240,236,227,0.3)' : '#050507',
                  border: 'none', cursor: (step === 2 && products.length === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: (step === 2 && products.length === 0) ? 'none' : '0 4px 16px rgba(201,168,76,0.2)',
                }}>Siguiente</button>
              ) : (
                <button onClick={handleFinish} disabled={loading} style={{
                  flex: 2, padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                  fontFamily: 'inherit', letterSpacing: '0.02em',
                  background: loading ? 'rgba(52,211,153,0.3)' : 'linear-gradient(135deg, #34d399, #059669)',
                  color: '#050507', border: 'none', cursor: loading ? 'wait' : 'pointer',
                  boxShadow: '0 4px 16px rgba(52,211,153,0.2)',
                }}>{loading ? 'Configurando...' : 'Lanzar mi CRM'}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
