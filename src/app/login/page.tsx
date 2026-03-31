'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await login(email, password)
    if (err) setError(err)
    setLoading(false)
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
        <div style={{ position: 'absolute', top: '-30%', left: '-10%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-25%', right: '-15%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '15%', right: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(167,139,250,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.02,
          backgroundImage: 'linear-gradient(rgba(201,168,76,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        {/* Gold line top */}
        <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)' }} />

        {/* Card */}
        <div style={{ width: '420px', maxWidth: '92vw', position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{
              width: '64px', height: '64px', margin: '0 auto 20px',
              borderRadius: '18px', position: 'relative',
              background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.04))',
              border: '1px solid rgba(201,168,76,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(201,168,76,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>

            <h1 style={{
              fontFamily: '"Cormorant Garamond",serif',
              fontSize: '36px', fontWeight: 300, color: '#F0ECE3',
              margin: '0 0 6px', letterSpacing: '0.02em', lineHeight: 1,
            }}>Luxury Shield</h1>
            <p style={{
              fontSize: '11px', fontWeight: 600, letterSpacing: '0.25em',
              textTransform: 'uppercase', color: 'rgba(201,168,76,0.5)',
            }}>Insurance CRM</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div style={{
              background: 'rgba(255,255,255,0.015)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
              padding: '36px 32px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
            }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'rgba(240,236,227,0.35)', marginBottom: '8px',
                }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" required autoComplete="email"
                  style={{
                    width: '100%', padding: '14px 18px', borderRadius: '12px',
                    fontSize: '15px', fontFamily: '"Outfit",sans-serif',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F0ECE3', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(201,168,76,0.08)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'rgba(240,236,227,0.35)', marginBottom: '8px',
                }}>Contrasena</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{
                    width: '100%', padding: '14px 18px', borderRadius: '12px',
                    fontSize: '15px', fontFamily: '"Outfit",sans-serif',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F0ECE3', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(201,168,76,0.08)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
                />
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
                background: loading ? 'rgba(201,168,76,0.3)' : 'linear-gradient(135deg, #C9A84C 0%, #A8893A 50%, #C9A84C 100%)',
                color: '#050507', border: 'none', cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 8px 32px rgba(201,168,76,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
                transition: 'all 0.3s',
              }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(201,168,76,0.3), inset 0 1px 0 rgba(255,255,255,0.2)' } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(201,168,76,0.2), inset 0 1px 0 rgba(255,255,255,0.15)' }}
              >
                {loading ? 'Accediendo...' : 'Acceder'}
              </button>
            </div>
          </form>

          {/* Register link */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.35)' }}>
              Eres agente?{' '}
              <Link href="/register" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 600 }}>
                Crea tu cuenta gratis
              </Link>
            </p>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.2)' }}>
              Powered by <span style={{ color: 'rgba(201,168,76,0.4)', fontWeight: 600 }}>SophiaOS</span>
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px' }}>
              <span style={{ fontSize: '10px', color: 'rgba(240,236,227,0.15)' }}>2026 Luxury Shield Insurance</span>
              <span style={{ fontSize: '10px', color: 'rgba(240,236,227,0.15)' }}>SeguriSSimo Agency</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
