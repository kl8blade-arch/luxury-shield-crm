'use client'
// src/app/dashboard/seguros/page.tsx — Tabla Seguros v3
// Market intelligence + referencia rápida de productos para el agente

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Product {
  id: string
  name: string
  carrier: string
  product_type: string
  description: string
  commission_rate: number
  states: string[]
  age_min: number
  age_max: number
  sophia_prompt: string
  active: boolean
  pricing?: Record<string, number>
}

const T = {
  bg:     '#0d0820',
  panel:  'rgba(255,255,255,0.05)',
  border: 'rgba(149,76,233,0.18)',
  text:   '#f0eaff',
  muted:  'rgba(200,180,255,0.45)',
  accent: '#9B59B6',
  green:  '#00E5A0',
  red:    '#FF4757',
  gold:   '#FFB930',
  cyan:   '#00D4FF',
  blue:   '#2980B9',
}

const TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  'Dental/Vision/Hearing': { color: '#00D4FF', icon: '🦷' },
  'ACA/Health':            { color: '#27AE60', icon: '🏥' },
  'Life/IUL':              { color: '#9B59B6', icon: '💎' },
  'Life/Term':             { color: '#8E44AD', icon: '🛡️' },
  'Medicare':              { color: '#2980B9', icon: '👴' },
  'Final Expense':         { color: '#E67E22', icon: '🕊️' },
  'Accident':              { color: '#E74C3C', icon: '⚡' },
  'Hospital Indemnity':    { color: '#16A085', icon: '🏨' },
  'Auto':                  { color: '#F39C12', icon: '🚗' },
}

function CommissionBar({ rate }: { rate: number }) {
  const pct  = Math.round(rate * 100)
  const color = pct >= 70 ? T.green : pct >= 40 ? T.gold : T.cyan
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 1s', boxShadow: `0 0 6px ${color}60` }}/>
      </div>
      <span style={{ fontSize: 12, fontWeight: 900, color, minWidth: 36 }}>{pct}%</span>
    </div>
  )
}

export default function SegurosPage() {
  const { user }  = useAuth()
  const [products, setProducts]     = useState<Product[]>([])
  const [loading,  setLoading]      = useState(true)
  const [filter,   setFilter]       = useState('all')
  const [search,   setSearch]       = useState('')
  const [selected, setSelected]     = useState<Product | null>(null)
  const [view,     setView]         = useState<'cards' | 'table'>('cards')

  useEffect(() => {
    if (!user?.id) return
    fetch(`/api/dashboard/products?agentId=${user.id}`)
      .then(r => r.json())
      .then(({ data }) => setProducts(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const types = ['all', ...Array.from(new Set(products.map(p => p.product_type)))]

  const filtered = products.filter(p => {
    const matchType   = filter === 'all' || p.product_type === filter
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.carrier.toLowerCase().includes(search.toLowerCase()) ||
      p.product_type.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch && p.active
  })

  const sorted = [...filtered].sort((a, b) => b.commission_rate - a.commission_rate)

  if (loading) return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', color: T.muted }}><div style={{ fontSize: 32 }}>📋</div><div>Cargando productos...</div></div>
    </div>
  )

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'SF Pro Display',system-ui,sans-serif", color: T.text }}>

      {/* HEADER */}
      <div style={{ background: 'rgba(13,8,32,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.border}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 20 }}>📋</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Tabla Seguros v3</div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: 'uppercase' }}>{products.length} productos activos</div>
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto, carrier..."
            style={{ flex: 1, maxWidth: 280, padding: '7px 14px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.text, outline: 'none', fontFamily: 'inherit' }}
          />

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {(['cards','table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 12px', background: view === v ? `${T.accent}25` : 'transparent', border: `1px solid ${view === v ? T.accent : T.border}`, borderRadius: 8, fontSize: 11, fontWeight: 600, color: view === v ? T.accent : T.muted, cursor: 'pointer' }}>
                {v === 'cards' ? '⊞ Cards' : '☰ Tabla'}
              </button>
            ))}
          </div>
        </div>

        {/* Type filters */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {types.map(t => {
            const cfg = t !== 'all' ? TYPE_CONFIG[t] : null
            const count = t === 'all' ? products.length : products.filter(p => p.product_type === t).length
            return (
              <button key={t} onClick={() => setFilter(t)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: filter === t ? `${cfg?.color ?? T.accent}20` : 'transparent', border: `1px solid ${filter === t ? (cfg?.color ?? T.accent) : T.border}`, borderRadius: 20, fontSize: 10, fontWeight: 700, color: filter === t ? (cfg?.color ?? T.accent) : T.muted, cursor: 'pointer', flexShrink: 0 }}>
                {cfg?.icon} {t === 'all' ? 'Todos' : t} <span style={{ opacity: 0.6 }}>({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 120px)' }}>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

          {/* CARDS VIEW */}
          {view === 'cards' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {sorted.map(p => {
                const cfg  = TYPE_CONFIG[p.product_type] ?? { color: T.accent, icon: '📄' }
                const isSelected = selected?.id === p.id
                return (
                  <div key={p.id} onClick={() => setSelected(isSelected ? null : p)}
                    style={{ background: isSelected ? `${cfg.color}12` : T.panel, border: `1px solid ${isSelected ? cfg.color : T.border}`, borderTop: `3px solid ${cfg.color}`, borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'all 0.15s', boxShadow: isSelected ? `0 0 20px ${cfg.color}25` : 'none' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        {cfg.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 2 }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: cfg.color, fontWeight: 700 }}>{p.carrier} · {p.product_type}</div>
                      </div>
                      <div style={{ padding: '2px 8px', background: `${cfg.color}15`, borderRadius: 8, fontSize: 10, fontWeight: 700, color: cfg.color }}>
                        {Math.round(p.commission_rate * 100)}% com.
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.6, marginBottom: 12 }}>{p.description}</div>

                    {/* Commission bar */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Comisión</div>
                      <CommissionBar rate={p.commission_rate} />
                    </div>

                    {/* Age + States */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 10, color: T.muted }}>
                        👤 {p.age_min}-{p.age_max} años
                      </div>
                      {p.states?.slice(0, 4).map(s => (
                        <div key={s} style={{ padding: '2px 6px', background: `${T.cyan}10`, borderRadius: 6, fontSize: 9, fontWeight: 700, color: T.cyan }}>{s}</div>
                      ))}
                      {p.states?.length > 4 && (
                        <div style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: 6, fontSize: 9, color: T.muted }}>+{p.states.length - 4}</div>
                      )}
                    </div>

                    {isSelected && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Instrucción Sophia</div>
                        <div style={{ fontSize: 11, color: T.text, lineHeight: 1.6, background: `${T.accent}08`, borderRadius: 8, padding: 10, borderLeft: `2px solid ${T.accent}` }}>
                          {p.sophia_prompt}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* TABLE VIEW */}
          {view === 'table' && (
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1.5fr 1fr 80px', padding: '10px 16px', background: 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${T.border}` }}>
                {['Producto','Carrier','Tipo','Comisión','Estados','Edad'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>

              {sorted.map((p, i) => {
                const cfg = TYPE_CONFIG[p.product_type] ?? { color: T.accent, icon: '📄' }
                return (
                  <div key={p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)}
                    style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1.5fr 1fr 80px', padding: '12px 16px', borderBottom: i < sorted.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', cursor: 'pointer', background: selected?.id === p.id ? `${cfg.color}08` : 'transparent', transition: 'background 0.15s' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{p.description.substring(0, 50)}...</div>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: T.text }}>{p.carrier}</div>

                    <div style={{ padding: '2px 8px', background: `${cfg.color}15`, borderRadius: 8, fontSize: 10, fontWeight: 700, color: cfg.color, display: 'inline-block' }}>
                      {p.product_type.split('/')[0]}
                    </div>

                    <CommissionBar rate={p.commission_rate} />

                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {p.states?.slice(0, 3).map(s => (
                        <span key={s} style={{ fontSize: 9, padding: '1px 5px', background: `${T.cyan}12`, borderRadius: 5, color: T.cyan, fontWeight: 700 }}>{s}</span>
                      ))}
                    </div>

                    <div style={{ fontSize: 11, color: T.muted }}>{p.age_min}-{p.age_max}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* SIDE PANEL — Product detail */}
        {selected && (
          <div style={{ width: 320, flexShrink: 0, background: 'rgba(13,8,40,0.97)', borderLeft: `1px solid ${T.border}`, overflow: 'auto', animation: 'slideIn 0.2s ease' }}>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>

            {(() => {
              const cfg = TYPE_CONFIG[selected.product_type] ?? { color: T.accent, icon: '📄' }
              return (
                <div style={{ padding: 20 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{cfg.icon}</div>
                    <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: `1px solid ${T.border}`, cursor: 'pointer', color: T.muted, fontSize: 16 }}>✕</button>
                  </div>

                  <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700, marginBottom: 16 }}>{selected.carrier} · {selected.product_type}</div>

                  {/* Commission big */}
                  <div style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`, borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: cfg.color }}>{Math.round(selected.commission_rate * 100)}%</div>
                    <div style={{ fontSize: 10, color: T.muted, letterSpacing: 2, textTransform: 'uppercase' }}>Comisión</div>
                  </div>

                  {/* Details */}
                  {[
                    { label: 'Descripción completa', val: selected.description },
                  ].map((f, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</div>
                      <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7 }}>{f.val}</div>
                    </div>
                  ))}

                  {/* States */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 6 }}>Estados</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selected.states?.map(s => (
                        <div key={s} style={{ padding: '3px 10px', background: `${T.cyan}15`, border: `1px solid ${T.cyan}30`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: T.cyan }}>{s}</div>
                      ))}
                    </div>
                  </div>

                  {/* Age */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 6 }}>Edad elegible</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{selected.age_min} — {selected.age_max} años</div>
                  </div>

                  {/* Sophia prompt */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 6 }}>🤖 Instrucción Sophia</div>
                    <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7, background: `${T.accent}08`, borderRadius: 10, padding: 12, borderLeft: `3px solid ${T.accent}` }}>
                      {selected.sophia_prompt}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => navigator.clipboard?.writeText(selected.sophia_prompt)}
                      style={{ padding: '10px', background: `${T.accent}15`, border: `1px solid ${T.accent}30`, borderRadius: 10, fontSize: 12, fontWeight: 700, color: T.accent, cursor: 'pointer' }}
                    >
                      📋 Copiar instrucción Sophia
                    </button>
                    <button
                      onClick={() => navigator.clipboard?.writeText(selected.description)}
                      style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, fontWeight: 700, color: T.muted, cursor: 'pointer' }}
                    >
                      📄 Copiar descripción
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
