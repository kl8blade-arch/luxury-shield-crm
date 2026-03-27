'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

/*
  SQL para tabla agent_configs (ejecutar en Supabase si no existe):

  CREATE TABLE IF NOT EXISTS agent_configs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    agent_id uuid REFERENCES agents(id),
    sophia_active boolean DEFAULT true,
    sophia_tone text DEFAULT 'amigable',
    work_hours_start integer DEFAULT 9,
    work_hours_end integer DEFAULT 21,
    welcome_message text DEFAULT 'Hola, soy Sophia de Luxury Shield Insurance 😊 ¿En qué puedo ayudarte?',
    notify_whatsapp boolean DEFAULT true,
    notify_email boolean DEFAULT false,
    score_alert_threshold integer DEFAULT 70
  );
*/

type Tab = 'perfil' | 'ia' | 'notificaciones' | 'integraciones'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('perfil')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Profile
  const [profile, setProfile] = useState({ name: 'Carlos Silva', email: 'kl8blade@gmail.com', phone: '+17869435656' })

  // IA Config
  const [iaConfig, setIaConfig] = useState({
    sophia_active: true,
    sophia_tone: 'amigable',
    work_hours_start: 9,
    work_hours_end: 21,
    welcome_message: 'Hola, soy Sophia de Luxury Shield Insurance 😊 ¿En qué puedo ayudarte?',
  })

  // Notifications
  const [notifs, setNotifs] = useState({
    notify_whatsapp: true,
    notify_email: false,
    score_alert_threshold: 70,
  })

  // Integration status
  const [integrations, setIntegrations] = useState({
    twilio: false, supabase: false, anthropic: false, stripe: false,
  })

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    setLoading(true)

    // Load config
    const { data: config } = await supabase.from('agent_configs').select('*').limit(1).single()
    if (config) {
      setIaConfig({
        sophia_active: config.sophia_active ?? true,
        sophia_tone: config.sophia_tone || 'amigable',
        work_hours_start: config.work_hours_start ?? 9,
        work_hours_end: config.work_hours_end ?? 21,
        welcome_message: config.welcome_message || '',
      })
      setNotifs({
        notify_whatsapp: config.notify_whatsapp ?? true,
        notify_email: config.notify_email ?? false,
        score_alert_threshold: config.score_alert_threshold ?? 70,
      })
    }

    // Check integrations
    const [twilioOk, supaOk] = await Promise.all([
      fetch('/api/whatsapp').then(r => r.ok).catch(() => false),
      supabase.from('leads').select('id', { count: 'exact', head: true }).then(r => !r.error),
    ])
    setIntegrations({ twilio: twilioOk, supabase: supaOk, anthropic: true, stripe: false })

    setLoading(false)
  }

  async function saveConfig() {
    setSaving(true)
    const payload = { ...iaConfig, ...notifs, updated_at: new Date().toISOString() }

    const { data: existing } = await supabase.from('agent_configs').select('id').limit(1).single()
    if (existing) {
      await supabase.from('agent_configs').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('agent_configs').insert(payload)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'perfil', label: 'Perfil', icon: '👤' },
    { key: 'ia', label: 'Agente IA', icon: '🤖' },
    { key: 'notificaciones', label: 'Notificaciones', icon: '🔔' },
    { key: 'integraciones', label: 'Integraciones', icon: '🔌' },
  ]

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: '10px', fontSize: '13px',
    background: C.surface2, border: `1px solid ${C.border}`, color: C.text,
    outline: 'none', fontFamily: C.font,
  }

  const labelStyle = { color: C.textDim, fontSize: '12px', fontWeight: 600 as const, marginBottom: '6px', display: 'block' }

  function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
      <div onClick={() => onChange(!value)} style={{
        width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
        background: value ? '#C9A84C' : 'rgba(255,255,255,0.1)',
        border: `1px solid ${value ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.1)'}`,
        position: 'relative', transition: 'all 0.2s', flexShrink: 0,
      }}>
        <div style={{
          width: '18px', height: '18px', borderRadius: '50%',
          background: value ? '#07080A' : 'rgba(255,255,255,0.4)',
          position: 'absolute', top: '2px', left: value ? '22px' : '2px',
          transition: 'all 0.2s',
        }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Configuración</h1>
          <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '4px' }}>Personaliza tu CRM y agente IA</p>
        </div>
        <button onClick={saveConfig} disabled={saving} style={{
          background: saved ? 'rgba(52,211,153,0.15)' : 'linear-gradient(135deg, #C9A84C, #8B6E2E)',
          color: saved ? '#34d399' : '#07080A',
          border: saved ? '1px solid rgba(52,211,153,0.3)' : 'none',
          borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 700,
          cursor: 'pointer', fontFamily: C.font, transition: 'all 0.2s',
        }}>{saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: C.surface, borderRadius: '12px', padding: '4px', border: `1px solid ${C.border}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '10px 16px', borderRadius: '10px', cursor: 'pointer',
            fontFamily: C.font, fontSize: '13px', fontWeight: tab === t.key ? 700 : 400,
            background: tab === t.key ? 'rgba(201,168,76,0.1)' : 'transparent',
            color: tab === t.key ? C.gold : C.textDim,
            border: tab === t.key ? '1px solid rgba(201,168,76,0.22)' : '1px solid transparent',
            transition: 'all 0.15s',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted }}>Cargando...</div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '28px' }}>

          {/* ── Tab: Perfil ── */}
          {tab === 'perfil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '480px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #C9A84C, #8B6E2E)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', fontWeight: 800, color: '#07080A',
                  boxShadow: '0 4px 16px rgba(201,168,76,0.3)',
                }}>CS</div>
                <div>
                  <p style={{ color: C.text, fontSize: '16px', fontWeight: 700, margin: 0 }}>{profile.name}</p>
                  <p style={{ color: C.gold, fontSize: '12px', fontWeight: 600, margin: '2px 0 0' }}>Admin · Elite</p>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Nombre</label>
                <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Teléfono</label>
                <input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} style={inputStyle} />
              </div>
            </div>
          )}

          {/* ── Tab: Agente IA ── */}
          {tab === 'ia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '520px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: C.text, fontSize: '14px', fontWeight: 600, margin: 0 }}>Sophia activa</p>
                  <p style={{ color: C.textMuted, fontSize: '12px', margin: '4px 0 0' }}>Responde automáticamente por WhatsApp</p>
                </div>
                <Toggle value={iaConfig.sophia_active} onChange={v => setIaConfig({ ...iaConfig, sophia_active: v })} />
              </div>

              <div>
                <label style={labelStyle}>Tono de Sophia</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['formal', 'casual', 'amigable'].map(tone => (
                    <button key={tone} onClick={() => setIaConfig({ ...iaConfig, sophia_tone: tone })} style={{
                      flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                      fontFamily: C.font, fontSize: '13px', fontWeight: iaConfig.sophia_tone === tone ? 700 : 400,
                      textTransform: 'capitalize',
                      background: iaConfig.sophia_tone === tone ? 'rgba(201,168,76,0.1)' : C.surface2,
                      color: iaConfig.sophia_tone === tone ? C.gold : C.textDim,
                      border: iaConfig.sophia_tone === tone ? '1px solid rgba(201,168,76,0.3)' : `1px solid ${C.border}`,
                    }}>{tone}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Hora inicio</label>
                  <select value={iaConfig.work_hours_start} onChange={e => setIaConfig({ ...iaConfig, work_hours_start: +e.target.value })} style={inputStyle}>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Hora fin</label>
                  <select value={iaConfig.work_hours_end} onChange={e => setIaConfig({ ...iaConfig, work_hours_end: +e.target.value })} style={inputStyle}>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Mensaje de bienvenida personalizado</label>
                <textarea
                  value={iaConfig.welcome_message}
                  onChange={e => setIaConfig({ ...iaConfig, welcome_message: e.target.value })}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' as const }}
                />
              </div>
            </div>
          )}

          {/* ── Tab: Notificaciones ── */}
          {tab === 'notificaciones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '520px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: C.text, fontSize: '14px', fontWeight: 600, margin: 0 }}>Alertas por WhatsApp</p>
                  <p style={{ color: C.textMuted, fontSize: '12px', margin: '4px 0 0' }}>Recibe notificaciones de leads listos para comprar</p>
                </div>
                <Toggle value={notifs.notify_whatsapp} onChange={v => setNotifs({ ...notifs, notify_whatsapp: v })} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: C.text, fontSize: '14px', fontWeight: 600, margin: 0 }}>Alertas por Email</p>
                  <p style={{ color: C.textMuted, fontSize: '12px', margin: '4px 0 0' }}>Resumen diario de actividad</p>
                </div>
                <Toggle value={notifs.notify_email} onChange={v => setNotifs({ ...notifs, notify_email: v })} />
              </div>

              <div>
                <label style={labelStyle}>Umbral de score para alerta</label>
                <p style={{ color: C.textMuted, fontSize: '11px', margin: '0 0 8px' }}>Notificar cuando un lead alcance este score</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <input
                    type="range" min={30} max={100} step={5}
                    value={notifs.score_alert_threshold}
                    onChange={e => setNotifs({ ...notifs, score_alert_threshold: +e.target.value })}
                    style={{ flex: 1, accentColor: '#C9A84C' }}
                  />
                  <span style={{
                    color: C.gold, fontSize: '18px', fontWeight: 800, minWidth: '40px', textAlign: 'center',
                  }}>{notifs.score_alert_threshold}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Integraciones ── */}
          {tab === 'integraciones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px' }}>
              {[
                { name: 'Twilio (WhatsApp)', icon: '📱', connected: integrations.twilio, desc: 'Envío y recepción de mensajes WhatsApp' },
                { name: 'Supabase', icon: '🗄️', connected: integrations.supabase, desc: 'Base de datos y autenticación' },
                { name: 'Anthropic API (Claude)', icon: '🤖', connected: integrations.anthropic, desc: 'Agente IA Sophia powered by Claude' },
                { name: 'Stripe', icon: '💳', connected: integrations.stripe, desc: 'Procesamiento de pagos' },
              ].map(int => (
                <div key={int.name} style={{
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px',
                  background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '12px',
                }}>
                  <span style={{ fontSize: '20px' }}>{int.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: C.text, fontSize: '14px', fontWeight: 600, margin: 0 }}>{int.name}</p>
                    <p style={{ color: C.textMuted, fontSize: '12px', margin: '2px 0 0' }}>{int.desc}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: int.connected ? '#34d399' : '#f87171',
                      boxShadow: int.connected ? '0 0 8px rgba(52,211,153,0.5)' : '0 0 8px rgba(248,113,113,0.5)',
                    }} />
                    <span style={{
                      color: int.connected ? '#34d399' : '#f87171',
                      fontSize: '12px', fontWeight: 600,
                    }}>{int.connected ? 'Conectado' : 'Desconectado'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
