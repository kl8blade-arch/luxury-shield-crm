'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const T = {
  bg: '#0d0820', panel: 'rgba(255,255,255,0.05)',
  border: 'rgba(149,76,233,0.18)', text: '#f0eaff',
  muted: 'rgba(200,180,255,0.45)', accent: '#9B59B6',
  green: '#00E5A0', red: '#FF4757', gold: '#FFB930',
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [config, setConfig]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [form, setForm] = useState({
    ai_agent_name:      '',
    notification_phone: '',
    notif_whatsapp:     true,
    notif_email:        false,
    custom_prompt:      '',
    main_language:      'es',
  })

  const fetchConfig = useCallback(async () => {
    if (!user?.id) return
    try {
      const r = await fetch(`/api/dashboard/settings?agentId=${user.id}`)
      if (!r.ok) return
      const { data } = await r.json()
      setConfig(data)
      setForm({
        ai_agent_name:      data.ai_agent_name      ?? 'Sophia',
        notification_phone: data.notification_phone ?? '',
        notif_whatsapp:     data.notif_whatsapp     ?? true,
        notif_email:        data.notif_email         ?? false,
        custom_prompt:      data.custom_prompt       ?? '',
        main_language:      data.main_language       ?? 'es',
      })
    } catch {}
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const save = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: user.id, ...form }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 32 }}>⚙️</div><div>Cargando configuración...</div></div>
    </div>
  )

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'SF Pro Display',system-ui,sans-serif", color: T.text, padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>⚙️ Configuración</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Personaliza cómo funciona Sophia para tu agencia</div>
      </div>

      {[
        {
          title: '🤖 Agente IA',
          fields: [
            { label: 'Nombre de Sophia', key: 'ai_agent_name', type: 'text', placeholder: 'Sophia de SeguriSSimo' },
            { label: 'Idioma principal', key: 'main_language', type: 'select', options: [{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }, { value: 'both', label: 'Español + English' }] },
          ]
        },
        {
          title: '🔔 Notificaciones de Lead Caliente',
          fields: [
            { label: 'Teléfono WhatsApp para alertas', key: 'notification_phone', type: 'text', placeholder: '+17725551234' },
            { label: 'Notificar por WhatsApp', key: 'notif_whatsapp', type: 'toggle' },
            { label: 'Notificar por Email', key: 'notif_email', type: 'toggle' },
          ]
        },
        {
          title: '📝 Instrucción Personalizada',
          fields: [
            { label: 'Instrucción adicional para Sophia', key: 'custom_prompt', type: 'textarea', placeholder: 'Ej: Siempre pregunta por el nombre del esposo/a antes de cotizar...' },
          ]
        },
      ].map((section, si) => (
        <div key={si} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 16 }}>{section.title}</div>
          {section.fields.map((field: any, fi) => (
            <div key={fi} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600 }}>{field.label}</div>
              {field.type === 'text' && (
                <input value={(form as any)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  style={{ width: '100%', padding: '9px 14px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              )}
              {field.type === 'select' && (
                <select value={(form as any)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  style={{ width: '100%', padding: '9px 14px', background: '#1a0f35', border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit' }}>
                  {field.options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {field.type === 'toggle' && (
                <button onClick={() => setForm(f => ({ ...f, [field.key]: !(f as any)[field.key] }))}
                  style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: (form as any)[field.key] ? T.green : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 3, left: (form as any)[field.key] ? 25 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left 0.2s' }}/>
                </button>
              )}
              {field.type === 'textarea' && (
                <textarea value={(form as any)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder} rows={4}
                  style={{ width: '100%', padding: '9px 14px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.text, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
              )}
            </div>
          ))}
        </div>
      ))}

      <button onClick={save} disabled={saving}
        style={{ width: '100%', padding: '14px', background: saved ? `${T.green}20` : `${T.accent}25`, border: `1px solid ${saved ? T.green : T.accent}`, borderRadius: 12, fontSize: 14, fontWeight: 800, color: saved ? T.green : T.accent, cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
        {saving ? 'Guardando...' : saved ? '✅ Guardado' : '💾 Guardar cambios'}
      </button>

      {config && (
        <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Info de la cuenta</div>
          {[
            { label: 'Plan', val: config.plan ?? 'Starter' },
            { label: 'Número WhatsApp', val: config.whatsapp_number ?? '—' },
            { label: 'IA activa', val: config.ia_active ? 'Sí ✅' : 'No ❌' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 2 ? `1px solid ${T.border}` : 'none' }}>
              <span style={{ fontSize: 12, color: T.muted }}>{row.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{row.val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
