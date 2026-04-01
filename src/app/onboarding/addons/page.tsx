'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function AddonsInner() {
  const searchParams = useSearchParams()
  const agentId = searchParams.get('agent_id') || ''
  const plan = searchParams.get('plan') || 'starter'

  const [selected, setSelected] = useState<'bundle' | 'own' | null>(null)
  const [loading, setLoading] = useState(false)
  const [ownData, setOwnData] = useState({ accountSid: '', authToken: '', phoneNumber: '' })

  const convos: Record<string, string> = { starter: '~300', professional: '~800', agency: '~2,000', enterprise: '~6,000' }
  const agents: Record<string, string> = { starter: '3', professional: '8', agency: '20', enterprise: '60' }

  async function handleActivate() {
    setLoading(true)
    const res = await fetch('/api/onboarding/activate-addons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, addons: { ai_package: true, whatsapp_number: true, whatsapp_mode: 'provision_new' } }),
    })
    const data = await res.json()
    if (data.success) window.location.href = `/onboarding/complete?number=${data.whatsappNumber || 'pendiente'}`
    setLoading(false)
  }

  async function handleOwnNumber() {
    if (!ownData.accountSid || !ownData.authToken || !ownData.phoneNumber) return
    setLoading(true)
    const res = await fetch('/api/onboarding/activate-addons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, addons: { ai_package: true, whatsapp_number: false, whatsapp_mode: 'bring_your_own', own_number_data: { provider: 'twilio', ...ownData } } }),
    })
    const data = await res.json()
    if (data.success) window.location.href = '/onboarding/complete'
    else alert(data.error || 'Error')
    setLoading(false)
  }

  async function handleSkip() {
    setLoading(true)
    await fetch('/api/onboarding/activate-addons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId, addons: {} }) })
    window.location.href = '/setup'
    setLoading(false)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: '"Outfit",sans-serif', boxSizing: 'border-box' }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(201,168,76,0.2)} 50%{box-shadow:0 0 40px rgba(201,168,76,0.4)} }
      `}</style>
      <div style={{ minHeight: '100vh', background: '#050507', fontFamily: '"Outfit",sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '500px', background: 'radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ width: '580px', maxWidth: '96vw', position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <p style={{ fontSize: '28px', marginBottom: '8px' }}>🎉</p>
            <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '32px', fontWeight: 300, color: '#F0ECE3', margin: '0 0 8px' }}>Tu cuenta esta activa!</h1>
            <p style={{ fontSize: '14px', color: 'rgba(240,236,227,0.4)' }}>Un ultimo paso para tener tu motor de ventas completo</p>
          </div>

          {/* Bundle offer */}
          <div style={{ padding: '2px', borderRadius: '22px', background: 'linear-gradient(135deg, #C9A84C, #6B4F1A, #C9A84C)', marginBottom: '16px', animation: 'glow 3s ease-in-out infinite' }}>
            <div style={{ padding: '28px 24px', borderRadius: '20px', background: '#0C0C14' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#C9A84C' }}>OFERTA ESPECIAL DE HOY</p>
                <span style={{ fontSize: '10px', padding: '4px 12px', borderRadius: '100px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontWeight: 700 }}>Solo hoy</span>
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F0ECE3', margin: '0 0 4px' }}>🤖 Paquete IA + 📱 WhatsApp Business</h2>
              <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '16px' }}>
                <span style={{ textDecoration: 'line-through', color: 'rgba(240,236,227,0.25)' }}>$90/mes</span>{' '}
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#C9A84C' }}>$70/mes</span>{' '}
                <span style={{ color: '#34d399', fontSize: '12px', fontWeight: 600 }}>Ahorra $20/mes</span>
              </p>

              {/* Flow diagram */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', borderRadius: '12px', background: 'rgba(201,168,76,0.04)', marginBottom: '16px', fontSize: '12px', color: 'rgba(240,236,227,0.5)', flexWrap: 'wrap' }}>
                <span>📥 Lead llega</span><span style={{ color: '#C9A84C' }}>→</span>
                <span>🤖 Sophia responde</span><span style={{ color: '#C9A84C' }}>→</span>
                <span>📋 Califica</span><span style={{ color: '#C9A84C' }}>→</span>
                <span>📅 Agenda</span><span style={{ color: '#C9A84C' }}>→</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>💰 Tu cierras</span>
              </div>

              {/* Features */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                {[
                  `${convos[plan] || '~300'} conversaciones/mes`,
                  'Sophia IA 24/7',
                  'Tu propio # WhatsApp Business',
                  'Calificacion automatica',
                  `Como tener ${agents[plan] || '3'} agentes`,
                  'Resumen diario',
                ].map(f => (
                  <div key={f} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ color: '#34d399', fontSize: '11px' }}>&#10003;</span>
                    <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.5)' }}>{f}</span>
                  </div>
                ))}
              </div>

              <button onClick={handleActivate} disabled={loading} style={{
                width: '100%', padding: '16px', borderRadius: '14px', fontSize: '15px', fontWeight: 700,
                fontFamily: 'inherit', letterSpacing: '0.02em',
                background: 'linear-gradient(135deg, #C9A84C, #E2C060, #C9A84C)',
                color: '#050507', border: 'none', cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 8px 32px rgba(201,168,76,0.3)',
              }}>
                {loading ? 'Activando...' : 'ACTIVAR MI MOTOR COMPLETO — $70/mes'}
              </button>
            </div>
          </div>

          {/* Own number option */}
          <div style={{ padding: '16px 20px', borderRadius: '14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
            <div onClick={() => setSelected(selected === 'own' ? null : 'own')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.5)', margin: 0 }}>Ya tengo un numero WhatsApp Business API (Twilio)</p>
              <span style={{ fontSize: '12px', color: '#60a5fa' }}>{selected === 'own' ? '▲' : '▼'}</span>
            </div>

            {selected === 'own' && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input value={ownData.accountSid} onChange={e => setOwnData({ ...ownData, accountSid: e.target.value })} placeholder="Twilio Account SID (ACxxxxxxx)" style={inp} />
                <input value={ownData.authToken} onChange={e => setOwnData({ ...ownData, authToken: e.target.value })} placeholder="Twilio Auth Token" type="password" style={inp} />
                <input value={ownData.phoneNumber} onChange={e => setOwnData({ ...ownData, phoneNumber: e.target.value })} placeholder="Numero (+1786xxxxxxx)" style={inp} />
                <button onClick={handleOwnNumber} disabled={loading} style={{ padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #60a5fa, #3b82f6)', color: '#050507', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Verificando...' : 'Conectar mi numero + Activar IA — $50/mes'}
                </button>
              </div>
            )}
          </div>

          {/* Skip */}
          <button onClick={handleSkip} disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: '10px', background: 'none', border: 'none',
            color: 'rgba(240,236,227,0.25)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            No gracias, activar sin estos servicios
          </button>
        </div>
      </div>
    </>
  )
}

export default function AddonsPage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050507', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>Cargando...</div>}><AddonsInner /></Suspense>
}
