'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const SOURCE_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  facebook: { icon: 'f', color: '#1877F2', label: 'Facebook' },
  instagram: { icon: 'ig', color: '#E4405F', label: 'Instagram' },
  google: { icon: 'G', color: '#4285F4', label: 'Google' },
  tiktok: { icon: 'tk', color: '#00F2EA', label: 'TikTok' },
  twitter: { icon: 'x', color: '#F0ECE3', label: 'X / Twitter' },
  youtube: { icon: 'yt', color: '#FF0000', label: 'YouTube' },
  linkedin: { icon: 'in', color: '#0A66C2', label: 'LinkedIn' },
  landing: { icon: 'LP', color: '#C9A84C', label: 'Landing Page' },
  direct: { icon: 'D', color: '#6b7280', label: 'Directo' },
  referral: { icon: 'R', color: '#a78bfa', label: 'Referido' },
  manual: { icon: 'M', color: '#34d399', label: 'Manual' },
  api_webhook: { icon: 'W', color: '#60a5fa', label: 'Webhook' },
  meta_lead_ads: { icon: 'f', color: '#1877F2', label: 'Meta Lead Ads' },
  google_ads: { icon: 'G', color: '#4285F4', label: 'Google Ads' },
}

const MEDIUM_LABELS: Record<string, { label: string; color: string }> = {
  cpc: { label: 'Pago (CPC)', color: '#f97316' },
  paid_social: { label: 'Social Pago', color: '#f472b6' },
  organic: { label: 'Organico', color: '#34d399' },
  social: { label: 'Social Organico', color: '#60a5fa' },
  direct: { label: 'Directo', color: '#6b7280' },
  referral: { label: 'Referido', color: '#a78bfa' },
  email: { label: 'Email', color: '#fbbf24' },
}

type Tab = 'sources' | 'campaigns' | 'insights' | 'snippet'

export default function CampaignsPage() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('sources')
  const [aiInsights, setAiInsights] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [copied, setCopied] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])

  useEffect(() => { if (user) loadAnalytics() }, [user])

  async function loadAnalytics() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ agent_id: user?.id || '', account_id: user?.account_id || '', role: user?.role || '' })
      const res = await fetch(`/api/campaign-analytics?${params}`)
      const d = await res.json()
      setData(d)
    } catch {}
    setLoading(false)
  }

  async function getAiInsights() {
    if (!data || aiLoading) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/social/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: 'campaign_analysis',
          platform: 'analytics',
          contentType: 'post',
          tone: 'educativo',
          agentId: user?.id,
          accountId: user?.account_id,
        }),
      })
      // Use a dedicated prompt instead
      const promptRes = await fetch('/api/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'campaign_analysis',
          data: {
            sources: data.sources,
            campaigns: data.campaigns,
            mediums: data.mediums,
            total: data.total_leads,
          },
        }),
      }).catch(() => null)

      if (promptRes?.ok) {
        const d = await promptRes.json()
        setAiInsights(d.analysis || d.message || 'No se pudo generar analisis')
      } else {
        // Fallback: generate insights locally
        const insights = generateLocalInsights(data)
        setAiInsights(insights)
      }
    } catch {
      setAiInsights(generateLocalInsights(data))
    }
    setAiLoading(false)
  }

  function generateLocalInsights(d: any): string {
    if (!d?.sources?.length) return 'Sin datos suficientes. Conecta tus campanas para empezar a recibir leads.'
    const lines: string[] = []
    const topSource = d.sources[0]
    lines.push(`Tu mejor fuente es ${topSource.name} con ${topSource.leads} leads.`)

    const bestHot = d.sources.reduce((best: any, s: any) => (s.hot > (best?.hot || 0) ? s : best), null)
    if (bestHot && bestHot.name !== topSource.name) {
      lines.push(`Pero ${bestHot.name} genera mas leads calientes (${bestHot.hot}).`)
    }

    const paidLeads = d.mediums?.find((m: any) => m.name === 'cpc' || m.name === 'paid_social')
    const organicLeads = d.mediums?.find((m: any) => m.name === 'organic' || m.name === 'social')
    if (paidLeads && organicLeads) {
      lines.push(`Leads pagos: ${paidLeads.count} vs Organicos: ${organicLeads.count}.`)
      if (organicLeads.count > paidLeads.count) lines.push('Tu trafico organico supera al pago — tu contenido esta funcionando.')
      else lines.push('El trafico pago domina — considera invertir en contenido organico para reducir costos.')
    }

    if (d.campaigns?.length) {
      const bestCamp = d.campaigns.reduce((best: any, c: any) => (c.avgScore > (best?.avgScore || 0) ? c : best), null)
      if (bestCamp) lines.push(`Campana con mejor score promedio: "${bestCamp.name}" (${bestCamp.avgScore}/100).`)
      const bestClose = d.campaigns.reduce((best: any, c: any) => (c.closeRate > (best?.closeRate || 0) && c.leads >= 3 ? c : best), null)
      if (bestClose && bestClose.name !== bestCamp?.name) lines.push(`Mejor tasa de cierre: "${bestClose.name}" (${bestClose.closeRate}%).`)

      if (d.campaigns.length >= 2) {
        const top2 = d.campaigns.slice(0, 2)
        lines.push(`Sugerencia: combina el angulo de "${top2[0].name}" con la audiencia de "${top2[1].name}" para una nueva campana optimizada.`)
      }
    }

    return lines.join('\n\n')
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://luxury-shield-crm.vercel.app'
  const snippetCode = `<script src="${baseUrl}/api/embed/script.js"></script>`

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif' }}>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>CAMPANAS</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0 }}>Analytics de Campanas</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Metricas por fuente, campana, organico vs pago. Sophia analiza y sugiere mejoras.</p>
        </div>

        {/* Summary cards */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Leads', value: data.total_leads, color: '#C9A84C' },
              { label: 'Fuentes', value: data.sources?.length || 0, color: '#60a5fa' },
              { label: 'Campanas', value: data.campaigns?.length || 0, color: '#a78bfa' },
              { label: 'Mejor fuente', value: data.sources?.[0]?.name || '—', color: '#34d399' },
            ].map(s => (
              <div key={s.label} style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderBottom: `2px solid ${s.color}30` }}>
                <p style={{ fontSize: '24px', fontWeight: 800, color: s.color, margin: '0 0 4px', fontFamily: '"DM Serif Display",serif' }}>{s.value}</p>
                <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.35)', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
          {([
            { k: 'sources' as Tab, l: 'Por Fuente' },
            { k: 'campaigns' as Tab, l: 'Por Campana' },
            { k: 'insights' as Tab, l: 'Sugerencias IA' },
            { k: 'snippet' as Tab, l: 'Conectar Landing' },
          ]).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: tab === t.k ? 700 : 400,
              fontFamily: 'inherit', cursor: 'pointer', border: 'none',
              background: tab === t.k ? 'rgba(201,168,76,0.08)' : 'transparent',
              color: tab === t.k ? '#C9A84C' : 'rgba(240,236,227,0.4)',
            }}>{t.l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,227,0.3)' }}>Cargando analytics...</div>
        ) : (
          <>
            {/* SOURCES TAB */}
            {tab === 'sources' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Medium breakdown */}
                {data?.mediums?.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {data.mediums.map((m: any) => {
                      const meta = MEDIUM_LABELS[m.name] || { label: m.name, color: '#6b7280' }
                      return (
                        <div key={m.name} style={{ padding: '8px 14px', borderRadius: '10px', background: `${meta.color}08`, border: `1px solid ${meta.color}20` }}>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: meta.color, fontFamily: '"DM Serif Display",serif' }}>{m.count}</span>
                          <span style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)', marginLeft: '8px' }}>{meta.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {data?.sources?.map((s: any) => {
                  const meta = SOURCE_ICONS[s.name] || { icon: s.name[0]?.toUpperCase(), color: '#6b7280', label: s.name }
                  return (
                    <div key={s.name} style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderLeft: `3px solid ${meta.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${meta.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: meta.color, flexShrink: 0 }}>{meta.icon}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '15px', fontWeight: 700, color: '#F0ECE3', margin: '0 0 4px' }}>{meta.label}</p>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                            <span style={{ color: 'rgba(240,236,227,0.5)' }}>{s.leads} leads</span>
                            <span style={{ color: '#f97316' }}>{s.hot} calientes</span>
                            <span style={{ color: '#34d399' }}>{s.won} cerrados</span>
                            {s.visits > 0 && <span style={{ color: '#60a5fa' }}>{s.conversionRate}% conversion</span>}
                            {s.campaigns > 0 && <span style={{ color: '#a78bfa' }}>{s.campaigns} campanas</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '28px', fontWeight: 800, color: meta.color, margin: 0, fontFamily: '"DM Serif Display",serif' }}>{s.leads}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {(!data?.sources?.length) && (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <p style={{ fontSize: '15px', color: 'rgba(240,236,227,0.25)' }}>Sin datos de fuentes. Conecta campanas en la pestana "Conectar Landing".</p>
                  </div>
                )}
              </div>
            )}

            {/* CAMPAIGNS TAB */}
            {tab === 'campaigns' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data?.campaigns?.map((c: any) => {
                  const srcMeta = SOURCE_ICONS[c.source] || { color: '#6b7280' }
                  return (
                    <div key={c.name} style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: '#F0ECE3', margin: '0 0 4px' }}>{c.name}</p>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: `${srcMeta.color}15`, color: srcMeta.color, fontWeight: 600 }}>{c.source}</span>
                            {c.medium && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: 'rgba(255,255,255,0.04)', color: 'rgba(240,236,227,0.4)' }}>{c.medium}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '22px', fontWeight: 800, color: '#C9A84C', margin: 0, fontFamily: '"DM Serif Display",serif' }}>{c.leads}</p>
                          <p style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', margin: 0 }}>leads</p>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {[
                          { label: 'Score prom.', value: c.avgScore, color: c.avgScore >= 70 ? '#34d399' : c.avgScore >= 40 ? '#fbbf24' : '#f87171' },
                          { label: 'Calientes', value: `${c.hotRate}%`, color: '#f97316' },
                          { label: 'Cierre', value: `${c.closeRate}%`, color: '#34d399' },
                          { label: 'Conversion', value: c.visits > 0 ? `${c.conversionRate}%` : '—', color: '#60a5fa' },
                        ].map(m => (
                          <div key={m.label} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
                            <p style={{ fontSize: '16px', fontWeight: 800, color: m.color, margin: '0 0 2px' }}>{m.value}</p>
                            <p style={{ fontSize: '9px', color: 'rgba(240,236,227,0.3)', margin: 0, letterSpacing: '0.05em' }}>{m.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {(!data?.campaigns?.length) && (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <p style={{ fontSize: '15px', color: 'rgba(240,236,227,0.25)' }}>Sin campanas con nombre. Usa utm_campaign en tus URLs para trackear campanas.</p>
                    <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.15)', marginTop: '8px' }}>Ejemplo: ?utm_source=facebook&utm_campaign=dental_miami_q2</p>
                  </div>
                )}
              </div>
            )}

            {/* INSIGHTS TAB */}
            {tab === 'insights' && (
              <div>
                {!aiInsights && (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ fontSize: '15px', color: 'rgba(240,236,227,0.4)', marginBottom: '16px' }}>Sophia analiza tus campanas y te dice que potenciar, que combinar, y como optimizar.</p>
                    <button onClick={getAiInsights} disabled={aiLoading} style={{ padding: '14px 32px', borderRadius: '14px', background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#06070B', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(201,168,76,0.3)' }}>
                      {aiLoading ? 'Analizando...' : 'Analizar mis campanas'}
                    </button>
                  </div>
                )}
                {aiInsights && (
                  <div style={{ padding: '24px', borderRadius: '16px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#C9A84C', margin: '0 0 16px' }}>Sugerencias de Sophia</h3>
                    <div style={{ fontSize: '14px', color: '#F0ECE3', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{aiInsights}</div>
                    <button onClick={() => { setAiInsights(''); getAiInsights() }} style={{ marginTop: '16px', padding: '8px 20px', borderRadius: '10px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Regenerar analisis</button>
                  </div>
                )}
              </div>
            )}

            {/* SNIPPET TAB */}
            {tab === 'snippet' && (
              <div>
                <div style={{ padding: '24px', borderRadius: '16px', background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#60a5fa', margin: '0 0 8px' }}>Paso 1: Agrega este script a tu landing page</h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: '0 0 12px' }}>Pegalo antes del cierre &lt;/body&gt; en cualquier landing page. Automaticamente captura UTMs, detecta la fuente, e intercepta formularios.</p>
                  <div style={{ position: 'relative' }}>
                    <pre style={{ padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', fontSize: '13px', color: '#60a5fa', fontFamily: 'monospace', overflowX: 'auto' }}>{snippetCode}</pre>
                    <button onClick={() => copy(snippetCode, 'snippet')} style={{ position: 'absolute', top: '8px', right: '8px', padding: '5px 12px', borderRadius: '6px', background: copied === 'snippet' ? 'rgba(52,211,153,0.15)' : 'rgba(201,168,76,0.1)', border: `1px solid ${copied === 'snippet' ? 'rgba(52,211,153,0.3)' : 'rgba(201,168,76,0.2)'}`, color: copied === 'snippet' ? '#34d399' : '#C9A84C', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{copied === 'snippet' ? 'Copiado!' : 'Copiar'}</button>
                  </div>
                </div>

                <div style={{ padding: '24px', borderRadius: '16px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#C9A84C', margin: '0 0 8px' }}>Paso 2: Agrega UTMs a tus URLs de campana</h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: '0 0 12px' }}>El script detecta automaticamente la fuente, pero los UTMs te dan trackeo preciso.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Facebook Ads', url: 'tulanding.com?utm_source=facebook&utm_medium=paid_social&utm_campaign=dental_miami' },
                      { label: 'Google Ads', url: 'tulanding.com?utm_source=google&utm_medium=cpc&utm_campaign=iul_retirement' },
                      { label: 'Instagram Organic', url: 'tulanding.com?utm_source=instagram&utm_medium=social&utm_campaign=contenido_enero' },
                      { label: 'TikTok', url: 'tulanding.com?utm_source=tiktok&utm_medium=paid_social&utm_campaign=viral_dental' },
                      { label: 'Email', url: 'tulanding.com?utm_source=email&utm_medium=email&utm_campaign=newsletter_marzo' },
                    ].map(ex => (
                      <div key={ex.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                        <span style={{ fontSize: '11px', color: '#C9A84C', fontWeight: 700, minWidth: '100px' }}>{ex.label}:</span>
                        <code style={{ fontSize: '11px', color: 'rgba(240,236,227,0.5)', fontFamily: 'monospace', flex: 1 }}>{ex.url}</code>
                        <button onClick={() => copy(ex.url, ex.label)} style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)', color: '#C9A84C', fontSize: '9px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{copied === ex.label ? '!' : 'Copiar'}</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '24px', borderRadius: '16px', background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#34d399', margin: '0 0 8px' }}>Que hace el script automaticamente</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
                    {[
                      { title: 'Captura UTMs', desc: 'Lee utm_source, utm_medium, utm_campaign de la URL' },
                      { title: 'Detecta fuente', desc: 'Si no hay UTM, detecta si viene de Facebook, Google, TikTok, etc. por el referrer' },
                      { title: 'Pago vs Organico', desc: 'Detecta gclid, fbclid, ttclid para saber si es trafico pago' },
                      { title: 'Intercepta formularios', desc: 'Cualquier form en tu pagina se envia automaticamente al CRM' },
                      { title: 'Registra visitas', desc: 'Cuenta pageviews por fuente para calcular tasa de conversion' },
                      { title: 'API disponible', desc: 'window.LuxuryShield.sendLead({name, phone}) para envios custom' },
                    ].map(f => (
                      <div key={f.title} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', margin: '0 0 4px' }}>{f.title}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)', margin: 0 }}>{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
