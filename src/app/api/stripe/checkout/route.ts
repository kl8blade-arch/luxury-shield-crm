import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({ error: 'Stripe no esta configurado' }, { status: 503 })
    }

    const stripe = new Stripe(stripeKey)
    const { packageId, packageName, price, leadCount, agentId, trialDays } = await req.json()

    if (!packageName) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'

    // If trialDays is set, create a SUBSCRIPTION with trial (card required upfront)
    if (trialDays && price > 0) {
      // Create or find product
      const products = await stripe.products.list({ limit: 10 })
      let product = products.data.find(p => p.metadata?.plan_key === packageId)
      if (!product) {
        product = await stripe.products.create({
          name: `Luxury Shield CRM — ${packageName}`,
          metadata: { plan_key: packageId || '' },
        })
      }

      // Create or find price
      const prices = await stripe.prices.list({ product: product.id, active: true, limit: 5 })
      let priceObj = prices.data.find(p => p.unit_amount === Math.round(price * 100) && p.recurring?.interval === 'month')
      if (!priceObj) {
        priceObj = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(price * 100),
          currency: 'usd',
          recurring: { interval: 'month' },
        })
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceObj.id, quantity: 1 }],
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

    // Regular one-time payment (no trial)
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
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
