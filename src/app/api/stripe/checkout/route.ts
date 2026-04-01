import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 })

    const { packageId, packageName, price, leadCount, agentId, trialDays } = await req.json()
    if (!packageName) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'
    const auth = `Basic ${Buffer.from(`${stripeKey}:`).toString('base64')}`

    // Build checkout session params
    const params = new URLSearchParams()
    params.append('mode', trialDays ? 'subscription' : 'payment')
    params.append('payment_method_types[]', 'card')
    params.append('line_items[0][price_data][currency]', 'usd')
    params.append('line_items[0][price_data][product_data][name]', `Luxury Shield CRM — ${packageName}`)
    params.append('line_items[0][price_data][unit_amount]', String(Math.round((price || 0) * 100)))
    params.append('line_items[0][quantity]', '1')

    if (trialDays) {
      params.append('line_items[0][price_data][recurring][interval]', 'month')
      params.append('subscription_data[trial_period_days]', String(trialDays))
      params.append('subscription_data[metadata][packageId]', packageId || '')
      params.append('subscription_data[metadata][agentId]', agentId || '')
      params.append('success_url', `${origin}/setup?payment=success`)
      params.append('cancel_url', `${origin}/register?payment=cancelled`)
    } else {
      params.append('success_url', `${origin}/packages?success=true`)
      params.append('cancel_url', `${origin}/packages?cancelled=true`)
    }

    params.append('metadata[packageId]', packageId || '')
    params.append('metadata[packageName]', packageName)
    params.append('metadata[leadCount]', String(leadCount || 0))
    params.append('metadata[agentId]', agentId || '')

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Stripe API error:', data)
      return NextResponse.json({ error: data.error?.message || 'Error de Stripe' }, { status: res.status })
    }

    return NextResponse.json({ url: data.url })
  } catch (error: any) {
    console.error('Stripe checkout error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
