import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[STRIPE] Webhook signature failed:', err)
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 })
  }

  let parsedBody: any
  try { parsedBody = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  console.log(`[STRIPE] Event: ${event.type}`)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const metadata = session.metadata || {}

    // Check if this is a SophiaOS plan (new pricing model)
    const isSophiaOSPlan = metadata.planName && ['starter', 'pro', 'agency'].includes(metadata.planName)

    if (isSophiaOSPlan) {
      // Handle SophiaOS subscription
      const { agentId, planName, isAnnual } = metadata

      await supabase.from('agents').update({
        plan: planName.toLowerCase(),
        plan_status: 'active',
        plan_is_annual: isAnnual === 'true',
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan_activated_at: new Date().toISOString(),
        paid: true,
        status: 'active',
      }).eq('id', agentId)

      console.log(`[STRIPE] SophiaOS plan ${planName} activated for agent ${agentId}`)
    } else {
      // Handle legacy lead orders (old pricing model)
      const { packageId, packageName, leadCount, agentId } = metadata

      const realAgentId = agentId || metadata.agentId
      console.log(`[STRIPE] Payment: ${packageName}, agent: ${realAgentId}`)

      // Save order
      await supabase.from('lead_orders').insert({
        agent_id: realAgentId || null,
        package_name: packageName || 'Plan',
        lead_count: parseInt(leadCount || '0'),
        amount: (session?.amount_total || 0) / 100,
        status: 'completed',
        stripe_session_id: session?.id,
      })

      if (realAgentId) {
        const { data: agent } = await supabase.from('agents').select('credits, tokens_extra').eq('id', realAgentId).single()

        // Token purchase
        if (packageId?.startsWith('tokens_')) {
          const tokenCount = parseInt(leadCount || '0')
          await supabase.from('agents').update({ tokens_extra: (agent?.tokens_extra || 0) + tokenCount }).eq('id', realAgentId)
          await supabase.from('token_purchases').insert({ agent_id: realAgentId, package_name: packageName, token_count: tokenCount, amount_usd: (session?.amount_total || 0) / 100, stripe_session_id: session?.id })
        } else {
          // Plan purchase — activate account
          const planMap: Record<string, string> = { starter: 'starter', professional: 'professional', agency: 'agency', enterprise: 'enterprise' }
          const tokenLimits: Record<string, number> = { starter: 300, professional: 1000, agency: 3000, enterprise: 10000 }
          const subPlan = planMap[packageId || ''] || 'starter'

          // GAP 2 fix: guardar stripe_customer_id
          const stripeCustomerId = session?.customer || null

          await supabase.from('agents').update({
            credits: (agent?.credits || 0) + parseInt(leadCount || '0'),
            paid: true, status: 'active',
            subscription_plan: subPlan,
            tokens_limit: tokenLimits[subPlan] || 300,
            tokens_used: 0, tokens_reset_at: new Date().toISOString(),
            refund_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
          }).eq('id', realAgentId)

          console.log(`[STRIPE] Agent ${realAgentId} activated: plan=${subPlan}, customer=${stripeCustomerId}`)

          // Trigger Sophia onboarding after payment
          try {
            const { startAgentOnboarding } = await import('@/lib/agent-onboarding')
            startAgentOnboarding(realAgentId).catch(() => {})
          } catch {}
        }
      }
    }
  }

  // GAP 1 fix: reactivar cuenta al pagar (ej: usuario con trial_expired que re-paga)
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data?.object
    const customerId = invoice?.customer
    if (customerId) {
      const { data: agent } = await supabase.from('agents').select('id, status').eq('stripe_customer_id', customerId).single()
      if (agent && agent.status === 'trial_expired') {
        await supabase.from('agents').update({ status: 'active', paid: true }).eq('id', agent.id)
        console.log(`[STRIPE] Agent ${agent.id} reactivated via invoice.payment_succeeded`)
      }
    }
  }

  // Subscription events
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = sub.customer
    if (customerId) {
      const { data: agent } = await supabase.from('agents').select('id').eq('stripe_customer_id', customerId as string).single()
      if (agent) {
        await supabase.from('agents').update({
          paid: false,
          subscription_plan: 'free',
          plan: 'free',
          plan_status: 'cancelled',
          plan_activated_at: null,
        }).eq('id', agent.id)
        console.log(`[STRIPE] Subscription cancelled for agent ${agent.id}`)
      }
    }
  }

  return NextResponse.json({ received: true })
}
