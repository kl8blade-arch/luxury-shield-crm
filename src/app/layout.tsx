import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Luxury Shield CRM',
  description: 'CRM para SeguriSSimo Agency',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ background: '#07080A' }}>
        <Sidebar />
        <main style={{ marginLeft: '224px', minHeight: '100vh', overflow: 'hidden' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
