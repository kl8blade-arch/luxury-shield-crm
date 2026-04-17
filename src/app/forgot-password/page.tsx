'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type Account = { id: string; name: string; email_hint: string; plan: string }

export default function ForgotPasswordPage() {
  const [contact, setContact] = useState('')
  const [step, setStep] = useState<'find' | 'choose' | 'code' | 'reset' | 'done'>('find')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sentMethod, setSentMethod] = useState<string>('')
  const [displayCode, setDisplayCode] = useState<string | null>(null)

  const inputStyle = {
    width: '100%', padding: '14px 18px', borderRadius: '12px', fontSize: '15px',
    fontFamily: '"Outfit",sans-serif',
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s, background-color 200ms ease, color 200ms ease',
  }
  function handleFocus(e: React.FocusEvent<HTMLInputElement>) { e.currentTarget.style.borderColor = 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.3)' }
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) { e.currentTarget.style.borderColor = 'var(--glass-border)' }

  async function handleFind(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }

      setAccounts(data.accounts || [])

      if (data.single && data.sent) {
        setSelectedId(data.selectedId)
        setSentMethod(data.method)
        if (data.code) setDisplayCode(data.code)
        setStep('code')
      } else if (data.accounts?.length > 1) {
        setStep('choose')
      }
    } catch { setError('Error de conexion') }
    setLoading(false)
  }

  async function handleSelectAccount(id: string) {
    setLoading(true); setError(''); setSelectedId(id)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, agentId: id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }
      setSentMethod(data.method)
      if (data.code) setDisplayCode(data.code)
      setStep('code')
    } catch { setError('Error de conexion') }
    setLoading(false)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setError('Las contrasenas no coinciden'); return }
    if (newPassword.length < 6) { setError('Minimo 6 caracteres'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code || displayCode, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }
      setStep('done')
    } catch { setError('Error de conexion') }
    setLoading(false)
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700&family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)', position: 'relative', overflow: 'hidden', fontFamily: '"Outfit",sans-serif',
        transition: 'background-color 200ms ease',
      }}>
        {/* Theme Toggle */}
        <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
          <ThemeToggle variant="icon" />
        </div>

        <div style={{
          position: 'absolute', top: '-30%', left: '-10%', width: '700px', height: '700px',
          background: 'radial-gradient(circle, rgba(var(--info-rgb, 59, 130, 246), 0.05) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-25%', right: '-15%', width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(var(--brand-primary-rgb, 201, 168, 76), 0.04) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.02,
          backgroundImage: 'linear-gradient(rgba(var(--brand-primary-rgb, 201, 168, 76), 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--brand-primary-rgb, 201, 168, 76), 0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div style={{ width: '440px', maxWidth: '92vw', position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{
              width: '56px', height: '56px', margin: '0 auto 18px', borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(201,168,76,0.06))',
              border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(167,139,250,0.1)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="m7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '30px', fontWeight: 300, color: '#F0ECE3', margin: 0 }}>
              {step === 'done' ? 'Listo!' : 'Recuperar contrasena'}
            </h1>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px', padding: '32px 28px', backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}>

            {/* ═══ STEP: Find account ═══ */}
            {step === 'find' && (
              <form onSubmit={handleFind}>
                <p style={{ fontSize: '14px', color: 'rgba(240,236,227,0.5)', marginBottom: '20px', lineHeight: 1.5 }}>
                  Ingresa tu email o telefono. Te enviaremos un codigo de recuperacion por WhatsApp al instante.
                </p>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }}>Email o telefono</label>
                  <input type="text" value={contact} onChange={e => setContact(e.target.value)}
                    placeholder="tu@email.com o +1 786 555 0000" required autoFocus
                    style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                </div>

                {error && <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#fca5a5', textAlign: 'center' }}>{error}</div>}

                <button type="submit" disabled={loading || !contact.trim()} style={{
                  width: '100%', padding: '15px', borderRadius: '14px', fontSize: '14px', fontWeight: 700,
                  fontFamily: 'inherit', background: loading ? 'rgba(167,139,250,0.3)' : 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                  color: '#050507', border: 'none', cursor: loading ? 'wait' : 'pointer',
                  boxShadow: '0 8px 32px rgba(167,139,250,0.2)', transition: 'all 0.3s',
                }}>
                  {loading ? 'Buscando...' : 'Enviar codigo'}
                </button>
              </form>
            )}

            {/* ═══ STEP: Choose account ═══ */}
            {step === 'choose' && (
              <div>
                <p style={{ fontSize: '14px', color: 'rgba(240,236,227,0.5)', marginBottom: '20px', lineHeight: 1.5 }}>
                  Encontramos {accounts.length} cuentas con ese contacto. Selecciona la cuenta que deseas recuperar:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {accounts.map(acc => (
                    <div key={acc.id} onClick={() => !loading && handleSelectAccount(acc.id)} style={{
                      padding: '16px', borderRadius: '14px', cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '14px',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(167,139,250,0.3)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(167,139,250,0.04)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)' }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                        background: 'linear-gradient(135deg, #a78bfa20, #7c3aed10)',
                        border: '1px solid rgba(167,139,250,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 800, color: '#a78bfa',
                      }}>
                        {acc.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#F0ECE3', margin: 0 }}>{acc.name}</p>
                        <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.35)', margin: '2px 0 0' }}>{acc.email_hint}</p>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', textTransform: 'capitalize' }}>{acc.plan}</span>
                    </div>
                  ))}
                </div>

                {error && <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#fca5a5', textAlign: 'center' }}>{error}</div>}

                {loading && <p style={{ textAlign: 'center', color: 'rgba(240,236,227,0.4)', fontSize: '13px' }}>Enviando codigo...</p>}

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', marginTop: '8px', textAlign: 'center' }}>
                  <Link href="/register" style={{ fontSize: '13px', color: '#34d399', textDecoration: 'none', fontWeight: 600 }}>
                    O crear una cuenta nueva
                  </Link>
                </div>
              </div>
            )}

            {/* ═══ STEP: Enter code + new password ═══ */}
            {step === 'code' && (
              <form onSubmit={handleVerifyCode}>
                {sentMethod === 'whatsapp' ? (
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ width: '48px', height: '48px', margin: '0 auto 12px', borderRadius: '50%', background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                      💬
                    </div>
                    <p style={{ fontSize: '14px', color: '#34d399', fontWeight: 600, marginBottom: '4px' }}>Codigo enviado por WhatsApp!</p>
                    <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>Revisa tu WhatsApp. El codigo expira en 15 minutos.</p>
                  </div>
                ) : displayCode ? (
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '12px' }}>Tu codigo de recuperacion:</p>
                    <div style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '0.3em', color: '#C9A84C', fontFamily: 'monospace', padding: '16px', background: 'rgba(201,168,76,0.06)', borderRadius: '12px', border: '1px solid rgba(201,168,76,0.2)' }}>
                      {displayCode}
                    </div>
                  </div>
                ) : null}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }}>Codigo de 6 digitos</label>
                  <input type="text" value={code || displayCode || ''} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setDisplayCode(null) }}
                    placeholder="000000" required maxLength={6}
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '24px', letterSpacing: '0.4em', fontWeight: 700 }}
                    onFocus={handleFocus} onBlur={handleBlur} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }}>Nueva contrasena</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimo 6 caracteres" required
                    style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }}>Confirmar contrasena</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contrasena" required
                    style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                </div>

                {error && <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#fca5a5', textAlign: 'center' }}>{error}</div>}

                <button type="submit" disabled={loading || (code || displayCode || '').length !== 6 || !newPassword} style={{
                  width: '100%', padding: '15px', borderRadius: '14px', fontSize: '14px', fontWeight: 700,
                  fontFamily: 'inherit', background: loading ? 'rgba(167,139,250,0.3)' : 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                  color: '#050507', border: 'none', cursor: loading ? 'wait' : 'pointer',
                  boxShadow: '0 8px 32px rgba(167,139,250,0.2)', transition: 'all 0.3s',
                }}>
                  {loading ? 'Cambiando...' : 'Cambiar contrasena'}
                </button>

                <button type="button" onClick={() => { setStep('find'); setError(''); setCode(''); setDisplayCode(null) }}
                  style={{ width: '100%', padding: '10px', marginTop: '10px', background: 'none', border: 'none', color: 'rgba(240,236,227,0.35)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Solicitar otro codigo
                </button>
              </form>
            )}

            {/* ═══ STEP: Done ═══ */}
            {step === 'done' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', margin: '0 auto 20px', borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#F0ECE3', margin: '0 0 8px' }}>Contrasena actualizada</h2>
                <p style={{ fontSize: '14px', color: 'rgba(240,236,227,0.4)', marginBottom: '24px' }}>
                  Ya puedes iniciar sesion con tu nueva contrasena.
                </p>
                <Link href="/login" style={{
                  display: 'inline-block', padding: '14px 40px', borderRadius: '14px', fontSize: '14px', fontWeight: 700,
                  background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#050507',
                  textDecoration: 'none', boxShadow: '0 8px 32px rgba(201,168,76,0.2)',
                }}>
                  Iniciar sesion
                </Link>
              </div>
            )}
          </div>

          {/* Back to login */}
          {step !== 'done' && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <Link href="/login" style={{ fontSize: '13px', color: 'rgba(240,236,227,0.35)', textDecoration: 'none' }}>
                ← Volver al inicio de sesion
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
