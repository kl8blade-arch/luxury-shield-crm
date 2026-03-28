import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Luxury Shield CRM',
  description: 'CRM para SeguriSSimo Agency',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ background: '#07080A' }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
