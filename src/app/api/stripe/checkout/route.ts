import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({ error: 'Stripe no esta configurado. Contacta al administrador para activar los pagos.' }, { status: 503 })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' as any })
    const { packageId, packageName, price, leadCount, agentId } = await req.json()

    if (!packageName || !price || !leadCount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Paquete ${packageName}`,
              description: `${leadCount} leads calificados para tu negocio`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        packageId: packageId || '',
        packageName,
        leadCount: String(leadCount),
        agentId: agentId || '',
      },
      success_url: `${origin}/packages?success=true`,
      cancel_url: `${origin}/packages?cancelled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
