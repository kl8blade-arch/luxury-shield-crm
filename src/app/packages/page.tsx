'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/design'

/*
  SQL para tablas (ejecutar en Supabase si no existen):

  CREATE TABLE IF NOT EXISTS lead_packages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    name text NOT NULL,
    lead_count integer NOT NULL,
    price numeric NOT NULL,
    price_per_lead numeric GENERATED ALWAYS AS (price / NULLIF(lead_count, 0)) STORED,
    description text,
    badge text,
    active boolean DEFAULT true
  );

  CREATE TABLE IF NOT EXISTS lead_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    agent_id uuid REFERENCES agents(id),
    package_id uuid REFERENCES lead_packages(id),
    package_name text,
    lead_count integer,
    amount numeric,
    status text DEFAULT 'completed',
    stripe_session_id text
  );

  -- Sample packages
  INSERT INTO lead_packages (name, lead_count, price, description, badge) VALUES
    ('Starter', 10, 49, 'Ideal para probar el sistema', null),
    ('Growth', 25, 99, 'Para agentes activos', 'Popular'),
    ('Pro', 50, 179, 'Mejor precio por lead', 'Mejor valor'),
    ('Business', 100, 299, 'Para equipos pequeños', null),
    ('Scale', 250, 599, 'Alto volumen', null),
    ('Enterprise', 500, 999, 'Máximo volumen', null),
    ('Agency', 1000, 1799, 'Para agencias', null),
    ('Unlimited', 2500, 3999, 'Sin límites', null);
*/

interface Package {
  id: string
  name: string
  lead_count: number
  price: number
  price_per_lead: number
  description: string
  badge: string | null
}

interface Order {
  id: string
  created_at: string
  package_name: string
  lead_count: number
  amount: number
  status: string
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: pkgs }, { data: ords }] = await Promise.all([
      supabase.from('lead_packages').select('*').eq('active', true).order('price', { ascending: true }),
      supabase.from('lead_orders').select('*').order('created_at', { ascending: false }).limit(10),
    ])
    setPackages(pkgs || [])
    setOrders(ords || [])
    setLoading(false)
  }

  const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
    'Popular': { bg: 'rgba(249,115,22,0.12)', text: '#f97316', border: 'rgba(249,115,22,0.3)' },
    'Mejor valor': { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  }

  return (
    <div style={{ padding: '36px 32px', background: C.bg, minHeight: '100vh', fontFamily: C.font }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: C.text, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Paquetes de Leads</h1>
        <p style={{ color: C.textMuted, fontSize: '13px', marginTop: '4px' }}>Compra leads calificados para tu negocio</p>
      </div>

      {/* Packages grid */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted, fontSize: '14px' }}>Cargando paquetes...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '36px' }}>
          {packages.map(pkg => {
            const badge = pkg.badge ? badgeColors[pkg.badge] : null
            return (
              <div key={pkg.id} style={{
                background: C.surface, border: badge ? `1px solid ${badge.border}` : `1px solid ${C.border}`,
                borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}>
                {badge && (
                  <div style={{
                    position: 'absolute', top: '14px', right: '14px',
                    background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`,
                    fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px',
                  }}>{pkg.badge}</div>
                )}

                <p style={{ color: C.gold, fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>{pkg.name}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                  <span style={{ color: C.text, fontSize: '36px', fontWeight: 800 }}>${pkg.price}</span>
                </div>
                <p style={{ color: C.textDim, fontSize: '12px', margin: '0 0 4px' }}>{pkg.lead_count} leads</p>
                <p style={{ color: C.textMuted, fontSize: '11px', margin: '0 0 16px' }}>
                  ${(pkg.price / pkg.lead_count).toFixed(2)} por lead
                </p>
                <p style={{ color: C.textDim, fontSize: '12px', margin: '0 0 20px', lineHeight: 1.5 }}>{pkg.description}</p>

                <button
                  onClick={() => setSelectedPkg(pkg)}
                  style={{
                    width: '100%', padding: '11px', borderRadius: '10px', cursor: 'pointer',
                    fontFamily: C.font, fontSize: '13px', fontWeight: 700,
                    background: badge ? 'linear-gradient(135deg, #C9A84C, #8B6E2E)' : 'rgba(201,168,76,0.08)',
                    color: badge ? '#07080A' : C.gold,
                    border: badge ? 'none' : `1px solid rgba(201,168,76,0.22)`,
                  }}
                >Comprar</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Orders history */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ color: C.text, fontSize: '15px', fontWeight: 700, margin: 0 }}>Historial de compras</h2>
        </div>
        {orders.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '14px', opacity: 0.5 }}>🛒</div>
            <p style={{ color: C.textMuted, fontSize: '13px' }}>Aún no has comprado paquetes.</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '10px 24px', borderBottom: `1px solid ${C.border}` }}>
              {['Paquete', 'Leads', 'Monto', 'Status', 'Fecha'].map(h => (
                <p key={h} style={{ color: C.textMuted, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>{h}</p>
              ))}
            </div>
            {orders.map((order, i) => (
              <div key={order.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '14px 24px', alignItems: 'center',
                borderBottom: i < orders.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
              }}>
                <p style={{ color: C.text, fontSize: '13px', fontWeight: 600, margin: 0 }}>{order.package_name}</p>
                <p style={{ color: C.textDim, fontSize: '13px', margin: 0 }}>{order.lead_count}</p>
                <p style={{ color: C.gold, fontSize: '13px', fontWeight: 700, margin: 0 }}>${order.amount}</p>
                <span style={{
                  display: 'inline-block', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '100px',
                  background: order.status === 'completed' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                  color: order.status === 'completed' ? '#34d399' : '#fbbf24',
                  border: `1px solid ${order.status === 'completed' ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}`,
                }}>{order.status === 'completed' ? 'Completado' : 'Pendiente'}</span>
                <p style={{ color: C.textMuted, fontSize: '12px', margin: 0 }}>
                  {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Buy Modal */}
      {selectedPkg && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setSelectedPkg(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: '20px',
            padding: '32px', width: '400px', maxWidth: '90vw', textAlign: 'center',
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 20px',
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
            }}>🛡️</div>
            <h3 style={{ color: C.text, fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>Paquete {selectedPkg.name}</h3>
            <p style={{ color: C.textDim, fontSize: '14px', margin: '0 0 24px' }}>
              {selectedPkg.lead_count} leads por <span style={{ color: C.gold, fontWeight: 700 }}>${selectedPkg.price}</span>
            </p>

            <div style={{
              background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '12px',
              padding: '16px', marginBottom: '24px', textAlign: 'left',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: C.textDim, fontSize: '13px' }}>Leads</span>
                <span style={{ color: C.text, fontSize: '13px', fontWeight: 600 }}>{selectedPkg.lead_count}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: C.textDim, fontSize: '13px' }}>Precio por lead</span>
                <span style={{ color: C.text, fontSize: '13px', fontWeight: 600 }}>${(selectedPkg.price / selectedPkg.lead_count).toFixed(2)}</span>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.text, fontSize: '14px', fontWeight: 700 }}>Total</span>
                <span style={{ color: C.gold, fontSize: '18px', fontWeight: 800 }}>${selectedPkg.price}</span>
              </div>
            </div>

            <button style={{
              width: '100%', padding: '14px', borderRadius: '12px', cursor: 'pointer',
              fontFamily: C.font, fontSize: '14px', fontWeight: 700,
              background: 'linear-gradient(135deg, #C9A84C, #8B6E2E)', color: '#07080A',
              border: 'none', marginBottom: '12px',
            }}>Pagar con Stripe</button>
            <button onClick={() => setSelectedPkg(null)} style={{
              width: '100%', padding: '12px', borderRadius: '10px', cursor: 'pointer',
              fontFamily: C.font, fontSize: '13px', color: C.textDim,
              background: 'transparent', border: `1px solid ${C.border}`,
            }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
