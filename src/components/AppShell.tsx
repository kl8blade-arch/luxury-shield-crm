'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import { useAuth } from '@/contexts/AuthContext'

const PUBLIC_ROUTES = ['/login', '/register', '/l/', '/setup']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const { user, loading, trialDaysLeft, isTrialExpired } = useAuth()

  const isPublicPage = pathname === '/' || PUBLIC_ROUTES.some(r => pathname.startsWith(r))

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { if (isMobile) setOpen(false) }, [pathname, isMobile])

  // On public pages or when not logged in, render without sidebar
  if (isPublicPage || (!loading && !user)) {
    return <>{children}</>
  }

  // While loading, show nothing (prevents flash)
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#07080A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 110, backdropFilter: 'blur(3px)',
        }} />
      )}

      {/* Sidebar wrapper */}
      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0,
        zIndex: isMobile ? (open ? 120 : -1) : 50,
        width: '224px',
        transform: isMobile && !open ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.25s ease',
        pointerEvents: isMobile && !open ? 'none' : 'auto',
      }}>
        <Sidebar onNavigate={() => isMobile && setOpen(false)} />
      </div>

      {/* Main content */}
      <main style={{
        marginLeft: isMobile ? 0 : '224px',
        minHeight: '100vh', overflow: 'hidden',
        width: isMobile ? '100%' : undefined,
      }}>
        {/* Trial banner */}
        {trialDaysLeft !== null && !user?.paid && user?.role !== 'admin' && (
          <div style={{
            padding: '10px 20px', textAlign: 'center', fontSize: '13px', fontWeight: 600,
            fontFamily: '"Outfit","Inter",sans-serif',
            background: isTrialExpired
              ? 'linear-gradient(90deg, #991b1b, #7f1d1d)'
              : trialDaysLeft <= 2
                ? 'linear-gradient(90deg, #92400e, #78350f)'
                : 'linear-gradient(90deg, #1e3a5f, #172554)',
            color: isTrialExpired ? '#fca5a5' : trialDaysLeft <= 2 ? '#fde68a' : '#93c5fd',
          }}>
            {isTrialExpired
              ? 'Tu prueba gratuita ha expirado. Actualiza tu plan para continuar usando el CRM.'
              : `Te quedan ${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''} de prueba gratis.`}
            {' '}
            <a href="/packages" style={{ color: '#C9A84C', textDecoration: 'underline', fontWeight: 700 }}>
              {isTrialExpired ? 'Ver planes' : 'Actualizar ahora'}
            </a>
          </div>
        )}
        {children}
      </main>

      {/* Hamburger button — only on mobile */}
      {isMobile && !open && (
        <button onClick={() => setOpen(true)} style={{
          position: 'fixed', bottom: 24, left: 16, zIndex: 100,
          background: '#C9A84C', border: 'none', borderRadius: 14,
          width: 50, height: 50, cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(201,168,76,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <span style={{ width: 18, height: 2, background: '#0a0a0f', borderRadius: 2, display: 'block' }} />
          <span style={{ width: 18, height: 2, background: '#0a0a0f', borderRadius: 2, display: 'block' }} />
          <span style={{ width: 14, height: 2, background: '#0a0a0f', borderRadius: 2, display: 'block' }} />
        </button>
      )}
    </>
  )
}
