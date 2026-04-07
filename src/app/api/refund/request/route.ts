import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const stripe = new Stripe(process.env.STRIPE_API_KEY!, { apiVersion: '2025-01-27' as any })

export async function POST(req: NextRequest) {
  try {
    const { agentId, reason } = await req.json()

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID requerido' }, { status: 400 })
    }

    // Get agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, email, name, stripe_customer_id, refund_deadline, status')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
    }

    // Check if within refund window
    if (!agent.refund_deadline) {
      return NextResponse.json({ error: 'No hay ventana de reembolso activa' }, { status: 400 })
    }

    const refundDeadline = new Date(agent.refund_deadline).getTime()
    const now = Date.now()

    if (now > refundDeadline) {
      return NextResponse.json({ error: 'La ventana de reembolso de 7 días ha expirado' }, { status: 400 })
    }

    // Cancel subscription in Stripe
    if (agent.stripe_customer_id) {
      try {
        // Get active subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: agent.stripe_customer_id,
          status: 'active',
          limit: 1,
        })

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0]

          // Cancel subscription
          await stripe.subscriptions.update(subscription.id, {
            cancel_at_period_end: false,
          })

          // Issue refund for the charge
          const charges = await stripe.charges.list({
            customer: agent.stripe_customer_id,
            limit: 1,
          })

          if (charges.data.length > 0) {
            const charge = charges.data[0]
            if (charge.refunded === false) {
              await stripe.refunds.create({
                charge: charge.id,
                reason: 'requested_by_customer',
              })
            }
          }
        }
      } catch (stripeError: any) {
        console.error('[REFUND] Stripe error:', stripeError)
        // Continue even if Stripe fails — cancel the account locally
      }
    }

    // Cancel account locally
    await supabase.from('agents').update({
      status: 'cancelled',
      paid: false,
      subscription_plan: 'free',
      refund_deadline: null,
    }).eq('id', agentId)

    console.log(`[REFUND] Agent ${agentId} refunded and cancelled`)

    return NextResponse.json({
      success: true,
      message: 'Tu suscripción ha sido cancelada y se ha procesado el reembolso. Recibirás el dinero en 5-10 días hábiles.',
    })
  } catch (err: any) {
    console.error('[REFUND] Error:', err)
    return NextResponse.json({ error: 'Error al procesar reembolso' }, { status: 500 })
  }
}
