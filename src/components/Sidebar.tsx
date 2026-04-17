'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Kanban, Bell, Calendar,
  MessageSquare, Settings, Shield, Building2,
  UserCheck, Package, ChevronRight, BarChart3, Brain, LogOut, Upload,
  ChevronDown, Plus, Circle, Share2, Archive, Plug,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: '224px',
      background: '#08090d', borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      zIndex: 50, fontFamily: '"Inter","Segoe UI",sans-serif',
    }}>

      {/* ── LOGO ── */}
      <div style={{ padding: '20px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
            background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {accountLogo ? (
              <img src={accountLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Shield style={{ width: '15px', height: '15px', color: '#C9A84C' }} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: isViewingSubAccount ? '#34d399' : '#E2C060', letterSpacing: '0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isViewingSubAccount ? activeAccount?.name : (accountName || 'Luxury Shield')}
            </p>
            <p style={{ fontSize: '9px', color: 'rgba(240,236,227,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '1px' }}>
              {isViewingSubAccount ? `Sub-cuenta · ${activeAccount?.industry || 'CRM'}` : `CRM ${isAdmin ? '· Admin' : ''}`}
            </p>
          </div>
        </div>

        {/* ── ACCOUNT SWITCHER (collapsible) ── */}
        {isAdmin && (
          <div>
            {/* Parent account + toggle */}
            <div onClick={() => setAccountsOpen(!accountsOpen)} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px',
              borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
              background: accountsOpen ? 'rgba(201,168,76,0.06)' : 'transparent',
            }}
              onMouseEnter={e => { if (!accountsOpen) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { if (!accountsOpen) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              <Building2 style={{ width: '12px', height: '12px', color: '#C9A84C', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '11px', fontWeight: 600, color: 'rgba(240,236,227,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {parentAccount?.name || 'Luxury Shield'}
              </span>
              <ChevronDown style={{
                width: '12px', height: '12px', color: 'rgba(240,236,227,0.3)',
                transform: accountsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
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
                    background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
                  }}>
                    <span style={{ fontSize: '10px', color: '#C9A84C' }}>&larr;</span>
                    <span style={{ fontSize: '10px', color: '#C9A84C', fontWeight: 600 }}>Volver a cuenta principal</span>
                  </div>
                )}

                {subAccounts.map(sub => {
                  const isActive = activeAccount?.id === sub.id
                  return (
                    <div key={sub.id} onClick={() => { switchAccount({ id: sub.id, name: sub.name, slug: sub.slug, industry: sub.industry || 'seguros', logo_url: sub.logo_url }); onNavigate?.() }} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px 6px 20px',
                      borderRadius: '6px', cursor: 'pointer', transition: 'all 0.12s',
                      background: isActive ? 'rgba(52,211,153,0.06)' : 'transparent',
                      border: isActive ? '1px solid rgba(52,211,153,0.15)' : '1px solid transparent',
                    }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    >
                      {sub.logo_url ? (
                        <img src={sub.logo_url} alt="" style={{ width: '14px', height: '14px', borderRadius: '4px', objectFit: 'cover' }} />
                      ) : (
                        <Circle style={{ width: '8px', height: '8px', color: isActive ? '#34d399' : 'rgba(240,236,227,0.2)', fill: isActive ? '#34d399' : 'rgba(240,236,227,0.2)' }} />
                      )}
                      <span style={{ fontSize: '11px', color: isActive ? '#34d399' : 'rgba(240,236,227,0.4)', fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sub.name}
                      </span>
                      <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '100px', background: isActive ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)', color: isActive ? '#34d399' : 'rgba(240,236,227,0.25)', marginLeft: 'auto', flexShrink: 0, textTransform: 'capitalize' }}>
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
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(201,168,76,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                  >
                    <Plus style={{ width: '10px', height: '10px', color: 'rgba(201,168,76,0.5)' }} />
                    <span style={{ fontSize: '10px', color: 'rgba(201,168,76,0.5)', fontWeight: 500 }}>Nueva sub-cuenta</span>
                  </div>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── LINKED ACCOUNTS ── */}
      {linkedAccounts.length > 0 && (
        <div style={{ padding: '6px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(240,236,227,0.18)', marginBottom: '6px' }}>CUENTAS VINCULADAS</p>
          {linkedAccounts.map((la: any) => {
            const acc = la.owner
            const isActive = activeAccount?.id === acc?.id && activeAccount?.isLinked
            return acc ? (
              <div key={la.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px',
                marginBottom: '2px', transition: 'all 0.12s',
                background: isActive ? 'rgba(251,191,36,0.06)' : 'transparent',
                border: isActive ? '1px solid rgba(251,191,36,0.15)' : '1px solid transparent',
              }}>
                <div onClick={() => { switchAccount({ id: acc.id, name: acc.name, slug: acc.slug, industry: acc.industry || '', logo_url: acc.logo_url, isLinked: true, permissions: la.permissions }); onNavigate?.() }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, cursor: 'pointer', overflow: 'hidden' }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget.parentElement as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget.parentElement as HTMLDivElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: '10px' }}>🔗</span>
                  <span style={{ fontSize: '11px', color: isActive ? '#fbbf24' : 'rgba(240,236,227,0.4)', fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
                </div>
                <span onClick={async (e) => {
                  e.stopPropagation()
                  if (!confirm(`Desvincular ${acc.name}?`)) return
                  await fetch('/api/linked-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke', accountId: user?.account_id, linkId: la.id }) })
                  if (isActive) switchAccount(null)
                  setLinkedAccounts((prev: any[]) => prev.filter((l: any) => l.id !== la.id))
                }} title="Desvincular" style={{ cursor: 'pointer', fontSize: '10px', color: 'rgba(240,236,227,0.2)', padding: '2px 4px', borderRadius: '4px', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,236,227,0.2)')}
                >✕</span>
              </div>
            ) : null
          })}
        </div>
      )}

      {/* ── NAV LABEL ── */}
      <div style={{ padding: '14px 20px 6px' }}>
        <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(240,236,227,0.22)' }}>
          Navegacion
        </p>
      </div>

      {/* ── NAV ITEMS ── */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {NAV.filter(n => !n.admin || isAdmin).map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={onNavigate} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '10px', cursor: 'pointer',
                background: active ? 'rgba(201,168,76,0.1)' : 'transparent',
                border: active ? '1px solid rgba(201,168,76,0.22)' : '1px solid transparent',
                color: active ? '#E2C060' : 'rgba(240,236,227,0.45)',
                fontSize: '13px', fontWeight: active ? 600 : 400,
                transition: 'all 0.15s', position: 'relative',
              }}
                onMouseEnter={e => {
                  if (!active) { const el = e.currentTarget as HTMLDivElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.color = 'rgba(240,236,227,0.82)'; el.style.border = '1px solid rgba(255,255,255,0.07)' }
                }}
                onMouseLeave={e => {
                  if (!active) { const el = e.currentTarget as HTMLDivElement; el.style.background = 'transparent'; el.style.color = 'rgba(240,236,227,0.45)'; el.style.border = '1px solid transparent' }
                }}
              >
                {active && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '18px', background: '#C9A84C', borderRadius: '0 3px 3px 0', marginLeft: '-12px' }} />}
                <Icon style={{ width: '16px', height: '16px', flexShrink: 0, opacity: active ? 1 : 0.7 }} />
                <span style={{ flex: 1, letterSpacing: '0.01em' }}>{label}</span>
                {active && <ChevronRight style={{ width: '12px', height: '12px', opacity: 0.5 }} />}
                {badge && <span style={{ background: '#f97316', color: 'white', fontSize: '10px', fontWeight: 700, borderRadius: '100px', padding: '1px 6px', minWidth: '18px', textAlign: 'center' }}>{badge}</span>}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* ── DIVIDER ── */}
      <div style={{ margin: '0 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

      {/* ── AGENT CARD ── */}
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{
          background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
          borderRadius: '12px', padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #C9A84C, #8B6E2E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 800, color: '#07080A',
            boxShadow: '0 2px 8px rgba(201,168,76,0.3)',
          }}>{initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#F0ECE3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'Agent'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              <p style={{ fontSize: '9px', color: '#C9A84C', fontWeight: 600, textTransform: 'capitalize' }}>{user?.role} · {user?.plan}</p>
            </div>
          </div>
          <button onClick={logout} title="Cerrar sesion" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '5px',
            color: 'rgba(240,236,227,0.3)', transition: 'color 0.2s', flexShrink: 0,
          }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,236,227,0.3)')}
          >
            <LogOut style={{ width: '13px', height: '13px' }} />
          </button>
        </div>
      </div>
    </aside>
  )
}
