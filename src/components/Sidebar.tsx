'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Kanban, Bell, Calendar,
  MessageSquare, Settings, Shield, Building2,
  UserCheck, Package, ChevronRight, BarChart3, Brain, LogOut, Upload,
  ChevronDown, Plus, Circle, Share2, Archive, Plug, Menu, X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ThemeToggle } from './ui/ThemeToggle'

const NAV = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',     badge: null, admin: false },
  { href: '/accounts',     icon: Building2,       label: 'Mi Cuenta',     badge: null, admin: true  },
  { href: '/admin',        icon: Shield,          label: 'Admin Panel',   badge: null, admin: true  },
  { href: '/agents',       icon: UserCheck,       label: 'Agentes',       badge: null, admin: true  },
  { href: '/analytics',    icon: BarChart3,       label: 'Analytics',     badge: null, admin: false },
  { href: '/calendar',     icon: Calendar,        label: 'Agenda',        badge: null, admin: false },
  { href: '/campaigns',    icon: BarChart3,       label: 'Campañas',      badge: null, admin: false },
  { href: '/import',       icon: Upload,          label: 'Importar',      badge: null, admin: false },
  { href: '/integrations', icon: Plug,            label: 'Integraciones', badge: null, admin: false },
  { href: '/leads',        icon: Users,           label: 'Mis Leads',     badge: null, admin: false },
  { href: '/marketplace',  icon: Package,         label: 'Marketplace',   badge: null, admin: false },
  { href: '/packages',     icon: Package,         label: 'Paquetes',      badge: null, admin: false },
  { href: '/pipeline',     icon: Kanban,          label: 'Pipeline',      badge: null, admin: false },
  { href: '/reminders',    icon: Bell,            label: 'Recordatorios', badge: null, admin: false },
  { href: '/social',       icon: Share2,          label: 'Social IA',     badge: null, admin: true  },
  { href: '/sophia-os',    icon: Shield,          label: 'Sophia OS',     badge: null, admin: true  },
  { href: '/templates',    icon: MessageSquare,   label: 'Plantillas',    badge: null, admin: false },
  { href: '/tools',        icon: Settings,        label: 'Herramientas',  badge: null, admin: false },
  { href: '/training',     icon: Brain,           label: 'SophiaModel',   badge: null, admin: true  },
  { href: '/vault',        icon: Archive,         label: 'Vault',         badge: null, admin: true  },
  { href: '/settings',     icon: Settings,        label: 'Configuración', badge: null, admin: false },
]

export default function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname()
  const { user, logout, isAdmin, activeAccount, switchAccount, isViewingSubAccount } = useAuth()
  const [accountLogo, setAccountLogo] = useState<string | null>(null)
  const [accountName, setAccountName] = useState<string | null>(null)
  const [parentAccount, setParentAccount] = useState<any>(null)
  const [subAccounts, setSubAccounts] = useState<any[]>([])
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([])
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // ESC key handler for mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileOpen(false)
    }
    if (isMobileOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileOpen])

  useEffect(() => {
    if (!user?.account_id) return
    // Load account info + sub-accounts
    supabase.from('accounts').select('id, logo_url, name, brand_color, slug, parent_account_id').eq('id', user.account_id).single()
      .then(({ data }) => {
        if (data?.logo_url) setAccountLogo(data.logo_url)
        if (data?.name && !isAdmin) setAccountName(data.name)
        setParentAccount(data)
      })

    // Load sub-accounts (only for admin/parent accounts)
    if (isAdmin) {
      supabase.from('accounts').select('id, name, slug, plan, logo_url, parent_account_id')
        .order('created_at', { ascending: true })
        .then(({ data }) => {
          if (data) {
            // Find parent (luxury-shield) and its children
            const parent = data.find(a => a.slug === 'luxury-shield' || !a.parent_account_id)
            if (parent) {
              setParentAccount(parent)
              setSubAccounts(data.filter(a => a.parent_account_id === parent.id))
            }
          }
        })
    }
    // Load linked accounts
    if (user?.account_id) {
      fetch(`/api/linked-accounts?account_id=${user.account_id}`)
        .then(r => r.json())
        .then(data => setLinkedAccounts(data.managing || []))
        .catch(() => {})
    }
  }, [user?.account_id, isAdmin])

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'AG'

  return (
    <>
      {/* Hamburger button for mobile */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        style={{
          position: 'fixed',
          top: '12px',
          left: '12px',
          zIndex: 200,
          display: 'none',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          padding: '8px',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          width: '40px',
          height: '40px',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'var(--glass-bg-hover)'
          el.style.borderColor = 'var(--glass-border-hover)'
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'var(--glass-bg)'
          el.style.borderColor = 'var(--glass-border)'
        }}
        className="mobile-hamburger"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Dark overlay for mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-overlay)',
            zIndex: 49,
            display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      {/* Main sidebar */}
      <aside style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '224px',
        background: 'var(--glass-bg)',
        borderRight: '1px solid var(--glass-border)',
        backdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column',
        zIndex: 50, fontFamily: '"Inter","Segoe UI",sans-serif',
        transition: 'background-color 200ms ease, border-color 200ms ease',
      }}>

      {/* ── LOGO ── */}
      <div style={{
        padding: '20px 16px 8px',
        borderBottom: '1px solid var(--glass-border)',
        transition: 'border-color 200ms ease',
      }}>
        {/* Header with logo and theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
              background: 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.1)',
              border: '1px solid rgba(var(--brand-primary-rgb, 201, 168, 76), 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              transition: 'all 200ms ease',
            }}>
              {accountLogo ? (
                <img src={accountLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Shield style={{ width: '15px', height: '15px', color: 'var(--brand-primary)' }} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                fontSize: '12px', fontWeight: 700,
                color: isViewingSubAccount ? '#34d399' : 'var(--brand-primary-hover)',
                letterSpacing: '0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'color 200ms ease',
              }}>
                {isViewingSubAccount ? activeAccount?.name : (accountName || 'Luxury Shield')}
              </p>
              <p style={{
                fontSize: '9px',
                color: 'var(--text-secondary)',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '1px',
                transition: 'color 200ms ease',
              }}>
                {isViewingSubAccount ? `Sub-cuenta · ${activeAccount?.industry || 'CRM'}` : `CRM ${isAdmin ? '· Admin' : ''}`}
              </p>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <ThemeToggle variant="icon" />
          </div>
        </div>

        {/* ── ACCOUNT SWITCHER (collapsible) ── */}
        {isAdmin && (
          <div>
            {/* Parent account + toggle */}
            <div onClick={() => setAccountsOpen(!accountsOpen)} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px',
              borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
              background: accountsOpen ? 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.06)' : 'transparent',
            }}
              onMouseEnter={e => { if (!accountsOpen) (e.currentTarget as HTMLDivElement).style.background = 'var(--glass-bg-hover)' }}
              onMouseLeave={e => { if (!accountsOpen) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              <Building2 style={{ width: '12px', height: '12px', color: 'var(--brand-primary)', flexShrink: 0 }} />
              <span style={{
                flex: 1, fontSize: '11px', fontWeight: 600,
                color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'color 200ms ease',
              }}>
                {parentAccount?.name || 'Luxury Shield'}
              </span>
              <ChevronDown style={{
                width: '12px', height: '12px',
                color: 'var(--text-muted)',
                transform: accountsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s, color 200ms ease',
              }} />
            </div>

            {/* Sub-accounts dropdown */}
            {accountsOpen && (
              <div style={{ paddingLeft: '4px', marginTop: '2px' }}>
                {/* Back to main account button (when viewing sub) */}
                {isViewingSubAccount && (
                  <div onClick={() => { switchAccount(null); onNavigate?.() }} style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px 6px 16px',
                    borderRadius: '6px', cursor: 'pointer', marginBottom: '4px',
                    background: 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.06)',
                    border: '1px solid rgba(var(--brand-primary-rgb, 201, 168, 76), 0.15)',
                    transition: 'all 200ms ease',
                  }}>
                    <span style={{ fontSize: '10px', color: 'var(--brand-primary)' }}>&larr;</span>
                    <span style={{ fontSize: '10px', color: 'var(--brand-primary)', fontWeight: 600 }}>Volver a cuenta principal</span>
                  </div>
                )}

                {subAccounts.map(sub => {
                  const isActive = activeAccount?.id === sub.id
                  return (
                    <div key={sub.id} onClick={() => { switchAccount({ id: sub.id, name: sub.name, slug: sub.slug, industry: sub.industry || 'seguros', logo_url: sub.logo_url }); onNavigate?.() }} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px 6px 20px',
                      borderRadius: '6px', cursor: 'pointer', transition: 'all 0.12s',
                      background: isActive ? 'rgba(var(--success-rgb, 16, 185, 129), 0.06)' : 'transparent',
                      border: isActive ? '1px solid rgba(var(--success-rgb, 16, 185, 129), 0.15)' : '1px solid transparent',
                    }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--glass-bg-hover)' }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    >
                      {sub.logo_url ? (
                        <img src={sub.logo_url} alt="" style={{ width: '14px', height: '14px', borderRadius: '4px', objectFit: 'cover' }} />
                      ) : (
                        <Circle style={{
                          width: '8px', height: '8px',
                          color: isActive ? 'var(--success)' : 'var(--text-muted)',
                          fill: isActive ? 'var(--success)' : 'var(--text-muted)',
                          transition: 'color 200ms ease, fill 200ms ease',
                        }} />
                      )}
                      <span style={{
                        fontSize: '11px',
                        color: isActive ? 'var(--success)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        transition: 'color 200ms ease',
                      }}>
                        {sub.name}
                      </span>
                      <span style={{
                        fontSize: '8px', padding: '1px 5px', borderRadius: '100px',
                        background: isActive ? 'rgba(var(--success-rgb, 16, 185, 129), 0.1)' : 'var(--glass-bg)',
                        color: isActive ? 'var(--success)' : 'var(--text-muted)',
                        marginLeft: 'auto', flexShrink: 0, textTransform: 'capitalize',
                        transition: 'all 200ms ease',
                      }}>
                        {sub.plan}
                      </span>
                    </div>
                  )
                })}

                {/* Add sub-account button */}
                <Link href="/accounts?tab=subs&create=true" onClick={onNavigate} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px 6px 18px',
                    borderRadius: '6px', cursor: 'pointer', marginTop: '2px',
                    transition: 'all 200ms ease',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                  >
                    <Plus style={{
                      width: '10px', height: '10px',
                      color: 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.5)',
                      transition: 'color 200ms ease',
                    }} />
                    <span style={{
                      fontSize: '10px',
                      color: 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.5)',
                      fontWeight: 500,
                      transition: 'color 200ms ease',
                    }}>Nueva sub-cuenta</span>
                  </div>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── LINKED ACCOUNTS ── */}
      {linkedAccounts.length > 0 && (
        <div style={{
          padding: '6px 16px 8px',
          borderBottom: '1px solid var(--glass-border)',
          transition: 'border-color 200ms ease',
        }}>
          <p style={{
            fontSize: '8px', fontWeight: 700, letterSpacing: '0.15em',
            color: 'var(--text-muted)',
            marginBottom: '6px',
            transition: 'color 200ms ease',
          }}>CUENTAS VINCULADAS</p>
          {linkedAccounts.map((la: any) => {
            const acc = la.owner
            const isActive = activeAccount?.id === acc?.id && activeAccount?.isLinked
            return acc ? (
              <div key={la.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px',
                marginBottom: '2px', transition: 'all 0.12s',
                background: isActive ? 'rgba(var(--warning-rgb, 245, 158, 11), 0.06)' : 'transparent',
                border: isActive ? '1px solid rgba(var(--warning-rgb, 245, 158, 11), 0.15)' : '1px solid transparent',
              }}>
                <div onClick={() => { switchAccount({ id: acc.id, name: acc.name, slug: acc.slug, industry: acc.industry || '', logo_url: acc.logo_url, isLinked: true, permissions: la.permissions }); onNavigate?.() }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, cursor: 'pointer', overflow: 'hidden' }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget.parentElement as HTMLDivElement).style.background = 'var(--glass-bg-hover)' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget.parentElement as HTMLDivElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: '10px' }}>🔗</span>
                  <span style={{
                    fontSize: '11px',
                    color: isActive ? 'var(--warning)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    transition: 'color 200ms ease',
                  }}>{acc.name}</span>
                </div>
                <span onClick={async (e) => {
                  e.stopPropagation()
                  if (!confirm(`Desvincular ${acc.name}?`)) return
                  await fetch('/api/linked-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke', accountId: user?.account_id, linkId: la.id }) })
                  if (isActive) switchAccount(null)
                  setLinkedAccounts((prev: any[]) => prev.filter((l: any) => l.id !== la.id))
                }} title="Desvincular" style={{
                  cursor: 'pointer', fontSize: '10px',
                  color: 'var(--text-muted)',
                  padding: '2px 4px', borderRadius: '4px', flexShrink: 0,
                  transition: 'color 200ms ease',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >✕</span>
              </div>
            ) : null
          })}
        </div>
      )}

      {/* ── NAV LABEL ── */}
      <div style={{ padding: '14px 20px 6px' }}>
        <p style={{
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--text-muted)',
          transition: 'color 200ms ease',
        }}>
          Navegacion
        </p>
      </div>

      {/* ── NAV ITEMS ── */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {NAV.filter(n => !n.admin || isAdmin).map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={() => { onNavigate?.(); setIsMobileOpen(false) }} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '10px', cursor: 'pointer',
                background: active ? 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.1)' : 'transparent',
                border: active ? '1px solid rgba(var(--brand-primary-rgb, 201, 168, 76), 0.22)' : '1px solid transparent',
                color: active ? 'var(--brand-primary-hover)' : 'var(--text-secondary)',
                fontSize: '13px', fontWeight: active ? 600 : 400,
                transition: 'all 0.15s', position: 'relative',
              }}
                onMouseEnter={e => {
                  if (!active) {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.background = 'var(--glass-bg-hover)'
                    el.style.color = 'var(--text-primary)'
                    el.style.border = '1px solid var(--glass-border-hover)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.background = 'transparent'
                    el.style.color = 'var(--text-secondary)'
                    el.style.border = '1px solid transparent'
                  }
                }}
              >
                {active && <div style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: '3px', height: '18px',
                  background: 'var(--brand-primary)',
                  borderRadius: '0 3px 3px 0', marginLeft: '-12px',
                }} />}
                <Icon style={{ width: '16px', height: '16px', flexShrink: 0, opacity: active ? 1 : 0.7 }} />
                <span style={{ flex: 1, letterSpacing: '0.01em' }}>{label}</span>
                {active && <ChevronRight style={{ width: '12px', height: '12px', opacity: 0.5 }} />}
                {badge && <span style={{
                  background: 'var(--danger)',
                  color: 'white', fontSize: '10px', fontWeight: 700, borderRadius: '100px',
                  padding: '1px 6px', minWidth: '18px', textAlign: 'center',
                  transition: 'all 200ms ease',
                }}>{badge}</span>}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* ── DIVIDER ── */}
      <div style={{
        margin: '0 20px',
        borderTop: '1px solid var(--glass-border)',
        transition: 'border-color 200ms ease',
      }} />

      {/* ── AGENT CARD ── */}
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{
          background: 'rgba(var(--brand-primary-rgb, 201, 168, 76), 0.06)',
          border: '1px solid rgba(var(--brand-primary-rgb, 201, 168, 76), 0.15)',
          borderRadius: '12px', padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: '10px',
          transition: 'all 200ms ease',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--brand-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 800,
            color: 'var(--bg-base)',
            boxShadow: 'var(--brand-primary-glow)',
            transition: 'all 200ms ease',
          }}>{initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              fontSize: '12px', fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'color 200ms ease',
            }}>
              {user?.name || 'Agent'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: 'var(--success)',
                display: 'inline-block',
                transition: 'background-color 200ms ease',
              }} />
              <p style={{
                fontSize: '9px',
                color: 'var(--brand-primary)',
                fontWeight: 600, textTransform: 'capitalize',
                transition: 'color 200ms ease',
              }}>{user?.role} · {user?.plan}</p>
            </div>
          </div>
          <button onClick={logout} title="Cerrar sesion" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '5px',
            color: 'var(--text-muted)',
            transition: 'color 200ms ease', flexShrink: 0,
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <LogOut style={{ width: '13px', height: '13px' }} />
          </button>
        </div>
      </div>
    </aside>

    <style>{`
      @media (max-width: 768px) {
        .mobile-hamburger { display: flex !important; }
        .mobile-overlay { display: block !important; }
        aside {
          transform: translateX(${isMobileOpen ? '0' : '-100%'}) !important;
          transition: transform 0.3s ease !important;
        }
      }
    `}</style>
    </>
  )
}
