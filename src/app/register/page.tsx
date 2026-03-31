'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useAuth } from '@/contexts/AuthContext'

declare global { interface Window { google: any } }
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

const PLANS = [
  {
    key: 'starter', name: 'Starter', price: 47, color: '#6b7280',
    tagline: 'Para empezar', subs: 1,
    features: ['Sophia IA basica', 'Pipeline + Leads', 'WhatsApp', '100 leads/mes', '1 sub-cuenta'],
  },
  {
    key: 'professional', name: 'Professional', price: 97, color: '#a78bfa',
    tagline: 'Para agentes serios', subs: 3, badge: 'POPULAR',
    features: ['Todo de Starter', 'Coaching IA', '500 leads/mes', '5 agentes', 'Analytics', '3 sub-cuentas'],
  },
  {
    key: 'agency', name: 'Agency', price: 197, color: '#C9A84C',
    tagline: 'Sin limites', subs: 10, highlighted: true, badge: 'MEJOR VALOR',
    features: ['Todo de Professional', 'Leads ilimitados', '25 agentes', 'SophiaModel', 'Social IA', '10 sub-cuentas', 'Voice IA', 'API'],
  },
]

export default function RegisterPage() {
  const [step, setStep] = useState<'plan' | 'form'>('plan')
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const { register, loginWithGoogle } = useAuth()

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || step !== 'form') return
    const init = () => { if (window.google?.accounts) { window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse }); window.google.accounts.id.renderButton(document.getElementById('google-btn-register'), { theme: 'filled_black', size: 'large', width: 356, text: 'signup_with', shape: 'pill' }) } }
    if (window.google?.accounts) init(); else (window as any).__google_init_register = init
  }, [step])

  async function handleGoogleResponse(response: any) {
    setLoading(true); setError('')
    const err = await loginWithGoogle(response.credential)
    if (err && err !== '2FA_REQUIRED') setError(err)
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { setError('El telefono es obligatorio'); return }
    if (!selectedPlan) { setError('Selecciona un plan'); return }
    setLoading(true); setError('')
    const err = await register(name, email, password, phone)
    if (err) setError(err)
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '14px 18px', borderRadius: '12px', fontSize: '15px', fontFamily: '"Outfit",sans-serif', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700&family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>
      {GOOGLE_CLIENT_ID && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => (window as any).__google_init_register?.()} />}
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050507', position: 'relative', overflow: 'hidden', fontFamily: '"Outfit",sans-serif', padding: '24px 16px' }}>
        <div style={{ position: 'absolute', top: '-30%', right: '-10%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-25%', left: '-15%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(52,211,153,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ width: step === 'plan' ? '800px' : '420px', maxWidth: '96vw', position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ width: '56px', height: '56px', margin: '0 auto 16px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(52,211,153,0.08))', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(201,168,76,0.1)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: step === 'plan' ? '32px' : '28px', fontWeight: 300, color: '#F0ECE3', margin: '0 0 6px' }}>
              {step === 'plan' ? 'Elige tu plan' : 'Crea tu cuenta'}
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>
              {step === 'plan' ? '10 dias gratis. Sin cobro hasta que termine tu promocion.' : `Plan ${PLANS.find(p => p.key === selectedPlan)?.name} — 10 dias gratis`}
            </p>
          </div>

          {/* ═══ STEP 1: SELECT PLAN ═══ */}
          {step === 'plan' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
                {PLANS.map(plan => {
                  const isSelected = selectedPlan === plan.key
                  return (
                    <div key={plan.key} onClick={() => setSelectedPlan(plan.key)} style={{
                      padding: plan.highlighted ? '2px' : '0', borderRadius: '20px', cursor: 'pointer',
                      background: plan.highlighted && isSelected ? 'linear-gradient(135deg, #C9A84C, #8B6914, #C9A84C)' : isSelected ? `linear-gradient(135deg, ${plan.color}50, ${plan.color}20)` : 'none',
                      position: 'relative', transition: 'all 0.2s',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    }}>
                      {plan.badge && (
                        <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 2, padding: '4px 14px', borderRadius: '100px', background: plan.highlighted ? 'linear-gradient(135deg, #C9A84C, #A8893A)' : `${plan.color}30`, color: plan.highlighted ? '#06070B' : plan.color, fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em' }}>{plan.badge}</div>
                      )}
                      <div style={{
                        padding: '28px 20px', borderRadius: plan.highlighted ? '18px' : '20px',
                        background: isSelected ? '#0D0D16' : 'rgba(255,255,255,0.015)',
                        border: !plan.highlighted ? `1px solid ${isSelected ? plan.color + '40' : 'rgba(255,255,255,0.05)'}` : 'none',
                      }}>
                        {/* Radio */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${isSelected ? plan.color : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: plan.color }} />}
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: isSelected ? plan.color : '#F0ECE3' }}>{plan.name}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '4px' }}>
                          <span style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '36px', fontWeight: 700, color: '#F0ECE3' }}>${plan.price}</span>
                          <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.3)' }}>/mes</span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)', margin: '0 0 14px' }}>{plan.tagline}</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {plan.features.map(f => (
                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '10px', color: '#34d399' }}>&#10003;</span>
                              <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.5)' }}>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Enterprise link */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.3)' }}>
                  Necesitas mas de 10 sub-cuentas?{' '}
                  <a href={`https://wa.me/17869435656?text=${encodeURIComponent('Hola, me interesa el plan Enterprise')}`} target="_blank" style={{ color: '#34d399', textDecoration: 'none', fontWeight: 600 }}>Plan Enterprise — Hablar con ventas</a>
                </p>
              </div>

              {/* Promo banner */}
              <div style={{ padding: '14px 20px', borderRadius: '14px', background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.15)', textAlign: 'center', marginBottom: '20px' }}>
                <p style={{ fontSize: '13px', color: '#34d399', fontWeight: 600, margin: '0 0 2px' }}>10 dias de prueba GRATIS</p>
                <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)', margin: 0 }}>No se cobra hasta que termine la promocion. Cancela cuando quieras.</p>
              </div>

              <button onClick={() => { if (!selectedPlan) { setError('Selecciona un plan'); return }; setError(''); setStep('form') }} style={{
                width: '100%', padding: '16px', borderRadius: '14px', fontSize: '15px', fontWeight: 700,
                fontFamily: 'inherit', letterSpacing: '0.02em',
                background: selectedPlan ? 'linear-gradient(135deg, #C9A84C, #A8893A)' : 'rgba(201,168,76,0.15)',
                color: selectedPlan ? '#050507' : 'rgba(240,236,227,0.3)',
                border: 'none', cursor: selectedPlan ? 'pointer' : 'not-allowed',
                boxShadow: selectedPlan ? '0 8px 32px rgba(201,168,76,0.3)' : 'none',
              }}>
                Continuar con {PLANS.find(p => p.key === selectedPlan)?.name || '...'}
              </button>

              {error && <p style={{ textAlign: 'center', color: '#fca5a5', fontSize: '13px', marginTop: '12px' }}>{error}</p>}

              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.35)' }}>
                  Ya tienes cuenta?{' '}
                  <Link href="/login" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 600 }}>Inicia sesion</Link>
                </p>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: CREATE ACCOUNT ═══ */}
          {step === 'form' && (
            <div>
              <form onSubmit={handleRegister}>
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '32px 28px', backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
                  {GOOGLE_CLIENT_ID && (
                    <>
                      <div id="google-btn-register" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                        <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)' }}>o con email</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                      </div>
                    </>
                  )}

                  <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Nombre completo *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Juan Perez" required style={inputStyle} /></div>
                  <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Email *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com" required style={inputStyle} /></div>
                  <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Telefono *</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (786) 555-0000" required style={inputStyle} /></div>
                  <div style={{ marginBottom: '24px' }}><label style={labelStyle}>Contrasena *</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" required style={inputStyle} /></div>

                  {error && <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#fca5a5', textAlign: 'center' }}>{error}</div>}

                  <button type="submit" disabled={loading} style={{
                    width: '100%', padding: '15px', borderRadius: '14px', fontSize: '14px', fontWeight: 700,
                    fontFamily: 'inherit',
                    background: loading ? 'rgba(52,211,153,0.3)' : 'linear-gradient(135deg, #34d399, #059669)',
                    color: '#050507', border: 'none', cursor: loading ? 'wait' : 'pointer',
                    boxShadow: '0 8px 32px rgba(52,211,153,0.2)',
                  }}>
                    {loading ? 'Creando cuenta...' : 'Empezar 10 dias gratis'}
                  </button>

                  <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.2)', textAlign: 'center', marginTop: '12px' }}>
                    Al crear tu cuenta aceptas los terminos. Se cobrara ${PLANS.find(p => p.key === selectedPlan)?.price}/mes despues de 10 dias.
                  </p>
                </div>
              </form>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '20px' }}>
                <button onClick={() => setStep('plan')} style={{ fontSize: '13px', color: 'rgba(240,236,227,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>&larr; Cambiar plan</button>
                <Link href="/login" style={{ fontSize: '13px', color: '#C9A84C', textDecoration: 'none', fontWeight: 600 }}>Iniciar sesion</Link>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.2)' }}>Powered by <span style={{ color: 'rgba(201,168,76,0.4)', fontWeight: 600 }}>SophiaOS</span></p>
          </div>
        </div>
      </div>
    </>
  )
}
