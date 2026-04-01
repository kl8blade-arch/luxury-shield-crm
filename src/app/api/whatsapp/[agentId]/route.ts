import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * Dynamic webhook per agent: /api/whatsapp/[agentId]
 * Each agent's Twilio sub-account points here.
 * Routes to the main webhook logic with agent context.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params

  // 1. Verify agent exists and is active
  const { data: agent } = await supabase.from('agents')
    .select('id, status, ai_blocked, ai_blocked_reason, name, account_id')
    .eq('id', agentId).single()

  if (!agent || (agent.status !== 'active' && agent.status !== 'verified')) {
    return new NextResponse('Not found', { status: 404 })
  }

  // 2. If AI is blocked, send static message (no tokens consumed)
  if (agent.ai_blocked) {
    const formData = await req.formData()
    const from = (formData.get('From') as string || '').replace('whatsapp:', '')
    const body = formData.get('Body') as string || ''

    // Save inbound message so agent sees it in CRM
    await supabase.from('conversations').insert({
      lead_phone: from, message: body, direction: 'inbound', created_at: new Date().toISOString(),
    })

    // Get agent's Twilio config to reply from THEIR number
    const { data: config } = await supabase.from('agent_twilio_config').select('twilio_number, byown_phone_number, mode').eq('agent_id', agentId).single()
    const fromNumber = config?.mode === 'managed' ? config.twilio_number : config?.byown_phone_number

    if (fromNumber) {
      // Static response that doesn't reveal AI or technical issues
      const staticMsg = `Hola, gracias por contactar a ${agent.name || 'nuestra agencia'}. En este momento estamos atendiendo otras consultas. Un agente se comunicara contigo muy pronto. 😊`

      // Use master Twilio to send (sub-account might not have WhatsApp approved yet)
      const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
      const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, To: `whatsapp:${from}`, Body: staticMsg }).toString(),
      })
    }

    // Log blocked message
    await supabase.from('agent_whatsapp_log').insert({
      agent_id: agentId, direction: 'inbound', from_number: from, status: 'blocked_no_tokens',
    })

    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { status: 200, headers: { 'Content-Type': 'text/xml' } })
  }

  // 3. Agent is active and has tokens — forward to main webhook
  // Reconstruct the request with agent context
  const formData = await req.formData()
  const mainWebhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'}/api/whatsapp`

  // Forward all form data to the main webhook
  const forwardBody = new URLSearchParams()
  formData.forEach((value, key) => forwardBody.append(key, value as string))
  forwardBody.append('_agentId', agentId) // Inject agent context

  const mainRes = await fetch(mainWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: forwardBody.toString(),
  })

  const responseBody = await mainRes.text()
  return new NextResponse(responseBody, { status: mainRes.status, headers: { 'Content-Type': 'text/xml' } })
}
