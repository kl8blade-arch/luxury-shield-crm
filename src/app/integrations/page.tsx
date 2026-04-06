'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function IntegrationsPage() {
  const { user } = useAuth()
  const [copied, setCopied] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://luxury-shield-crm.vercel.app'
  const apiKey = user ? `lscrm_${user.account_id?.substring(0, 8) || 'master'}_${user.id.substring(0, 12)}` : 'cargando...'

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const CopyBtn = ({ text, label }: { text: string; label: string }) => (
    <button onClick={() => copy(text, label)} style={{ padding: '6px 14px', borderRadius: '8px', background: copied === label ? 'rgba(52,211,153,0.1)' : 'rgba(201,168,76,0.08)', border: `1px solid ${copied === label ? 'rgba(52,211,153,0.3)' : 'rgba(201,168,76,0.2)'}`, color: copied === label ? '#34d399' : '#C9A84C', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
      {copied === label ? 'Copiado!' : 'Copiar'}
    </button>
  )

  const CodeBlock = ({ code, label }: { code: string; label: string }) => (
    <div style={{ position: 'relative', marginTop: '8px' }}>
      <pre style={{ padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '12px', color: '#60a5fa', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>{code}</pre>
      <div style={{ position: 'absolute', top: '8px', right: '8px' }}><CopyBtn text={code} label={label} /></div>
    </div>
  )

  const metaWebhookUrl = `${baseUrl}/api/webhooks/meta`
  const googleWebhookUrl = `${baseUrl}/api/webhooks/google`
  const universalWebhookUrl = `${baseUrl}/api/v1/webhooks/inbound`

  const INTEGRATIONS = [
    {
      key: 'meta',
      name: 'Meta Lead Ads',
      desc: 'Facebook e Instagram — recibe leads automaticamente cuando alguien llena tu formulario',
      icon: 'f',
      color: '#1877F2',
      steps: [
        { title: 'Crea tu formulario de Lead Ads en Meta Business Suite', desc: 'Ads Manager → Crear campana → Lead Generation → Crea tu formulario con los campos: nombre, telefono, email' },
        { title: 'Configura el webhook en Meta', desc: 'Ve a developers.facebook.com → Tu App → Webhooks → Page → leadgen' },
        { title: 'URL del Webhook', code: metaWebhookUrl, copyLabel: 'meta-url' },
        { title: 'Verify Token', code: 'luxuryshield_meta_verify_2026', copyLabel: 'meta-token' },
        { title: 'Suscribete al evento "leadgen"', desc: 'Selecciona el campo "leadgen" y haz click en "Subscribe"' },
        { title: 'Agrega META_ACCESS_TOKEN en Vercel', desc: 'Copia el Page Access Token de tu pagina de Facebook y agregalo en Vercel → Settings → Environment Variables → META_ACCESS_TOKEN' },
      ],
    },
    {
      key: 'google',
      name: 'Google Ads',
      desc: 'Recibe leads de formularios de Google Ads directamente en tu CRM',
      icon: 'G',
      color: '#4285F4',
      steps: [
        { title: 'Crea tu campana con Lead Form Extension', desc: 'Google Ads → Campana → Assets → Lead Form → Configura campos: nombre, telefono, email' },
        { title: 'Configura el webhook de entrega', desc: 'En la configuracion del Lead Form, selecciona "Webhook" como metodo de entrega' },
        { title: 'URL del Webhook', code: googleWebhookUrl, copyLabel: 'google-url' },
        { title: 'Agrega este header', code: `x-api-key: ${apiKey}`, copyLabel: 'google-key' },
        { title: 'Listo!', desc: 'Cada lead que llene tu formulario llegara al CRM automaticamente con source "google_ads"' },
      ],
    },
    {
      key: 'zapier',
      name: 'Zapier',
      desc: 'Conecta 6,000+ apps — envia leads desde cualquier fuente a tu CRM',
      icon: 'Z',
      color: '#FF4A00',
      steps: [
        { title: 'Crea un Zap con accion "Webhooks by Zapier"', desc: 'Trigger: tu plataforma (Facebook, Typeform, etc.) → Action: Webhooks by Zapier → POST' },
        { title: 'URL del Webhook', code: universalWebhookUrl, copyLabel: 'zapier-url' },
        { title: 'Headers', code: `x-api-key: ${apiKey}\nContent-Type: application/json`, copyLabel: 'zapier-headers' },
        { title: 'Body (JSON)', code: `{\n  "name": "{{nombre}}",\n  "phone": "{{telefono}}",\n  "email": "{{email}}",\n  "state": "{{estado}}",\n  "source": "zapier",\n  "campaign": "{{nombre_campana}}"\n}`, copyLabel: 'zapier-body' },
      ],
    },
    {
      key: 'make',
      name: 'Make (Integromat)',
      desc: 'Automatizacion avanzada — conecta Meta, Google, CRMs, y mas',
      icon: 'M',
      color: '#6D00CC',
      steps: [
        { title: 'Agrega un modulo HTTP "Make a request"', desc: 'URL, Method POST, Headers, Body type JSON' },
        { title: 'URL', code: universalWebhookUrl, copyLabel: 'make-url' },
        { title: 'Headers', code: `x-api-key: ${apiKey}`, copyLabel: 'make-key' },
        { title: 'Body', code: `{\n  "name": "{{name}}",\n  "phone": "{{phone}}",\n  "email": "{{email}}",\n  "source": "make"\n}`, copyLabel: 'make-body' },
      ],
    },
    {
      key: 'manual',
      name: 'API Directa',
      desc: 'Para desarrolladores — envia leads desde cualquier sistema via HTTP POST',
      icon: '</>',
      color: '#22c55e',
      steps: [
        { title: 'Endpoint', code: universalWebhookUrl, copyLabel: 'api-url' },
        { title: 'Ejemplo cURL', code: `curl -X POST ${universalWebhookUrl} \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: ${apiKey}" \\\n  -d '{"name":"Juan","phone":"+17865551234","email":"juan@email.com","state":"FL","source":"mi_app"}'`, copyLabel: 'api-curl' },
        { title: 'Campos soportados', code: `name (requerido)\nphone\nemail\nstate, city\nproduct / insurance_type\nsource / platform\ncampaign\nnotes\ncustom_fields: { any: "data" }`, copyLabel: 'api-fields' },
      ],
    },
  ]

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif' }}>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(96,165,250,0.6)', marginBottom: '6px' }}>INTEGRACIONES</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Conectar Campanas</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Recibe leads de Meta, Google Ads, Zapier, Make y cualquier plataforma directamente en tu CRM</p>
        </div>

        {/* API Key */}
        <div style={{ padding: '16px 20px', borderRadius: '14px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.1em', margin: '0 0 4px' }}>TU API KEY</p>
            <code style={{ fontSize: '13px', color: '#F0ECE3', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '6px' }}>{apiKey}</code>
          </div>
          <CopyBtn text={apiKey} label="api-key" />
        </div>

        {/* Status indicators */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { label: 'Meta Webhook', url: metaWebhookUrl, color: '#1877F2' },
            { label: 'Google Webhook', url: googleWebhookUrl, color: '#4285F4' },
            { label: 'API Universal', url: universalWebhookUrl, color: '#22c55e' },
          ].map(w => (
            <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 4px rgba(52,211,153,0.5)' }} />
              <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.5)', fontWeight: 500 }}>{w.label}</span>
              <span style={{ fontSize: '10px', color: '#34d399' }}>Activo</span>
            </div>
          ))}
        </div>

        {/* Integration cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {INTEGRATIONS.map(integ => {
            const isExpanded = expandedGuide === integ.key
            return (
              <div key={integ.key} style={{
                borderRadius: '18px',
                background: isExpanded ? `${integ.color}04` : 'rgba(255,255,255,0.015)',
                border: `1px solid ${isExpanded ? integ.color + '25' : 'rgba(255,255,255,0.05)'}`,
                overflow: 'hidden', transition: 'all 0.2s',
              }}>
                {/* Header */}
                <div onClick={() => setExpandedGuide(isExpanded ? null : integ.key)} style={{
                  padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px',
                }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                    background: `${integ.color}15`, border: `1px solid ${integ.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: integ.icon.length > 2 ? '14px' : '18px', fontWeight: 800, color: integ.color,
                  }}>{integ.icon}</div>

                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F0ECE3', margin: '0 0 2px' }}>{integ.name}</h3>
                    <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: 0 }}>{integ.desc}</p>
                  </div>

                  <span style={{ fontSize: '20px', color: 'rgba(240,236,227,0.3)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>v</span>
                </div>

                {/* Steps */}
                {isExpanded && (
                  <div style={{ padding: '0 24px 24px' }}>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '20px' }} />

                    {integ.steps.map((step, i) => (
                      <div key={i} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                            background: `${integ.color}15`, border: `1px solid ${integ.color}25`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 700, color: integ.color,
                          }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#F0ECE3', margin: '0 0 4px' }}>{step.title}</p>
                            {step.desc && <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: 0, lineHeight: 1.5 }}>{step.desc}</p>}
                            {step.code && <CodeBlock code={step.code} label={step.copyLabel || `step-${i}`} />}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Test button for Meta/Google */}
                    {(integ.key === 'meta' || integ.key === 'google') && (
                      <div style={{ marginTop: '8px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)' }}>
                        <p style={{ fontSize: '11px', color: '#34d399', fontWeight: 600, margin: '0 0 4px' }}>Como verificar que funciona</p>
                        <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: 0, lineHeight: 1.5 }}>
                          {integ.key === 'meta'
                            ? 'Despues de configurar, ve a tu formulario de Lead Ads → "Test" → llena el formulario. El lead deberia aparecer en tu CRM en segundos.'
                            : 'Publica tu campana → cuando alguien llene el formulario, el lead aparecera automaticamente en "Mis Leads" con source "google_ads".'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Help section */}
        <div style={{ marginTop: '28px', padding: '20px 24px', borderRadius: '16px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#F0ECE3', margin: '0 0 8px' }}>Necesitas ayuda?</h3>
          <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: 0, lineHeight: 1.6 }}>
            Si necesitas asistencia configurando tus integraciones, enviame un mensaje por WhatsApp y Sophia te guiara paso a paso.
            Tambien puedes usar Zapier o Make como intermediario si prefieres una configuracion sin codigo.
          </p>
        </div>
      </div>
    </>
  )
}
