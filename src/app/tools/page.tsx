'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

type Tab = 'landings' | 'emails' | 'compliance' | 'commissions' | 'marketplace' | 'api' | 'voice'

const TAB_CONFIG: { key: Tab; label: string; icon: string; color: string; desc: string }[] = [
  { key: 'landings', label: 'Landings', icon: '🌐', color: '#60a5fa', desc: 'Paginas de captura con IA' },
  { key: 'emails', label: 'Emails', icon: '📧', color: '#a78bfa', desc: 'Campanas automaticas' },
  { key: 'compliance', label: 'Compliance', icon: '📋', color: '#fbbf24', desc: 'Licencias y regulaciones' },
  { key: 'commissions', label: 'Comisiones', icon: '💰', color: '#34d399', desc: 'Tracking de ganancias' },
  { key: 'marketplace', label: 'Leads', icon: '🏪', color: '#f97316', desc: 'Compra/venta de leads' },
  { key: 'api', label: 'API', icon: '🔌', color: '#06b6d4', desc: 'Integraciones externas' },
  { key: 'voice', label: 'Llamadas', icon: '📞', color: '#f472b6', desc: 'Historial de llamadas' },
]

export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>('landings')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    if (tab === 'landings') {
      const { data: d } = await supabase.from('landing_builds').select('*, landing_templates(name, category)').order('created_at', { ascending: false }).limit(20)
      setData(d || [])
    } else {
      const tables: Record<string, string> = { emails: 'email_campaigns', compliance: 'compliance_records', commissions: 'commissions', marketplace: 'lead_marketplace', api: 'api_keys', voice: 'voice_calls' }
      const { data: d } = await supabase.from(tables[tab]).select('*').order('created_at', { ascending: false }).limit(20)
      setData(d || [])
    }
    setLoading(false)
  }

  // ── Form states ──
  const [newEmail, setNewEmail] = useState({ name: '', trigger_event: 'new_lead' })
  const [newLicense, setNewLicense] = useState({ license_type: '', license_number: '', state: '', carrier: '', expiration_date: '' })
  const [newComm, setNewComm] = useState({ carrier: '', product: '', premium: '', commission_rate: '0.15', policy_number: '' })
  const [newListing, setNewListing] = useState({ lead_count: '', price_per_lead: '', lead_type: 'dental', states: '', description: '' })

  async function createCampaign() {
    if (!newEmail.name) return
    await supabase.from('email_campaigns').insert({ ...newEmail, emails: [{ subject: 'Bienvenido', body: '', delay_hours: 0 }, { subject: 'Seguimiento', body: '', delay_hours: 48 }, { subject: 'Ultima oportunidad', body: '', delay_hours: 168 }] })
    setNewEmail({ name: '', trigger_event: 'new_lead' }); setShowCreate(false); load()
  }
  async function createLicense() {
    if (!newLicense.license_number) return
    await supabase.from('compliance_records').insert(newLicense)
    setNewLicense({ license_type: '', license_number: '', state: '', carrier: '', expiration_date: '' }); setShowCreate(false); load()
  }
  async function createCommission() {
    const premium = parseFloat(newComm.premium) || 0; const rate = parseFloat(newComm.commission_rate) || 0.15
    await supabase.from('commissions').insert({ ...newComm, premium, commission_rate: rate, commission_amount: premium * rate })
    setNewComm({ carrier: '', product: '', premium: '', commission_rate: '0.15', policy_number: '' }); setShowCreate(false); load()
  }
  async function createListing() {
    const count = parseInt(newListing.lead_count) || 0; const price = parseFloat(newListing.price_per_lead) || 0
    await supabase.from('lead_marketplace').insert({ lead_count: count, price_per_lead: price, total_price: count * price, lead_type: newListing.lead_type, states: newListing.states.split(',').map(s => s.trim()), description: newListing.description })
    setNewListing({ lead_count: '', price_per_lead: '', lead_type: 'dental', states: '', description: '' }); setShowCreate(false); load()
  }

  const currentTab = TAB_CONFIG.find(t => t.key === tab)!
  const totalCommissions = tab === 'commissions' ? data.reduce((s, c) => s + (c.commission_amount || 0), 0) : 0
  const readyLandings = tab === 'landings' ? data.filter(d => d.status === 'ready').length : 0

  const inp: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: '"Outfit","Inter",sans-serif', boxSizing: 'border-box' }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative' }}>

        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '500px', height: '500px', background: `radial-gradient(circle, ${currentTab.color}08 0%, transparent 70%)`, pointerEvents: 'none', transition: 'background 0.5s' }} />

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>HERRAMIENTAS</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Centro de Control</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>7 herramientas para gestionar tu negocio</p>
        </div>

        {/* Tab cards - visual grid on desktop, scroll on mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(7, 1fr)', gap: '8px', marginBottom: '28px' }}>
          {TAB_CONFIG.map(t => {
            const active = tab === t.key
            return (
              <div key={t.key} onClick={() => { setTab(t.key); setShowCreate(false) }}
                style={{
                  padding: isMobile ? '10px 6px' : '14px 10px', borderRadius: '14px', cursor: 'pointer',
                  background: active ? `${t.color}10` : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${active ? t.color + '30' : 'rgba(255,255,255,0.04)'}`,
                  borderBottom: active ? `3px solid ${t.color}` : '3px solid transparent',
                  textAlign: 'center', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)' }}
              >
                <span style={{ fontSize: isMobile ? '18px' : '22px', display: 'block', marginBottom: '4px' }}>{t.icon}</span>
                <span style={{ fontSize: '11px', fontWeight: active ? 700 : 500, color: active ? t.color : 'rgba(240,236,227,0.5)', display: 'block' }}>{t.label}</span>
                {!isMobile && <span style={{ fontSize: '9px', color: 'rgba(240,236,227,0.2)', display: 'block', marginTop: '2px' }}>{t.desc}</span>}
              </div>
            )
          })}
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px 16px', borderRadius: '12px', background: `${currentTab.color}06`, border: `1px solid ${currentTab.color}15` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>{currentTab.icon}</span>
            <div>
              <span style={{ fontSize: '18px', fontWeight: 800, color: currentTab.color, fontFamily: '"DM Serif Display",serif' }}>{data.length}</span>
              <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', marginLeft: '6px' }}>
                {tab === 'landings' ? `(${readyLandings} listas)` : tab === 'commissions' ? `· $${totalCommissions.toFixed(2)} total` : 'registros'}
              </span>
            </div>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} style={{
            padding: '9px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit',
            background: `linear-gradient(135deg, ${currentTab.color}, ${currentTab.color}CC)`,
            color: '#06070B', border: 'none', cursor: 'pointer',
            boxShadow: `0 4px 16px ${currentTab.color}30`,
          }}>+ Nuevo</button>
        </div>

        {/* Create forms */}
        {showCreate && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${currentTab.color}20`, borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: currentTab.color, marginBottom: '16px', textTransform: 'uppercase' }}>Nuevo {currentTab.label}</p>

            {tab === 'landings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '20px 0' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🌐</div>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#F0ECE3', textAlign: 'center', margin: 0 }}>Crea landing pages con IA</p>
                <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', textAlign: 'center', margin: 0 }}>Elige un template, contesta preguntas, y tu pagina esta lista</p>
                <a href="/marketplace" style={{ marginTop: '8px', padding: '12px 32px', borderRadius: '12px', background: 'linear-gradient(135deg, #60a5fa, #3b82f6)', color: '#06070B', fontSize: '14px', fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(96,165,250,0.3)' }}>Ir al Marketplace &rarr;</a>
              </div>
            )}

            {tab === 'emails' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input placeholder="Nombre de la campana" value={newEmail.name} onChange={e => setNewEmail({ ...newEmail, name: e.target.value })} style={inp} />
                <select value={newEmail.trigger_event} onChange={e => setNewEmail({ ...newEmail, trigger_event: e.target.value })} style={inp}>
                  <option value="new_lead">Nuevo lead</option><option value="no_response_48h">Sin respuesta 48h</option><option value="post_sale">Post-venta</option><option value="referral">Referido</option>
                </select>
                <button onClick={createCampaign} style={{ padding: '12px', borderRadius: '12px', background: `linear-gradient(135deg, ${currentTab.color}, ${currentTab.color}CC)`, color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Crear Campana (3 emails)</button>
              </div>
            )}

            {tab === 'compliance' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <select value={newLicense.license_type} onChange={e => setNewLicense({ ...newLicense, license_type: e.target.value })} style={inp}>
                  <option value="">Tipo de licencia</option><option value="life_health">Vida y Salud</option><option value="property_casualty">Propiedad</option><option value="surplus_lines">Surplus Lines</option>
                </select>
                <input placeholder="Numero de licencia" value={newLicense.license_number} onChange={e => setNewLicense({ ...newLicense, license_number: e.target.value })} style={inp} />
                <input placeholder="Estado (FL, TX...)" value={newLicense.state} onChange={e => setNewLicense({ ...newLicense, state: e.target.value })} style={inp} />
                <input placeholder="Carrier" value={newLicense.carrier} onChange={e => setNewLicense({ ...newLicense, carrier: e.target.value })} style={inp} />
                <input type="date" value={newLicense.expiration_date} onChange={e => setNewLicense({ ...newLicense, expiration_date: e.target.value })} style={inp} />
                <button onClick={createLicense} style={{ padding: '12px', borderRadius: '12px', background: `linear-gradient(135deg, ${currentTab.color}, ${currentTab.color}CC)`, color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Guardar Licencia</button>
              </div>
            )}

            {tab === 'commissions' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <input placeholder="Carrier" value={newComm.carrier} onChange={e => setNewComm({ ...newComm, carrier: e.target.value })} style={inp} />
                <input placeholder="Producto" value={newComm.product} onChange={e => setNewComm({ ...newComm, product: e.target.value })} style={inp} />
                <input placeholder="Prima mensual ($)" type="number" value={newComm.premium} onChange={e => setNewComm({ ...newComm, premium: e.target.value })} style={inp} />
                <input placeholder="Tasa comision (0.15)" type="number" step="0.01" value={newComm.commission_rate} onChange={e => setNewComm({ ...newComm, commission_rate: e.target.value })} style={inp} />
                <input placeholder="# Poliza" value={newComm.policy_number} onChange={e => setNewComm({ ...newComm, policy_number: e.target.value })} style={inp} />
                <button onClick={createCommission} style={{ padding: '12px', borderRadius: '12px', background: `linear-gradient(135deg, ${currentTab.color}, ${currentTab.color}CC)`, color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Registrar Comision</button>
              </div>
            )}

            {tab === 'marketplace' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
                  <input placeholder="Cantidad de leads" type="number" value={newListing.lead_count} onChange={e => setNewListing({ ...newListing, lead_count: e.target.value })} style={inp} />
                  <input placeholder="Precio por lead ($)" type="number" value={newListing.price_per_lead} onChange={e => setNewListing({ ...newListing, price_per_lead: e.target.value })} style={inp} />
                  <select value={newListing.lead_type} onChange={e => setNewListing({ ...newListing, lead_type: e.target.value })} style={inp}>
                    <option value="dental">Dental</option><option value="aca">ACA</option><option value="vida">Vida</option><option value="medicare">Medicare</option>
                  </select>
                </div>
                <input placeholder="Estados (FL, TX, CA...)" value={newListing.states} onChange={e => setNewListing({ ...newListing, states: e.target.value })} style={inp} />
                <textarea placeholder="Descripcion del paquete" value={newListing.description} onChange={e => setNewListing({ ...newListing, description: e.target.value })} rows={2} style={{ ...inp, resize: 'none' }} />
                <button onClick={createListing} style={{ padding: '12px', borderRadius: '12px', background: `linear-gradient(135deg, ${currentTab.color}, ${currentTab.color}CC)`, color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Publicar</button>
              </div>
            )}

            {tab === 'api' && (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>Las API keys se generan automaticamente. Contacta al admin para una nueva.</p>
              </div>
            )}

            {tab === 'voice' && (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)' }}>Las llamadas se registran automaticamente via Twilio.</p>
              </div>
            )}
          </div>
        )}

        {/* Data list */}
        {loading ? <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,227,0.3)' }}>Cargando...</div> :
        data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '48px', opacity: 0.15, marginBottom: '12px' }}>{currentTab.icon}</div>
            <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '18px', color: 'rgba(240,236,227,0.2)', fontStyle: 'italic' }}>Sin {currentTab.label.toLowerCase()}</p>
            <p style={{ color: 'rgba(240,236,227,0.12)', fontSize: '12px', marginTop: '6px' }}>Haz click en "+ Nuevo" para empezar</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.map(item => (
              <div key={item.id} style={{
                padding: '16px 20px', borderRadius: '14px',
                background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)',
                borderLeft: `3px solid ${currentTab.color}40`, transition: 'all 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = currentTab.color }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = currentTab.color + '40' }}>

                {tab === 'landings' && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.landing_templates?.name || 'Landing'}</span>
                    <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '100px', fontWeight: 600, background: item.status === 'ready' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', color: item.status === 'ready' ? '#34d399' : '#fbbf24' }}>{item.status === 'ready' ? 'Lista' : 'En proceso'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                    <span>{item.landing_templates?.category || '-'}</span>
                    {item.slug && <span>/{item.slug}</span>}
                    <span>{item.visits || 0} visitas</span>
                    {item.status === 'ready' && item.slug && <a href={`/l/${item.slug}`} target="_blank" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 600 }}>Abrir &rarr;</a>}
                  </div>
                </>}

                {tab === 'emails' && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '100px', fontWeight: 600, background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>{item.status || 'Activa'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                    <span>Trigger: {item.trigger_event}</span>
                    <span>{(item.emails as any[])?.length || 0} emails</span>
                    <span>{item.sent_count || 0} enviados</span>
                  </div>
                </>}

                {tab === 'compliance' && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.license_type} — {item.state}</span>
                    <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '100px', fontWeight: 600, background: item.status === 'active' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: item.status === 'active' ? '#34d399' : '#f87171' }}>{item.status || 'Activa'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                    <span>#{item.license_number}</span>
                    <span>{item.carrier || '-'}</span>
                    <span>Exp: {item.expiration_date || '-'}</span>
                  </div>
                </>}

                {tab === 'commissions' && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.carrier} — {item.product}</span>
                    <span style={{ color: '#34d399', fontSize: '18px', fontWeight: 800, fontFamily: '"DM Serif Display",serif' }}>${(item.commission_amount || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                    <span>Prima: ${item.premium}</span>
                    <span>Tasa: {((item.commission_rate || 0) * 100).toFixed(0)}%</span>
                    <span>Poliza: {item.policy_number || '-'}</span>
                  </div>
                </>}

                {tab === 'marketplace' && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.lead_count} leads {item.lead_type}</span>
                    <span style={{ color: '#f97316', fontSize: '18px', fontWeight: 800, fontFamily: '"DM Serif Display",serif' }}>${item.total_price}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                    <span>${item.price_per_lead}/lead</span>
                    <span>{item.states?.join(', ')}</span>
                    <span>{item.status}</span>
                  </div>
                </>}

                {tab === 'api' && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.name || 'API Key'}</span>
                    <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '100px', fontWeight: 600, background: item.active ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: item.active ? '#34d399' : '#f87171' }}>{item.active ? 'Activa' : 'Inactiva'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                    <span>Hoy: {item.requests_today || 0}/{item.rate_limit || 100}</span>
                    <span>Ultimo uso: {item.last_used ? new Date(item.last_used).toLocaleDateString('es') : 'Nunca'}</span>
                  </div>
                </>}

                {tab === 'voice' && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.lead_phone}</span>
                    <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '100px', fontWeight: 600, background: 'rgba(244,114,182,0.1)', color: '#f472b6' }}>{item.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>
                    <span>{item.direction}</span>
                    <span>{item.duration_seconds ? `${item.duration_seconds}s` : '-'}</span>
                    <span>{new Date(item.created_at).toLocaleString('es')}</span>
                  </div>
                </>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
