'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { if (isMobile) setOpen(false) }, [pathname, isMobile])

  return (
    <>
      {/* Mobile overlay — z-index ABOVE sidebar, catches all taps */}
      {isMobile && open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 110, backdropFilter: 'blur(3px)',
        }} />
      )}

      {/* Sidebar wrapper — overrides Sidebar's own position:fixed */}
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

      {/* Main content — full width on mobile */}
      <main style={{
        marginLeft: isMobile ? 0 : '224px',
        minHeight: '100vh', overflow: 'hidden',
        width: isMobile ? '100%' : undefined,
      }}>
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
