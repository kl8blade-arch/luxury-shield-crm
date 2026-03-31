import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Stripe webhook signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[STRIPE] Event: ${event.type}`)

  // Checkout completed (one-time or subscription first payment)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { packageId, packageName, leadCount, agentId } = session.metadata || {}

    console.log(`[STRIPE] Payment: ${packageName}, $${(session.amount_total || 0) / 100}, agent: ${agentId}`)

    // Save order
    await supabase.from('lead_orders').insert({
      agent_id: agentId || null,
      package_id: packageId || null,
      package_name: packageName,
      lead_count: parseInt(leadCount || '0'),
      amount: (session.amount_total || 0) / 100,
      status: 'completed',
      stripe_session_id: session.id,
    })

    // Update agent: activate, start 7-day trial, set plan
    if (agentId) {
      const { data: agent } = await supabase.from('agents').select('credits, phone, name, tokens_extra').eq('id', agentId).single()
      // Check if this is a token purchase
      if (packageId?.startsWith('tokens_')) {
        const tokenCount = parseInt(leadCount || '0')
        await supabase.from('agents').update({
          tokens_extra: (agent?.tokens_extra || 0) + tokenCount,
        }).eq('id', agentId)
        await supabase.from('token_purchases').insert({
          agent_id: agentId, package_name: packageName,
          token_count: tokenCount, amount_usd: (session.amount_total || 0) / 100,
          stripe_session_id: session.id,
        })
        console.log(`[STRIPE] Token purchase: ${tokenCount} tokens for agent ${agentId}`)
      } else {
        // Plan purchase/subscription
        const planMap: Record<string, string> = { starter: 'starter', professional: 'professional', agency: 'agency', enterprise: 'enterprise' }
        const subPlan = planMap[packageId || ''] || 'starter'
        const tokenLimits: Record<string, number> = { starter: 300, professional: 1000, agency: 3000, enterprise: 10000 }

        await supabase.from('agents').update({
          credits: (agent?.credits || 0) + parseInt(leadCount || '0'),
          paid: true, status: 'active',
          subscription_plan: subPlan,
          tokens_limit: tokenLimits[subPlan] || 300,
          tokens_used: 0,
          tokens_reset_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq('id', agentId)
      }

      // NOW trigger Sophia WhatsApp onboarding (only after payment)
      try {
        const { startAgentOnboarding } = await import('@/lib/agent-onboarding')
        startAgentOnboarding(agentId).catch(e => console.error('[STRIPE] Onboarding error:', e))
      } catch {}

      console.log(`[STRIPE] Agent ${agentId} activated: plan=${packageId}, 7-day trial started`)
    }
  }

  // Subscription events
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = sub.customer as string

    // Find agent by stripe customer ID
    const { data: agent } = await supabase.from('agents').select('id').eq('stripe_customer_id', customerId).single()
    if (agent) {
      const status = sub.status === 'active' ? true : false
      await supabase.from('agents').update({ paid: status }).eq('id', agent.id)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = sub.customer as string

    const { data: agent } = await supabase.from('agents').select('id').eq('stripe_customer_id', customerId).single()
    if (agent) {
      await supabase.from('agents').update({ paid: false, subscription_plan: 'free' }).eq('id', agent.id)
    }
  }

  return NextResponse.json({ received: true })
}
