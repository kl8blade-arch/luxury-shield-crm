'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'
import { useAuth } from '@/contexts/AuthContext'

type Tab = 'perfil' | 'seguridad' | 'licencias' | 'redes' | 'ia' | 'notificaciones' | 'integraciones'

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR']

const SOCIAL_PLATFORMS = [
  { key: 'social_facebook', label: 'Facebook', icon: 'f', color: '#1877F2', placeholder: 'https://facebook.com/tu-pagina', bg: '#1877F215' },
  { key: 'social_instagram', label: 'Instagram', icon: 'ig', color: '#E4405F', placeholder: 'https://instagram.com/tu-usuario', bg: '#E4405F15' },
  { key: 'social_tiktok', label: 'TikTok', icon: 'tk', color: '#00F2EA', placeholder: 'https://tiktok.com/@tu-usuario', bg: '#00F2EA15' },
  { key: 'social_linkedin', label: 'LinkedIn', icon: 'in', color: '#0A66C2', placeholder: 'https://linkedin.com/in/tu-perfil', bg: '#0A66C215' },
  { key: 'social_youtube', label: 'YouTube', icon: 'yt', color: '#FF0000', placeholder: 'https://youtube.com/@tu-canal', bg: '#FF000015' },
  { key: 'social_twitter', label: 'X / Twitter', icon: 'x', color: '#F0ECE3', placeholder: 'https://x.com/tu-usuario', bg: 'rgba(255,255,255,0.05)' },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('perfil')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Profile
  const [agent, setAgent] = useState<any>(null)
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)

  // Security
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')

  // Licensed states
  const [licensedStates, setLicensedStates] = useState<string[]>([])

  // Socials
  const [socials, setSocials] = useState<Record<string, string>>({})
  const [editingSocial, setEditingSocial] = useState<string | null>(null)

  // IA Config
  const [iaConfig, setIaConfig] = useState({ sophia_active: true, sophia_tone: 'amigable', work_hours_start: 9, work_hours_end: 21, welcome_message: '' })
  const [notifs, setNotifs] = useState({ notify_whatsapp: true, notify_email: false, score_alert_threshold: 70 })
  const [integrations, setIntegrations] = useState({ twilio: false, supabase: false, anthropic: false, stripe: false })

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    if (!user) return

    const { data: ag } = await supabase.from('agents').select('*').eq('id', user.id).single()
    if (ag) {
      setAgent(ag)
      setProfilePhoto(ag.profile_photo || null)
      setLicensedStates(ag.licensed_states || [])
      setSocials({
        social_facebook: ag.social_facebook || '',
        social_instagram: ag.social_instagram || '',
        social_tiktok: ag.social_tiktok || '',
        social_linkedin: ag.social_linkedin || '',
        social_youtube: ag.social_youtube || '',
        social_twitter: ag.social_twitter || '',
      })
    }

    const { data: config } = await supabase.from('agent_configs').select('*').eq('agent_id', user.id).limit(1).single()
    if (config) {
      setIaConfig({ sophia_active: config.sophia_active ?? true, sophia_tone: config.sophia_tone || 'amigable', work_hours_start: config.work_hours_start ?? 9, work_hours_end: config.work_hours_end ?? 21, welcome_message: config.welcome_message || '' })
      setNotifs({ notify_whatsapp: config.notify_whatsapp ?? true, notify_email: config.notify_email ?? false, score_alert_threshold: config.score_alert_threshold ?? 70 })
    }

    setIntegrations({ twilio: true, supabase: true, anthropic: true, stripe: false })
    setLoading(false)
  }

  async function saveProfile() {
    if (!user || !agent) return
    setSaving(true)
    await supabase.from('agents').update({
      name: agent.name, email: agent.email, phone: agent.phone,
      company_name: agent.company_name, agency_url: agent.agency_url,
      bio: agent.bio, profile_photo: profilePhoto,
      licensed_states: licensedStates,
      ...socials,
    }).eq('id', user.id)

    if (user.account_id && profilePhoto) {
      await supabase.from('accounts').update({ logo_url: profilePhoto }).eq('id', user.account_id)
    }

    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function saveIAConfig() {
    if (!user) return
    setSaving(true)
    const payload = { ...iaConfig, ...notifs, agent_id: user.id, updated_at: new Date().toISOString() }
    const { data: existing } = await supabase.from('agent_configs').select('id').eq('agent_id', user.id).limit(1).single()
    if (existing) await supabase.from('agent_configs').update(payload).eq('id', existing.id)
    else await supabase.from('agent_configs').insert(payload)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function changePassword() {
    if (newPassword.length < 6) { setPasswordMsg('Minimo 6 caracteres'); return }
    if (newPassword !== confirmPassword) { setPasswordMsg('Las contrasenas no coinciden'); return }
    setSaving(true); setPasswordMsg('')

    // Verify current password
    const { data: valid } = await supabase.rpc('check_password', { p_email: user?.email, p_password: currentPassword })
    if (!valid) { setPasswordMsg('Contrasena actual incorrecta'); setSaving(false); return }

    // Generate a reset token and use it to change password
    const { data: token } = await supabase.rpc('create_reset_token', { p_agent_id: user?.id })
    if (token) {
      await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: token, newPassword }),
      })
      setPasswordMsg('Contrasena actualizada correctamente')
    } else {
      setPasswordMsg('Error al cambiar contrasena. Intenta desde "Olvide mi contrasena".')
    }

    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    setSaving(false)
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setProfilePhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  function toggleState(st: string) {
    setLicensedStates(prev => prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st])
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'perfil', label: 'Perfil', icon: '👤' },
    { key: 'seguridad', label: 'Seguridad', icon: '🔒' },
    { key: 'licencias', label: 'Licencias', icon: '📋' },
    { key: 'redes', label: 'Redes', icon: '🔗' },
    { key: 'ia', label: 'Sophia IA', icon: '🤖' },
    { key: 'notificaciones', label: 'Alertas', icon: '🔔' },
    { key: 'integraciones', label: 'APIs', icon: '🔌' },
  ]

  const inp: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: '"Outfit",sans-serif', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,227,0.35)', marginBottom: '8px' }

  function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
      <div onClick={() => onChange(!value)} style={{
        width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
        background: value ? '#C9A84C' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'all 0.2s', flexShrink: 0,
      }}>
        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: value ? '#07080A' : 'rgba(255,255,255,0.4)', position: 'absolute', top: '3px', left: value ? '23px' : '3px', transition: 'all 0.2s' }} />
      </div>
    )
  }

  const initials = agent?.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'AG'

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative' }}>

        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>CONFIGURACION</p>
            <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Mi Perfil</h1>
          </div>
          <button onClick={tab === 'ia' || tab === 'notificaciones' ? saveIAConfig : saveProfile} disabled={saving} style={{
            padding: '10px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
            background: saved ? 'rgba(52,211,153,0.1)' : 'linear-gradient(135deg, #C9A84C, #A8893A)',
            color: saved ? '#34d399' : '#06070B', border: saved ? '1px solid rgba(52,211,153,0.3)' : 'none',
            cursor: 'pointer', boxShadow: saved ? 'none' : '0 4px 16px rgba(201,168,76,0.2)',
          }}>{saving ? 'Guardando...' : saved ? '&#10003; Guardado' : 'Guardar'}</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '9px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: tab === t.key ? 700 : 400,
              fontFamily: 'inherit', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
              background: tab === t.key ? 'rgba(201,168,76,0.08)' : 'transparent',
              color: tab === t.key ? '#C9A84C' : 'rgba(240,236,227,0.4)', transition: 'all 0.15s',
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {loading ? <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,227,0.3)' }}>Cargando...</div> : (
          <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '18px', padding: isMobile ? '24px 20px' : '32px' }}>

            {/* ═══ PERFIL ═══ */}
            {tab === 'perfil' && agent && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '560px' }}>
                {/* Avatar + photo upload */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <label style={{ cursor: 'pointer', position: 'relative' }}>
                    <div style={{
                      width: '80px', height: '80px', borderRadius: '20px', overflow: 'hidden',
                      background: profilePhoto ? 'none' : 'linear-gradient(135deg, #C9A84C, #8B6E2E)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '24px', fontWeight: 800, color: '#07080A',
                      boxShadow: '0 4px 20px rgba(201,168,76,0.3)',
                    }}>
                      {profilePhoto ? <img src={profilePhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                    </div>
                    <div style={{ position: 'absolute', bottom: -4, right: -4, width: '24px', height: '24px', borderRadius: '50%', background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>📷</div>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </label>
                  <div>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: '#F0ECE3', margin: 0 }}>{agent.name}</p>
                    <p style={{ fontSize: '12px', color: '#C9A84C', fontWeight: 600, margin: '2px 0 0', textTransform: 'capitalize' }}>{agent.role} · {agent.plan}</p>
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.25)', margin: '2px 0 0' }}>Toca la foto para cambiar</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                  <div><label style={lbl}>Nombre completo</label><input value={agent.name || ''} onChange={e => setAgent({ ...agent, name: e.target.value })} style={inp} /></div>
                  <div><label style={lbl}>Email</label><input type="email" value={agent.email || ''} onChange={e => setAgent({ ...agent, email: e.target.value })} style={inp} /></div>
                  <div><label style={lbl}>Telefono</label><input type="tel" value={agent.phone || ''} onChange={e => setAgent({ ...agent, phone: e.target.value })} style={inp} /></div>
                  <div><label style={lbl}>Nombre de agencia</label><input value={agent.company_name || ''} onChange={e => setAgent({ ...agent, company_name: e.target.value })} placeholder="Mi Agencia Insurance" style={inp} /></div>
                  <div style={{ gridColumn: isMobile ? undefined : '1 / -1' }}><label style={lbl}>Pagina web</label><input type="url" value={agent.agency_url || ''} onChange={e => setAgent({ ...agent, agency_url: e.target.value })} placeholder="https://miagencia.com" style={inp} /></div>
                  <div style={{ gridColumn: isMobile ? undefined : '1 / -1' }}><label style={lbl}>Bio / Descripcion</label><textarea value={agent.bio || ''} onChange={e => setAgent({ ...agent, bio: e.target.value })} placeholder="Agente con 10+ anos de experiencia en seguros de vida y salud..." rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
                </div>
              </div>
            )}

            {/* ═══ SEGURIDAD ═══ */}
            {tab === 'seguridad' && (
              <div style={{ maxWidth: '440px' }}>
                <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '20px', color: '#F0ECE3', margin: '0 0 20px' }}>Cambiar contrasena</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div><label style={lbl}>Contrasena actual</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Nueva contrasena</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimo 6 caracteres" style={inp} /></div>
                  <div><label style={lbl}>Confirmar contrasena</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inp} /></div>
                  {passwordMsg && <p style={{ fontSize: '13px', color: passwordMsg.includes('incorrecta') || passwordMsg.includes('coinciden') ? '#fca5a5' : '#C9A84C', textAlign: 'center' }}>{passwordMsg}</p>}
                  <button onClick={changePassword} style={{ padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', color: '#06070B', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cambiar contrasena</button>
                </div>

                <div style={{ marginTop: '32px', padding: '16px', borderRadius: '12px', background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.15)' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', margin: '0 0 8px' }}>Autenticacion de dos factores (2FA)</p>
                  <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: '0 0 12px' }}>Agrega una capa extra de seguridad con Google Authenticator o Authy</p>
                  <a href="/settings" style={{ fontSize: '12px', color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}>Configurar 2FA &rarr;</a>
                </div>
              </div>
            )}

            {/* ═══ LICENCIAS ═══ */}
            {tab === 'licencias' && (
              <div>
                <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '20px', color: '#F0ECE3', margin: '0 0 6px' }}>Estados con licencia</h3>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '20px' }}>Selecciona los estados donde tienes licencia activa. Esto se guarda en tu cuenta y en las sub-cuentas.</p>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 700 }}>{licensedStates.length} estados seleccionados</span>
                  {licensedStates.length > 0 && (
                    <button onClick={() => setLicensedStates([])} style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Limpiar</button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 5 : 10}, 1fr)`, gap: '6px' }}>
                  {US_STATES.map(st => {
                    const selected = licensedStates.includes(st)
                    return (
                      <div key={st} onClick={() => toggleState(st)} style={{
                        padding: '8px 4px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer',
                        background: selected ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${selected ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.05)'}`,
                        fontSize: '12px', fontWeight: selected ? 700 : 400,
                        color: selected ? '#34d399' : 'rgba(240,236,227,0.4)', transition: 'all 0.15s',
                      }}>{st}</div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ═══ REDES SOCIALES ═══ */}
            {tab === 'redes' && (
              <div style={{ maxWidth: '560px' }}>
                <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '20px', color: '#F0ECE3', margin: '0 0 6px' }}>Redes sociales</h3>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '24px' }}>Conecta tus redes para que aparezcan en tu perfil y landing pages</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {SOCIAL_PLATFORMS.map(p => {
                    const value = socials[p.key] || ''
                    const isEditing = editingSocial === p.key
                    const isConnected = !!value.trim()

                    return (
                      <div key={p.key} style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                        borderRadius: '14px', background: isConnected ? p.bg : 'rgba(255,255,255,0.015)',
                        border: `1px solid ${isConnected ? p.color + '30' : 'rgba(255,255,255,0.05)'}`,
                        transition: 'all 0.2s',
                      }}>
                        {/* Icon */}
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                          background: `${p.color}15`, border: `1px solid ${p.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px', fontWeight: 800, color: p.color,
                        }}>{p.icon}</div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: isConnected ? p.color : 'rgba(240,236,227,0.5)', margin: 0 }}>{p.label}</p>
                          {isEditing ? (
                            <input value={value} onChange={e => setSocials({ ...socials, [p.key]: e.target.value })}
                              onBlur={() => setEditingSocial(null)} onKeyDown={e => e.key === 'Enter' && setEditingSocial(null)}
                              placeholder={p.placeholder} autoFocus
                              style={{ width: '100%', padding: '6px 0', fontSize: '12px', background: 'none', border: 'none', borderBottom: `1px solid ${p.color}40`, color: '#F0ECE3', outline: 'none', fontFamily: 'inherit' }} />
                          ) : (
                            <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.3)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {value || 'No conectado'}
                            </p>
                          )}
                        </div>

                        {/* Action button */}
                        {isConnected && !isEditing ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => window.open(value, '_blank')} title="Abrir" style={{
                              width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer',
                              background: `${p.color}20`, border: 'none', color: p.color, fontSize: '14px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>&#8599;</button>
                            <button onClick={() => setEditingSocial(p.key)} title="Editar" style={{
                              width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer',
                              background: 'rgba(255,255,255,0.04)', border: 'none', color: 'rgba(240,236,227,0.4)', fontSize: '12px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>&#9998;</button>
                          </div>
                        ) : !isEditing ? (
                          <button onClick={() => setEditingSocial(p.key)} style={{
                            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                            background: `${p.color}15`, border: `1px solid ${p.color}25`,
                            color: p.color, fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                          }}>+ Conectar</button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ═══ SOPHIA IA ═══ */}
            {tab === 'ia' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '520px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div><p style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600, margin: 0 }}>Sophia activa</p><p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '12px', margin: '4px 0 0' }}>Responde automaticamente por WhatsApp</p></div>
                  <Toggle value={iaConfig.sophia_active} onChange={v => setIaConfig({ ...iaConfig, sophia_active: v })} />
                </div>
                <div>
                  <label style={lbl}>Tono de Sophia</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['formal', 'casual', 'amigable'].map(tone => (
                      <button key={tone} onClick={() => setIaConfig({ ...iaConfig, sophia_tone: tone })} style={{
                        flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px',
                        fontWeight: iaConfig.sophia_tone === tone ? 700 : 400, textTransform: 'capitalize',
                        background: iaConfig.sophia_tone === tone ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
                        color: iaConfig.sophia_tone === tone ? '#C9A84C' : 'rgba(240,236,227,0.4)',
                        border: iaConfig.sophia_tone === tone ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      }}>{tone}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}><label style={lbl}>Hora inicio</label><select value={iaConfig.work_hours_start} onChange={e => setIaConfig({ ...iaConfig, work_hours_start: +e.target.value })} style={inp}>{Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}</select></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Hora fin</label><select value={iaConfig.work_hours_end} onChange={e => setIaConfig({ ...iaConfig, work_hours_end: +e.target.value })} style={inp}>{Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}</select></div>
                </div>
                <div><label style={lbl}>Mensaje de bienvenida</label><textarea value={iaConfig.welcome_message} onChange={e => setIaConfig({ ...iaConfig, welcome_message: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
              </div>
            )}

            {/* ═══ ALERTAS ═══ */}
            {tab === 'notificaciones' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '520px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div><p style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600, margin: 0 }}>WhatsApp</p><p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '12px', margin: '4px 0 0' }}>Leads listos para comprar</p></div>
                  <Toggle value={notifs.notify_whatsapp} onChange={v => setNotifs({ ...notifs, notify_whatsapp: v })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div><p style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600, margin: 0 }}>Email</p><p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '12px', margin: '4px 0 0' }}>Resumen diario</p></div>
                  <Toggle value={notifs.notify_email} onChange={v => setNotifs({ ...notifs, notify_email: v })} />
                </div>
                <div>
                  <label style={lbl}>Umbral de score para alerta</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <input type="range" min={30} max={100} step={5} value={notifs.score_alert_threshold} onChange={e => setNotifs({ ...notifs, score_alert_threshold: +e.target.value })} style={{ flex: 1, accentColor: '#C9A84C' }} />
                    <span style={{ color: '#C9A84C', fontSize: '20px', fontWeight: 800, minWidth: '40px', textAlign: 'center' }}>{notifs.score_alert_threshold}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ INTEGRACIONES ═══ */}
            {tab === 'integraciones' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '520px' }}>
                {[
                  { name: 'Twilio (WhatsApp)', icon: '📱', connected: true, desc: 'Mensajes WhatsApp' },
                  { name: 'Supabase', icon: '🗄️', connected: true, desc: 'Base de datos' },
                  { name: 'Claude (Anthropic)', icon: '🤖', connected: true, desc: 'Sophia IA' },
                  { name: 'Stripe', icon: '💳', connected: false, desc: 'Pagos' },
                  { name: 'OpenAI Whisper', icon: '🎤', connected: true, desc: 'Audio a texto' },
                ].map(i => (
                  <div key={i.name} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '22px' }}>{i.icon}</span>
                    <div style={{ flex: 1 }}><p style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600, margin: 0 }}>{i.name}</p><p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '12px', margin: '2px 0 0' }}>{i.desc}</p></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: i.connected ? '#34d399' : '#f87171', boxShadow: `0 0 8px ${i.connected ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)'}` }} />
                      <span style={{ color: i.connected ? '#34d399' : '#f87171', fontSize: '12px', fontWeight: 600 }}>{i.connected ? 'OK' : 'Off'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
