'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface ThemeToggleProps {
  variant?: 'icon' | 'full'
}

export function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const isDark = theme === 'dark'
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleTheme}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          transition: 'all 200ms ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--glass-bg-hover)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border-hover)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--glass-bg)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border)'
        }}
        title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        {isDark ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.536l1.414 1.414a1 1 0 001.414-1.414l-1.414-1.414a1 1 0 00-1.414 1.414zm2.828-2.828l1.414-1.414a1 1 0 00-1.414-1.414l-1.414 1.414a1 1 0 001.414 1.414zM13 11a1 1 0 110 2h-2a1 1 0 110-2h2zm-8 0a1 1 0 100 2H3a1 1 0 100-2h2z" clipRule="evenodd" />
          </svg>
        )}
      </button>
    )
  }

  // variant === 'full'
  return (
    <button
      onClick={toggleTheme}
      className="w-full px-4 py-2 rounded-lg flex items-center gap-3 transition-all"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        color: 'var(--text-primary)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--glass-bg-hover)'
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border-hover)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--glass-bg)'
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border)'
      }}
    >
      {isDark ? (
        <>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
          <span className="text-sm font-medium">Modo oscuro</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.536l1.414 1.414a1 1 0 001.414-1.414l-1.414-1.414a1 1 0 00-1.414 1.414zm2.828-2.828l1.414-1.414a1 1 0 00-1.414-1.414l-1.414 1.414a1 1 0 001.414 1.414zM13 11a1 1 0 110 2h-2a1 1 0 110-2h2zm-8 0a1 1 0 100 2H3a1 1 0 100-2h2z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">Modo claro</span>
        </>
      )}
    </button>
  )
}
