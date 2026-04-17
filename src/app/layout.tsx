import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

export const metadata: Metadata = {
  title: 'Luxury Shield CRM',
  description: 'CRM para SeguriSSimo Agency',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
