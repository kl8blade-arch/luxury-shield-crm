import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({ error: 'Stripe no esta configurado. Contacta al administrador.' }, { status: 503 })
    }

    const stripe = new Stripe(stripeKey)
    const { packageId, packageName, price, leadCount, agentId } = await req.json()

    if (!packageName || !price) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
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
              name: `Plan ${packageName} — Luxury Shield CRM`,
              description: packageName.includes('IA') ? 'Suscripcion mensual con creditos de IA incluidos' : `Suscripcion mensual ${packageName}`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        packageId: packageId || '',
        packageName,
        leadCount: String(leadCount || 0),
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
