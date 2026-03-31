'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useAuth } from '@/contexts/AuthContext'

declare global { interface Window { google: any } }

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { register, loginWithGoogle } = useAuth()

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const init = () => {
      if (window.google?.accounts) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        })
        window.google.accounts.id.renderButton(
          document.getElementById('google-btn-register'),
          { theme: 'filled_black', size: 'large', width: 356, text: 'signup_with', shape: 'pill' }
        )
      }
    }
    if (window.google?.accounts) init()
    else (window as any).__google_init_register = init
  }, [])

  async function handleGoogleResponse(response: any) {
    setLoading(true)
    setError('')
    const err = await loginWithGoogle(response.credential)
    if (err && err !== '2FA_REQUIRED') setError(err)
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { setError('El telefono es obligatorio'); return }
    setLoading(true)
    setError('')
    const err = await register(name, email, password, phone)
    if (err) setError(err)
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '14px 18px', borderRadius: '12px',
    fontSize: '15px', fontFamily: '"Outfit",sans-serif',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#F0ECE3', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box' as const,
  }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }
  function handleFocus(e: React.FocusEvent<HTMLInputElement>) { e.currentTarget.style.borderColor = 'rgba(52,211,153,0.3)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(52,211,153,0.08)' }
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>
      {GOOGLE_CLIENT_ID && (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
          onLoad={() => (window as any).__google_init_register?.()}
        />
      )}
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#050507', position: 'relative', overflow: 'hidden', fontFamily: '"Outfit",sans-serif',
      }}>
        <div style={{ position: 'absolute', top: '-30%', right: '-10%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(52,211,153,0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-25%', left: '-15%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.02, backgroundImage: 'linear-gradient(rgba(201,168,76,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.3), transparent)' }} />

        <div style={{ width: '420px', maxWidth: '92vw', position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '64px', height: '64px', margin: '0 auto 20px', borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(201,168,76,0.08))',
              border: '1px solid rgba(52,211,153,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(52,211,153,0.1)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '32px', fontWeight: 300, color: '#F0ECE3', margin: '0 0 6px' }}>Crea tu cuenta</h1>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginTop: '8px' }}>7 dias gratis. Sin tarjeta de credito.</p>
          </div>

          <form onSubmit={handleRegister}>
            <div style={{
              background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px', padding: '32px 28px',
              backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            }}>
              {/* Google Sign-In */}
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

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Nombre completo *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Juan Perez" required autoComplete="name"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="juan@email.com" required autoComplete="email"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Telefono *</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (786) 555-0000" required autoComplete="tel"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Contrasena *</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres" required autoComplete="new-password"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#fca5a5', textAlign: 'center' }}>{error}</div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '15px', borderRadius: '14px', fontSize: '14px', fontWeight: 700,
                fontFamily: '"Outfit",sans-serif', letterSpacing: '0.05em',
                background: loading ? 'rgba(52,211,153,0.3)' : 'linear-gradient(135deg, #34d399 0%, #059669 50%, #34d399 100%)',
                color: '#050507', border: 'none', cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 8px 32px rgba(52,211,153,0.2)', transition: 'all 0.3s',
              }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {loading ? 'Creando cuenta...' : 'Empezar 7 dias gratis'}
              </button>

              <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.2)', textAlign: 'center', marginTop: '12px' }}>
                Al crear tu cuenta aceptas los terminos de servicio
              </p>
            </div>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.35)' }}>
              Ya tienes cuenta?{' '}
              <Link href="/login" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 600 }}>Inicia sesion</Link>
            </p>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.2)' }}>Powered by <span style={{ color: 'rgba(201,168,76,0.4)', fontWeight: 600 }}>SophiaOS</span></p>
          </div>
        </div>
      </div>
    </>
  )
}
