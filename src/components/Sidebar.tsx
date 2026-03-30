'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Kanban, Bell, Calendar,
  MessageSquare, Settings, Shield,
  UserCheck, Package, ChevronRight, BarChart3, Brain,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',      badge: null },
  { href: '/analytics',  icon: BarChart3,       label: 'Analytics',      badge: null },
  { href: '/leads',      icon: Users,           label: 'Mis Leads',       badge: null },
  { href: '/pipeline',   icon: Kanban,          label: 'Pipeline',        badge: null },
  { href: '/calendar',   icon: Calendar,        label: 'Agenda',          badge: null },
  { href: '/reminders',  icon: Bell,            label: 'Recordatorios',   badge: null },
  { href: '/templates',  icon: MessageSquare,   label: 'Plantillas',      badge: null },
  { href: '/agents',     icon: UserCheck,       label: 'Agentes',         badge: null },
  { href: '/packages',   icon: Package,         label: 'Paquetes',        badge: null },
  { href: '/training',   icon: Brain,           label: 'SophiaModel',     badge: null },
  { href: '/settings',   icon: Settings,        label: 'Configuración',   badge: null },
]

export default function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname()

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: '224px',
      background: '#08090d',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      zIndex: 50, fontFamily: '"Inter","Segoe UI",sans-serif',
    }}>

      {/* ── LOGO ── */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield style={{ width: '16px', height: '16px', color: '#C9A84C' }} />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#E2C060', letterSpacing: '0.02em', lineHeight: 1.2 }}>
              Luxury Shield
            </p>
            <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '1px' }}>
              CRM · Admin
            </p>
          </div>
        </div>
      </div>

      {/* ── NAV LABEL ── */}
      <div style={{ padding: '20px 20px 8px' }}>
        <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(240,236,227,0.22)' }}>
          Navegación
        </p>
      </div>

      {/* ── NAV ITEMS ── */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {NAV.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={onNavigate} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                  background: active ? 'rgba(201,168,76,0.1)' : 'transparent',
                  border: active ? '1px solid rgba(201,168,76,0.22)' : '1px solid transparent',
                  color: active ? '#E2C060' : 'rgba(240,236,227,0.45)',
                  fontSize: '13px', fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s', position: 'relative',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.background = 'rgba(255,255,255,0.04)'
                    el.style.color = 'rgba(240,236,227,0.82)'
                    el.style.border = '1px solid rgba(255,255,255,0.07)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.background = 'transparent'
                    el.style.color = 'rgba(240,236,227,0.45)'
                    el.style.border = '1px solid transparent'
                  }
                }}
              >
                {/* Active indicator bar */}
                {active && (
                  <div style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: '3px', height: '18px', background: '#C9A84C',
                    borderRadius: '0 3px 3px 0', marginLeft: '-12px',
                  }} />
                )}
                <Icon style={{ width: '16px', height: '16px', flexShrink: 0, opacity: active ? 1 : 0.7 }} />
                <span style={{ flex: 1, letterSpacing: '0.01em' }}>{label}</span>
                {active && <ChevronRight style={{ width: '12px', height: '12px', opacity: 0.5 }} />}
                {badge && (
                  <span style={{
                    background: '#f97316', color: 'white', fontSize: '10px', fontWeight: 700,
                    borderRadius: '100px', padding: '1px 6px', minWidth: '18px', textAlign: 'center',
                  }}>{badge}</span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* ── DIVIDER ── */}
      <div style={{ margin: '0 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

      {/* ── AGENT CARD ── */}
      <div style={{ padding: '16px 16px 20px' }}>
        <div style={{
          background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
          borderRadius: '12px', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #C9A84C, #8B6E2E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 800, color: '#07080A',
            boxShadow: '0 2px 8px rgba(201,168,76,0.3)',
          }}>CS</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#F0ECE3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Carlos Silva
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              <p style={{ fontSize: '10px', color: '#C9A84C', fontWeight: 600 }}>Admin · Elite</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
