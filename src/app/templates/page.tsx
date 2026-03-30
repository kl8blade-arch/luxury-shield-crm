'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'
import { Template } from '@/types'

const CHANNEL_ICON: Record<string, string> = { whatsapp: '💬', sms: '📱', email: '📧', call: '📞' }
const STAGE_LABEL: Record<string, string> = { first_contact: 'Primer contacto', followup: 'Seguimiento', objection: 'Objeción', closing: 'Cierre', post_sale: 'Post-venta' }
const STAGE_FILTERS = [{ value: 'all', label: 'Todas' }, ...Object.entries(STAGE_LABEL).map(([v, l]) => ({ value: v, label: l }))]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [filter, setFilter] = useState('all')
  const [copied, setCopied] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('templates').select('*').eq('active', true).order('name')
      .then(({ data }) => { setTemplates(data || []); setLoading(false) })
  }, [])

  const filtered = filter === 'all' ? templates : templates.filter(t => t.stage === filter)

  async function copy(t: Template) {
    await navigator.clipboard.writeText(t.message)
    await supabase.from('templates').update({ use_count: t.use_count + 1 }).eq('id', t.id)
    setCopied(t.id); setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ color: C.text, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>Plantillas</h1>
          <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '5px' }}>{filtered.length} plantilla{filtered.length !== 1 ? 's' : ''} · Copia y pega en WhatsApp</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {STAGE_FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              style={{ padding: '7px 14px', borderRadius: '10px', border: filter === f.value ? '1px solid rgba(201,168,76,0.3)' : `1px solid ${C.border}`, background: filter === f.value ? 'rgba(201,168,76,0.1)' : 'transparent', color: filter === f.value ? C.goldBright : C.textMuted, fontSize: '12px', fontWeight: filter === f.value ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: C.textMuted }}>Cargando plantillas...</div>
        ) : filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '72px' }}>
            <div style={{ fontSize: '36px', marginBottom: '14px', opacity: 0.5 }}>💬</div>
            <p style={{ color: C.text, fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Sin plantillas</p>
            <p style={{ color: C.textMuted, fontSize: '13px' }}>No hay plantillas para este filtro.</p>
          </div>
        ) : filtered.map(t => {
          const isCopied = copied === t.id
          return (
            <div key={t.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.borderMd}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.border}
            >
              {/* Card header */}
              <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: C.text, fontSize: '14px', fontWeight: 700, margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600, color: C.textMuted, background: C.surface2, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: '100px' }}>
                      {CHANNEL_ICON[t.channel]} {t.channel}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: C.gold, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', padding: '2px 8px', borderRadius: '100px' }}>
                      {STAGE_LABEL[t.stage] || t.stage}
                    </span>
                    {t.insurance_type && (
                      <span style={{ fontSize: '10px', color: C.textMuted, background: C.surface2, border: `1px solid ${C.border}`, padding: '2px 8px', borderRadius: '100px' }}>
                        {t.insurance_type}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => copy(t)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', cursor: 'pointer', flexShrink: 0, border: isCopied ? '1px solid rgba(52,211,153,0.3)' : `1px solid ${C.border}`, background: isCopied ? 'rgba(52,211,153,0.1)' : C.surface2, color: isCopied ? '#34d399' : C.textDim, fontSize: '12px', fontWeight: 600, transition: 'all 0.2s' }}>
                  {isCopied ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>

              {/* Message */}
              <div style={{ padding: '14px 18px 16px' }}>
                <p style={{ color: C.textDim, fontSize: '13px', lineHeight: 1.65, margin: '0 0 10px', background: C.surface2, padding: '12px 14px', borderRadius: '10px', border: `1px solid ${C.border}` }}>
                  {t.message}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {t.variables && t.variables.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {t.variables.map((v: string) => (
                        <span key={v} style={{ fontSize: '10px', color: '#60a5fa', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', padding: '1px 7px', borderRadius: '100px', fontFamily: 'monospace' }}>{v}</span>
                      ))}
                    </div>
                  )}
                  <p style={{ color: C.textMuted, fontSize: '11px', marginLeft: 'auto' }}>Usado {t.use_count} veces</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
