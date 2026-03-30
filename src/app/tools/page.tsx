'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

type Tab = 'landings' | 'emails' | 'compliance' | 'commissions' | 'marketplace' | 'api' | 'voice'

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
    const tables: Record<Tab, string> = { landings: 'landing_pages', emails: 'email_campaigns', compliance: 'compliance_records', commissions: 'commissions', marketplace: 'lead_marketplace', api: 'api_keys', voice: 'voice_calls' }
    const { data: d } = await supabase.from(tables[tab]).select('*').order('created_at', { ascending: false }).limit(20)
    setData(d || [])
    setLoading(false)
  }

  // Landing Builder
  const [newLanding, setNewLanding] = useState({ title: '', slug: '', template: 'dental' })
  async function createLanding() {
    if (!newLanding.title) return
    await supabase.from('landing_pages').insert({ ...newLanding, slug: newLanding.slug || newLanding.title.toLowerCase().replace(/\s+/g, '-') })
    setNewLanding({ title: '', slug: '', template: 'dental' }); setShowCreate(false); load()
  }

  // Email Campaign
  const [newEmail, setNewEmail] = useState({ name: '', trigger_event: 'new_lead' })
  async function createCampaign() {
    if (!newEmail.name) return
    await supabase.from('email_campaigns').insert({ ...newEmail, emails: [{ subject: 'Bienvenido', body: '', delay_hours: 0 }, { subject: 'Seguimiento', body: '', delay_hours: 48 }, { subject: 'Última oportunidad', body: '', delay_hours: 168 }] })
    setNewEmail({ name: '', trigger_event: 'new_lead' }); setShowCreate(false); load()
  }

  // Compliance
  const [newLicense, setNewLicense] = useState({ license_type: '', license_number: '', state: '', carrier: '', expiration_date: '' })
  async function createLicense() {
    if (!newLicense.license_number) return
    await supabase.from('compliance_records').insert(newLicense)
    setNewLicense({ license_type: '', license_number: '', state: '', carrier: '', expiration_date: '' }); setShowCreate(false); load()
  }

  // Commission
  const [newComm, setNewComm] = useState({ carrier: '', product: '', premium: '', commission_rate: '0.15', policy_number: '' })
  async function createCommission() {
    const premium = parseFloat(newComm.premium) || 0
    const rate = parseFloat(newComm.commission_rate) || 0.15
    await supabase.from('commissions').insert({ ...newComm, premium, commission_rate: rate, commission_amount: premium * rate })
    setNewComm({ carrier: '', product: '', premium: '', commission_rate: '0.15', policy_number: '' }); setShowCreate(false); load()
  }

  // Marketplace
  const [newListing, setNewListing] = useState({ lead_count: '', price_per_lead: '', lead_type: 'dental', states: '', description: '' })
  async function createListing() {
    const count = parseInt(newListing.lead_count) || 0
    const price = parseFloat(newListing.price_per_lead) || 0
    await supabase.from('lead_marketplace').insert({ lead_count: count, price_per_lead: price, total_price: count * price, lead_type: newListing.lead_type, states: newListing.states.split(',').map(s => s.trim()), description: newListing.description })
    setNewListing({ lead_count: '', price_per_lead: '', lead_type: 'dental', states: '', description: '' }); setShowCreate(false); load()
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'landings', label: 'Landings', icon: '🌐' },
    { key: 'emails', label: 'Emails', icon: '📧' },
    { key: 'compliance', label: 'Compliance', icon: '📋' },
    { key: 'commissions', label: 'Comisiones', icon: '💰' },
    { key: 'marketplace', label: 'Marketplace', icon: '🏪' },
    { key: 'api', label: 'API', icon: '🔌' },
    { key: 'voice', label: 'Llamadas', icon: '📞' },
  ]

  const inp = { width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: '"Outfit","Inter",sans-serif', boxSizing: 'border-box' as const }

  const totalCommissions = tab === 'commissions' ? data.reduce((s, c) => s + (c.commission_amount || 0), 0) : 0

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif' }}>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>HERRAMIENTAS</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Centro de Control</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setShowCreate(false) }} style={{
              padding: '9px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: tab === t.key ? 700 : 400, whiteSpace: 'nowrap',
              fontFamily: 'inherit', cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: tab === t.key ? 'rgba(201,168,76,0.08)' : 'transparent', color: tab === t.key ? '#C9A84C' : 'rgba(240,236,227,0.4)',
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* Header + Create */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={{ color: 'rgba(240,236,227,0.4)', fontSize: '13px' }}>{data.length} registro{data.length !== 1 ? 's' : ''}{tab === 'commissions' ? ` · $${totalCommissions.toFixed(2)} total` : ''}</p>
          <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '8px 18px', borderRadius: '10px', background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#06070B', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ Nuevo</button>
        </div>

        {/* Create forms */}
        {showCreate && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
            {tab === 'landings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Título de la landing" value={newLanding.title} onChange={e => setNewLanding({ ...newLanding, title: e.target.value })} style={inp} />
                <input placeholder="URL slug" value={newLanding.slug} onChange={e => setNewLanding({ ...newLanding, slug: e.target.value })} style={inp} />
                <select value={newLanding.template} onChange={e => setNewLanding({ ...newLanding, template: e.target.value })} style={inp}>
                  <option value="dental">Dental</option><option value="aca">ACA/Obamacare</option><option value="vida">Vida/IUL</option><option value="medicare">Medicare</option>
                </select>
                <button onClick={createLanding} style={{ padding: '10px', borderRadius: '10px', background: '#C9A84C', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Crear Landing</button>
              </div>
            )}
            {tab === 'emails' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Nombre de la campaña" value={newEmail.name} onChange={e => setNewEmail({ ...newEmail, name: e.target.value })} style={inp} />
                <select value={newEmail.trigger_event} onChange={e => setNewEmail({ ...newEmail, trigger_event: e.target.value })} style={inp}>
                  <option value="new_lead">Nuevo lead</option><option value="no_response_48h">Sin respuesta 48h</option><option value="post_sale">Post-venta</option><option value="referral">Referido</option>
                </select>
                <button onClick={createCampaign} style={{ padding: '10px', borderRadius: '10px', background: '#C9A84C', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Crear Campaña (3 emails)</button>
              </div>
            )}
            {tab === 'compliance' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                <select value={newLicense.license_type} onChange={e => setNewLicense({ ...newLicense, license_type: e.target.value })} style={inp}>
                  <option value="">Tipo de licencia</option><option value="life_health">Vida y Salud</option><option value="property_casualty">Propiedad</option><option value="surplus_lines">Surplus Lines</option>
                </select>
                <input placeholder="Número de licencia" value={newLicense.license_number} onChange={e => setNewLicense({ ...newLicense, license_number: e.target.value })} style={inp} />
                <input placeholder="Estado (FL, TX...)" value={newLicense.state} onChange={e => setNewLicense({ ...newLicense, state: e.target.value })} style={inp} />
                <input placeholder="Carrier" value={newLicense.carrier} onChange={e => setNewLicense({ ...newLicense, carrier: e.target.value })} style={inp} />
                <input type="date" value={newLicense.expiration_date} onChange={e => setNewLicense({ ...newLicense, expiration_date: e.target.value })} style={inp} />
                <button onClick={createLicense} style={{ padding: '10px', borderRadius: '10px', background: '#C9A84C', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Guardar Licencia</button>
              </div>
            )}
            {tab === 'commissions' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                <input placeholder="Carrier" value={newComm.carrier} onChange={e => setNewComm({ ...newComm, carrier: e.target.value })} style={inp} />
                <input placeholder="Producto" value={newComm.product} onChange={e => setNewComm({ ...newComm, product: e.target.value })} style={inp} />
                <input placeholder="Prima mensual ($)" type="number" value={newComm.premium} onChange={e => setNewComm({ ...newComm, premium: e.target.value })} style={inp} />
                <input placeholder="Tasa comisión (0.15)" type="number" step="0.01" value={newComm.commission_rate} onChange={e => setNewComm({ ...newComm, commission_rate: e.target.value })} style={inp} />
                <input placeholder="# Póliza" value={newComm.policy_number} onChange={e => setNewComm({ ...newComm, policy_number: e.target.value })} style={inp} />
                <button onClick={createCommission} style={{ padding: '10px', borderRadius: '10px', background: '#C9A84C', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Registrar Comisión</button>
              </div>
            )}
            {tab === 'marketplace' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <input placeholder="Cantidad de leads" type="number" value={newListing.lead_count} onChange={e => setNewListing({ ...newListing, lead_count: e.target.value })} style={inp} />
                  <input placeholder="Precio por lead ($)" type="number" value={newListing.price_per_lead} onChange={e => setNewListing({ ...newListing, price_per_lead: e.target.value })} style={inp} />
                  <select value={newListing.lead_type} onChange={e => setNewListing({ ...newListing, lead_type: e.target.value })} style={inp}>
                    <option value="dental">Dental</option><option value="aca">ACA</option><option value="vida">Vida</option><option value="medicare">Medicare</option>
                  </select>
                </div>
                <input placeholder="Estados (FL, TX, CA...)" value={newListing.states} onChange={e => setNewListing({ ...newListing, states: e.target.value })} style={inp} />
                <textarea placeholder="Descripción del paquete" value={newListing.description} onChange={e => setNewListing({ ...newListing, description: e.target.value })} rows={2} style={{ ...inp, resize: 'none' }} />
                <button onClick={createListing} style={{ padding: '10px', borderRadius: '10px', background: '#C9A84C', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Publicar en Marketplace</button>
              </div>
            )}
          </div>
        )}

        {/* Data list */}
        {loading ? <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,227,0.3)' }}>Cargando...</div> :
        data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '28px', opacity: 0.2, marginBottom: '12px' }}>◦</div>
            <p style={{ fontFamily: '"DM Serif Display",serif', fontSize: '18px', color: 'rgba(240,236,227,0.2)', fontStyle: 'italic' }}>Sin registros</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.map(item => {
              const colors: Record<Tab, string> = { landings: '#60a5fa', emails: '#a78bfa', compliance: '#fbbf24', commissions: '#34d399', marketplace: '#f97316', api: '#06b6d4', voice: '#f472b6' }
              const color = colors[tab]

              return (
                <div key={item.id} style={{ padding: '16px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderLeft: `3px solid ${color}`, transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)' }}>

                  {tab === 'landings' && <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.title}</span>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: item.published ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', color: item.published ? '#34d399' : '#fbbf24' }}>{item.published ? 'Publicada' : 'Borrador'}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>/{item.slug} · {item.template} · {item.visits || 0} visitas · {item.conversions || 0} conversiones</p>
                  </>}

                  {tab === 'emails' && <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.name}</span>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>{item.status}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>Trigger: {item.trigger_event} · {(item.emails as any[])?.length || 0} emails · {item.sent_count || 0} enviados</p>
                  </>}

                  {tab === 'compliance' && <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.license_type} — {item.state}</span>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: item.status === 'active' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: item.status === 'active' ? '#34d399' : '#f87171' }}>{item.status}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>#{item.license_number} · {item.carrier || '—'} · Exp: {item.expiration_date || '—'}</p>
                  </>}

                  {tab === 'commissions' && <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.carrier} — {item.product}</span>
                      <span style={{ color: '#34d399', fontSize: '16px', fontWeight: 800, fontFamily: '"DM Serif Display",serif' }}>${(item.commission_amount || 0).toFixed(2)}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>Prima: ${item.premium} · Tasa: {(item.commission_rate * 100).toFixed(0)}% · Póliza: {item.policy_number || '—'} · {item.status}</p>
                  </>}

                  {tab === 'marketplace' && <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.lead_count} leads {item.lead_type}</span>
                      <span style={{ color: '#f97316', fontSize: '16px', fontWeight: 800, fontFamily: '"DM Serif Display",serif' }}>${item.total_price}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>${item.price_per_lead}/lead · {item.states?.join(', ')} · Score: {item.quality_score} · {item.status}</p>
                    {item.description && <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.25)', marginTop: '4px', fontStyle: 'italic' }}>{item.description}</p>}
                  </>}

                  {tab === 'api' && <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.name || 'API Key'}</span>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: item.active ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: item.active ? '#34d399' : '#f87171' }}>{item.active ? 'Activa' : 'Inactiva'}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>Requests hoy: {item.requests_today}/{item.rate_limit} · Último uso: {item.last_used ? new Date(item.last_used).toLocaleDateString('es') : 'Nunca'}</p>
                  </>}

                  {tab === 'voice' && <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{item.lead_phone}</span>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: 'rgba(244,114,182,0.1)', color: '#f472b6' }}>{item.status}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.35)' }}>{item.direction} · {item.duration_seconds ? `${item.duration_seconds}s` : 'En curso'} · {new Date(item.created_at).toLocaleString('es')}</p>
                  </>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
