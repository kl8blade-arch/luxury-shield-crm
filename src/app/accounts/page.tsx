'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

const FEATURES = [
  { key: 'sophia_ai', label: 'Sophia IA', desc: 'Agente IA de ventas por WhatsApp', icon: '🤖' },
  { key: 'coaching', label: 'Coaching IA', desc: 'Coach en tiempo real para agentes', icon: '🧠' },
  { key: 'pipeline', label: 'Pipeline', desc: 'Kanban de leads con drag & drop', icon: '📊' },
  { key: 'calendar', label: 'Agenda', desc: 'Calendario con notificaciones WA/SMS', icon: '📅' },
  { key: 'analytics', label: 'Analytics', desc: 'Dashboard de inteligencia del negocio', icon: '📈' },
  { key: 'training', label: 'SophiaModel', desc: 'Pipeline de datos para fine-tuning', icon: '🎓' },
  { key: 'voice', label: 'Voz IA', desc: 'Sophia responde con notas de voz', icon: '🎙️' },
  { key: 'rescue_sequence', label: 'Rescue', desc: 'Secuencia de rescate para leads perdidos', icon: '🔄' },
  { key: 'referrals', label: 'Referidos', desc: 'Programa de referidos automatizado', icon: '🤝' },
  { key: 'whatsapp', label: 'WhatsApp', desc: 'Mensajería por WhatsApp Business', icon: '💬' },
  { key: 'sms', label: 'SMS', desc: 'Mensajería SMS via Twilio', icon: '📱' },
  { key: 'email', label: 'Email', desc: 'Email marketing y notificaciones', icon: '📧' },
  { key: 'forms', label: 'Formularios', desc: 'Landing pages con quiz de calificación', icon: '📝' },
  { key: 'api_access', label: 'API', desc: 'Acceso a la API para integraciones', icon: '🔌' },
  { key: 'white_label', label: 'White Label', desc: 'Marca propia sin mencionar Luxury Shield', icon: '🏷️' },
]

const PLANS = [
  { key: 'starter', label: 'Starter', price: '$97/mes', color: '#60a5fa', subs: 0, leads: 100, agents: 1, features: ['sophia_ai', 'pipeline', 'whatsapp', 'forms'] },
  { key: 'professional', label: 'Professional', price: '$297/mes', color: '#a78bfa', subs: 5, leads: 500, agents: 5, features: ['sophia_ai', 'coaching', 'pipeline', 'calendar', 'analytics', 'whatsapp', 'sms', 'forms', 'rescue_sequence', 'referrals'] },
  { key: 'agency', label: 'Agency', price: '$597/mes', color: '#C9A84C', subs: 25, leads: null, agents: 25, features: ['sophia_ai', 'coaching', 'pipeline', 'calendar', 'analytics', 'training', 'voice', 'rescue_sequence', 'referrals', 'whatsapp', 'sms', 'email', 'forms', 'api_access'] },
  { key: 'enterprise', label: 'Enterprise', price: '$997/mes', color: '#34d399', subs: 50, leads: null, agents: 100, features: FEATURES.map(f => f.key) },
]

export default function AccountsPage() {
  const [account, setAccount] = useState<any>(null)
  const [subAccounts, setSubAccounts] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showProduct, setShowProduct] = useState(false)
  const [tab, setTab] = useState<'overview' | 'subs' | 'products' | 'features' | 'plans'>('overview')
  const [newSub, setNewSub] = useState({ name: '', slug: '', plan: 'starter', features: {} as Record<string, boolean> })
  const [newProduct, setNewProduct] = useState({ name: '', carrier: '', product_type: 'dental', description: '', states: '' })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: acc } = await supabase.from('accounts').select('*').eq('slug', 'luxury-shield').single()
    setAccount(acc)
    if (acc) {
      const { data: subs } = await supabase.from('accounts').select('*').eq('parent_account_id', acc.id).order('created_at', { ascending: false })
      setSubAccounts(subs || [])
      const { data: prods } = await supabase.from('account_products').select('*').eq('account_id', acc.id).order('created_at', { ascending: false })
      setProducts(prods || [])
    }
    setLoading(false)
  }

  async function createSubAccount() {
    if (!newSub.name || !newSub.slug || !account) return
    const plan = PLANS.find(p => p.key === newSub.plan) || PLANS[0]
    const features: Record<string, boolean> = {}
    plan.features.forEach(f => { features[f] = true })
    Object.entries(newSub.features).forEach(([k, v]) => { features[k] = v })

    await supabase.from('accounts').insert({
      name: newSub.name,
      slug: newSub.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      parent_account_id: account.id,
      account_type: 'single',
      plan: newSub.plan,
      max_sub_accounts: 0,
      max_leads: plan.leads,
      max_agents: plan.agents,
      features,
    })
    setNewSub({ name: '', slug: '', plan: 'starter', features: {} })
    setShowCreate(false)
    load()
  }

  async function createProduct() {
    if (!newProduct.name || !account) return
    await supabase.from('account_products').insert({
      account_id: account.id,
      name: newProduct.name,
      carrier: newProduct.carrier,
      product_type: newProduct.product_type,
      description: newProduct.description,
      states: newProduct.states.split(',').map(s => s.trim()).filter(Boolean),
    })
    setNewProduct({ name: '', carrier: '', product_type: 'dental', description: '', states: '' })
    setShowProduct(false)
    load()
  }

  async function toggleFeature(accId: string, feature: string, current: any) {
    const features = { ...(current || {}) }
    features[feature] = !features[feature]
    await supabase.from('accounts').update({ features }).eq('id', accId)
    load()
  }

  const inp = { width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: '"Outfit","Inter",sans-serif', boxSizing: 'border-box' as const }

  const tabs = [
    { key: 'overview' as const, label: 'General' },
    { key: 'subs' as const, label: `Sub-cuentas (${subAccounts.length})` },
    { key: 'products' as const, label: `Productos (${products.length})` },
    { key: 'features' as const, label: 'Features' },
    { key: 'plans' as const, label: 'Planes' },
  ]

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative' }}>

        <div style={{ position: 'absolute', top: '-15%', right: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>PLATAFORMA</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Mi Cuenta</h1>
          {account && <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>{account.name} · Plan {account.plan} · {account.account_type === 'multi' ? 'Multi-producto' : 'Producto único'}</p>}
        </div>

        {loading ? <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,227,0.3)' }}>Cargando...</div> : !account ? <div style={{ padding: '60px', textAlign: 'center', color: '#f87171' }}>Cuenta no encontrada</div> : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '3px', border: '1px solid rgba(255,255,255,0.04)', overflowX: 'auto' }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '9px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: tab === t.key ? 700 : 400, whiteSpace: 'nowrap',
                  fontFamily: 'inherit', cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  background: tab === t.key ? 'rgba(201,168,76,0.08)' : 'transparent', color: tab === t.key ? '#C9A84C' : 'rgba(240,236,227,0.4)',
                }}>{t.label}</button>
              ))}
            </div>

            {/* Overview */}
            {tab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { label: 'Tipo de cuenta', value: account.account_type === 'multi' ? 'Multi-producto' : 'Producto único', color: '#C9A84C' },
                  { label: 'Plan', value: account.plan, color: '#a78bfa' },
                  { label: 'Sub-cuentas', value: `${subAccounts.length}/${account.max_sub_accounts || '∞'}`, color: '#60a5fa' },
                  { label: 'Leads máximos', value: account.max_leads ? account.max_leads.toLocaleString() : 'Ilimitados', color: '#34d399' },
                  { label: 'Agentes máximos', value: `${account.max_agents}`, color: '#fbbf24' },
                  { label: 'Productos', value: `${products.length}`, color: '#f97316' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.012)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', padding: '20px', borderBottom: `2px solid ${color}30` }}>
                    <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 10px' }}>{label}</p>
                    <p style={{ color, fontSize: '24px', fontWeight: 800, margin: 0, fontFamily: '"DM Serif Display",serif', textTransform: 'capitalize' }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-accounts */}
            {tab === 'subs' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '22px', color: '#F0ECE3', margin: 0 }}>Sub-cuentas</h2>
                  <button onClick={() => setShowCreate(true)} style={{ padding: '10px 22px', borderRadius: '12px', background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ Nueva sub-cuenta</button>
                </div>

                {subAccounts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{ fontSize: '28px', opacity: 0.2, marginBottom: '12px' }}>◦</div>
                    <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '18px', color: 'rgba(240,236,227,0.25)', fontStyle: 'italic' }}>Sin sub-cuentas</p>
                    <p style={{ color: 'rgba(240,236,227,0.15)', fontSize: '13px', marginTop: '6px' }}>Crea una para cada producto o cliente</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
                    {subAccounts.map(sub => {
                      const planInfo = PLANS.find(p => p.key === sub.plan) || PLANS[0]
                      const enabledFeatures = Object.entries(sub.features || {}).filter(([, v]) => v).length
                      return (
                        <div key={sub.id} style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${planInfo.color}20`, borderRadius: '16px', padding: '20px', borderLeft: `3px solid ${planInfo.color}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div>
                              <h3 style={{ color: '#F0ECE3', fontSize: '16px', fontWeight: 700, margin: 0 }}>{sub.name}</h3>
                              <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '11px', margin: '2px 0 0' }}>/{sub.slug}</p>
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: `${planInfo.color}15`, color: planInfo.color, textTransform: 'capitalize' }}>{sub.plan}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(240,236,227,0.4)' }}>
                            <span>{enabledFeatures} features</span>
                            <span>{sub.max_agents} agentes</span>
                            <span>{sub.max_leads || '∞'} leads</span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                            {Object.entries(sub.features || {}).filter(([, v]) => v).slice(0, 5).map(([k]) => {
                              const f = FEATURES.find(f => f.key === k)
                              return f ? <span key={k} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '100px', background: 'rgba(201,168,76,0.06)', color: 'rgba(201,168,76,0.6)' }}>{f.icon} {f.label}</span> : null
                            })}
                            {enabledFeatures > 5 && <span style={{ fontSize: '9px', color: 'rgba(240,236,227,0.25)' }}>+{enabledFeatures - 5}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Create sub-account modal */}
                {showCreate && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowCreate(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '28px', width: '520px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }}>
                      <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '22px', color: '#F0ECE3', margin: '0 0 20px' }}>Nueva sub-cuenta</h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        <input placeholder="Nombre de la agencia" value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} style={inp} />
                        <input placeholder="URL slug (ej: miami-dental)" value={newSub.slug} onChange={e => setNewSub({ ...newSub, slug: e.target.value })} style={inp} />
                      </div>

                      <p style={{ color: 'rgba(201,168,76,0.6)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', marginBottom: '10px' }}>PLAN BASE</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '20px' }}>
                        {PLANS.map(p => (
                          <div key={p.key} onClick={() => setNewSub({ ...newSub, plan: p.key })}
                            style={{ padding: '12px', borderRadius: '12px', cursor: 'pointer', border: newSub.plan === p.key ? `1px solid ${p.color}50` : '1px solid rgba(255,255,255,0.05)', background: newSub.plan === p.key ? `${p.color}08` : 'rgba(255,255,255,0.015)', transition: 'all 0.15s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: newSub.plan === p.key ? p.color : '#F0ECE3' }}>{p.label}</span>
                              <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)' }}>{p.price}</span>
                            </div>
                            <div style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)' }}>{p.subs} subs · {p.leads || '∞'} leads · {p.agents} agentes</div>
                          </div>
                        ))}
                      </div>

                      <p style={{ color: 'rgba(201,168,76,0.6)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', marginBottom: '10px' }}>FEATURES (PERSONALIZAR)</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '20px' }}>
                        {FEATURES.map(f => {
                          const planFeatures = PLANS.find(p => p.key === newSub.plan)?.features || []
                          const isInPlan = planFeatures.includes(f.key)
                          const isEnabled = newSub.features[f.key] !== undefined ? newSub.features[f.key] : isInPlan
                          return (
                            <div key={f.key} onClick={() => setNewSub({ ...newSub, features: { ...newSub.features, [f.key]: !isEnabled } })}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', background: isEnabled ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.01)', border: `1px solid ${isEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)'}`, transition: 'all 0.15s' }}>
                              <div style={{ width: '14px', height: '14px', borderRadius: '4px', border: `1px solid ${isEnabled ? '#34d399' : 'rgba(255,255,255,0.15)'}`, background: isEnabled ? '#34d399' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#06070B', flexShrink: 0 }}>{isEnabled ? '✓' : ''}</div>
                              <span style={{ fontSize: '11px', color: isEnabled ? '#F0ECE3' : 'rgba(240,236,227,0.35)' }}>{f.icon} {f.label}</span>
                            </div>
                          )
                        })}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowCreate(false)} style={{ padding: '10px 20px', borderRadius: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                        <button onClick={createSubAccount} disabled={!newSub.name || !newSub.slug} style={{ padding: '10px 24px', borderRadius: '10px', background: newSub.name ? 'linear-gradient(135deg, #C9A84C, #A8893A)' : 'rgba(201,168,76,0.2)', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Crear sub-cuenta</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Products */}
            {tab === 'products' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '22px', color: '#F0ECE3', margin: 0 }}>Productos</h2>
                  <button onClick={() => setShowProduct(true)} style={{ padding: '10px 22px', borderRadius: '12px', background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ Nuevo producto</button>
                </div>

                {products.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{ fontSize: '28px', opacity: 0.2, marginBottom: '12px' }}>◦</div>
                    <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '18px', color: 'rgba(240,236,227,0.25)', fontStyle: 'italic' }}>Sin productos</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
                    {products.map(p => (
                      <div key={p.id} style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', padding: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <h4 style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 700, margin: 0 }}>{p.name}</h4>
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: p.active ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: p.active ? '#34d399' : '#f87171' }}>{p.active ? 'Activo' : 'Inactivo'}</span>
                        </div>
                        {p.carrier && <p style={{ fontSize: '11px', color: '#C9A84C', margin: '0 0 4px' }}>{p.carrier}</p>}
                        {p.description && <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)', margin: '0 0 8px', lineHeight: 1.4 }}>{p.description}</p>}
                        {p.states?.length > 0 && <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>{p.states.map((s: string) => <span key={s} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '100px', background: 'rgba(96,165,250,0.08)', color: '#93c5fd' }}>{s}</span>)}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {showProduct && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowProduct(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '28px', width: '440px', maxWidth: '95vw' }}>
                      <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '22px', color: '#F0ECE3', margin: '0 0 20px' }}>Nuevo producto</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                        <input placeholder="Nombre (ej: Cigna DVH Plus)" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} style={inp} />
                        <input placeholder="Carrier (ej: Cigna)" value={newProduct.carrier} onChange={e => setNewProduct({ ...newProduct, carrier: e.target.value })} style={inp} />
                        <select value={newProduct.product_type} onChange={e => setNewProduct({ ...newProduct, product_type: e.target.value })} style={inp}>
                          <option value="dental">Dental</option><option value="aca">ACA/Obamacare</option><option value="vida">Vida/IUL</option><option value="medicare">Medicare</option><option value="suplementario">Suplementario</option><option value="otro">Otro</option>
                        </select>
                        <textarea placeholder="Descripción" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} rows={2} style={{ ...inp, resize: 'none' }} />
                        <input placeholder="Estados (FL, TX, CA...)" value={newProduct.states} onChange={e => setNewProduct({ ...newProduct, states: e.target.value })} style={inp} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowProduct(false)} style={{ padding: '10px 20px', borderRadius: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                        <button onClick={createProduct} style={{ padding: '10px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Crear</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Features */}
            {tab === 'features' && (
              <div>
                <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '22px', color: '#F0ECE3', margin: '0 0 16px' }}>Features activos</h2>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '8px' }}>
                  {FEATURES.map(f => {
                    const isEnabled = account.features?.[f.key]
                    return (
                      <div key={f.key} onClick={() => toggleFeature(account.id, f.key, account.features)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', background: isEnabled ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.01)', border: `1px solid ${isEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)'}`, transition: 'all 0.2s' }}>
                        <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: isEnabled ? '#34d399' : 'rgba(255,255,255,0.08)', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: isEnabled ? '#fff' : 'rgba(255,255,255,0.3)', position: 'absolute', top: '2px', left: isEnabled ? '18px' : '2px', transition: 'all 0.2s' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: isEnabled ? '#F0ECE3' : 'rgba(240,236,227,0.4)', margin: 0 }}>{f.icon} {f.label}</p>
                          <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.25)', margin: '2px 0 0' }}>{f.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Plans */}
            {tab === 'plans' && (
              <div>
                <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '22px', color: '#F0ECE3', margin: '0 0 16px' }}>Planes disponibles</h2>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '12px' }}>
                  {PLANS.map(p => (
                    <div key={p.key} style={{ background: 'rgba(255,255,255,0.015)', border: account.plan === p.key ? `1px solid ${p.color}40` : '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
                      {account.plan === p.key && <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '9px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', background: `${p.color}15`, color: p.color }}>ACTUAL</div>}
                      <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '24px', color: p.color, margin: '0 0 4px' }}>{p.label}</p>
                      <p style={{ fontSize: '20px', fontWeight: 800, color: '#F0ECE3', margin: '0 0 16px' }}>{p.price}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)' }}>{p.subs === 0 ? 'Sin sub-cuentas' : `${p.subs} sub-cuentas`}</span>
                        <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)' }}>{p.leads ? `${p.leads} leads` : 'Leads ilimitados'}</span>
                        <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)' }}>{p.agents} agentes</span>
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                        {p.features.map(fk => {
                          const f = FEATURES.find(feat => feat.key === fk)
                          return f ? <p key={fk} style={{ fontSize: '10px', color: 'rgba(240,236,227,0.35)', margin: '3px 0' }}>{f.icon} {f.label}</p> : null
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
