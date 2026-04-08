import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TOKEN_PACKAGES } from '@/lib/token-guard'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Lazy-load Stripe to avoid build errors
async function getStripe() {
  const Stripe = (await import('stripe')).default
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

/**
 * Auto-recharge tokens for an agent.
 * Called from token-guard when tokens run out and agent has auto mode enabled.
 */
export async function POST(req: NextRequest) {
  try {
    const { agentId } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'agentId requerido' }, { status: 400 })

    const { data: agent } = await supabase.from('agents')
      .select('id, token_recharge_mode, token_recharge_package, token_recharge_threshold, tokens_used, tokens_limit, tokens_extra, stripe_customer_id, phone, name')
      .eq('id', agentId).single()

    if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
    if (agent.token_recharge_mode === 'manual') return NextResponse.json({ recharged: false, reason: 'manual_mode' })

    // Find the package
    const pkg = TOKEN_PACKAGES.find(p => p.id === agent.token_recharge_package)
    if (!pkg) return NextResponse.json({ recharged: false, reason: 'no_package' })

    // Check if recharge is needed
    const remaining = (agent.tokens_limit || 0) + (agent.tokens_extra || 0) - (agent.tokens_used || 0)
    const total = (agent.tokens_limit || 0) + (agent.tokens_extra || 0)

    if (agent.token_recharge_mode === 'auto_zero' && remaining > 0) {
      return NextResponse.json({ recharged: false, reason: 'still_has_tokens' })
    }
    if (agent.token_recharge_mode === 'auto_threshold') {
      const pct = total > 0 ? (remaining / total) * 100 : 0
      if (pct > (agent.token_recharge_threshold || 20)) {
        return NextResponse.json({ recharged: false, reason: 'above_threshold' })
      }
    }

    // Attempt Stripe charge if customer exists
    if (agent.stripe_customer_id) {
      try {
        const stripe = await getStripe()
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(pkg.price * 100),
          currency: 'usd',
          customer: agent.stripe_customer_id,
          off_session: true,
          confirm: true,
          description: `Auto-recharge: ${pkg.name} (${pkg.tokens} tokens)`,
          metadata: { agentId, packageId: pkg.id },
        })

        if (paymentIntent.status === 'succeeded') {
          // Add tokens
          await supabase.from('agents').update({
            tokens_extra: (agent.tokens_extra || 0) + pkg.tokens,
          }).eq('id', agentId)

          // Log purchase
          await supabase.from('token_purchases').insert({
            agent_id: agentId, package_name: `Auto: ${pkg.name}`,
            token_count: pkg.tokens, amount_usd: pkg.price,
            stripe_session_id: paymentIntent.id,
          })

          // Notify agent via WhatsApp
          if (agent.phone) {
            const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
            const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
            const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM
            if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
              const cleanPhone = agent.phone.startsWith('+') ? agent.phone : `+1${agent.phone.replace(/\D/g, '')}`
              await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
                method: 'POST',
                headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanPhone}`,
                  Body: `🔄 *Recarga automatica de tokens*\n\nHola ${agent.name?.split(' ')[0] || ''},\n\nSe recargaron *${pkg.tokens} tokens* a tu cuenta.\nCargo: $${pkg.price} USD\n\nSaldo actual: ${(agent.tokens_limit || 0) + (agent.tokens_extra || 0) + pkg.tokens - (agent.tokens_used || 0)} tokens\n\nSophia sigue activa vendiendo por ti.`,
                }).toString(),
              })
            }
          }

          return NextResponse.json({ recharged: true, tokens: pkg.tokens, amount: pkg.price })
        }
      } catch (stripeErr: any) {
        console.error('[AUTO-RECHARGE] Stripe error:', stripeErr.message)
        // Payment failed — notify agent
        return NextResponse.json({ recharged: false, reason: 'payment_failed', error: stripeErr.message })
      }
    }

    return NextResponse.json({ recharged: false, reason: 'no_stripe_customer' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
