'use client'
// src/app/dashboard/layout.tsx
// Sidebar persistente para todas las páginas del dashboard

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { CommandPalette } from '@/components/CommandPalette'

const NAV_ITEMS = [
  { href: '/dashboard',          icon: '📊', label: 'Dashboard',    exact: true  },
  { href: '/dashboard/pipeline', icon: '🎯', label: 'Pipeline',     exact: false },
  { href: '/dashboard/money',    icon: '💰', label: 'Comisiones',   exact: false },
  { href: '/dashboard/seguros',  icon: '📋', label: 'Seguros',      exact: false },
  { href: '/dashboard/carriers', icon: '🏢', label: 'Carriers',     exact: false },
  { href: '/dashboard/citas',    icon: '📅', label: 'SophiaCita',   exact: false },
  { href: '/leads',              icon: '👥', label: 'Leads',        exact: false },
  { href: '/conversations',      icon: '💬', label: 'Conversaciones',exact: false },
  { href: '/settings',           icon: '⚙️', label: 'Configuración',exact: false },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user } = useAuth()

  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('sophiaos-theme')
    if (saved !== null) return saved === 'dark'
    return new Date().getHours() < 7 || new Date().getHours() >= 19
  })

  // Sync dark mode con el dashboard
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('sophiaos-theme')
      if (saved !== null) setDark(saved === 'dark')
    }
    window.addEventListener('storage', handleStorage)
    // Poll cada 500ms para detectar cambios del dashboard
    const interval = setInterval(() => {
      const saved = localStorage.getItem('sophiaos-theme')
      if (saved !== null) setDark(saved === 'dark')
    }, 500)
    return () => { window.removeEventListener('storage', handleStorage); clearInterval(interval) }
  }, [])

  const T = {
    bg:     dark ? '#080614' : '#f0ebff',
    sidebar: dark ? 'rgba(13,8,32,0.95)' : 'rgba(255,255,255,0.92)',
    border:  dark ? 'rgba(149,76,233,0.18)' : 'rgba(124,58,237,0.12)',
    text:    dark ? '#f0eaff' : '#1a0a3d',
    muted:   dark ? 'rgba(200,180,255,0.4)' : 'rgba(80,50,120,0.5)',
    accent:  dark ? '#9B59B6' : '#7c3aed',
    hover:   dark ? 'rgba(155,89,182,0.12)' : 'rgba(124,58,237,0.08)',
    active:  dark ? 'rgba(155,89,182,0.22)' : 'rgba(124,58,237,0.15)',
  }

  const isActive = (item: typeof NAV_ITEMS[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  const sidebarW = collapsed ? 56 : 200

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: "'SF Pro Display',system-ui,sans-serif" }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div style={{
        width: sidebarW, flexShrink: 0,
        background: T.sidebar,
        borderRight: `1px solid ${T.border}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
        transition: 'width 0.2s ease',
        overflow: 'hidden', zIndex: 50,
      }}>

        {/* Logo */}
        <div style={{ padding: collapsed ? '14px 12px' : '14px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10, minHeight: 56 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${T.accent},#00D4FF)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, boxShadow: `0 4px 12px ${T.accent}40` }}>🤖</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, whiteSpace: 'nowrap' }}>SophiaOS</div>
              <div style={{ fontSize: 8, color: T.muted, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Command Center</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item)
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? '10px 0' : '9px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 10, cursor: 'pointer',
                  background: active ? T.active : 'transparent',
                  border: `1px solid ${active ? T.accent + '40' : 'transparent'}`,
                  color: active ? T.accent : T.muted,
                  fontWeight: active ? 700 : 400,
                  fontSize: 13,
                  transition: 'all 0.15s',
                  width: '100%',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = T.hover }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                {!collapsed && active && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: T.accent, boxShadow: `0 0 6px ${T.accent}` }}/>}
              </button>
            )
          })}
        </nav>

        {/* Bottom: user + collapse */}
        <div style={{ borderTop: `1px solid ${T.border}`, padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* User info */}
          {!collapsed && user && (
            <div style={{ padding: '8px 10px', background: T.hover, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${T.accent},#00D4FF)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {user.name ? user.name[0].toUpperCase() : 'A'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name ?? 'Agente'}</div>
                <div style={{ fontSize: 9, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.plan ?? 'Free'}</div>
              </div>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8, padding: collapsed ? '8px 0' : '8px 10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: 'none', color: T.muted, fontSize: 12, width: '100%' }}
          >
            <span style={{ fontSize: 14 }}>{collapsed ? '→' : '←'}</span>
            {!collapsed && <span>Colapsar</span>}
          </button>
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </div>

      {/* Command Palette */}
      <CommandPalette />
    </div>
  )
}
