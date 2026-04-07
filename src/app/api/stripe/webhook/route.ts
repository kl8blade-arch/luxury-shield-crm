import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const parts = signature.split(',').reduce((acc: Record<string, string>, part) => {
      const [key, val] = part.split('='); acc[key] = val; return acc
    }, {})
    const timestamp = parts['t']
    const sig = parts['v1']
    if (!timestamp || !sig) return false
    const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch { return false }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') || ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  // Verify signature if secret is configured
  if (webhookSecret && signature) {
    if (!verifyStripeSignature(body, signature, webhookSecret)) {
      console.error('[STRIPE] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  }

  let event: any
  try { event = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  console.log(`[STRIPE] Event: ${event.type}`)

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object
    const metadata = session?.metadata || {}
    const subMetadata = session?.subscription_data?.metadata || session?.metadata || metadata
    const { packageId, packageName, leadCount, agentId } = { ...metadata, ...subMetadata }

    const realAgentId = agentId || metadata.agentId || subMetadata.agentId
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
    const sub = event.data?.object
    const customerId = sub?.customer
    if (customerId) {
      const { data: agent } = await supabase.from('agents').select('id').eq('stripe_customer_id', customerId).single()
      if (agent) await supabase.from('agents').update({ paid: false, subscription_plan: 'free' }).eq('id', agent.id)
    }
  }

  return NextResponse.json({ received: true })
}
