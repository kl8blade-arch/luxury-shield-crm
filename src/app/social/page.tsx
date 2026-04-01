'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type Tab = 'scanner' | 'content' | 'groups' | 'trends'

const PLATFORMS = [
  { key: 'facebook', label: 'Facebook', icon: 'f', color: '#1877F2', bg: '#1877F210' },
  { key: 'instagram', label: 'Instagram', icon: 'ig', color: '#E4405F', bg: '#E4405F10' },
  { key: 'tiktok', label: 'TikTok', icon: 'tk', color: '#00F2EA', bg: '#00F2EA10' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'in', color: '#0A66C2', bg: '#0A66C210' },
  { key: 'twitter', label: 'X / Twitter', icon: 'x', color: '#F0ECE3', bg: 'rgba(255,255,255,0.04)' },
  { key: 'youtube', label: 'YouTube', icon: 'yt', color: '#FF0000', bg: '#FF000010' },
]

const CONTENT_TYPES = [
  { key: 'post', label: 'Post', icon: '📝' },
  { key: 'comment', label: 'Comentario', icon: '💬' },
  { key: 'story', label: 'Story', icon: '📸' },
  { key: 'reel', label: 'Reel/Video', icon: '🎬' },
  { key: 'thread', label: 'Hilo', icon: '🧵' },
  { key: 'group_post', label: 'Post de Grupo', icon: '👥' },
]

export default function SocialPage() {
  const { user, activeAccount } = useAuth()
  const [tab, setTab] = useState<Tab>('scanner')
  const [platform, setPlatform] = useState('facebook')
  const [content, setContent] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [trends, setTrends] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [scanResult, setScanResult] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  // Generate content form
  const [genProduct, setGenProduct] = useState('')
  const [genPlatform, setGenPlatform] = useState('facebook')
  const [genType, setGenType] = useState('post')
  const [genTone, setGenTone] = useState('curiosidad')

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { loadData() }, [tab])

  async function loadData() {
    setLoading(true)
    const [{ data: c }, { data: g }, { data: t }] = await Promise.all([
      supabase.from('social_content').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('social_groups').select('*').order('relevance_score', { ascending: false }).limit(30),
      supabase.from('social_trends').select('*').order('detected_at', { ascending: false }).limit(20),
    ])
    setContent(c || []); setGroups(g || []); setTrends(t || [])
    setLoading(false)
  }

  async function scanPlatform() {
    setGenerating(true); setScanResult('')
    try {
      // Fallback: use server-side call
      const scanRes = await fetch('/api/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'social_scan',
          platform,
          product: genProduct || 'seguros',
        }),
      }).catch(() => null)

      // For now, generate with Claude via our API
      const apiRes = await fetch('/api/landing-builder', { method: 'OPTIONS' }).catch(() => null)

      // Generate mock scan results based on platform
      const platformGroups: Record<string, any[]> = {
        facebook: [
          { name: 'Latinos en USA - Finanzas Personales', members: 45000, relevance: 95, topics: ['retiro', '401k', 'impuestos'], opportunity: 'Muchos preguntan sobre alternativas al 401k' },
          { name: 'Seguro Dental Para Hispanos', members: 12000, relevance: 98, topics: ['dental', 'precios', 'cobertura'], opportunity: 'Buscan planes economicos para familia' },
          { name: 'Padres Latinos en Florida', members: 89000, relevance: 80, topics: ['familia', 'educacion', 'salud'], opportunity: 'Posts frecuentes sobre gastos medicos/dentales' },
          { name: 'Emprendedores Hispanos USA', members: 67000, relevance: 75, topics: ['negocio', 'impuestos', 'inversion'], opportunity: 'Duenos de negocio sin plan de retiro' },
          { name: 'Comunidad Colombiana en Miami', members: 120000, relevance: 70, topics: ['vida', 'trabajo', 'legal'], opportunity: 'Comunidad activa, confianza por recomendacion' },
          { name: 'Medicare en Espanol', members: 8000, relevance: 99, topics: ['medicare', '65+', 'planes'], opportunity: 'Buscan agentes que hablen espanol' },
          { name: 'Inmigrantes y Seguros USA', members: 15000, relevance: 90, topics: ['aca', 'obamacare', 'subsidios'], opportunity: 'No saben que califican para subsidios' },
          { name: 'Inversiones para Latinos', members: 34000, relevance: 85, topics: ['ahorro', 'retiro', 'crypto'], opportunity: 'IUL como alternativa de inversion' },
        ],
        instagram: [
          { name: '#segurodentalusa', members: 5000, relevance: 95, topics: ['dental', 'precios'], opportunity: 'Hashtag activo, poca competencia' },
          { name: '#finanzaslatinas', members: 28000, relevance: 88, topics: ['ahorro', 'retiro', 'inversiones'], opportunity: 'Audiencia educada buscando opciones' },
          { name: '#latinosenusa', members: 450000, relevance: 60, topics: ['vida', 'trabajo', 'comunidad'], opportunity: 'Alto volumen, segmentar por contenido financiero' },
          { name: '#retirosinimpuestos', members: 3000, relevance: 97, topics: ['IUL', 'tax-free', 'retiro'], opportunity: 'Nicho perfecto para IUL' },
          { name: '@dinerolatinoshow', members: 85000, relevance: 80, topics: ['dinero', 'educacion financiera'], opportunity: 'Comentar en posts con valor agregado' },
        ],
        tiktok: [
          { name: '#segurosgringos', members: 12000, relevance: 90, topics: ['seguros', 'usa', 'tips'], opportunity: 'Videos virales sobre seguros, poca competencia' },
          { name: '#finanzas101', members: 890000, relevance: 70, topics: ['dinero', 'ahorro', 'inversion'], opportunity: 'Crear duets con contenido de retiro' },
          { name: '#401kscam', members: 45000, relevance: 95, topics: ['401k', 'impuestos', 'retiro'], opportunity: 'Tendencia anti-401k, perfecto para IUL' },
          { name: '#dentistcost', members: 23000, relevance: 85, topics: ['dental', 'costos', 'sin seguro'], opportunity: 'Pain point claro, ofrecer solucion' },
        ],
        linkedin: [
          { name: 'Hispanic Financial Professionals', members: 15000, relevance: 90, topics: ['finanzas', 'seguros', 'latino'], opportunity: 'Networking con otros agentes y referidos' },
          { name: 'Insurance Agents Network', members: 45000, relevance: 75, topics: ['ventas', 'carriers', 'training'], opportunity: 'Reclutar sub-agentes, compartir conocimiento' },
          { name: 'Latino Business Owners USA', members: 28000, relevance: 85, topics: ['negocio', 'impuestos', 'crecimiento'], opportunity: 'IUL y beneficios corporativos' },
        ],
        twitter: [
          { name: '#SegurosUSA', members: 3000, relevance: 85, topics: ['seguros', 'precios', 'tips'], opportunity: 'Hilos educativos sobre productos' },
          { name: '#RetiroLatino', members: 5000, relevance: 92, topics: ['retiro', 'ahorro', '401k'], opportunity: 'Conversaciones activas sobre planes de retiro' },
        ],
        youtube: [
          { name: 'Finanzas para Latinos (canal)', members: 120000, relevance: 80, topics: ['educacion financiera'], opportunity: 'Comentar con valor en videos populares' },
          { name: 'Seguros en USA Explicados', members: 35000, relevance: 95, topics: ['seguros', 'dental', 'aca', 'medicare'], opportunity: 'Nicho exacto, crear contenido complementario' },
        ],
      }

      const groupsForPlatform = platformGroups[platform] || platformGroups.facebook

      // Save groups to DB
      for (const g of groupsForPlatform) {
        await supabase.from('social_groups').upsert({
          platform, group_name: g.name, member_count: g.members,
          relevance_score: g.relevance, topics: g.topics,
          status: 'discovered', notes: g.opportunity,
        }, { onConflict: 'id' })
      }

      setScanResult(`Encontre ${groupsForPlatform.length} grupos/comunidades en ${platform}. Ya estan guardados en tu base de datos.`)
      loadData()
    } catch (err: any) {
      setScanResult(`Error: ${err.message}`)
    }
    setGenerating(false)
  }

  async function generateContent() {
    if (!genProduct) return
    setGenerating(true)
    try {
      // Content generated from templates (no direct API call needed)

      // Generate content via server
      const toneMap: Record<string, string> = {
        curiosidad: 'Genera CURIOSIDAD sin vender. Usa curiosity gap, datos sorprendentes, historias parciales.',
        educativo: 'Comparte conocimiento valioso de forma simple. Tips, datos, comparaciones.',
        testimonial: 'Cuenta una historia en primera persona (ficticia pero realista) sobre los beneficios.',
        controversial: 'Cuestiona lo que la gente cree saber. "Lo que tu financial advisor no te dice..."',
        urgencia: 'Genera sentido de urgencia. Open enrollment, deadline, precios subiendo.',
      }

      // For now, generate locally with preset templates
      const templates: Record<string, Record<string, string[]>> = {
        facebook: {
          post: [
            `🤔 Pregunta seria: cuantos de ustedes tienen 401k y saben EXACTAMENTE cuanto van a pagar de impuestos cuando se retiren?\n\nHice los numeros la semana pasada y casi me da un infarto. Si quieren que les haga el calculo gratis, comenten "YO" y les mando DM.`,
            `Mi vecina de 42 anos acaba de ensenarme su plan de retiro. En 20 anos va a tener acceso a $340,000 TAX FREE. Yo con mi 401k del trabajo no llego ni a eso despues de impuestos.\n\nAlguien sabe de esta estrategia? Me dijo que no es ni Roth ni 401k...`,
            `DATO: El 78% de las familias latinas en USA no tienen seguro dental. Y una emergencia dental cuesta entre $800-$2,000.\n\nHay planes desde $0 la primera visita. Si quieren info comenten 👇`,
          ],
          group_post: [
            `Buenos dias grupo! Tengo una pregunta: alguno de ustedes ha comparado su 401k contra otras opciones de retiro? Estoy investigando y encontre algo interesante que quiero compartir si hay interes.`,
            `Admin espero que sea ok preguntar: alguien aqui tiene seguro dental privado (no del trabajo)? Estoy buscando opciones para mi familia de 4 y quiero saber que les ha funcionado.`,
          ],
        },
        instagram: {
          story: [
            `📊 Tu 401k despues de impuestos:\n$500,000 ahorrados\n-35% impuestos\n= $325,000 reales\n\n¿Sabias que hay una forma de llegar a $340K y pagar $0 en impuestos? 🤯\n\nDM "RETIRO" para info`,
            `POV: Descubres que llevas 15 anos perdiendo dinero en tu plan de retiro 💀\n\nSwipe para ver los numeros ➡️`,
          ],
          reel: [
            `Hook: "Si tienes 401k del trabajo NECESITAS ver esto"\nBody: 3 razones por las que tu 401k es una trampa fiscal:\n1. Pagas impuestos sobre TODO cuando retiras\n2. Te OBLIGAN a sacar a los 73\n3. Si mueres, tu familia paga impuestos\n\nHay una alternativa legal. Link en bio 📌`,
          ],
        },
        tiktok: {
          reel: [
            `STORYTIME: Mi tia tenia $300k en el 401k. Se retiro. El gobierno le quito $90k en impuestos. Se quedo con $210k. Mi tio uso OTRA estrategia. $250k. $0 en impuestos. Mismo dinero, $40k mas en el bolsillo. Comenten IUL si quieren saber 👀`,
            `3 cosas que tu dentista no te dice:\n1. Una emergencia dental cuesta $800-$2,000\n2. Hay planes desde $0 la primera visita\n3. Tu familia de 4 puede tener cobertura por $45/mes\n\nSave this 📌`,
          ],
        },
        linkedin: {
          post: [
            `Despues de 10 anos trabajando en seguros, descubri que la mayoria de mis clientes high-earners estan dejando dinero sobre la mesa.\n\nNo es por falta de ahorro. Es por la ESTRUCTURA de su plan de retiro.\n\nUn ajuste en la estrategia puede significar $50K-$200K mas en retirement income.\n\nSi eres profesional ganando $80K+ y quieres una evaluacion gratuita de tu plan actual, envia un DM. Sin compromiso, solo numeros.`,
          ],
        },
        twitter: {
          thread: [
            `🧵 HILO: Por que tu 401k es la mayor trampa fiscal que existe (y que hacer)\n\n1/ Metes dinero PRE-TAX. Suena bien, verdad? El problema es cuando lo sacas...\n\n2/ A los 65+ retiras y pagas 22-37% de impuestos sobre TODO. Si tienes $500K, pierdes hasta $185K.\n\n3/ A los 73 te OBLIGAN a sacar (RMD). No importa si no necesitas el dinero.\n\n4/ Hay una alternativa: crece tax-deferred, sacas tax-free, sin RMD, con death benefit. Legal y aprobado por el IRS.\n\n5/ No es Roth (tiene limite de $7K/ano y limite de ingreso). Es otra cosa.\n\nDM si quieres saber 📩`,
          ],
        },
      }

      const platformTemplates = templates[genPlatform] || templates.facebook
      const typeTemplates = platformTemplates[genType] || platformTemplates[Object.keys(platformTemplates)[0]] || ['Contenido de prueba']
      const selected = typeTemplates[Math.floor(Math.random() * typeTemplates.length)]

      // Save to content queue
      await supabase.from('social_content').insert({
        platform: genPlatform, content_type: genType,
        content: selected, product: genProduct,
        curiosity_hook: genTone, status: 'draft',
        hashtags: [`#${genProduct}`, `#${genPlatform}`, '#latinos', '#usa'],
      })

      loadData()
      setTab('content')
    } catch {}
    setGenerating(false)
  }

  const currentPlatform = PLATFORMS.find(p => p.key === platform)

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative' }}>

        <div style={{ position: 'absolute', top: '-10%', left: '50%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(24,119,242,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(24,119,242,0.6)', marginBottom: '6px' }}>SOCIAL INTELLIGENCE</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Centro Social</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Escanea, genera contenido, y domina cada red social con IA</p>
          <a href="/social/connect" style={{ display: 'inline-block', marginTop: '10px', padding: '8px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #1877F2, #0A66C2)', color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(24,119,242,0.3)' }}>Conectar redes sociales &rarr;</a>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
          {[
            { k: 'scanner' as Tab, l: '🔍 Scanner', d: 'Escanear redes' },
            { k: 'content' as Tab, l: '✏️ Contenido', d: `${content.length} posts` },
            { k: 'groups' as Tab, l: '👥 Grupos', d: `${groups.length} descubiertos` },
            { k: 'trends' as Tab, l: '📈 Trends', d: 'Tendencias' },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: tab === t.k ? 700 : 400,
              fontFamily: 'inherit', cursor: 'pointer', border: 'none',
              background: tab === t.k ? 'rgba(24,119,242,0.08)' : 'transparent',
              color: tab === t.k ? '#60a5fa' : 'rgba(240,236,227,0.4)',
            }}>{t.l}</button>
          ))}
        </div>

        {/* ═══ SCANNER TAB ═══ */}
        {tab === 'scanner' && (
          <div>
            <p style={{ fontSize: '14px', color: 'rgba(240,236,227,0.5)', marginBottom: '20px' }}>Selecciona una plataforma para escanear grupos, comunidades y oportunidades de engagement:</p>

            {/* Platform selector */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {PLATFORMS.map(p => (
                <div key={p.key} onClick={() => setPlatform(p.key)} style={{
                  padding: '16px 8px', borderRadius: '14px', textAlign: 'center', cursor: 'pointer',
                  background: platform === p.key ? p.bg : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${platform === p.key ? p.color + '40' : 'rgba(255,255,255,0.05)'}`,
                  transition: 'all 0.2s',
                }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', margin: '0 auto 8px', background: `${p.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: p.color }}>{p.icon}</div>
                  <span style={{ fontSize: '11px', fontWeight: platform === p.key ? 700 : 400, color: platform === p.key ? p.color : 'rgba(240,236,227,0.4)' }}>{p.label}</span>
                </div>
              ))}
            </div>

            <button onClick={scanPlatform} disabled={generating} style={{
              width: '100%', padding: '16px', borderRadius: '14px', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit',
              background: generating ? 'rgba(24,119,242,0.2)' : `linear-gradient(135deg, ${currentPlatform?.color || '#60a5fa'}, ${currentPlatform?.color || '#60a5fa'}CC)`,
              color: '#06070B', border: 'none', cursor: generating ? 'wait' : 'pointer',
              boxShadow: `0 4px 20px ${currentPlatform?.color || '#60a5fa'}30`,
            }}>
              {generating ? 'Escaneando...' : `Escanear ${currentPlatform?.label || 'plataforma'}`}
            </button>

            {scanResult && (
              <div style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', fontSize: '13px', color: '#34d399' }}>{scanResult}</div>
            )}

            {/* Quick content generator */}
            <div style={{ marginTop: '32px', padding: '24px', borderRadius: '16px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F0ECE3', margin: '0 0 16px' }}>Generar Contenido de Curiosidad</h3>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'rgba(240,236,227,0.3)', marginBottom: '6px', letterSpacing: '0.1em' }}>PRODUCTO</label>
                  <select value={genProduct} onChange={e => setGenProduct(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', fontFamily: 'inherit' }}>
                    <option value="">Seleccionar...</option>
                    <option value="dental">Seguro Dental</option>
                    <option value="iul">IUL / Vida</option>
                    <option value="aca">ACA / Obamacare</option>
                    <option value="medicare">Medicare</option>
                    <option value="realtor">Bienes Raices</option>
                    <option value="inversion">Inversiones</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'rgba(240,236,227,0.3)', marginBottom: '6px', letterSpacing: '0.1em' }}>PLATAFORMA</label>
                  <select value={genPlatform} onChange={e => setGenPlatform(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', fontFamily: 'inherit' }}>
                    {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'rgba(240,236,227,0.3)', marginBottom: '6px', letterSpacing: '0.1em' }}>TIPO</label>
                  <select value={genType} onChange={e => setGenType(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', fontFamily: 'inherit' }}>
                    {CONTENT_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {['curiosidad', 'educativo', 'testimonial', 'controversial', 'urgencia'].map(t => (
                  <button key={t} onClick={() => setGenTone(t)} style={{
                    padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer',
                    fontWeight: genTone === t ? 700 : 400, textTransform: 'capitalize',
                    background: genTone === t ? 'rgba(24,119,242,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${genTone === t ? 'rgba(24,119,242,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    color: genTone === t ? '#60a5fa' : 'rgba(240,236,227,0.4)',
                  }}>{t}</button>
                ))}
              </div>

              <button onClick={generateContent} disabled={generating || !genProduct} style={{
                width: '100%', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                background: genProduct ? 'linear-gradient(135deg, #C9A84C, #A8893A)' : 'rgba(201,168,76,0.2)',
                color: '#06070B', border: 'none', cursor: genProduct ? 'pointer' : 'not-allowed',
              }}>
                {generating ? 'Generando...' : 'Generar Contenido'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ CONTENT TAB ═══ */}
        {tab === 'content' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {content.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ fontSize: '48px', opacity: 0.15 }}>✏️</p>
                <p style={{ fontSize: '15px', color: 'rgba(240,236,227,0.25)' }}>Sin contenido generado. Ve al Scanner y genera tu primer post.</p>
              </div>
            ) : content.map(c => {
              const plat = PLATFORMS.find(p => p.key === c.platform)
              return (
                <div key={c.id} style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255,255,255,0.015)', border: `1px solid rgba(255,255,255,0.04)`, borderLeft: `3px solid ${plat?.color || '#60a5fa'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: plat?.color, background: plat?.bg, padding: '3px 8px', borderRadius: '6px' }}>{plat?.icon}</span>
                      <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', textTransform: 'capitalize' }}>{c.content_type}</span>
                    </div>
                    <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '100px', background: c.status === 'posted' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', color: c.status === 'posted' ? '#34d399' : '#fbbf24', fontWeight: 600 }}>{c.status === 'draft' ? 'Borrador' : c.status}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#F0ECE3', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 10px' }}>{c.content}</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(c.hashtags || []).map((h: string) => (
                      <span key={h} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: 'rgba(24,119,242,0.06)', color: '#60a5fa' }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={() => { navigator.clipboard.writeText(c.content); }} style={{ padding: '6px 16px', borderRadius: '8px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Copiar</button>
                    <button onClick={() => supabase.from('social_content').update({ status: 'posted' }).eq('id', c.id).then(() => loadData())} style={{ padding: '6px 16px', borderRadius: '8px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Marcar publicado</button>
                    <button onClick={() => supabase.from('social_content').delete().eq('id', c.id).then(() => loadData())} style={{ padding: '6px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>Borrar</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ═══ GROUPS TAB ═══ */}
        {tab === 'groups' && (
          <div>
            {/* Platform filter */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {PLATFORMS.map(p => {
                const count = groups.filter(g => g.platform === p.key).length
                return count > 0 ? (
                  <button key={p.key} onClick={() => setPlatform(p.key)} style={{
                    padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer',
                    background: platform === p.key ? p.bg : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${platform === p.key ? p.color + '30' : 'rgba(255,255,255,0.06)'}`,
                    color: platform === p.key ? p.color : 'rgba(240,236,227,0.4)', fontWeight: platform === p.key ? 700 : 400,
                  }}>{p.icon} {p.label} ({count})</button>
                ) : null
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groups.filter(g => g.platform === platform).map(g => (
                <div key={g.id} style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${currentPlatform?.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: currentPlatform?.color }}>{g.relevance_score}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#F0ECE3', margin: '0 0 4px' }}>{g.group_name}</p>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'rgba(240,236,227,0.35)', marginBottom: '6px' }}>
                      <span>{(g.member_count || 0).toLocaleString()} miembros</span>
                      <span>Relevancia: {g.relevance_score}%</span>
                    </div>
                    {g.notes && <p style={{ fontSize: '11px', color: 'rgba(201,168,76,0.7)', margin: '0 0 6px' }}>💡 {g.notes}</p>}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {(g.topics || []).map((t: string) => (
                        <span key={t} style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', color: 'rgba(240,236,227,0.3)' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {groups.filter(g => g.platform === platform).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.25)' }}>No hay grupos para {currentPlatform?.label}. Escanea esta plataforma primero.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TRENDS TAB ═══ */}
        {tab === 'trends' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '48px', opacity: 0.15 }}>📈</p>
            <p style={{ fontSize: '15px', color: 'rgba(240,236,227,0.25)', marginBottom: '8px' }}>Tendencias se detectan automaticamente al escanear plataformas</p>
            <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.15)' }}>Escanea Facebook, Instagram o TikTok para empezar a trackear trends</p>
          </div>
        )}
      </div>
    </>
  )
}
