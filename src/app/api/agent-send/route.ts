import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!

export async function POST(req: NextRequest) {
  try {
    const { lead_id, message, agent_id } = await req.json()
    if (!lead_id || !message) return NextResponse.json({ error: 'lead_id and message required' }, { status: 400 })

    const { data: lead } = await supabase.from('leads').select('phone, name').eq('id', lead_id).single()
    if (!lead?.phone) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const cleanTo = lead.phone.startsWith('+') ? lead.phone : `+${lead.phone.replace(/\D/g, '')}`

    // Send via Twilio
    const body = new URLSearchParams({
      From: `whatsapp:${TWILIO_FROM}`,
      To: `whatsapp:${cleanTo}`,
      Body: message,
    })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    const result = await res.json()

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

    return NextResponse.json({ success: true, sid: result.sid })
  } catch (error: any) {
    console.error('Agent send error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
