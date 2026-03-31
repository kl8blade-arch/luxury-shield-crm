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
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  register: (name: string, email: string, password: string, phone?: string) => Promise<string | null>
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => null,
  register: async () => null,
  logout: () => {},
  isAdmin: false,
})

export const useAuth = () => useContext(AuthContext)

const PUBLIC_ROUTES = ['/login', '/register', '/l']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Load from localStorage on mount
    try {
      const stored = localStorage.getItem('ls_auth')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Support both old format (email+role) and new format (full user object)
        if (parsed.id) {
          setUser(parsed)
        } else if (parsed.email) {
          // Old format — treat as admin for backwards compat
          setUser({
            id: 'legacy',
            name: parsed.name || 'Carlos Silva',
            email: parsed.email,
            role: parsed.role || 'admin',
            plan: 'elite',
            account_id: null,
          })
        }
      }
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
  }, [user, loading, pathname, router])

  async function login(email: string, password: string): Promise<string | null> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) return data.error || 'Error de autenticacion'
      setUser(data.user)
      localStorage.setItem('ls_auth', JSON.stringify(data.user))
      router.push('/dashboard')
      return null
    } catch {
      return 'Error de conexion'
    }
  }

  async function register(name: string, email: string, password: string, phone?: string): Promise<string | null> {
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
      router.push('/dashboard')
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
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}
