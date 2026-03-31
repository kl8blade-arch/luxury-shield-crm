'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/*
 * DECOY PRICING (Asymmetric Dominance Effect):
 * - Starter ($67): Basic, cheap — exists to anchor "low"
 * - Professional ($197): THE DECOY — close to Agency price but far fewer features
 * - Agency ($297): THE TARGET — only $100 more than Pro but 3x the value
 * - Enterprise: Contact us — aspirational, makes Agency feel accessible
 *
 * The Professional plan makes Agency look like an incredible deal.
 * $100 more gets you: unlimited leads, 25 agents, sub-accounts, SophiaModel,
 * Social Intelligence, Voice IA, API — worth $1000+ individually.
 */

const PLANS = [
  {
    key: 'starter', name: 'Starter', price: 47, monthly: 47,
    tagline: 'Para empezar a vender con IA',
    color: '#6b7280', textColor: '#9ca3af',
    features: [
      { text: 'Sophia IA basica', included: true },
      { text: 'Pipeline + Kanban', included: true },
      { text: 'WhatsApp automatizado', included: true },
      { text: '100 leads/mes', included: true },
      { text: '1 agente', included: true },
      { text: '1 sub-cuenta', included: true },
      { text: 'Coaching IA', included: false },
      { text: 'Analytics avanzados', included: false },
      { text: 'Social Intelligence', included: false },
    ],
    leads: 100, agents: 1, subs: 1, cta: 'Empezar',
  },
  {
    key: 'professional', name: 'Professional', price: 97, monthly: 97,
    tagline: 'Para agentes serios',
    color: '#a78bfa', textColor: '#c4b5fd', badge: 'POPULAR',
    features: [
      { text: 'Todo de Starter', included: true, bold: true },
      { text: 'Coaching IA en tiempo real', included: true },
      { text: '500 leads/mes', included: true },
      { text: '5 agentes', included: true },
      { text: 'Analytics avanzados', included: true },
      { text: '3 sub-cuentas', included: true },
      { text: 'Campanas multi-plataforma', included: true },
      { text: 'Calendario + Recordatorios', included: true },
      { text: 'Social Intelligence', included: false },
    ],
    leads: 500, agents: 5, subs: 3, cta: 'Seleccionar',
  },
  {
    key: 'agency', name: 'Agency', price: 197, monthly: 197,
    tagline: 'Todo lo que necesitas. Sin limites.',
    badge: 'MEJOR VALOR',
    color: '#C9A84C', textColor: '#E2C060',
    highlighted: true,
    features: [
      { text: 'Todo de Professional', included: true, bold: true },
      { text: 'Leads ILIMITADOS', included: true, highlight: true },
      { text: '25 agentes', included: true },
      { text: '10 sub-cuentas', included: true, highlight: true },
      { text: 'SophiaModel training', included: true },
      { text: 'Social Intelligence', included: true },
      { text: 'Voz IA', included: true },
      { text: 'API publica', included: true },
      { text: 'Landing page builder', included: true },
    ],
    leads: null, agents: 25, subs: 10, cta: 'Obtener Agency',
    savings: 'Solo $100 mas que Professional — 5x mas valor',
  },
  {
    key: 'enterprise', name: 'Enterprise', price: 0, monthly: 0,
    tagline: 'Para agencias y corporaciones',
    color: '#34d399', textColor: '#6ee7b7',
    isEnterprise: true,
    features: [
      { text: 'Todo de Agency', included: true, bold: true },
      { text: '100+ agentes', included: true },
      { text: 'Sub-cuentas ilimitadas', included: true },
      { text: 'White label completo', included: true },
      { text: 'Soporte dedicado 24/7', included: true },
      { text: 'Integraciones custom', included: true },
      { text: 'Onboarding personalizado', included: true },
      { text: 'SLA garantizado', included: true },
      { text: 'Infraestructura dedicada', included: true },
    ],
    leads: null, agents: 100, subs: 999, cta: 'Hablar con ventas',
  },
]

export default function PackagesPageWrapper() {
  return <Suspense fallback={<div style={{ padding: '48px', textAlign: 'center', color: '#666', background: '#06070B', minHeight: '100vh' }}>Cargando...</div>}><PackagesPage /></Suspense>
}

function PackagesPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [useOwnKeys, setUseOwnKeys] = useState(false)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [savingKeys, setSavingKeys] = useState(false)
  const [keysSaved, setKeysSaved] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [annual, setAnnual] = useState(false)
  const showSuccess = searchParams.get('success') === 'true'

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    setLoading(true)
    const { data: ag } = await supabase.from('agents').select('subscription_plan, uses_own_ai_keys, anthropic_api_key, openai_api_key').eq('id', user?.id).single()
    if (ag) {
      setAgent(ag)
      setUseOwnKeys(ag.uses_own_ai_keys || false)
      if (ag.anthropic_api_key) setAnthropicKey('sk-ant-•••••••')
      if (ag.openai_api_key) setOpenaiKey('sk-•••••••')
    }
    setLoading(false)
  }

  async function handleCheckout(plan: any) {
    if (plan.isEnterprise) {
      window.open(`https://wa.me/17869435656?text=${encodeURIComponent('Hola, me interesa el plan Enterprise de Luxury Shield CRM. Quiero hablar con un especialista.')}`, '_blank')
      return
    }
    setCheckoutLoading(true)
    const aiSurcharge = useOwnKeys ? 0 : 50
    const price = annual ? Math.round(plan.price * 10) : plan.price + aiSurcharge
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName: `${plan.name}${annual ? ' (Anual)' : ''}${aiSurcharge && !annual ? ' + IA' : ''}`,
          price,
          leadCount: plan.leads || 9999,
          packageId: plan.key,
          agentId: user?.id,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { alert(data.error || 'Error'); setCheckoutLoading(false) }
    } catch { alert('Error de conexion'); setCheckoutLoading(false) }
  }

  async function saveApiKeys() {
    if (!user) return
    setSavingKeys(true)
    await fetch('/api/settings/save-keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: user.id, anthropicKey, openaiKey, useOwnKeys }),
    })
    setSavingKeys(false); setKeysSaved(true); setTimeout(() => setKeysSaved(false), 3000)
  }

  const currentPlan = agent?.subscription_plan || 'free'
  const inp: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: '"Outfit",sans-serif', boxSizing: 'border-box' }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '48px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit",sans-serif', position: 'relative', overflow: 'hidden' }}>

        {/* Ambient effects */}
        <div style={{ position: 'absolute', top: '-20%', left: '30%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />

        {/* Success banner */}
        {showSuccess && (
          <div style={{ padding: '16px 24px', borderRadius: '16px', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(52,211,153,0.05))', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>&#10003;</span>
            <div><p style={{ color: '#34d399', fontSize: '16px', fontWeight: 700, margin: 0 }}>Pago completado!</p><p style={{ color: 'rgba(240,236,227,0.4)', fontSize: '13px', margin: 0 }}>Tu plan esta activo. Bienvenido.</p></div>
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.3em', color: 'rgba(201,168,76,0.6)', marginBottom: '12px' }}>PLANES Y PRECIOS</p>
          <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: isMobile ? '36px' : '52px', fontWeight: 300, color: '#F0ECE3', margin: '0 0 12px', lineHeight: 1.1 }}>
            Invierte en tu negocio,<br />
            <span style={{ color: '#C9A84C' }}>no en herramientas.</span>
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(240,236,227,0.4)', maxWidth: '500px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            Sophia vende por ti 24/7. Cada plan incluye IA, WhatsApp, pipeline, y todo lo que necesitas para cerrar mas ventas.
          </p>

          {/* Annual toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '4px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => setAnnual(false)} style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: !annual ? 700 : 400, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: !annual ? 'rgba(201,168,76,0.1)' : 'transparent', color: !annual ? '#C9A84C' : 'rgba(240,236,227,0.4)' }}>Mensual</button>
            <button onClick={() => setAnnual(true)} style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: annual ? 700 : 400, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: annual ? 'rgba(52,211,153,0.1)' : 'transparent', color: annual ? '#34d399' : 'rgba(240,236,227,0.4)' }}>Anual <span style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', marginLeft: '4px' }}>-17%</span></button>
          </div>
        </div>

        {/* Plans grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '16px', maxWidth: '1200px', margin: '0 auto 40px', position: 'relative', zIndex: 1 }}>
          {PLANS.map(plan => {
            const isCurrent = currentPlan === plan.key
            const isHighlighted = plan.highlighted
            const aiSurcharge = useOwnKeys || plan.isEnterprise ? 0 : 50
            const displayPrice = annual ? Math.round(plan.price * 10 / 12) : plan.price
            const totalMonthly = plan.isEnterprise ? 0 : displayPrice + (annual ? 0 : aiSurcharge)

            return (
              <div key={plan.key} style={{
                padding: isHighlighted ? '2px' : '0',
                borderRadius: '22px',
                background: isHighlighted ? 'linear-gradient(135deg, #C9A84C, #8B6914, #C9A84C)' : 'none',
                position: 'relative',
                transform: isHighlighted && !isMobile ? 'scale(1.04)' : 'none',
                zIndex: isHighlighted ? 2 : 1,
              }}>
                {/* Badge */}
                {plan.badge && (
                  <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', zIndex: 3, padding: '5px 18px', borderRadius: '100px', background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#06070B', fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', boxShadow: '0 4px 16px rgba(201,168,76,0.4)' }}>{plan.badge}</div>
                )}

                <div style={{
                  padding: '32px 24px', borderRadius: isHighlighted ? '20px' : '22px',
                  background: isHighlighted ? '#0D0D16' : 'rgba(255,255,255,0.015)',
                  border: isHighlighted ? 'none' : `1px solid rgba(255,255,255,0.05)`,
                  height: '100%', display: 'flex', flexDirection: 'column',
                }}>
                  {/* Current badge */}
                  {isCurrent && (
                    <div style={{ marginBottom: '12px' }}><span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 12px', borderRadius: '100px', background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>TU PLAN ACTUAL</span></div>
                  )}

                  <p style={{ fontSize: '13px', fontWeight: 600, color: plan.textColor, margin: '0 0 4px', letterSpacing: '0.02em' }}>{plan.name}</p>

                  {/* Price */}
                  {plan.isEnterprise ? (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '32px', fontWeight: 700, color: '#F0ECE3' }}>Custom</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '44px', fontWeight: 700, color: '#F0ECE3', lineHeight: 1 }}>${totalMonthly}</span>
                      <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.3)' }}>/mes</span>
                    </div>
                  )}

                  {/* Price breakdown */}
                  {!plan.isEnterprise && aiSurcharge > 0 && !annual && (
                    <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.25)', margin: '0 0 4px' }}>${plan.price} plan + ${aiSurcharge} IA</p>
                  )}
                  {!plan.isEnterprise && annual && (
                    <p style={{ fontSize: '10px', color: '#34d399', margin: '0 0 4px' }}>Ahorra ${Math.round(plan.price * 2)}/ano vs mensual</p>
                  )}
                  {!plan.isEnterprise && useOwnKeys && (
                    <p style={{ fontSize: '10px', color: '#34d399', margin: '0 0 4px' }}>$0 cargo IA (tus keys)</p>
                  )}

                  <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.35)', margin: '0 0 20px', lineHeight: 1.4 }}>{plan.tagline}</p>

                  {/* Savings callout for Agency (decoy effect) */}
                  {plan.savings && (
                    <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '16px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
                      <p style={{ fontSize: '11px', color: '#C9A84C', fontWeight: 600, margin: 0 }}>{plan.savings}</p>
                    </div>
                  )}

                  {/* Features */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', flex: 1 }}>
                    {plan.features.map((f: any) => (
                      <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {f.included ? (
                          <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: f.highlight ? 'rgba(201,168,76,0.15)' : 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: f.highlight ? '#C9A84C' : '#34d399', flexShrink: 0 }}>&#10003;</span>
                        ) : (
                          <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'rgba(240,236,227,0.15)', flexShrink: 0 }}>—</span>
                        )}
                        <span style={{
                          fontSize: '12px', lineHeight: 1.3,
                          color: f.included ? (f.highlight ? '#C9A84C' : 'rgba(240,236,227,0.6)') : 'rgba(240,236,227,0.2)',
                          fontWeight: f.bold ? 600 : 400,
                          textDecoration: f.included ? 'none' : 'line-through',
                        }}>{f.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button onClick={() => plan.isEnterprise ? handleCheckout(plan) : setSelectedPlan(plan)} disabled={isCurrent} style={{
                    width: '100%', padding: '14px', borderRadius: '14px', fontSize: '14px', fontWeight: 700,
                    fontFamily: 'inherit', cursor: isCurrent ? 'default' : 'pointer', letterSpacing: '0.02em',
                    background: isCurrent ? 'rgba(52,211,153,0.06)'
                      : isHighlighted ? 'linear-gradient(135deg, #C9A84C 0%, #E2C060 50%, #C9A84C 100%)'
                      : plan.isEnterprise ? 'rgba(52,211,153,0.08)'
                      : `rgba(255,255,255,0.04)`,
                    color: isCurrent ? '#34d399' : isHighlighted ? '#06070B' : plan.isEnterprise ? '#34d399' : 'rgba(240,236,227,0.6)',
                    border: isCurrent ? '1px solid rgba(52,211,153,0.15)' : isHighlighted ? 'none' : `1px solid rgba(255,255,255,0.08)`,
                    boxShadow: isHighlighted ? '0 8px 32px rgba(201,168,76,0.3)' : 'none',
                    transition: 'all 0.3s',
                  }}
                    onMouseEnter={e => { if (!isCurrent && isHighlighted) e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    {isCurrent ? 'Plan actual' : plan.cta}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* AI Keys section */}
        <div style={{ maxWidth: '700px', margin: '0 auto 40px', position: 'relative', zIndex: 1 }}>
          <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(167,139,250,0.03)', border: '1px solid rgba(167,139,250,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa', margin: 0 }}>Creditos de IA</p>
                <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.35)', margin: '2px 0 0' }}>Sophia usa Claude + Whisper</p>
              </div>
              {useOwnKeys && <span style={{ fontSize: '10px', padding: '4px 12px', borderRadius: '100px', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontWeight: 700 }}>Tus keys</span>}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: useOwnKeys ? '16px' : '0' }}>
              <div onClick={() => setUseOwnKeys(false)} style={{
                flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                background: !useOwnKeys ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.01)',
                border: `1px solid ${!useOwnKeys ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                <p style={{ fontSize: '18px', fontWeight: 800, color: !useOwnKeys ? '#C9A84C' : 'rgba(240,236,227,0.2)', margin: '0 0 2px' }}>+$50<span style={{ fontSize: '11px', fontWeight: 400 }}>/mes</span></p>
                <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', margin: 0 }}>Nosotros lo manejamos</p>
              </div>
              <div onClick={() => setUseOwnKeys(true)} style={{
                flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                background: useOwnKeys ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.01)',
                border: `1px solid ${useOwnKeys ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                <p style={{ fontSize: '18px', fontWeight: 800, color: useOwnKeys ? '#34d399' : 'rgba(240,236,227,0.2)', margin: '0 0 2px' }}>$0</p>
                <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', margin: 0 }}>Tus propias API keys</p>
              </div>
            </div>

            {useOwnKeys && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} placeholder="Anthropic: sk-ant-api03-..." style={inp} />
                <input value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="OpenAI: sk-proj-..." style={inp} />
                <button onClick={saveApiKeys} disabled={savingKeys} style={{ padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', background: keysSaved ? 'rgba(52,211,153,0.1)' : 'linear-gradient(135deg, #34d399, #059669)', color: keysSaved ? '#34d399' : '#06070B', border: keysSaved ? '1px solid rgba(52,211,153,0.2)' : 'none', cursor: 'pointer' }}>
                  {savingKeys ? 'Guardando...' : keysSaved ? 'Guardadas' : 'Guardar keys'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Social proof */}
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 40px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
            {[
              { num: '500+', label: 'Conversaciones IA generadas' },
              { num: '11', label: 'Agentes IA activos' },
              { num: '7', label: 'Industrias soportadas' },
              { num: '<$0.04', label: 'Costo por lead atendido' },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '28px', fontWeight: 700, color: '#C9A84C', margin: 0 }}>{s.num}</p>
                <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Checkout Modal */}
        {selectedPlan && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setSelectedPlan(null); setCheckoutLoading(false) }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#0D0D16', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '24px', padding: '36px', width: '440px', maxWidth: '92vw', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 20px', background: `${selectedPlan.color}15`, border: `1px solid ${selectedPlan.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={selectedPlan.color} strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>

              <h3 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '26px', fontWeight: 400, color: '#F0ECE3', margin: '0 0 8px' }}>Plan {selectedPlan.name}</h3>

              <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '24px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>Plan {selectedPlan.name}</span>
                  <span style={{ fontSize: '13px', color: '#F0ECE3', fontWeight: 600 }}>${annual ? Math.round(selectedPlan.price * 10 / 12) : selectedPlan.price}/mes</span>
                </div>
                {!useOwnKeys && !annual && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>Creditos IA</span>
                    <span style={{ fontSize: '13px', color: '#a78bfa', fontWeight: 600 }}>+$50/mes</span>
                  </div>
                )}
                {annual && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>Facturacion anual (2 meses gratis)</span>
                    <span style={{ fontSize: '13px', color: '#34d399', fontWeight: 600 }}>${Math.round(selectedPlan.price * 10)}/ano</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#F0ECE3' }}>Total</span>
                  <span style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '28px', fontWeight: 700, color: '#C9A84C' }}>
                    ${annual ? Math.round(selectedPlan.price * 10) : selectedPlan.price + (useOwnKeys ? 0 : 50)}
                    <span style={{ fontSize: '13px', color: 'rgba(240,236,227,0.3)', fontFamily: '"Outfit",sans-serif', fontWeight: 400 }}>{annual ? '/ano' : '/mes'}</span>
                  </span>
                </div>
              </div>

              <button onClick={() => handleCheckout(selectedPlan)} disabled={checkoutLoading} style={{
                width: '100%', padding: '16px', borderRadius: '14px', fontSize: '15px', fontWeight: 700,
                fontFamily: 'inherit', letterSpacing: '0.02em',
                background: checkoutLoading ? 'rgba(201,168,76,0.3)' : 'linear-gradient(135deg, #C9A84C 0%, #E2C060 50%, #C9A84C 100%)',
                color: '#06070B', border: 'none', cursor: checkoutLoading ? 'wait' : 'pointer',
                boxShadow: '0 8px 32px rgba(201,168,76,0.3)', marginBottom: '12px',
              }}>{checkoutLoading ? 'Procesando...' : 'Pagar con Stripe'}</button>
              <button onClick={() => { setSelectedPlan(null); setCheckoutLoading(false) }} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'none', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(240,236,227,0.3)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
