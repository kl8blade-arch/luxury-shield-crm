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

  // Close sidebar on route change (mobile)
  useEffect(() => { if (isMobile) setOpen(false) }, [pathname, isMobile])

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 49, backdropFilter: 'blur(2px)',
        }} />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50,
        transform: isMobile && !open ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.25s ease',
      }}>
        {isMobile && (
          <button onClick={() => setOpen(false)} style={{
            position: 'absolute', top: 14, right: -40, zIndex: 51,
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
            display: open ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#9ca3af', fontSize: 16,
          }}>×</button>
        )}
        <Sidebar onNavigate={() => isMobile && setOpen(false)} />
      </div>

      {/* Main */}
      <main style={{
        marginLeft: isMobile ? 0 : '224px',
        minHeight: '100vh', overflow: 'hidden',
        transition: 'margin-left 0.25s ease',
      }}>
        {children}
      </main>

      {/* Mobile hamburger button */}
      {isMobile && !open && (
        <button onClick={() => setOpen(true)} style={{
          position: 'fixed', bottom: 20, left: 16, zIndex: 40,
          background: '#C9A84C', border: 'none', borderRadius: 12,
          width: 44, height: 44, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(201,168,76,0.4)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <span style={{ width: 18, height: 2, background: '#0a0a0f', borderRadius: 2, display: 'block' }} />
          <span style={{ width: 18, height: 2, background: '#0a0a0f', borderRadius: 2, display: 'block' }} />
          <span style={{ width: 18, height: 2, background: '#0a0a0f', borderRadius: 2, display: 'block' }} />
        </button>
      )}
    </>
  )
}
