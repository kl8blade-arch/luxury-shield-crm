'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'
import { useAuth } from '@/contexts/AuthContext'

const PLANS = [
  {
    key: 'starter', name: 'Starter', price: 97, color: '#60a5fa',
    features: ['Pipeline + Leads', 'WhatsApp basico', '100 leads/mes', '1 agente', 'Sophia IA basica'],
    leads: 100, agents: 1,
  },
  {
    key: 'professional', name: 'Professional', price: 297, color: '#a78bfa', badge: 'Popular',
    features: ['Todo de Starter', 'Coaching IA en tiempo real', '500 leads/mes', '5 agentes', 'Analytics avanzados', 'Campanas multi-plataforma', 'Rescue sequences', 'Calendario + Recordatorios'],
    leads: 500, agents: 5,
  },
  {
    key: 'agency', name: 'Agency', price: 597, color: '#C9A84C', badge: 'Mejor valor',
    features: ['Todo de Professional', 'Leads ilimitados', '25 agentes', 'SophiaModel training', 'Voz IA', 'API publica', 'Sub-cuentas (25)', 'Social Intelligence', 'Landing page builder'],
    leads: null, agents: 25,
  },
  {
    key: 'enterprise', name: 'Enterprise', price: 997, color: '#34d399',
    features: ['Todo de Agency', '100 agentes', '50 sub-cuentas', 'White label', 'Soporte dedicado', 'Custom integrations', 'Onboarding personalizado'],
    leads: null, agents: 100,
  },
]

export default function PackagesPageWrapper() {
  return <Suspense fallback={<div style={{ padding: '48px', textAlign: 'center', color: C.textMuted, background: C.bg, minHeight: '100vh' }}>Cargando...</div>}><PackagesPage /></Suspense>
}

function PackagesPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [agent, setAgent] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [useOwnKeys, setUseOwnKeys] = useState(false)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [savingKeys, setSavingKeys] = useState(false)
  const [keysSaved, setKeysSaved] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const showSuccess = searchParams.get('success') === 'true'

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    setLoading(true)
    const [{ data: ag }, { data: ords }] = await Promise.all([
      supabase.from('agents').select('subscription_plan, uses_own_ai_keys, anthropic_api_key, openai_api_key, ai_credits_balance').eq('id', user?.id).single(),
      supabase.from('lead_orders').select('*').order('created_at', { ascending: false }).limit(10),
    ])
    if (ag) {
      setAgent(ag)
      setUseOwnKeys(ag.uses_own_ai_keys || false)
      if (ag.anthropic_api_key) setAnthropicKey('sk-ant-•••••••••••••')
      if (ag.openai_api_key) setOpenaiKey('sk-•••••••••••••')
    }
    setOrders(ords || [])
    setLoading(false)
  }

  async function handleCheckout(plan: any) {
    setCheckoutLoading(true)
    const aiSurcharge = useOwnKeys ? 0 : 50
    const totalPrice = plan.price + aiSurcharge

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName: `${plan.name}${aiSurcharge ? ' + IA ($50)' : ''}`,
          price: totalPrice,
          leadCount: plan.leads || 9999,
          packageId: plan.key,
        }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url }
      else { alert(data.error || 'Error al crear sesion de pago'); setCheckoutLoading(false) }
    } catch { alert('Error de conexion'); setCheckoutLoading(false) }
  }

  async function saveApiKeys() {
    if (!user) return
    setSavingKeys(true)
    const update: any = { uses_own_ai_keys: useOwnKeys }
    if (anthropicKey && !anthropicKey.includes('•')) update.anthropic_api_key = anthropicKey
    if (openaiKey && !openaiKey.includes('•')) update.openai_api_key = openaiKey
    await supabase.from('agents').update(update).eq('id', user.id)
    setSavingKeys(false)
    setKeysSaved(true)
    setTimeout(() => setKeysSaved(false), 3000)
  }

  const currentPlan = agent?.subscription_plan || 'free'
  const inp: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: '"Outfit",sans-serif', boxSizing: 'border-box' }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative' }}>

        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>PLANES</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Elige tu Plan</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Todos los planes incluyen Sophia IA, WhatsApp, y soporte</p>
        </div>

        {showSuccess && (
          <div style={{ padding: '14px 20px', borderRadius: '14px', marginBottom: '20px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>&#10003;</span>
            <div><p style={{ color: '#34d399', fontSize: '14px', fontWeight: 700, margin: 0 }}>Pago completado!</p><p style={{ color: 'rgba(240,236,227,0.4)', fontSize: '12px', margin: 0 }}>Tu plan ya esta activo.</p></div>
          </div>
        )}

        {/* ═══ AI KEYS SECTION ═══ */}
        <div style={{ padding: '20px 24px', borderRadius: '16px', marginBottom: '24px', background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa', margin: '0 0 2px' }}>Creditos de IA</p>
              <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: 0 }}>Sophia usa Anthropic Claude + OpenAI Whisper para funcionar</p>
            </div>
            {agent?.uses_own_ai_keys && (
              <span style={{ fontSize: '10px', padding: '4px 12px', borderRadius: '100px', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontWeight: 700, border: '1px solid rgba(52,211,153,0.2)' }}>Usando tus keys</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <div onClick={() => setUseOwnKeys(false)} style={{
              flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
              background: !useOwnKeys ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.015)',
              border: `1px solid ${!useOwnKeys ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}>
              <p style={{ fontSize: '20px', margin: '0 0 6px' }}>🤖</p>
              <p style={{ fontSize: '12px', fontWeight: !useOwnKeys ? 700 : 400, color: !useOwnKeys ? '#C9A84C' : 'rgba(240,236,227,0.4)', margin: '0 0 4px' }}>Nosotros lo manejamos</p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: !useOwnKeys ? '#C9A84C' : 'rgba(240,236,227,0.25)', margin: '0 0 4px' }}>+$50<span style={{ fontSize: '12px', fontWeight: 400 }}>/mes</span></p>
              <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', margin: 0 }}>Se agrega a tu plan. Sin limites de uso.</p>
            </div>
            <div onClick={() => setUseOwnKeys(true)} style={{
              flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
              background: useOwnKeys ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.015)',
              border: `1px solid ${useOwnKeys ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}>
              <p style={{ fontSize: '20px', margin: '0 0 6px' }}>🔑</p>
              <p style={{ fontSize: '12px', fontWeight: useOwnKeys ? 700 : 400, color: useOwnKeys ? '#34d399' : 'rgba(240,236,227,0.4)', margin: '0 0 4px' }}>Uso mis propias keys</p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: useOwnKeys ? '#34d399' : 'rgba(240,236,227,0.25)', margin: '0 0 4px' }}>$0<span style={{ fontSize: '12px', fontWeight: 400 }}>/mes</span></p>
              <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', margin: 0 }}>Conecta tu Anthropic y OpenAI API key.</p>
            </div>
          </div>

          {useOwnKeys && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'rgba(240,236,227,0.3)', marginBottom: '6px', letterSpacing: '0.1em' }}>ANTHROPIC API KEY (Claude)</label>
                <input value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} placeholder="sk-ant-api03-..." style={inp} />
                <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.2)', marginTop: '4px' }}>Obtenla en console.anthropic.com → API Keys</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'rgba(240,236,227,0.3)', marginBottom: '6px', letterSpacing: '0.1em' }}>OPENAI API KEY (Whisper audio)</label>
                <input value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-proj-..." style={inp} />
                <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.2)', marginTop: '4px' }}>Obtenla en platform.openai.com → API Keys</p>
              </div>
              <button onClick={saveApiKeys} disabled={savingKeys} style={{
                padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                background: keysSaved ? 'rgba(52,211,153,0.1)' : 'linear-gradient(135deg, #34d399, #059669)',
                color: keysSaved ? '#34d399' : '#06070B', border: keysSaved ? '1px solid rgba(52,211,153,0.3)' : 'none',
                cursor: 'pointer',
              }}>{savingKeys ? 'Guardando...' : keysSaved ? '&#10003; Keys guardadas' : 'Guardar API Keys'}</button>
            </div>
          )}
        </div>

        {/* ═══ PLANS GRID ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '14px', marginBottom: '32px' }}>
          {PLANS.map(plan => {
            const aiSurcharge = useOwnKeys ? 0 : 50
            const totalPrice = plan.price + aiSurcharge
            const isCurrent = currentPlan === plan.key
            const isPopular = plan.badge === 'Popular'
            const isBest = plan.badge === 'Mejor valor'

            return (
              <div key={plan.key} style={{
                padding: '24px', borderRadius: '18px', position: 'relative', overflow: 'hidden',
                background: isCurrent ? `${plan.color}08` : 'rgba(255,255,255,0.015)',
                border: `1px solid ${isCurrent ? plan.color + '40' : isPopular || isBest ? plan.color + '25' : 'rgba(255,255,255,0.05)'}`,
                borderTop: isPopular || isBest ? `3px solid ${plan.color}` : undefined,
              }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: '9px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: `${plan.color}15`, color: plan.color, border: `1px solid ${plan.color}30` }}>{plan.badge}</div>
                )}
                {isCurrent && (
                  <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: '9px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>ACTUAL</div>
                )}

                <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '22px', color: plan.color, margin: '0 0 4px' }}>{plan.name}</p>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 800, color: '#F0ECE3' }}>${totalPrice}</span>
                  <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.3)' }}>/mes</span>
                </div>

                {aiSurcharge > 0 && (
                  <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', margin: '0 0 8px' }}>
                    ${plan.price} plan + ${aiSurcharge} IA
                  </p>
                )}
                {aiSurcharge === 0 && (
                  <p style={{ fontSize: '10px', color: '#34d399', margin: '0 0 8px' }}>
                    Sin cargo IA (tus API keys)
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: plan.color, fontSize: '11px' }}>&#10003;</span>
                      <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.5)' }}>{f}</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => setSelectedPlan(plan)} disabled={isCurrent} style={{
                  width: '100%', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                  fontFamily: 'inherit', cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'rgba(52,211,153,0.08)' : isPopular || isBest ? `linear-gradient(135deg, ${plan.color}, ${plan.color}CC)` : `${plan.color}10`,
                  color: isCurrent ? '#34d399' : isPopular || isBest ? '#06070B' : plan.color,
                  border: isCurrent ? '1px solid rgba(52,211,153,0.2)' : isPopular || isBest ? 'none' : `1px solid ${plan.color}25`,
                  boxShadow: isPopular || isBest ? `0 4px 16px ${plan.color}30` : 'none',
                }}>
                  {isCurrent ? 'Plan actual' : 'Seleccionar'}
                </button>
              </div>
            )
          })}
        </div>

        {/* ═══ CHECKOUT MODAL ═══ */}
        {selectedPlan && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedPlan(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '32px', width: '420px', maxWidth: '90vw', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 20px', background: `${selectedPlan.color}15`, border: `1px solid ${selectedPlan.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>&#9733;</div>

              <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#F0ECE3', margin: '0 0 8px' }}>Plan {selectedPlan.name}</h3>

              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>Plan {selectedPlan.name}</span>
                  <span style={{ fontSize: '13px', color: '#F0ECE3', fontWeight: 600 }}>${selectedPlan.price}/mes</span>
                </div>
                {!useOwnKeys && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>Creditos IA (Anthropic + OpenAI)</span>
                    <span style={{ fontSize: '13px', color: '#a78bfa', fontWeight: 600 }}>+$50/mes</span>
                  </div>
                )}
                {useOwnKeys && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>IA con tus API keys</span>
                    <span style={{ fontSize: '13px', color: '#34d399', fontWeight: 600 }}>$0</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#F0ECE3' }}>Total mensual</span>
                  <span style={{ fontSize: '22px', fontWeight: 800, color: '#C9A84C' }}>${selectedPlan.price + (useOwnKeys ? 0 : 50)}</span>
                </div>
              </div>

              <button onClick={() => handleCheckout(selectedPlan)} disabled={checkoutLoading} style={{
                width: '100%', padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
                background: checkoutLoading ? 'rgba(201,168,76,0.3)' : 'linear-gradient(135deg, #C9A84C, #A8893A)',
                color: '#06070B', border: 'none', cursor: checkoutLoading ? 'wait' : 'pointer',
                boxShadow: '0 4px 20px rgba(201,168,76,0.3)', marginBottom: '10px',
              }}>{checkoutLoading ? 'Procesando...' : 'Pagar con Stripe'}</button>

              <button onClick={() => setSelectedPlan(null)} style={{
                width: '100%', padding: '10px', borderRadius: '10px', background: 'none', border: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(240,236,227,0.4)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* ═══ ORDER HISTORY ═══ */}
        {orders.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F0ECE3', margin: 0 }}>Historial</h2>
            </div>
            {orders.map((o, i) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < orders.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <span style={{ fontSize: '13px', color: '#F0ECE3', fontWeight: 600 }}>{o.package_name}</span>
                <span style={{ fontSize: '13px', color: '#C9A84C', fontWeight: 700 }}>${o.amount}</span>
                <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '100px', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontWeight: 600 }}>{o.status}</span>
                <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)' }}>{new Date(o.created_at).toLocaleDateString('es')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
