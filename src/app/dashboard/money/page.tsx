'use client'
// src/app/dashboard/money/page.tsx — SophiaOS Money Command

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Commission {
  id: string
  carrier: string | null
  product: string | null
  premium: number | null
  commission_rate: number | null
  commission_amount: number | null
  status: string
  paid_date: string | null
  effective_date: string | null
  created_at: string
  lead_id: string | null
  policy_number: string | null
}

interface MoneyData {
  commissions: Commission[]
  mrrReal: number
  mrrTotal: number
  pending: number
  paid: number
  chargebacks: number
  byCarrier: Record<string, number>
  byProduct: Record<string, number>
  trend: { mes: string; amount: number }[]
  projectedMonth: number
}

const T = {
  bg: '#0d0820', panel: 'rgba(255,255,255,0.05)',
  border: 'rgba(149,76,233,0.18)', text: '#f0eaff',
  muted: 'rgba(200,180,255,0.45)', accent: '#9B59B6',
  green: '#00E5A0', red: '#FF4757', gold: '#FFB930',
  cyan: '#00D4FF',
}

const STATUS_COLOR: Record<string, string> = {
  paid:    '#00E5A0',
  pending: '#FFB930',
  chargeback: '#FF4757',
  cancelled:  '#888',
}
const STATUS_LABEL: Record<string, string> = {
  paid:    '✅ Pagada',
  pending: '⏳ Pendiente',
  chargeback: '⚠️ Chargeback',
  cancelled:  '❌ Cancelada',
}

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-US')}` }
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function MoneyPage() {
  const { user } = useAuth()
  const [data, setData]       = useState<MoneyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<'all' | 'paid' | 'pending' | 'chargeback'>('all')
  const [sortBy, setSortBy]   = useState<'date' | 'amount' | 'carrier'>('date')

  const fetchMoney = useCallback(async () => {
    if (!user?.id) return
    try {
      const r = await fetch(`/api/dashboard/money?agentId=${user.id}`)
      if (!r.ok) throw new Error('Error cargando comisiones')
      const { data } = await r.json()
      setData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchMoney() }, [fetchMoney])

  if (loading) return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ textAlign: 'center', color: T.muted }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>💰</div>
        <div>Cargando comisiones...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: T.red }}>⚠️ {error}</div>
    </div>
  )

  if (!data) return null

  // Filtered + sorted commissions
  const filtered = (data.commissions ?? [])
    .filter(c => filter === 'all' || c.status === filter)
    .sort((a, b) => {
      if (sortBy === 'amount') return (b.commission_amount ?? 0) - (a.commission_amount ?? 0)
      if (sortBy === 'carrier') return (a.carrier ?? '').localeCompare(b.carrier ?? '')
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const META = 8000
  const mrrPct = Math.min(Math.round((data.mrrReal / META) * 100), 100)

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'SF Pro Display',system-ui,sans-serif", color: T.text }}>

      {/* HEADER */}
      <div style={{ background: 'rgba(13,8,32,0.9)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.border}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 20 }}>💰</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Money Command</div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: 'uppercase' }}>Comisiones y pólizas</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {data.chargebacks > 0 && (
              <div style={{ padding: '4px 12px', background: `${T.red}20`, border: `1px solid ${T.red}40`, borderRadius: 20, fontSize: 11, fontWeight: 700, color: T.red }}>
                ⚠️ {data.chargebacks} chargeback{data.chargebacks > 1 ? 's' : ''}
              </div>
            )}
            <button onClick={fetchMoney} style={{ padding: '6px 14px', background: `${T.accent}20`, border: `1px solid ${T.accent}40`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: T.accent, cursor: 'pointer' }}>↺ Actualizar</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* KPI CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Comisiones del Mes', val: fmt(data.mrrReal), sub: `Meta: ${fmt(META)}`, color: T.accent, pct: mrrPct },
            { label: 'Total Acumulado',    val: fmt(data.mrrTotal), sub: `${data.commissions.length} pólizas`, color: T.green, pct: null },
            { label: 'Pendientes de Cobro',val: fmt(data.pending), sub: 'Por recibir', color: T.gold, pct: null },
            { label: 'Chargebacks',        val: String(data.chargebacks), sub: data.chargebacks > 0 ? 'Acción requerida' : 'Todo limpio ✅', color: data.chargebacks > 0 ? T.red : T.green, pct: null },
          ].map((k, i) => (
            <div key={i} style={{ background: T.panel, border: `1px solid ${k.color}25`, borderTop: `3px solid ${k.color}`, borderRadius: 14, padding: 16, backdropFilter: 'blur(20px)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: k.color, marginBottom: 4 }}>{k.val}</div>
              {k.pct !== null && (
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${k.pct}%`, background: k.color, borderRadius: 2, transition: 'width 1s' }}/>
                </div>
              )}
              <div style={{ fontSize: 10, color: T.muted }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* BREAKDOWN ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Por Carrier */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, backdropFilter: 'blur(20px)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 14 }}>Por Carrier</div>
            {Object.entries(data.byCarrier).length === 0
              ? <div style={{ fontSize: 12, color: T.muted, textAlign: 'center', padding: '16px 0' }}>Sin datos aún</div>
              : Object.entries(data.byCarrier)
                  .sort(([,a],[,b]) => b - a)
                  .map(([carrier, amount]) => {
                    const maxAmount = Math.max(...Object.values(data.byCarrier))
                    const pct = maxAmount > 0 ? Math.round((amount / maxAmount) * 100) : 0
                    return (
                      <div key={carrier} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{carrier}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: T.green }}>{fmt(amount)}</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: T.green, borderRadius: 3 }}/>
                        </div>
                      </div>
                    )
                  })
            }
          </div>

          {/* Por Producto */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, backdropFilter: 'blur(20px)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 14 }}>Por Producto</div>
            {Object.entries(data.byProduct).length === 0
              ? <div style={{ fontSize: 12, color: T.muted, textAlign: 'center', padding: '16px 0' }}>Sin datos aún</div>
              : Object.entries(data.byProduct)
                  .sort(([,a],[,b]) => b - a)
                  .map(([product, amount]) => {
                    const maxAmount = Math.max(...Object.values(data.byProduct))
                    const pct = maxAmount > 0 ? Math.round((amount / maxAmount) * 100) : 0
                    return (
                      <div key={product} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{product}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: T.cyan }}>{fmt(amount)}</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: T.cyan, borderRadius: 3 }}/>
                        </div>
                      </div>
                    )
                  })
            }
          </div>
        </div>

        {/* COMMISSIONS TABLE */}
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', backdropFilter: 'blur(20px)' }}>

          {/* Table controls */}
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase' }}>Historial de Pólizas</div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
              {(['all','paid','pending','chargeback'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: filter === f ? `${T.accent}25` : 'transparent', border: `1px solid ${filter === f ? T.accent : T.border}`, color: filter === f ? T.accent : T.muted }}>
                  {f === 'all' ? 'Todas' : STATUS_LABEL[f]}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: T.muted }}>Ordenar:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 10, color: T.text, cursor: 'pointer' }}>
                <option value="date"    style={{ background: '#0d0820' }}>Fecha</option>
                <option value="amount"  style={{ background: '#0d0820' }}>Monto</option>
                <option value="carrier" style={{ background: '#0d0820' }}>Carrier</option>
              </select>
            </div>
          </div>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr', padding: '8px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${T.border}` }}>
            {['Carrier / Producto','Prima','Comisión','Estado','Póliza','Fecha'].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.muted, textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {/* Table rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>Sin comisiones registradas</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
                Cuando registres pólizas cerradas aparecerán aquí.<br/>
                También puedes agregar comisiones manualmente.
              </div>
            </div>
          ) : filtered.map((c, i) => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 16px', borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', background: c.status === 'chargeback' ? `${T.red}08` : 'transparent' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{c.carrier ?? '—'}</div>
                <div style={{ fontSize: 10, color: T.muted }}>{c.product ?? '—'}</div>
              </div>
              <div style={{ fontSize: 12, color: T.text }}>{c.premium ? fmt(c.premium) : '—'}</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: c.status === 'chargeback' ? T.red : T.green }}>
                {c.commission_amount ? fmt(c.commission_amount) : '—'}
                {c.commission_rate && <div style={{ fontSize: 9, color: T.muted, fontWeight: 400 }}>{Math.round(c.commission_rate * 100)}%</div>}
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${STATUS_COLOR[c.status] ?? '#888'}18`, color: STATUS_COLOR[c.status] ?? '#888', border: `1px solid ${STATUS_COLOR[c.status] ?? '#888'}30` }}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>{c.policy_number ?? '—'}</div>
              <div style={{ fontSize: 10, color: T.muted }}>{fmtDate(c.paid_date ?? c.effective_date ?? c.created_at)}</div>
            </div>
          ))}
        </div>

        {/* EMPTY STATE — add commission */}
        {data.commissions.length === 0 && (
          <div style={{ background: `${T.accent}08`, border: `1px dashed ${T.accent}30`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, marginBottom: 8 }}>
              💡 ¿Cómo registrar comisiones?
            </div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
              Cuando cierres una póliza en el Pipeline, Sophia puede registrarla automáticamente.<br/>
              También puedes conectar el carrier API para que lleguen solas (próximamente).
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
