import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!

export async function POST(req: NextRequest) {
  try {
    const { lead_id, lead_phone, message } = await req.json()
    if (!lead_phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

    const cleanTo = lead_phone.startsWith('+') ? lead_phone : `+${lead_phone.replace(/\D/g, '')}`
    const twiml = `<Response><Say voice="Polly.Lupe" language="es-US">${message || 'Hola, te llamamos de Luxury Shield Insurance para confirmar tu cita.'}</Say></Response>`

    const body = new URLSearchParams({
      To: cleanTo,
      From: process.env.TWILIO_WHATSAPP_FROM!.replace('whatsapp:', ''),
      Twiml: twiml,
    })

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await res.json()

    await supabase.from('voice_calls').insert({ lead_id, lead_phone: cleanTo, call_sid: data.sid, direction: 'outbound', status: data.status || 'initiated' })

    return NextResponse.json({ success: true, call_sid: data.sid, status: data.status })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
