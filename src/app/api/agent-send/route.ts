import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { lead_id, message, agent_id } = await req.json()
    if (!lead_id || !message) return NextResponse.json({ error: 'lead_id and message required' }, { status: 400 })

    const { data: lead } = await supabase.from('leads').select('phone, name, agent_id').eq('id', lead_id).single()
    if (!lead?.phone) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // Determine which agent is sending
    const sendingAgentId = agent_id || lead.agent_id

    // Look up the agent to check role
    let isAdmin = false
    if (sendingAgentId) {
      const { data: agent } = await supabase.from('agents').select('role').eq('id', sendingAgentId).single()
      isAdmin = agent?.role === 'admin'
    }

    if (isAdmin) {
      // Admin (master account) — unlimited, uses master Twilio
      const sid = process.env.TWILIO_ACCOUNT_SID!
      const token = process.env.TWILIO_AUTH_TOKEN!
      const from = process.env.TWILIO_WHATSAPP_FROM!
      await sendVia(sid, token, from, lead.phone, message)
    } else if (sendingAgentId) {
      // Non-admin — check for their own Twilio config
      const { getTwilioConfigForAgent } = await import('@/lib/twilio-provisioner')
      const config = await getTwilioConfigForAgent(sendingAgentId)

      if (config) {
        // Has their own number — send via their Twilio
        await sendVia(config.sid, config.token, config.fromNumber, lead.phone, message)
      } else {
        // Check if still in trial — provision temporary via master during trial
        const { data: agentData } = await supabase.from('agents').select('trial_ends_at, status, created_at').eq('id', sendingAgentId).single()
        const trialEnds = agentData?.trial_ends_at ? new Date(agentData.trial_ends_at) : null
        const isInTrial = trialEnds && trialEnds > new Date()

        if (isInTrial) {
          // Trial period — allow via master Twilio (temporary)
          const sid = process.env.TWILIO_ACCOUNT_SID!
          const token = process.env.TWILIO_AUTH_TOKEN!
          const from = process.env.TWILIO_WHATSAPP_FROM!
          await sendVia(sid, token, from, lead.phone, message)
        } else {
          // Trial expired, no config — block and upsell
          return NextResponse.json({
            error: 'whatsapp_not_configured',
            message: 'Tu periodo de prueba de WhatsApp ha terminado. Para seguir enviando mensajes necesitas tu propio numero. Te lo configuramos por $20/mes con conversaciones ilimitadas.',
            action: 'configure_whatsapp',
          }, { status: 403 })
        }
      }
    } else {
      return NextResponse.json({ error: 'No se pudo determinar el agente' }, { status: 400 })
    }

    // Save to conversations
    await supabase.from('conversations').insert({
      lead_id,
      lead_name: lead.name,
      lead_phone: lead.phone,
      channel: 'whatsapp',
      direction: 'outbound',
      message,
      ai_summary: agent_id ? `Enviado por agente ${agent_id}` : 'Enviado manualmente desde CRM',
    })

    // Update lead
    await supabase.from('leads').update({
      last_contact: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', lead_id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Agent send error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function sendVia(sid: string, token: string, from: string, to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const cleanFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`
  const body = new URLSearchParams({
    From: cleanFrom,
    To: `whatsapp:${cleanTo}`,
    Body: message,
  })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  const result = await res.json()
  if (result.code && result.code >= 20000) {
    throw new Error(result.message || 'Twilio error')
  }
  return result
}
