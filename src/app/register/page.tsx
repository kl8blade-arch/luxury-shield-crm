'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const PLANS = [
  { key: 'starter', name: 'Starter', price: 47, color: '#60a5fa', subs: 1, tagline: 'Ideal para comenzar', features: ['Sophia IA basica', 'Pipeline + Leads', 'WhatsApp', '100 leads/mes', '1 sub-cuenta'], badge: null },
  { key: 'professional', name: 'Professional', price: 97, color: '#a78bfa', subs: 3, tagline: 'Para agentes serios', features: ['Todo de Starter +', 'Coaching IA', '500 leads/mes', '5 agentes', 'Analytics', '3 sub-cuentas'], badge: 'POPULAR' },
  { key: 'agency', name: 'Agency', price: 197, color: '#C9A84C', subs: 10, tagline: 'Sin limites', features: ['Todo de Professional +', 'Leads ILIMITADOS', '25 agentes', '10 sub-cuentas', 'SophiaModel + Voice IA', 'Social Intelligence', 'API + Landing Builder'], badge: 'MEJOR VALOR', highlighted: true },
]

function RegisterInner() {
  const searchParams = useSearchParams()
  const paymentCancelled = searchParams.get('payment') === 'cancelled'

  const [step, setStep] = useState<'plan' | 'form' | 'processing'>('plan')
  const [selectedPlan, setSelectedPlan] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])

  const pwChecks = { length: password.length >= 8, upper: /[A-Z]/.test(password), lower: /[a-z]/.test(password), number: /[0-9]/.test(password), special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) }
  const pwStrength = Object.values(pwChecks).filter(Boolean).length
  const pwValid = pwStrength === 5
  const plan = PLANS.find(p => p.key === selectedPlan)

  const inp: React.CSSProperties = { width: '100%', padding: '14px 18px', borderRadius: '12px', fontSize: '15px', fontFamily: '"Outfit",sans-serif', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }

  // Single step: create account + go to Stripe immediately
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pwValid) { setError('La contrasena no cumple los requisitos'); return }
    if (!phone.trim()) { setError('Telefono obligatorio'); return }
    setLoading(true); setError(''); setStep('processing')

    // 1. Create account
    const regRes = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone }),
    })
    const regData = await regRes.json()

    if (!regRes.ok) { setError(regData.error || 'Error'); setStep('form'); setLoading(false); return }

    const agentId = regData.agentId

    // 2. Go directly to Stripe (no intermediate steps)
    try {
      const stripeRes = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName: plan?.name || 'Starter',
          price: plan?.price || 47,
          leadCount: plan?.subs || 1,
          packageId: selectedPlan,
          agentId,
          trialDays: 7,
        }),
      })
      const stripeData = await stripeRes.json()
      if (stripeData.url) {
        // Redirect to Stripe — user pays — Stripe webhook activates account
        window.location.href = stripeData.url
        return
      }
      setError(stripeData.error || 'Error al crear sesion de pago')
    } catch {
      setError('Error de conexion con Stripe')
    }
    setStep('form'); setLoading(false)
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ minHeight: '100vh', background: '#050507', fontFamily: '"Outfit",sans-serif', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '1000px', height: '600px', background: 'radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.015, backgroundImage: 'linear-gradient(rgba(201,168,76,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.4) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />

        {/* Nav */}
        <div style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#C9A84C' }}>Luxury Shield</span>
          </div>
          <Link href="/login" style={{ fontSize: '13px', color: 'rgba(240,236,227,0.5)', textDecoration: 'none', padding: '8px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>Iniciar sesion</Link>
        </div>

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '20px 32px 60px', position: 'relative', zIndex: 2 }}>

          {paymentCancelled && (
            <div style={{ padding: '12px 20px', borderRadius: '12px', marginBottom: '20px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', textAlign: 'center' }}>
              <p style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 600, margin: 0 }}>Pago cancelado. Selecciona tu plan e intenta de nuevo.</p>
            </div>
          )}

          {/* Processing screen */}
          {step === 'processing' && (
            <div style={{ textAlign: 'center', paddingTop: '100px' }}>
              <div style={{ width: 48, height: 48, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <p style={{ fontSize: '16px', color: '#F0ECE3', fontWeight: 600 }}>Preparando tu cuenta...</p>
              <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>En un momento te redirigiremos a la pagina de pago</p>
            </div>
          )}

          {/* ═══ STEP 1: PLAN ═══ */}
          {step === 'plan' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.3em', color: 'rgba(201,168,76,0.5)', marginBottom: '14px' }}>PLANES Y PRECIOS</p>
                <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: isMobile ? '32px' : '48px', fontWeight: 300, color: '#F0ECE3', margin: '0 0 14px', lineHeight: 1.15 }}>
                  La IA que vende<br /><span style={{ color: '#C9A84C' }}>mientras tu duermes.</span>
                </h1>
                <p style={{ fontSize: '15px', color: 'rgba(240,236,227,0.4)', maxWidth: '460px', margin: '0 auto' }}>7 dias gratis. Cancela cuando quieras.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
                {PLANS.map(p => {
                  const sel = selectedPlan === p.key
                  return (
                    <div key={p.key} onClick={() => setSelectedPlan(p.key)} style={{ position: 'relative', cursor: 'pointer', transition: 'all 0.25s', transform: sel ? 'translateY(-4px)' : 'none' }}>
                      {p.badge && <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', zIndex: 3, padding: '5px 16px', borderRadius: '100px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', background: p.highlighted ? 'linear-gradient(135deg, #C9A84C, #A8893A)' : `${p.color}25`, color: p.highlighted ? '#06070B' : p.color }}>{p.badge}</div>}
                      <div style={{ padding: p.highlighted ? '2px' : '0', borderRadius: '22px', background: p.highlighted && sel ? 'linear-gradient(135deg, #C9A84C, #6B4F1A, #C9A84C)' : sel ? `linear-gradient(135deg, ${p.color}60, ${p.color}20)` : 'none' }}>
                        <div style={{ padding: '32px 26px', borderRadius: p.highlighted ? '20px' : '22px', background: sel ? '#0C0C14' : 'rgba(255,255,255,0.015)', border: p.highlighted ? 'none' : `1px solid ${sel ? p.color+'35' : 'rgba(255,255,255,0.05)'}`, minHeight: isMobile ? 'auto' : '380px', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: sel ? p.color : '#F0ECE3' }}>{p.name}</span>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${sel ? p.color : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sel && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color }} />}</div>
                          </div>
                          <div style={{ marginBottom: '6px' }}><span style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '42px', fontWeight: 700, color: '#F0ECE3' }}>${p.price}</span><span style={{ fontSize: '14px', color: 'rgba(240,236,227,0.25)' }}>/mes</span></div>
                          <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.35)', margin: '0 0 20px' }}>{p.tagline}</p>
                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '18px' }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                            {p.features.map(f => <div key={f} style={{ display: 'flex', gap: '10px' }}><span style={{ color: '#34d399', fontSize: '9px', marginTop: '3px' }}>&#10003;</span><span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.55)' }}>{f}</span></div>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.3)' }}>Mas de 10 sub-cuentas? <a href={`https://wa.me/17869435656?text=${encodeURIComponent('Plan Enterprise')}`} target="_blank" style={{ color: '#34d399', textDecoration: 'none', fontWeight: 600 }}>Plan Enterprise &rarr;</a></p>
              </div>

              <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', borderRadius: '12px', background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)', marginBottom: '18px' }}>
                  <span style={{ fontSize: '18px' }}>&#127873;</span>
                  <div><p style={{ fontSize: '13px', color: '#34d399', fontWeight: 600, margin: 0 }}>7 dias GRATIS</p><p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)', margin: 0 }}>Se cobra al terminar la promocion.</p></div>
                </div>
                <button onClick={() => { if (!selectedPlan) { setError('Selecciona un plan'); return }; setError(''); setStep('form') }} style={{
                  width: '100%', padding: '16px', borderRadius: '14px', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit',
                  background: selectedPlan ? 'linear-gradient(135deg, #C9A84C, #E2C060, #C9A84C)' : 'rgba(255,255,255,0.04)',
                  color: selectedPlan ? '#050507' : 'rgba(240,236,227,0.25)', border: selectedPlan ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  cursor: selectedPlan ? 'pointer' : 'not-allowed', boxShadow: selectedPlan ? '0 8px 32px rgba(201,168,76,0.25)' : 'none',
                }}>{selectedPlan ? `Continuar con ${plan?.name}` : 'Selecciona un plan'}</button>
                {error && <p style={{ textAlign: 'center', color: '#fca5a5', fontSize: '13px', marginTop: '10px' }}>{error}</p>}
              </div>
            </>
          )}

          {/* ═══ STEP 2: FORM → straight to Stripe ═══ */}
          {step === 'form' && (
            <div style={{ maxWidth: '440px', margin: '0 auto', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '14px', background: `${plan?.color || '#C9A84C'}08`, border: `1px solid ${plan?.color || '#C9A84C'}20`, marginBottom: '24px' }}>
                <div><p style={{ fontSize: '14px', fontWeight: 700, color: plan?.color || '#C9A84C', margin: 0 }}>Plan {plan?.name}</p><p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)', margin: '2px 0 0' }}>${plan?.price}/mes — 7 dias gratis</p></div>
                <button onClick={() => setStep('plan')} style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', background: 'none', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>Cambiar</button>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '32px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                    <div><label style={lbl}>Nombre completo *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Juan Perez" required autoComplete="name" name="name" style={inp} /></div>
                    <div><label style={lbl}>Email *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com" required autoComplete="email" name="email" style={inp} /></div>
                    <div><label style={lbl}>Telefono (WhatsApp) *</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (786) 555-0000" required autoComplete="tel" name="phone" style={inp} /><p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.2)', marginTop: '4px' }}>Sophia enviara los leads a este numero</p></div>
                    <div>
                      <label style={lbl}>Contrasena *</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8, mayus, minus, num, especial" required autoComplete="new-password" name="password" style={{ ...inp, borderColor: password && !pwValid ? 'rgba(239,68,68,0.3)' : password && pwValid ? 'rgba(52,211,153,0.3)' : undefined }} />
                      {password && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: pwStrength >= i ? (pwStrength <= 2 ? '#f87171' : pwStrength <= 4 ? '#fbbf24' : '#34d399') : 'rgba(255,255,255,0.06)' }} />)}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                            {[{ c: pwChecks.length, l: '8+ caracteres' }, { c: pwChecks.upper, l: 'Mayuscula' }, { c: pwChecks.lower, l: 'Minuscula' }, { c: pwChecks.number, l: 'Numero' }, { c: pwChecks.special, l: 'Especial (!@#)' }].map(r =>
                              <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ fontSize: '9px', color: r.c ? '#34d399' : 'rgba(240,236,227,0.2)' }}>{r.c ? '●' : '○'}</span><span style={{ fontSize: '10px', color: r.c ? 'rgba(240,236,227,0.5)' : 'rgba(240,236,227,0.2)' }}>{r.l}</span></div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {error && <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#fca5a5', textAlign: 'center' }}>{error}</div>}

                  <button type="submit" disabled={loading || !pwValid} style={{
                    width: '100%', padding: '15px', borderRadius: '14px', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit',
                    background: pwValid ? 'linear-gradient(135deg, #34d399, #059669)' : 'rgba(52,211,153,0.15)',
                    color: pwValid ? '#050507' : 'rgba(240,236,227,0.3)', border: 'none',
                    cursor: pwValid ? 'pointer' : 'not-allowed', boxShadow: pwValid ? '0 8px 32px rgba(52,211,153,0.2)' : 'none',
                  }}>
                    {loading ? 'Creando...' : 'Crear cuenta y pagar'}
                  </button>

                  <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.2)', textAlign: 'center', marginTop: '12px' }}>
                    Se cobrara ${plan?.price}/mes al finalizar los 7 dias gratis.
                  </p>
                </div>
              </form>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Link href="/login" style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', textDecoration: 'none' }}>Ya tienes cuenta? <span style={{ color: '#C9A84C', fontWeight: 600 }}>Inicia sesion</span></Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function RegisterPage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050507' }} />}><RegisterInner /></Suspense>
}
