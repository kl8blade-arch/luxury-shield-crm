'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
  role: string
  plan: string
  account_id: string | null
  totp_enabled?: boolean
  paid?: boolean
  onboarding_complete?: boolean
  trial_ends_at?: string | null
  profile_photo?: string | null
}

interface ActiveAccount {
  id: string
  name: string
  slug: string
  industry: string
  logo_url?: string | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error?: string; requires_2fa?: boolean; agent_id?: string; name?: string } | null>
  register: (name: string, email: string, password: string, phone: string) => Promise<string | null>
  loginWithGoogle: (credential: string) => Promise<string | null>
  verify2FA: (agentId: string, code: string) => Promise<string | null>
  logout: () => void
  isAdmin: boolean
  trialDaysLeft: number | null
  isTrialExpired: boolean
  activeAccount: ActiveAccount | null
  switchAccount: (account: ActiveAccount | null) => void
  isViewingSubAccount: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => null,
  register: async () => null,
  loginWithGoogle: async () => null,
  verify2FA: async () => null,
  logout: () => {},
  isAdmin: false,
  trialDaysLeft: null,
  isTrialExpired: false,
  activeAccount: null,
  switchAccount: () => {},
  isViewingSubAccount: false,
})

export const useAuth = () => useContext(AuthContext)

const PUBLIC_ROUTES = ['/login', '/register', '/l']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeAccount, setActiveAccount] = useState<ActiveAccount | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const isViewingSubAccount = activeAccount !== null

  function switchAccount(account: ActiveAccount | null) {
    setActiveAccount(account)
    if (account) {
      sessionStorage.setItem('ls_active_account', JSON.stringify(account))
    } else {
      sessionStorage.removeItem('ls_active_account')
    }
    router.push('/dashboard')
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ls_auth')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.id) {
          setUser(parsed)
        } else if (parsed.email) {
          setUser({
            id: 'legacy',
            name: parsed.name || 'Carlos Silva',
            email: parsed.email,
            role: parsed.role || 'admin',
            plan: 'elite',
            account_id: null,
            paid: true,
            onboarding_complete: true,
          })
        }
      }
    } catch {}
    // Restore active account from session
    try {
      const stored = sessionStorage.getItem('ls_active_account')
      if (stored) setActiveAccount(JSON.parse(stored))
    } catch {}
    setLoading(false)
  }, [])

  // Route protection
  useEffect(() => {
    if (loading) return
    const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r)) || pathname === '/'
    if (!user && !isPublic) {
      router.push('/login')
    }
    // Redirect to setup if onboarding not complete (except admin)
    if (user && !user.onboarding_complete && user.role !== 'admin' && pathname !== '/setup' && !isPublic) {
      router.push('/setup')
    }
  }, [user, loading, pathname, router])

  // Trial calculation
  const trialDaysLeft = user?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(user.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const isTrialExpired = user?.role !== 'admin' && !user?.paid && trialDaysLeft !== null && trialDaysLeft <= 0

  async function login(email: string, password: string) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error || 'Error de autenticacion' }

      // 2FA required
      if (data.requires_2fa) {
        return { requires_2fa: true, agent_id: data.agent_id, name: data.name }
      }

      setUser(data.user)
      localStorage.setItem('ls_auth', JSON.stringify(data.user))

      if (!data.user.onboarding_complete && data.user.role !== 'admin') {
        router.push('/setup')
      } else {
        router.push('/dashboard')
      }
      return null
    } catch {
      return { error: 'Error de conexion' }
    }
  }

  async function register(name: string, email: string, password: string, phone: string): Promise<string | null> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone }),
      })
      const data = await res.json()
      if (!res.ok) return data.error || 'Error al crear cuenta'
      setUser(data.user)
      localStorage.setItem('ls_auth', JSON.stringify(data.user))
      router.push('/setup')
      return null
    } catch {
      return 'Error de conexion'
    }
  }

  async function loginWithGoogle(credential: string): Promise<string | null> {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      })
      const data = await res.json()
      if (!res.ok) return data.error || 'Error con Google'

      if (data.user.totp_enabled) {
        // Store temp data for 2FA
        sessionStorage.setItem('pending_2fa', JSON.stringify({ agent_id: data.user.id, name: data.user.name }))
        return '2FA_REQUIRED'
      }

      setUser(data.user)
      localStorage.setItem('ls_auth', JSON.stringify(data.user))

      if (data.isNew || !data.user.onboarding_complete) {
        router.push('/setup')
      } else {
        router.push('/dashboard')
      }
      return null
    } catch {
      return 'Error de conexion'
    }
  }

  async function verify2FA(agentId: string, code: string): Promise<string | null> {
    try {
      const res = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, code }),
      })
      const data = await res.json()
      if (!res.ok) return data.error || 'Codigo incorrecto'

      setUser(data.user)
      localStorage.setItem('ls_auth', JSON.stringify(data.user))

      if (!data.user.onboarding_complete && data.user.role !== 'admin') {
        router.push('/setup')
      } else {
        router.push('/dashboard')
      }
      return null
    } catch {
      return 'Error de conexion'
    }
  }

  function logout() {
    setUser(null)
    localStorage.removeItem('ls_auth')
    router.push('/login')
  }

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, verify2FA, logout, isAdmin, trialDaysLeft, isTrialExpired, activeAccount, switchAccount, isViewingSubAccount }}>
      {children}
    </AuthContext.Provider>
  )
}
