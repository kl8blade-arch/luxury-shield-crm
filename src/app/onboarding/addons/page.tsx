'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function AddonsInner() {
  const searchParams = useSearchParams()
  const agentId = searchParams.get('agent_id') || ''
  const plan = searchParams.get('plan') || 'starter'

  const [step, setStep] = useState<'ai' | 'processing'>('ai')
  const [aiMode, setAiMode] = useState<'managed' | 'own' | null>(null)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const convos: Record<string, string> = { starter: '~300', professional: '~800', agency: '~2,000' }
  const agents: Record<string, string> = { starter: '3', professional: '8', agency: '20' }

  async function handleActivate() {
    setLoading(true); setError(''); setStep('processing')

    const body: any = { agentId, addons: { ai_package: true } }

    if (aiMode === 'own') {
      // Save own API keys
      body.addons.own_keys = true
      body.addons.anthropic_key = anthropicKey
      body.addons.openai_key = openaiKey
    } else {
      // Managed AI + WhatsApp number
      body.addons.whatsapp_number = true
      body.addons.whatsapp_mode = 'provision_new'
    }

    try {
      const res = await fetch('/api/onboarding/activate-addons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        // Save user to localStorage and go to setup
        const userRes = await fetch('/api/auth/validate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId }),
        })
        const userData = await userRes.json()
        if (userData.valid && userData.user) {
          localStorage.setItem('ls_auth', JSON.stringify(userData.user))
        }
        window.location.href = `/onboarding`
      } else {
        setError(data.error || 'Error al configurar')
        setStep('ai')
      }
    } catch {
      setError('Error de conexion')
      setStep('ai')
    }
    setLoading(false)
  }

  async function handleSkip() {
    setLoading(true); setStep('processing')
    // Just activate without addons, save user, go to setup
    try {
      await fetch('/api/onboarding/activate-addons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, addons: {} }),
      })
      const userRes = await fetch('/api/auth/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      })
      const userData = await userRes.json()
      if (userData.valid && userData.user) localStorage.setItem('ls_auth', JSON.stringify(userData.user))
    } catch {}
    window.location.href = '/setup'
  }

  const inp: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: '"Outfit",sans-serif', boxSizing: 'border-box' }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(201,168,76,0.2)}50%{box-shadow:0 0 40px rgba(201,168,76,0.4)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <div style={{ minHeight: '100vh', background: '#050507', fontFamily: '"Outfit",sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '500px', background: 'radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 60%)', pointerEvents: 'none' }} />

        {/* Processing */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '16px', color: '#F0ECE3' }}>Configurando tu cuenta...</p>
          </div>
        )}

        {/* AI Configuration */}
        {step === 'ai' && (
          <div style={{ width: '600px', maxWidth: '96vw', position: 'relative', zIndex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <p style={{ fontSize: '28px', marginBottom: '8px' }}>🎉</p>
              <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '30px', fontWeight: 300, color: '#F0ECE3', margin: '0 0 8px' }}>Pago exitoso!</h1>
              <p style={{ fontSize: '14px', color: 'rgba(240,236,227,0.4)' }}>Configura tu motor de IA para que Sophia empiece a vender</p>
            </div>

            {/* Option 1: Managed (recommended) */}
            <div onClick={() => setAiMode('managed')} style={{
              padding: '2px', borderRadius: '20px', marginBottom: '14px', cursor: 'pointer',
              background: aiMode === 'managed' ? 'linear-gradient(135deg, #C9A84C, #6B4F1A, #C9A84C)' : 'none',
              animation: aiMode === 'managed' ? 'glow 3s ease-in-out infinite' : 'none',
            }}>
              <div style={{ padding: '24px', borderRadius: '18px', background: '#0C0C14', border: aiMode !== 'managed' ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${aiMode === 'managed' ? '#C9A84C' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {aiMode === 'managed' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#C9A84C' }} />}
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: aiMode === 'managed' ? '#C9A84C' : '#F0ECE3' }}>Paquete completo: IA + WhatsApp</span>
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '4px 10px', borderRadius: '100px', background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>RECOMENDADO</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: '#F0ECE3' }}>$70</span>
                  <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.3)' }}>/mes adicional</span>
                  <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.2)', textDecoration: 'line-through', marginLeft: '8px' }}>$90</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '10px', background: 'rgba(201,168,76,0.04)', marginBottom: '12px', fontSize: '12px', color: 'rgba(240,236,227,0.5)', flexWrap: 'wrap' }}>
                  <span>📥 Lead llega</span><span style={{ color: '#C9A84C' }}>→</span>
                  <span>🤖 Sophia responde</span><span style={{ color: '#C9A84C' }}>→</span>
                  <span>📋 Califica</span><span style={{ color: '#C9A84C' }}>→</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>💰 Tu cierras</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {[`${convos[plan] || '~300'} conversaciones/mes`, 'Tu propio # WhatsApp Business', `Como ${agents[plan] || '3'} agentes 24/7`, 'Transcripcion de audio', 'Calificacion automatica', 'Resumen diario'].map(f =>
                    <div key={f} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ color: '#34d399', fontSize: '10px' }}>&#10003;</span>
                      <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.5)' }}>{f}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Option 2: Own keys */}
            <div onClick={() => setAiMode('own')} style={{
              padding: '20px', borderRadius: '18px', marginBottom: '14px', cursor: 'pointer',
              background: aiMode === 'own' ? 'rgba(96,165,250,0.04)' : 'rgba(255,255,255,0.015)',
              border: `1px solid ${aiMode === 'own' ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.05)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${aiMode === 'own' ? '#60a5fa' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {aiMode === 'own' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#60a5fa' }} />}
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: aiMode === 'own' ? '#60a5fa' : 'rgba(240,236,227,0.5)' }}>Tengo mis propias API keys</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: aiMode === 'own' ? '#60a5fa' : 'rgba(240,236,227,0.2)', marginLeft: 'auto' }}>$0</span>
              </div>

              {aiMode === 'own' && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'rgba(240,236,227,0.3)', marginBottom: '4px' }}>ANTHROPIC API KEY (Claude) *</label>
                    <input value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} placeholder="sk-ant-api03-..." style={inp} onClick={e => e.stopPropagation()} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'rgba(240,236,227,0.3)', marginBottom: '4px' }}>OPENAI API KEY (Whisper audio) — opcional</label>
                    <input value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-proj-..." style={inp} onClick={e => e.stopPropagation()} />
                  </div>
                  <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.2)' }}>Necesitaras conectar tu propio numero WhatsApp Business en Configuracion.</p>
                </div>
              )}
            </div>

            {error && <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#fca5a5', textAlign: 'center' }}>{error}</div>}

            {/* CTA */}
            <button onClick={handleActivate} disabled={loading || !aiMode || (aiMode === 'own' && !anthropicKey)} style={{
              width: '100%', padding: '16px', borderRadius: '14px', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit',
              background: aiMode ? 'linear-gradient(135deg, #C9A84C, #E2C060, #C9A84C)' : 'rgba(255,255,255,0.04)',
              color: aiMode ? '#050507' : 'rgba(240,236,227,0.25)', border: 'none',
              cursor: aiMode ? 'pointer' : 'not-allowed', boxShadow: aiMode ? '0 8px 32px rgba(201,168,76,0.3)' : 'none',
            }}>
              {loading ? 'Activando...' : aiMode === 'managed' ? 'Activar IA + WhatsApp — $70/mes' : aiMode === 'own' ? 'Conectar mis keys' : 'Selecciona una opcion'}
            </button>

            <button onClick={handleSkip} disabled={loading} style={{
              width: '100%', padding: '12px', marginTop: '10px', borderRadius: '10px',
              background: 'none', border: 'none', color: 'rgba(240,236,227,0.2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Configurar despues
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default function AddonsPage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050507', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 40, height: 40, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}><AddonsInner /></Suspense>
}
