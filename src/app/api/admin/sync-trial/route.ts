import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Lazy-load Stripe to avoid build errors
async function getStripe() {
  const Stripe = (await import('stripe')).default
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

export async function POST(req: NextRequest) {
  // Auth check
  const auth = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  console.log('DEBUG - Auth header:', auth)
  console.log('DEBUG - Expected:', expected)
  console.log('DEBUG - CRON_SECRET value:', process.env.CRON_SECRET)
  console.log('DEBUG - Match:', auth === expected)

  if (auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized', debug: { received: auth, expected, cronSecret: process.env.CRON_SECRET } }, { status: 401 })
  }

  const { agentEmail, action, days } = await req.json()

  if (!agentEmail || !action) {
    return NextResponse.json({ error: 'agentEmail and action required' }, { status: 400 })
  }

  if (!['expire_now', 'extend_days'].includes(action)) {
    return NextResponse.json({ error: 'action must be expire_now or extend_days' }, { status: 400 })
  }

  if (action === 'extend_days' && (!days || days < 1)) {
    return NextResponse.json({ error: 'days required for extend_days (min 1)' }, { status: 400 })
  }

  // Find agent
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, name, email, stripe_customer_id, trial_ends_at, status, paid')
    .eq('email', agentEmail)
    .single()

  if (agentError || !agent) {
    return NextResponse.json({ error: `Agent not found: ${agentEmail}` }, { status: 404 })
  }

  if (!agent.stripe_customer_id) {
    return NextResponse.json({ error: 'Agent has no stripe_customer_id. They may not have completed checkout.' }, { status: 400 })
  }

  // Find active subscription in Stripe
  const stripe = await getStripe()
  const subscriptions = await stripe.subscriptions.list({
    customer: agent.stripe_customer_id,
    status: 'trialing',
    limit: 1,
  })

  let subscription = subscriptions.data[0]

  // If no trialing sub, check for active
  if (!subscription) {
    const activeSubs = await stripe.subscriptions.list({
      customer: agent.stripe_customer_id,
      status: 'active',
      limit: 1,
    })
    subscription = activeSubs.data[0]
  }

  if (!subscription) {
    return NextResponse.json({
      error: 'No active/trialing subscription found in Stripe',
      stripe_customer_id: agent.stripe_customer_id,
    }, { status: 404 })
  }

  const now = Math.floor(Date.now() / 1000)

  if (action === 'expire_now') {
    // End trial immediately in Stripe — triggers billing
    await stripe.subscriptions.update(subscription.id, { trial_end: 'now' })

    // Update Supabase
    await supabase.from('agents').update({
      trial_ends_at: new Date().toISOString(),
    }).eq('id', agent.id)

    return NextResponse.json({
      success: true,
      action: 'expire_now',
      agent: agent.email,
      subscription_id: subscription.id,
      message: 'Trial ended. Stripe will charge the card now.',
    })
  }

  if (action === 'extend_days') {
    const newTrialEnd = now + (days * 24 * 60 * 60)
    const newTrialEndDate = new Date(newTrialEnd * 1000).toISOString()

    // Extend in Stripe
    await stripe.subscriptions.update(subscription.id, { trial_end: newTrialEnd })

    // Extend in Supabase
    await supabase.from('agents').update({
      trial_ends_at: newTrialEndDate,
      status: 'active',
    }).eq('id', agent.id)

    return NextResponse.json({
      success: true,
      action: 'extend_days',
      days,
      agent: agent.email,
      subscription_id: subscription.id,
      new_trial_ends_at: newTrialEndDate,
    })
  }
}
