import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { priceId, agentId, email, planName, isAnnual } = await request.json()

    if (!priceId || !agentId || !email || !planName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?checkout=success&plan=${planName}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/register?checkout=cancelled`,
      customer_email: email,
      metadata: {
        agentId,
        planName,
        isAnnual: isAnnual ? 'true' : 'false',
      },
      subscription_data: {
        metadata: {
          agentId,
          planName,
          isAnnual: isAnnual ? 'true' : 'false',
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('[Stripe Checkout]', error)
    return NextResponse.json({ error: error.message || 'Error creating checkout session' }, { status: 500 })
  }
}
