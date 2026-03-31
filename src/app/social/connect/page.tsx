'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Suspense } from 'react'

const PLATFORMS = [
  { key: 'facebook', label: 'Facebook', icon: 'f', color: '#1877F2', desc: 'Paginas, grupos, posts, Marketplace' },
  { key: 'instagram', label: 'Instagram', icon: 'ig', color: '#E4405F', desc: 'Feed, Stories, Reels, DMs' },
  { key: 'tiktok', label: 'TikTok', icon: 'tk', color: '#00F2EA', desc: 'Videos, Lives, DMs' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'in', color: '#0A66C2', desc: 'Posts, articulos, networking' },
  { key: 'twitter', label: 'X / Twitter', icon: 'x', color: '#F0ECE3', desc: 'Tweets, hilos, espacios' },
  { key: 'youtube', label: 'YouTube', icon: 'yt', color: '#FF0000', desc: 'Videos, Shorts, Community' },
]

function ConnectPageInner() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [setupInfo, setSetupInfo] = useState<any>(null)
  const [toast, setToast] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])

  useEffect(() => {
    loadConnections()
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const platform = searchParams.get('platform')
    if (success) setToast(`${platform || 'Red social'} conectada exitosamente!`)
    if (error) setToast(`Error: ${error}`)
    if (toast) setTimeout(() => setToast(''), 5000)
  }, [searchParams])

  async function loadConnections() {
    setLoading(true)
    const { data } = await supabase.from('social_connections').select('*').eq('status', 'active').order('connected_at', { ascending: false })
    setConnections(data || [])
    setLoading(false)
  }

  async function connectPlatform(platform: string) {
    setConnecting(platform)
    setSetupInfo(null)
    try {
      const res = await fetch('/api/social/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, agentId: user?.id }),
      })
      const data = await res.json()

      if (data.setup_needed) {
        setSetupInfo({ platform, instructions: data.instructions, error: data.error })
        setConnecting(null)
        return
      }

      if (data.authUrl) {
        window.location.href = data.authUrl
        return
      }

      setToast(data.error || 'Error desconocido')
    } catch (err: any) {
      setToast(`Error: ${err.message}`)
    }
    setConnecting(null)
  }

  async function disconnectPlatform(connectionId: string) {
    await supabase.from('social_connections').update({ status: 'revoked' }).eq('id', connectionId)
    loadConnections()
    setToast('Desconectado')
  }

  const getConnection = (platform: string) => connections.find(c => c.platform === platform)

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative' }}>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(24,119,242,0.6)', marginBottom: '6px' }}>REDES SOCIALES</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Conectar Cuentas</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Conecta tus redes sociales para que los agentes IA las administren</p>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{ padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', background: toast.includes('Error') || toast.includes('error') ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${toast.includes('Error') || toast.includes('error') ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}`, fontSize: '13px', color: toast.includes('Error') || toast.includes('error') ? '#fca5a5' : '#34d399' }}>
            {toast}
          </div>
        )}

        {/* Setup instructions modal */}
        {setupInfo && (
          <div style={{ padding: '24px', borderRadius: '16px', marginBottom: '20px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24', margin: 0 }}>Configuracion requerida: {setupInfo.platform}</h3>
              <button onClick={() => setSetupInfo(null)} style={{ background: 'none', border: 'none', color: 'rgba(240,236,227,0.3)', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.5)', marginBottom: '12px' }}>{setupInfo.error}</p>
            <pre style={{ fontSize: '12px', color: 'rgba(240,236,227,0.6)', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '10px', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'monospace' }}>
              {setupInfo.instructions}
            </pre>
            <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)', marginTop: '12px' }}>Despues de agregar las variables en Vercel, haz un re-deploy y vuelve a intentar conectar.</p>
          </div>
        )}

        {/* Agents managing your socials */}
        <div style={{ padding: '16px 20px', borderRadius: '14px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)', marginBottom: '24px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.1em', marginBottom: '8px' }}>AGENTES QUE ADMINISTRAN TUS REDES</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { name: 'ContentScheduler', desc: 'Programa contenido' },
              { name: 'CommunityManager', desc: 'Responde comentarios/DMs' },
              { name: 'AnalyticsReporter', desc: 'Metricas y reportes' },
              { name: 'DMCloser', desc: 'Convierte DMs en leads' },
              { name: 'CuriosityCreator', desc: 'Genera contenido viral' },
              { name: 'GroupEngager', desc: 'Engagement en grupos' },
            ].map(a => (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
                <span style={{ fontSize: '11px', color: '#C9A84C', fontWeight: 600 }}>{a.name}</span>
                <span style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)' }}>· {a.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Platforms grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px' }}>
          {PLATFORMS.map(p => {
            const conn = getConnection(p.key)
            const isConnected = !!conn
            const isConnecting = connecting === p.key

            return (
              <div key={p.key} style={{
                padding: '24px', borderRadius: '18px',
                background: isConnected ? `${p.color}06` : 'rgba(255,255,255,0.015)',
                border: `1px solid ${isConnected ? p.color + '30' : 'rgba(255,255,255,0.05)'}`,
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  {/* Platform icon */}
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                    background: `${p.color}15`, border: `1px solid ${p.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', fontWeight: 800, color: p.color,
                  }}>{p.icon}</div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F0ECE3', margin: 0 }}>{p.label}</h3>
                      {isConnected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
                          <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>Conectado</span>
                        </div>
                      )}
                    </div>

                    <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: '0 0 12px' }}>{p.desc}</p>

                    {/* Connected info */}
                    {isConnected && conn && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }}>
                        {conn.profile_image && <img src={conn.profile_image} style={{ width: '24px', height: '24px', borderRadius: '50%' }} alt="" />}
                        <span style={{ fontSize: '12px', color: '#F0ECE3', fontWeight: 500 }}>{conn.platform_name || conn.platform_username || 'Cuenta conectada'}</span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isConnected ? (
                        <>
                          <button onClick={() => disconnectPlatform(conn.id)} style={{
                            padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171',
                          }}>Desconectar</button>
                          <a href="/social" style={{
                            padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
                            background: `${p.color}15`, border: `1px solid ${p.color}25`, color: p.color,
                          }}>Administrar &rarr;</a>
                        </>
                      ) : (
                        <button onClick={() => connectPlatform(p.key)} disabled={isConnecting} style={{
                          padding: '10px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                          cursor: isConnecting ? 'wait' : 'pointer',
                          background: isConnecting ? `${p.color}30` : `linear-gradient(135deg, ${p.color}, ${p.color}CC)`,
                          color: p.key === 'twitter' ? '#000' : '#fff', border: 'none',
                          boxShadow: `0 4px 16px ${p.color}30`,
                        }}>
                          {isConnecting ? 'Conectando...' : `Conectar ${p.label}`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* How it works */}
        <div style={{ marginTop: '32px', padding: '24px', borderRadius: '16px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F0ECE3', margin: '0 0 16px' }}>Como funciona</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { step: '1', title: 'Conecta', desc: 'Click en la plataforma. Se abre la autorizacion oficial. Ningun password se guarda en nuestro servidor.', icon: '🔗' },
              { step: '2', title: 'Los agentes trabajan', desc: 'ContentScheduler programa posts. CommunityManager responde comentarios. DMCloser convierte DMs en leads.', icon: '🤖' },
              { step: '3', title: 'Tu apruebas', desc: 'Todo el contenido pasa por tu aprobacion antes de publicarse. Tu tienes el control final.', icon: '✅' },
            ].map(s => (
              <div key={s.step} style={{ textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', margin: '0 auto 10px', background: 'rgba(201,168,76,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{s.icon}</div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#C9A84C', margin: '0 0 4px' }}>Paso {s.step}: {s.title}</p>
                <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default function ConnectPage() {
  return <Suspense fallback={<div style={{ padding: '48px', textAlign: 'center', color: '#666', background: '#06070B', minHeight: '100vh' }}>Cargando...</div>}><ConnectPageInner /></Suspense>
}
