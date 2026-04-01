'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function CompleteInner() {
  const searchParams = useSearchParams()
  const number = searchParams.get('number')

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ minHeight: '100vh', background: '#050507', fontFamily: '"Outfit",sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ width: '480px', maxWidth: '96vw', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 24px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>

          <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: '36px', fontWeight: 300, color: '#F0ECE3', margin: '0 0 8px' }}>Todo listo!</h1>
          <p style={{ fontSize: '15px', color: 'rgba(240,236,227,0.4)', marginBottom: '32px' }}>Tu motor de ventas esta activo</p>

          {number && number !== 'pendiente' && (
            <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', margin: '0 0 6px' }}>Tu numero de WhatsApp Business:</p>
              <p style={{ fontSize: '24px', fontWeight: 700, color: '#C9A84C', margin: '0 0 8px', fontFamily: 'monospace' }}>{number}</p>
              <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.25)', margin: 0 }}>La activacion de WhatsApp Business puede tomar hasta 24h. Tu numero ya puede recibir SMS.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px', textAlign: 'left', padding: '0 20px' }}>
            {[
              'Sophia lista para responder leads 24/7',
              'Calificacion y seguimiento automatico',
              'Resumenes diarios de actividad',
              'Pipeline inteligente con lead scoring',
            ].map(f => (
              <div key={f} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#34d399', fontSize: '14px' }}>&#10003;</span>
                <span style={{ fontSize: '14px', color: 'rgba(240,236,227,0.5)' }}>{f}</span>
              </div>
            ))}
          </div>

          <a href="/setup" style={{
            display: 'inline-block', padding: '16px 48px', borderRadius: '14px', fontSize: '15px', fontWeight: 700,
            background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#050507', textDecoration: 'none',
            boxShadow: '0 8px 32px rgba(201,168,76,0.3)',
          }}>
            Ir a configurar mi CRM &rarr;
          </a>
        </div>
      </div>
    </>
  )
}

export default function CompletePage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050507' }} />}><CompleteInner /></Suspense>
}
