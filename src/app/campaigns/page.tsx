'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

const ANGLE_COLORS: Record<string, string> = {
  'mal-aliento': '#34d399', 'sonrisa-rota': '#a78bfa', 'dolor-3am': '#f87171',
  'mama-sin-seguro': '#f472b6', 'costo-esperar': '#fbbf24', 'primera-cita': '#60a5fa',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    setCampaigns(data || [])
    setLoading(false)
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopyFeedback(label)
    setTimeout(() => setCopyFeedback(null), 2000)
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif' }}>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>MARKETING</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Campañas</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>6 campañas disruptivas listas para lanzar</p>
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>
          {/* Campaign list */}
          <div style={{ flex: 1 }}>
            {loading ? <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,227,0.3)' }}>Cargando...</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
                {campaigns.map(c => {
                  const color = ANGLE_COLORS[c.slug] || '#C9A84C'
                  const isSelected = selected?.id === c.id
                  return (
                    <div key={c.id} onClick={() => setSelected(isSelected ? null : c)}
                      style={{
                        padding: '20px', borderRadius: '16px', cursor: 'pointer',
                        background: isSelected ? `${color}08` : 'rgba(255,255,255,0.015)',
                        border: `1px solid ${isSelected ? color + '30' : 'rgba(255,255,255,0.04)'}`,
                        borderLeft: `3px solid ${color}`,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: `${color}15`, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.angle}</span>
                        <span style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)' }}>{(c.platforms || []).join(' · ')}</span>
                      </div>
                      <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '20px', color: '#F0ECE3', margin: '0 0 6px' }}>{c.name}</h3>
                      <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.5)', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>"{c.hook}"</p>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'rgba(240,236,227,0.3)' }}>
                        <span>{c.leads_generated || 0} leads</span>
                        <span>{c.conversions || 0} conversiones</span>
                        <span>{c.target_audience?.substring(0, 30)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ width: isMobile ? '100%' : '420px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px', position: isMobile ? 'relative' : 'sticky', top: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '24px', color: '#F0ECE3', margin: 0 }}>{selected.name}</h2>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'rgba(240,236,227,0.3)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>

                <p style={{ fontSize: '14px', color: 'rgba(240,236,227,0.6)', fontStyle: 'italic', margin: '0 0 16px', lineHeight: 1.5 }}>"{selected.hook}"</p>

                <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(201,168,76,0.2), transparent)', margin: '0 0 16px' }} />

                {/* Ad Copy sections */}
                {selected.ad_copy && Object.entries(selected.ad_copy as Record<string, any>).map(([platform, copy]: [string, any]) => (
                  <div key={platform} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{platform}</span>
                      <button onClick={() => copyText(copy.primary_text || copy.caption || copy.script || '', platform)}
                        style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '6px', background: copyFeedback === platform ? 'rgba(52,211,153,0.1)' : 'rgba(201,168,76,0.06)', border: `1px solid ${copyFeedback === platform ? 'rgba(52,211,153,0.2)' : 'rgba(201,168,76,0.15)'}`, color: copyFeedback === platform ? '#34d399' : '#C9A84C', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {copyFeedback === platform ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>

                    {copy.headline && <p style={{ fontSize: '13px', fontWeight: 700, color: '#F0ECE3', margin: '0 0 6px' }}>{copy.headline}</p>}
                    {copy.hook && <p style={{ fontSize: '12px', fontWeight: 600, color: '#fbbf24', margin: '0 0 6px' }}>Hook: {copy.hook}</p>}
                    <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.45)', lineHeight: 1.6, margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{copy.primary_text || copy.caption || copy.script || ''}</p>
                    {copy.cta && <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>{copy.cta}</span>}
                    {copy.hashtags && <p style={{ fontSize: '10px', color: 'rgba(96,165,250,0.6)', margin: '6px 0 0' }}>{copy.hashtags}</p>}
                  </div>
                ))}

                {/* WhatsApp sequence */}
                {selected.whatsapp_sequence?.length > 0 && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#25D366', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Secuencia WhatsApp</p>
                    {(selected.whatsapp_sequence as any[]).map((msg: any, i: number) => (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: '10px', marginBottom: '6px', background: 'rgba(37,211,102,0.04)', border: '1px solid rgba(37,211,102,0.1)', borderLeft: '2px solid #25D366' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#4ade80' }}>Mensaje {i + 1}</span>
                          <span style={{ fontSize: '9px', color: 'rgba(240,236,227,0.3)' }}>{msg.delay_hours === 0 ? 'Inmediato' : `+${msg.delay_hours}h`}</span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.5)', lineHeight: 1.5, margin: 0 }}>{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sophia override */}
                {selected.sophia_prompt_override && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Instrucción para Sophia</p>
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)', lineHeight: 1.6, padding: '10px', background: 'rgba(167,139,250,0.04)', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.1)' }}>{selected.sophia_prompt_override}</p>
                  </div>
                )}

                {/* UTM */}
                <div style={{ marginTop: '16px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize: '9px', color: 'rgba(240,236,227,0.25)', margin: 0 }}>UTM: ?utm_source={selected.utm_source}&utm_campaign={selected.utm_campaign}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
