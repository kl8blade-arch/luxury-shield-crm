import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 })

    const stripe = new Stripe(stripeKey)
    const { packageId, packageName, price, leadCount, agentId, trialDays } = await req.json()
    if (!packageName) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'

    // Subscription with trial (registration flow)
    if (trialDays && price > 0) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `Luxury Shield CRM — ${packageName}` },
            unit_amount: Math.round(price * 100),
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        subscription_data: {
          trial_period_days: trialDays,
          metadata: { packageId: packageId || '', agentId: agentId || '' },
        },
        metadata: { packageId: packageId || '', packageName, leadCount: String(leadCount || 0), agentId: agentId || '' },
        success_url: `${origin}/setup?payment=success`,
        cancel_url: `${origin}/register?payment=cancelled`,
      })
      return NextResponse.json({ url: session.url })
    }

    // One-time payment (token packages, plan upgrades)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Plan ${packageName} — Luxury Shield CRM` },
          unit_amount: Math.round((price || 0) * 100),
        },
        quantity: 1,
      }],
      metadata: { packageId: packageId || '', packageName, leadCount: String(leadCount || 0), agentId: agentId || '' },
      success_url: `${origin}/packages?success=true`,
      cancel_url: `${origin}/packages?cancelled=true`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Stripe checkout error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
