'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { register } = useAuth()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await register(name, email, password, phone || undefined)
    if (err) setError(err)
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '14px 18px', borderRadius: '12px',
    fontSize: '15px', fontFamily: '"Outfit",sans-serif',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#F0ECE3', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: 600,
    letterSpacing: '0.12em', textTransform: 'uppercase' as const,
    color: 'rgba(240,236,227,0.35)', marginBottom: '8px',
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'
    e.currentTarget.style.boxShadow = '0 0 20px rgba(201,168,76,0.08)'
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#050507', position: 'relative', overflow: 'hidden',
        fontFamily: '"Outfit",sans-serif',
      }}>

        {/* Ambient effects */}
        <div style={{ position: 'absolute', top: '-30%', right: '-10%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(52,211,153,0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-25%', left: '-15%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />

        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.02,
          backgroundImage: 'linear-gradient(rgba(201,168,76,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.3), transparent)' }} />

        {/* Card */}
        <div style={{ width: '420px', maxWidth: '92vw', position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{
              width: '64px', height: '64px', margin: '0 auto 20px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(201,168,76,0.08))',
              border: '1px solid rgba(52,211,153,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(52,211,153,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>

            <h1 style={{
              fontFamily: '"Cormorant Garamond",serif',
              fontSize: '32px', fontWeight: 300, color: '#F0ECE3',
              margin: '0 0 6px', letterSpacing: '0.02em', lineHeight: 1,
            }}>Crea tu cuenta</h1>
            <p style={{
              fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginTop: '8px',
            }}>Accede al CRM mas avanzado para vender seguros</p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister}>
            <div style={{
              background: 'rgba(255,255,255,0.015)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
              padding: '32px 28px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
            }}>
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Nombre completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Juan Perez" required autoComplete="name"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="juan@email.com" required autoComplete="email"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Telefono <span style={{ opacity: 0.5 }}>(opcional)</span></label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (786) 555-0000" autoComplete="tel"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Contrasena</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres" required autoComplete="new-password"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: '13px', color: '#fca5a5', textAlign: 'center',
                }}>{error}</div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '15px', borderRadius: '14px',
                fontSize: '14px', fontWeight: 700, fontFamily: '"Outfit",sans-serif',
                letterSpacing: '0.05em',
                background: loading ? 'rgba(52,211,153,0.3)' : 'linear-gradient(135deg, #34d399 0%, #059669 50%, #34d399 100%)',
                color: '#050507', border: 'none', cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 8px 32px rgba(52,211,153,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
                transition: 'all 0.3s',
              }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(52,211,153,0.3)' } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(52,211,153,0.2)' }}
              >
                {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
              </button>
            </div>
          </form>

          {/* Login link */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.35)' }}>
              Ya tienes cuenta?{' '}
              <Link href="/login" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 600 }}>
                Inicia sesion
              </Link>
            </p>
          </div>

          {/* Benefits */}
          <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              'Sophia IA responde tus leads 24/7 por WhatsApp',
              'Pipeline inteligente con lead scoring',
              'Campanas de marketing listas para usar',
              'Coaching en tiempo real para cerrar mas ventas',
            ].map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#34d399', fontSize: '14px', flexShrink: 0 }}>&#10003;</span>
                <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.3)' }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.2)' }}>
              Powered by <span style={{ color: 'rgba(201,168,76,0.4)', fontWeight: 600 }}>SophiaOS</span>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
