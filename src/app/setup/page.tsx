'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const PRODUCT_OPTIONS = [
  { key: 'dental', label: 'Dental (DVH Plus)', icon: '🦷', color: '#60a5fa' },
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
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1 — Personal info
  const [agentName, setAgentName] = useState(user?.name || '')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [agencyUrl, setAgencyUrl] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Step 2 — Products
  const [products, setProducts] = useState<string[]>([])

  // Step 3 — Preferences
  const [language, setLanguage] = useState('es')
  const [states, setStates] = useState('')

  const totalSteps = 3

  function toggleProduct(key: string) {
    setProducts(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleFinish() {
    if (!user) return
    setLoading(true)

    const agentUpdate: any = {
      name: agentName || user.name,
      phone: phone || undefined,
      company_name: companyName || null,
      agency_url: agencyUrl || null,
      products: products,
      licensed_states: states.split(',').map(s => s.trim()).filter(Boolean),
      onboarding_complete: true,
      wa_onboarding_step: 'done',
    }
    if (logoPreview) agentUpdate.profile_photo = logoPreview

    await supabase.from('agents').update(agentUpdate).eq('id', user.id)

    // Also update account logo if exists
    if (user.account_id && logoPreview) {
      await supabase.from('accounts').update({ logo_url: logoPreview, name: companyName || undefined }).eq('id', user.account_id)
    }

    // Update local storage
    const updated = { ...user, onboarding_complete: true }
    localStorage.setItem('ls_auth', JSON.stringify(updated))
    window.location.href = '/dashboard'
  }

  const inputStyle = {
    width: '100%', padding: '14px 18px', borderRadius: '12px', fontSize: '15px',
    fontFamily: '"Outfit",sans-serif', background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none',
    boxSizing: 'border-box' as const,
  }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700&family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050507', fontFamily: '"Outfit",sans-serif', position: 'relative', overflow: 'hidden' }}>

        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ width: '520px', maxWidth: '94vw', position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '32px', fontWeight: 300, color: '#F0ECE3', margin: '0 0 8px' }}>Configura tu CRM</h1>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>Paso {step} de {totalSteps}</p>
            {/* Progress bar */}
            <div style={{ width: '200px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', margin: '16px auto 0', overflow: 'hidden' }}>
              <div style={{ width: `${(step / totalSteps) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #C9A84C, #34d399)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px', padding: '36px 32px',
            backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}>

            {/* STEP 1: Personal info */}
            {step === 1 && (
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F0ECE3', margin: '0 0 4px' }}>Informacion personal</h2>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '24px' }}>Datos basicos de tu perfil y agencia</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Logo upload */}
                  <div>
                    <label style={labelStyle}>Logo de tu agencia</label>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <label style={{
                        width: '72px', height: '72px', borderRadius: '16px', cursor: 'pointer',
                        background: logoPreview ? 'none' : 'rgba(201,168,76,0.04)',
                        border: `2px dashed ${logoPreview ? 'rgba(52,211,153,0.3)' : 'rgba(201,168,76,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
                      }}>
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '24px', opacity: 0.4 }}>📷</span>
                        )}
                        <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                      </label>
                      <div>
                        <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.5)', margin: 0 }}>
                          {logoPreview ? 'Logo cargado. Toca para cambiar.' : 'Toca para subir tu logo (PNG, JPG)'}
                        </p>
                        <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.25)', margin: '4px 0 0' }}>Aparecera en tu CRM y landing pages</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Tu nombre completo *</label>
                    <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)}
                      placeholder="Juan Perez" required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Telefono de contacto *</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+1 (786) 555-0000" required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Nombre de tu agencia <span style={{ opacity: 0.5 }}>(si tienes)</span></label>
                    <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                      placeholder="Miami Insurance Group" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>URL de tu agencia <span style={{ opacity: 0.5 }}>(si tienes)</span></label>
                    <input type="url" value={agencyUrl} onChange={e => setAgencyUrl(e.target.value)}
                      placeholder="https://miagencia.com" style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Products */}
            {step === 2 && (
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F0ECE3', margin: '0 0 4px' }}>Que productos vendes?</h2>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '24px' }}>Selecciona todos los que apliquen. Sophia se configurara para ayudarte con estos.</p>

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
                        <span style={{ fontSize: '24px' }}>{p.icon}</span>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: selected ? p.color : '#F0ECE3', margin: 0 }}>{p.label}</p>
                        </div>
                        {selected && <span style={{ marginLeft: 'auto', color: p.color, fontSize: '16px' }}>&#10003;</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: Preferences */}
            {step === 3 && (
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F0ECE3', margin: '0 0 4px' }}>Preferencias</h2>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '24px' }}>Ultimos detalles para personalizar tu experiencia</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>Idioma principal de tus clientes</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                      {[
                        { key: 'es', label: 'Espanol', flag: '🇪🇸' },
                        { key: 'en', label: 'English', flag: '🇺🇸' },
                        { key: 'zh', label: 'Mandarin', flag: '🇨🇳' },
                        { key: 'ht', label: 'Creole', flag: '🇭🇹' },
                      ].map(l => (
                        <div key={l.key} onClick={() => setLanguage(l.key)} style={{
                          padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                          background: language === l.key ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${language === l.key ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                          <span style={{ fontSize: '20px' }}>{l.flag}</span>
                          <p style={{ fontSize: '12px', color: language === l.key ? '#C9A84C' : 'rgba(240,236,227,0.4)', margin: '4px 0 0', fontWeight: language === l.key ? 600 : 400 }}>{l.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Estados donde vendes <span style={{ opacity: 0.5 }}>(separados por coma)</span></label>
                    <input type="text" value={states} onChange={e => setStates(e.target.value)}
                      placeholder="FL, TX, CA, NY" style={inputStyle} />
                  </div>
                </div>

                {/* Summary */}
                <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.15)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', letterSpacing: '0.1em', margin: '0 0 8px' }}>TU CRM INCLUYE:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[
                      'Sophia IA vendiendo por WhatsApp 24/7',
                      `${products.length} producto${products.length !== 1 ? 's' : ''} configurado${products.length !== 1 ? 's' : ''}`,
                      'Pipeline inteligente + lead scoring',
                      'Coaching en tiempo real',
                      '7 dias de prueba gratis',
                    ].map(f => (
                      <div key={f} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ color: '#34d399', fontSize: '12px' }}>&#10003;</span>
                        <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.5)' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)} style={{
                  flex: 1, padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
                  fontFamily: 'inherit', background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(240,236,227,0.5)', cursor: 'pointer',
                }}>Atras</button>
              )}
              {step < totalSteps ? (
                <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !agentName}
                  style={{
                    flex: 2, padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                    fontFamily: 'inherit', letterSpacing: '0.03em',
                    background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#050507',
                    border: 'none', cursor: 'pointer', boxShadow: '0 8px 32px rgba(201,168,76,0.2)',
                  }}>Siguiente</button>
              ) : (
                <button onClick={handleFinish} disabled={loading}
                  style={{
                    flex: 2, padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                    fontFamily: 'inherit', letterSpacing: '0.03em',
                    background: loading ? 'rgba(52,211,153,0.3)' : 'linear-gradient(135deg, #34d399, #059669)',
                    color: '#050507', border: 'none', cursor: loading ? 'wait' : 'pointer',
                    boxShadow: '0 8px 32px rgba(52,211,153,0.2)',
                  }}>{loading ? 'Configurando...' : 'Lanzar mi CRM'}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
