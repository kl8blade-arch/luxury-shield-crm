import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
}

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

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { packageId, packageName, leadCount, agentId } = session.metadata || {}

    console.log(`Stripe payment completed: ${packageName}, ${leadCount} leads, agent: ${agentId}`)

    // Save order to lead_orders
    await supabase.from('lead_orders').insert({
      agent_id: agentId || null,
      package_id: packageId || null,
      package_name: packageName,
      lead_count: parseInt(leadCount || '0'),
      amount: (session.amount_total || 0) / 100,
      status: 'completed',
      stripe_session_id: session.id,
    })

    // Update agent credits
    if (agentId) {
      const { data: agent } = await supabase
        .from('agents')
        .select('credits')
        .eq('id', agentId)
        .single()

      if (agent) {
        await supabase
          .from('agents')
          .update({ credits: (agent.credits || 0) + parseInt(leadCount || '0') })
          .eq('id', agentId)
      }
    }
  }

  return NextResponse.json({ received: true })
}
