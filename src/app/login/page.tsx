'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

declare global { interface Window { google: any } }

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'login' | '2fa'>('login')
  const [totpCode, setTotpCode] = useState('')
  const [pendingAgent, setPendingAgent] = useState<{ id: string; name: string } | null>(null)
  const { login, loginWithGoogle, verify2FA } = useAuth()

  // Initialize Google Sign-In
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const init = () => {
      if (window.google?.accounts) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        })
        window.google.accounts.id.renderButton(
          document.getElementById('google-btn'),
          { theme: 'filled_black', size: 'large', width: 356, text: 'continue_with', shape: 'pill' }
        )
      }
    }
    if (window.google?.accounts) init()
    else (window as any).__google_init = init
  }, [])

  async function handleGoogleResponse(response: any) {
    setLoading(true)
    setError('')
    const err = await loginWithGoogle(response.credential)
    if (err === '2FA_REQUIRED') {
      const pending = JSON.parse(sessionStorage.getItem('pending_2fa') || '{}')
      setPendingAgent({ id: pending.agent_id, name: pending.name })
      setStep('2fa')
    } else if (err) {
      setError(err)
    }
    setLoading(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(email, password)
    if (result?.error) setError(result.error)
    if (result?.requires_2fa) {
      setPendingAgent({ id: result.agent_id!, name: result.name! })
      setStep('2fa')
    }
    setLoading(false)
  }

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingAgent) return
    setLoading(true)
    setError('')
    const err = await verify2FA(pendingAgent.id, totpCode)
    if (err) setError(err)
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '14px 18px', borderRadius: '12px',
    fontSize: '15px', fontFamily: '"Outfit",sans-serif',
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-primary)', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box' as const,
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.3)'
    e.currentTarget.style.boxShadow = '0 0 20px rgba(var(--brand-primary-rgb, 201, 168, 76), 0.08)'
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--glass-border)'
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>
      {GOOGLE_CLIENT_ID && (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
          onLoad={() => (window as any).__google_init?.()}
        />
      )}
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)', position: 'relative', overflow: 'hidden',
        fontFamily: '"Outfit",sans-serif',
      }}>
        {/* Theme Toggle */}
        <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
          <ThemeToggle variant="icon" />
        </div>
        {/* Ambient effects */}
        <div style={{
          position: 'absolute', top: '-30%', left: '-10%', width: '700px', height: '700px',
          background: 'radial-gradient(circle, rgba(var(--brand-primary-rgb, 201, 168, 76), 0.06) 0%, transparent 60%)',
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
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb, 201, 168, 76), 0.3), transparent)',
        }} />

        <div style={{ width: '420px', maxWidth: '92vw', position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{
              width: '64px', height: '64px', margin: '0 auto 20px', borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb, 201, 168, 76), 0.12), rgba(var(--brand-primary-rgb, 201, 168, 76), 0.04))',
              border: '1px solid rgba(var(--brand-primary-rgb, 201, 168, 76), 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(var(--brand-primary-rgb, 201, 168, 76), 0.1)',
              transition: 'all 200ms ease',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h1 style={{
              fontFamily: '"Cormorant Garamond",serif', fontSize: '36px', fontWeight: 300,
              color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '0.02em', lineHeight: 1,
              transition: 'color 200ms ease',
            }}>Luxury Shield</h1>
            <p style={{
              fontSize: '11px', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase',
              color: 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.5)',
              transition: 'color 200ms ease',
            }}>Insurance CRM</p>
          </div>

          {step === '2fa' ? (
            /* ═══ 2FA STEP ═══ */
            <form onSubmit={handleVerify2FA}>
              <div style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '20px', padding: '36px 32px',
                backdropFilter: 'blur(20px)',
                boxShadow: 'var(--glass-shadow)',
                transition: 'all 200ms ease',
              }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '14px',
                    background: 'rgba(var(--info-rgb, 59, 130, 246), 0.1)',
                    border: '1px solid rgba(var(--info-rgb, 59, 130, 246), 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 200ms ease',
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="m7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                  <h2 style={{
                    fontSize: '18px', fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: '0 0 4px',
                    transition: 'color 200ms ease',
                  }}>Verificacion de dos factores</h2>
                  <p style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    transition: 'color 200ms ease',
                  }}>Hola {pendingAgent?.name}. Ingresa el codigo de tu app de autenticacion.</p>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <input
                    type="text" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" required autoFocus maxLength={6}
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '28px', letterSpacing: '0.5em', fontWeight: 700 }}
                    onFocus={handleFocus} onBlur={handleBlur}
                  />
                </div>

                {error && (
                  <div style={{
                    padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
                    background: 'var(--danger-bg)',
                    border: '1px solid var(--danger)',
                    fontSize: '13px',
                    color: 'var(--danger)',
                    textAlign: 'center',
                    transition: 'all 200ms ease',
                  }}>{error}</div>
                )}

                <button type="submit" disabled={loading || totpCode.length !== 6} style={{
                  width: '100%', padding: '15px', borderRadius: '14px', fontSize: '14px', fontWeight: 700,
                  fontFamily: '"Outfit",sans-serif', letterSpacing: '0.05em',
                  background: totpCode.length === 6 ? 'linear-gradient(135deg, var(--info) 0%, var(--brand-primary) 100%)' : 'rgba(var(--info-rgb, 59, 130, 246), 0.2)',
                  color: 'var(--bg-base)',
                  border: 'none', cursor: totpCode.length === 6 ? 'pointer' : 'not-allowed',
                  boxShadow: '0 8px 32px rgba(var(--info-rgb, 59, 130, 246), 0.2)',
                  transition: 'all 0.3s',
                }}>
                  {loading ? 'Verificando...' : 'Verificar'}
                </button>

                <button type="button" onClick={() => { setStep('login'); setError(''); setTotpCode('') }}
                  style={{
                    width: '100%', padding: '10px', marginTop: '12px',
                    background: 'none', border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'color 200ms ease',
                  }}>
                  Volver al login
                </button>
              </div>
            </form>
          ) : (
            /* ═══ LOGIN STEP ═══ */
            <>
              <form onSubmit={handleLogin}>
                <div style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '20px', padding: '36px 32px',
                  backdropFilter: 'blur(20px)',
                  boxShadow: 'var(--glass-shadow)',
                  transition: 'all 200ms ease',
                }}>
                  {/* Google Sign-In */}
                  {GOOGLE_CLIENT_ID && (
                    <>
                      <div id="google-btn" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                        <span style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          fontWeight: 500,
                          transition: 'color 200ms ease',
                        }}>o con email</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                      </div>
                    </>
                  )}

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      marginBottom: '8px',
                      transition: 'color 200ms ease',
                    }}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com" required autoComplete="email"
                      style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      marginBottom: '8px',
                      transition: 'color 200ms ease',
                    }}>Contrasena</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••" required autoComplete="current-password"
                        style={{ ...inputStyle, paddingRight: '48px' }} onFocus={handleFocus} onBlur={handleBlur} />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '14px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: '20px',
                          padding: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                      >
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div style={{
                      padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
                      background: 'var(--danger-bg)',
                      border: '1px solid var(--danger)',
                      fontSize: '13px',
                      color: 'var(--danger)',
                      textAlign: 'center',
                      transition: 'all 200ms ease',
                    }}>{error}</div>
                  )}

                  <button type="submit" disabled={loading} style={{
                    width: '100%', padding: '15px', borderRadius: '14px', fontSize: '14px', fontWeight: 700,
                    fontFamily: '"Outfit",sans-serif', letterSpacing: '0.05em',
                    background: loading ? 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.3)' : 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 50%, var(--brand-primary) 100%)',
                    color: 'var(--bg-base)',
                    border: 'none', cursor: loading ? 'wait' : 'pointer',
                    boxShadow: '0 8px 32px rgba(var(--brand-primary-rgb, 201, 168, 76), 0.2)',
                    transition: 'all 0.3s',
                  }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)' } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    {loading ? 'Accediendo...' : 'Acceder'}
                  </button>
                </div>
              </form>

              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Link href="/forgot-password" style={{
                  fontSize: '13px',
                  color: 'var(--info)',
                  textDecoration: 'none', fontWeight: 500,
                  transition: 'color 200ms ease',
                }}>
                  Olvide mi contrasena
                </Link>
              </div>
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <p style={{
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  transition: 'color 200ms ease',
                }}>
                  Eres agente?{' '}
                  <Link href="/register" style={{
                    color: 'var(--brand-primary)',
                    textDecoration: 'none', fontWeight: 600,
                    transition: 'color 200ms ease',
                  }}>Crea tu cuenta gratis</Link>
                </p>
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              transition: 'color 200ms ease',
            }}>
              Powered by <span style={{
                color: 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.6)',
                fontWeight: 600,
                transition: 'color 200ms ease',
              }}>SophiaOS</span>
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px' }}>
              <span style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                transition: 'color 200ms ease',
              }}>2026 Luxury Shield Insurance</span>
              <span style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                transition: 'color 200ms ease',
              }}>SeguriSSimo Agency</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
