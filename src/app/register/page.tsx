'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useAuth } from '@/contexts/AuthContext'

declare global { interface Window { google: any } }
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

const PLANS = [
  {
    key: 'starter', name: 'Starter', price: 47, color: '#60a5fa', subs: 1,
    tagline: 'Ideal para comenzar',
    features: ['Sophia IA basica', 'Pipeline + Leads', 'WhatsApp automatizado', '100 leads/mes', '1 agente', '1 sub-cuenta'],
  },
  {
    key: 'professional', name: 'Professional', price: 97, color: '#a78bfa', subs: 3,
    tagline: 'Para agentes serios', badge: 'POPULAR',
    features: ['Todo de Starter +', 'Coaching IA en tiempo real', '500 leads/mes', '5 agentes', 'Analytics avanzados', '3 sub-cuentas', 'Campanas + Calendario'],
  },
  {
    key: 'agency', name: 'Agency', price: 197, color: '#C9A84C', subs: 10,
    tagline: 'Sin limites', badge: 'MEJOR VALOR', highlighted: true,
    features: ['Todo de Professional +', 'Leads ILIMITADOS', '25 agentes', '10 sub-cuentas', 'SophiaModel + Voice IA', 'Social Intelligence', 'API + Landing Builder'],
  },
]

export default function RegisterPage() {
  const [step, setStep] = useState<'plan' | 'form' | 'verify'>('plan')
  const [selectedPlan, setSelectedPlan] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [pendingAgentId, setPendingAgentId] = useState('')
  const [phoneHint, setPhoneHint] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [sentVia, setSentVia] = useState('whatsapp')
  const [pendingCodeServer, setPendingCodeServer] = useState('')
  const [pendingDataServer, setPendingDataServer] = useState<any>(null)
  const [showCodeOnScreen, setShowCodeOnScreen] = useState(false)
  const { register: authRegister, loginWithGoogle } = useAuth()

  // Password strength indicators
  const pwChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }
  const pwStrength = Object.values(pwChecks).filter(Boolean).length
  const pwValid = pwStrength === 5

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || step !== 'form') return
    const init = () => { if (window.google?.accounts) { window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse }); window.google.accounts.id.renderButton(document.getElementById('g-btn-reg'), { theme: 'filled_black', size: 'large', width: 360, text: 'signup_with', shape: 'pill' }) } }
    if (window.google?.accounts) init(); else (window as any).__g_init_r = init
  }, [step])

  async function handleGoogleResponse(r: any) { setLoading(true); setError(''); const err = await loginWithGoogle(r.credential); if (err && err !== '2FA_REQUIRED') setError(err); setLoading(false) }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { setError('Telefono obligatorio'); return }
    if (!selectedPlan) { setError('Selecciona un plan'); return }
    if (!pwValid) { setError('La contrasena no cumple los requisitos'); return }
    setLoading(true); setError('')

    // Step 1: Create pending account + send verification code
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }

    if (data.pending_verification) {
      setPhoneHint(data.phone_hint)
      setSentVia(data.sent_via || 'none')
      setPendingCodeServer(data.pending_code || '')
      setPendingDataServer(data.pending_data || null)
      // If code couldn't be sent, show it on screen
      if (!data.code_sent && data.verification_code) {
        setShowCodeOnScreen(true)
        setVerifyCode(data.verification_code)
      }
      setStep('verify')
    }
    setLoading(false)
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (verifyCode.length !== 6) return
    setLoading(true); setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', code: verifyCode, pendingCode: pendingCodeServer, pendingData: pendingDataServer }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }

    if (data.verified && data.user) {
      localStorage.setItem('ls_auth', JSON.stringify(data.user))

      // Go to Stripe to register card (7-day free trial)
      const planData = PLANS.find(p => p.key === selectedPlan)
      try {
        const stripeRes = await fetch('/api/stripe/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageName: planData?.name || 'Starter',
            price: planData?.price || 47,
            leadCount: planData?.subs || 1,
            packageId: selectedPlan,
            agentId: data.user.id,
            trialDays: 7,
          }),
        })
        const stripeData = await stripeRes.json()
        if (stripeData.url) { window.location.href = stripeData.url; return }
      } catch {}
      window.location.href = '/packages'
    }
    setLoading(false)
  }

  const plan = PLANS.find(p => p.key === selectedPlan)
  const inp: React.CSSProperties = { width: '100%', padding: '14px 18px', borderRadius: '12px', fontSize: '15px', fontFamily: '"Outfit",sans-serif', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }
  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)' }
  const blur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>
      {GOOGLE_CLIENT_ID && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => (window as any).__g_init_r?.()} />}

      <div style={{ minHeight: '100vh', background: '#050507', fontFamily: '"Outfit",sans-serif', position: 'relative', overflow: 'hidden' }}>
        {/* BG effects */}
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '1000px', height: '600px', background: 'radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.015, backgroundImage: 'linear-gradient(rgba(201,168,76,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.4) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />

        {/* Top bar */}
        <div style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.02em' }}>Luxury Shield</span>
          </div>
          <Link href="/login" style={{ fontSize: '13px', color: 'rgba(240,236,227,0.5)', textDecoration: 'none', padding: '8px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.2s' }}>Iniciar sesion</Link>
        </div>

        {/* Content */}
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '20px 32px 60px', position: 'relative', zIndex: 2 }}>

          {/* ═══ STEP 1: PLAN SELECTION ═══ */}
          {step === 'plan' && (
            <>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.3em', color: 'rgba(201,168,76,0.5)', marginBottom: '14px' }}>PLANES Y PRECIOS</p>
                <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: isMobile ? '32px' : '48px', fontWeight: 300, color: '#F0ECE3', margin: '0 0 14px', lineHeight: 1.15 }}>
                  La IA que vende seguros<br /><span style={{ color: '#C9A84C' }}>mientras tu duermes.</span>
                </h1>
                <p style={{ fontSize: '15px', color: 'rgba(240,236,227,0.4)', maxWidth: '460px', margin: '0 auto' }}>
                  Empieza gratis por 7 dias. Sin tarjeta. Cancela cuando quieras.
                </p>
              </div>

              {/* Plan cards */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '16px' : '20px', marginBottom: '28px' }}>
                {PLANS.map(p => {
                  const sel = selectedPlan === p.key
                  const hl = p.highlighted
                  return (
                    <div key={p.key} onClick={() => setSelectedPlan(p.key)} style={{
                      position: 'relative', cursor: 'pointer', transition: 'all 0.25s',
                      transform: sel ? 'translateY(-4px)' : 'translateY(0)',
                    }}>
                      {/* Badge */}
                      {p.badge && (
                        <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', zIndex: 3, padding: '5px 16px', borderRadius: '100px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', background: hl ? 'linear-gradient(135deg, #C9A84C, #A8893A)' : `${p.color}25`, color: hl ? '#06070B' : p.color, boxShadow: hl ? '0 4px 12px rgba(201,168,76,0.4)' : 'none' }}>{p.badge}</div>
                      )}

                      {/* Card wrapper (gold border for highlighted) */}
                      <div style={{
                        padding: hl ? '2px' : '0', borderRadius: '22px',
                        background: hl && sel ? 'linear-gradient(135deg, #C9A84C, #6B4F1A, #C9A84C)' : sel ? `linear-gradient(135deg, ${p.color}60, ${p.color}20)` : 'none',
                      }}>
                        <div style={{
                          padding: isMobile ? '28px 22px' : '32px 26px', borderRadius: hl ? '20px' : '22px',
                          background: sel ? '#0C0C14' : 'rgba(255,255,255,0.015)',
                          border: hl ? 'none' : `1px solid ${sel ? p.color + '35' : 'rgba(255,255,255,0.05)'}`,
                          minHeight: isMobile ? 'auto' : '420px', display: 'flex', flexDirection: 'column',
                        }}>
                          {/* Plan name */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: sel ? p.color : '#F0ECE3' }}>{p.name}</span>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${sel ? p.color : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                              {sel && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color }} />}
                            </div>
                          </div>

                          {/* Price */}
                          <div style={{ marginBottom: '6px' }}>
                            <span style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '42px', fontWeight: 700, color: '#F0ECE3', lineHeight: 1 }}>${p.price}</span>
                            <span style={{ fontSize: '14px', color: 'rgba(240,236,227,0.25)', marginLeft: '4px' }}>/mes</span>
                          </div>
                          <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.35)', margin: '0 0 20px' }}>{p.tagline}</p>

                          {/* Divider */}
                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '18px' }} />

                          {/* Features */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                            {p.features.map(f => (
                              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: f.includes('ILIMITADOS') || f.includes('10 sub') ? 'rgba(201,168,76,0.12)' : 'rgba(52,211,153,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: f.includes('ILIMITADOS') || f.includes('10 sub') ? '#C9A84C' : '#34d399', flexShrink: 0, marginTop: '1px' }}>&#10003;</span>
                                <span style={{ fontSize: '13px', color: f.includes('ILIMITADOS') || f.includes('10 sub') ? '#C9A84C' : 'rgba(240,236,227,0.55)', fontWeight: f.includes('+') || f.includes('ILIMITADOS') ? 600 : 400, lineHeight: 1.3 }}>{f}</span>
                              </div>
                            ))}
                          </div>

                          {/* Agency savings callout */}
                          {hl && (
                            <div style={{ marginTop: '16px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)' }}>
                              <p style={{ fontSize: '11px', color: '#C9A84C', fontWeight: 600, margin: 0, textAlign: 'center' }}>$100 mas que Professional — 5x mas valor</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Enterprise */}
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.3)' }}>
                  Mas de 10 sub-cuentas?{' '}
                  <a href={`https://wa.me/17869435656?text=${encodeURIComponent('Hola, me interesa el plan Enterprise de Luxury Shield CRM')}`} target="_blank" style={{ color: '#34d399', textDecoration: 'none', fontWeight: 600 }}>Plan Enterprise &rarr;</a>
                </p>
              </div>

              {/* CTA */}
              <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                {/* Promo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', borderRadius: '12px', background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)', marginBottom: '18px' }}>
                  <span style={{ fontSize: '18px' }}>&#127873;</span>
                  <div>
                    <p style={{ fontSize: '13px', color: '#34d399', fontWeight: 600, margin: 0 }}>7 dias GRATIS</p>
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)', margin: 0 }}>Sin tarjeta ahora. Se cobra al terminar la promocion.</p>
                  </div>
                </div>

                <button onClick={() => { if (!selectedPlan) { setError('Selecciona un plan primero'); return }; setError(''); setStep('form') }} style={{
                  width: '100%', padding: '16px', borderRadius: '14px', fontSize: '15px', fontWeight: 700,
                  fontFamily: 'inherit', letterSpacing: '0.02em',
                  background: selectedPlan ? 'linear-gradient(135deg, #C9A84C 0%, #E2C060 50%, #C9A84C 100%)' : 'rgba(255,255,255,0.04)',
                  color: selectedPlan ? '#050507' : 'rgba(240,236,227,0.25)',
                  border: selectedPlan ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  cursor: selectedPlan ? 'pointer' : 'not-allowed',
                  boxShadow: selectedPlan ? '0 8px 32px rgba(201,168,76,0.25)' : 'none',
                  transition: 'all 0.3s',
                }}>
                  {selectedPlan ? `Continuar con ${plan?.name}` : 'Selecciona un plan para continuar'}
                </button>

                {error && <p style={{ textAlign: 'center', color: '#fca5a5', fontSize: '13px', marginTop: '10px' }}>{error}</p>}
              </div>

              {/* Social proof */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '20px' : '40px', marginTop: '40px', flexWrap: 'wrap' }}>
                {[
                  { n: '11', l: 'Agentes IA' },
                  { n: '7', l: 'Industrias' },
                  { n: '24/7', l: 'Sophia activa' },
                  { n: '<4¢', l: 'Por lead' },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '24px', fontWeight: 700, color: '#C9A84C', margin: 0 }}>{s.n}</p>
                    <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.25)', margin: '2px 0 0' }}>{s.l}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ STEP 2: FORM ═══ */}
          {step === 'form' && (
            <div style={{ maxWidth: '440px', margin: '0 auto', paddingTop: '20px' }}>
              {/* Selected plan summary */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '14px', background: `${plan?.color || '#C9A84C'}08`, border: `1px solid ${plan?.color || '#C9A84C'}20`, marginBottom: '24px' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: plan?.color || '#C9A84C', margin: 0 }}>Plan {plan?.name}</p>
                  <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)', margin: '2px 0 0' }}>${plan?.price}/mes despues de 7 dias gratis</p>
                </div>
                <button onClick={() => setStep('plan')} style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', background: 'none', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>Cambiar</button>
              </div>

              <form onSubmit={handleRegister}>
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '32px 28px', backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

                  {GOOGLE_CLIENT_ID && (
                    <>
                      <div id="g-btn-reg" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                        <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)' }}>o con email</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                    <div><label style={lbl}>Nombre completo *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Juan Perez" required style={inp} onFocus={focus} onBlur={blur} /></div>
                    <div><label style={lbl}>Email *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com" required style={inp} onFocus={focus} onBlur={blur} /></div>
                    <div><label style={lbl}>Telefono (WhatsApp) *</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (786) 555-0000" required style={inp} onFocus={focus} onBlur={blur} /><p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.2)', marginTop: '4px' }}>Enviaremos un codigo de verificacion a este numero</p></div>
                    <div>
                      <label style={lbl}>Contrasena *</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 caracteres, mayus, minus, num, especial" required style={{ ...inp, borderColor: password && !pwValid ? 'rgba(239,68,68,0.3)' : password && pwValid ? 'rgba(52,211,153,0.3)' : undefined }} onFocus={focus} onBlur={blur} />
                      {/* Password strength */}
                      {password && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
                            {[1,2,3,4,5].map(i => (
                              <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: pwStrength >= i ? (pwStrength <= 2 ? '#f87171' : pwStrength <= 4 ? '#fbbf24' : '#34d399') : 'rgba(255,255,255,0.06)' }} />
                            ))}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                            {[
                              { check: pwChecks.length, label: '8+ caracteres' },
                              { check: pwChecks.upper, label: 'Mayuscula (A-Z)' },
                              { check: pwChecks.lower, label: 'Minuscula (a-z)' },
                              { check: pwChecks.number, label: 'Numero (0-9)' },
                              { check: pwChecks.special, label: 'Especial (!@#$%)' },
                            ].map(r => (
                              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '9px', color: r.check ? '#34d399' : 'rgba(240,236,227,0.2)' }}>{r.check ? '●' : '○'}</span>
                                <span style={{ fontSize: '10px', color: r.check ? 'rgba(240,236,227,0.5)' : 'rgba(240,236,227,0.2)' }}>{r.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {error && <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#fca5a5', textAlign: 'center' }}>{error}</div>}

                  <button type="submit" disabled={loading} style={{
                    width: '100%', padding: '15px', borderRadius: '14px', fontSize: '15px', fontWeight: 700,
                    fontFamily: 'inherit', letterSpacing: '0.02em',
                    background: loading ? 'rgba(52,211,153,0.3)' : 'linear-gradient(135deg, #34d399, #059669)',
                    color: '#050507', border: 'none', cursor: loading ? 'wait' : 'pointer',
                    boxShadow: '0 8px 32px rgba(52,211,153,0.2)', transition: 'all 0.3s',
                  }}>
                    {loading ? 'Creando...' : 'Empezar 7 dias gratis'}
                  </button>
                </div>
              </form>

              <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.2)', textAlign: 'center', marginTop: '14px', lineHeight: 1.5 }}>
                Al registrarte aceptas los terminos de servicio.<br />Se cobrara ${plan?.price}/mes al finalizar la promocion.
              </p>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Link href="/login" style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', textDecoration: 'none' }}>Ya tienes cuenta? <span style={{ color: '#C9A84C', fontWeight: 600 }}>Inicia sesion</span></Link>
              </div>
            </div>
          )}

          {/* ═══ STEP 3: VERIFY PHONE ═══ */}
          {step === 'verify' && (
            <div style={{ maxWidth: '420px', margin: '0 auto', paddingTop: '40px' }}>
              <form onSubmit={handleVerify}>
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '36px 28px', textAlign: 'center' }}>
                  <div style={{ width: '56px', height: '56px', margin: '0 auto 20px', borderRadius: '16px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>💬</div>

                  <h2 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '24px', fontWeight: 400, color: '#F0ECE3', margin: '0 0 8px' }}>Verifica tu telefono</h2>
                  {showCodeOnScreen ? (
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '12px' }}>Tu codigo de verificacion:</p>
                      <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', textAlign: 'center' }}>
                        <p style={{ fontSize: '32px', fontWeight: 800, color: '#C9A84C', letterSpacing: '0.3em', margin: 0, fontFamily: 'monospace' }}>{verifyCode}</p>
                      </div>
                      <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.25)', marginTop: '8px' }}>Ingresa este codigo abajo para confirmar</p>
                    </div>
                  ) : (
                    <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '24px' }}>
                      Enviamos un codigo de 6 digitos por {sentVia === 'sms' ? 'SMS' : 'WhatsApp'} a <span style={{ color: '#34d399', fontWeight: 600 }}>{phoneHint}</span>
                    </p>
                  )}

                  <input type="text" value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" required maxLength={6} autoFocus
                    style={{ width: '100%', padding: '18px', borderRadius: '14px', fontSize: '32px', fontWeight: 700, textAlign: 'center', letterSpacing: '0.4em', fontFamily: 'monospace', background: 'rgba(255,255,255,0.03)', border: `1px solid ${verifyCode.length === 6 ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`, color: '#F0ECE3', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />

                  <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.2)', marginTop: '8px', marginBottom: '20px' }}>El codigo expira en 10 minutos</p>

                  {error && <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#fca5a5' }}>{error}</div>}

                  <button type="submit" disabled={loading || verifyCode.length !== 6} style={{
                    width: '100%', padding: '15px', borderRadius: '14px', fontSize: '15px', fontWeight: 700,
                    fontFamily: 'inherit',
                    background: verifyCode.length === 6 ? 'linear-gradient(135deg, #34d399, #059669)' : 'rgba(52,211,153,0.15)',
                    color: verifyCode.length === 6 ? '#050507' : 'rgba(240,236,227,0.3)',
                    border: 'none', cursor: verifyCode.length === 6 ? 'pointer' : 'not-allowed',
                    boxShadow: verifyCode.length === 6 ? '0 8px 32px rgba(52,211,153,0.2)' : 'none',
                  }}>
                    {loading ? 'Verificando...' : 'Verificar y registrar tarjeta'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '16px', padding: '10px', borderRadius: '10px', background: 'rgba(201,168,76,0.03)', border: '1px solid rgba(201,168,76,0.08)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="m7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span style={{ fontSize: '10px', color: 'rgba(201,168,76,0.6)' }}>Verificacion de dos factores para proteger tu cuenta</span>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
