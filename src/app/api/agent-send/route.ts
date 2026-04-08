import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!

async function sendWhatsApp(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const auth = `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`

  const msg = message.length > 1500 ? message.substring(0, 1497) + '...' : message

  const body = new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanTo}`, Body: msg })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  const data = await res.json()
  console.log('[Agent Send] WhatsApp sent:', data.sid, 'to:', cleanTo)
  return data
}

export async function POST(req: NextRequest) {
  try {
    const { lead_id, message, agent_id } = await req.json()

    if (!lead_id || !message?.trim()) {
      return NextResponse.json({ error: 'Lead ID y mensaje requeridos' }, { status: 400 })
    }

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, phone, name, agent_id, conversation_mode')
      .eq('id', lead_id)
      .single()

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
    }

    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      return NextResponse.json(
        {
          error: 'whatsapp_not_configured',
          message: 'WhatsApp no está configurado. Contacta al administrador.',
        },
        { status: 400 }
      )
    }

    const { error: saveErr } = await supabase.from('conversations').insert({
      lead_id: lead.id,
      lead_name: lead.name,
      lead_phone: lead.phone,
      channel: 'whatsapp',
      direction: 'outbound',
      message: message.trim(),
      created_at: new Date().toISOString(),
    })

    if (saveErr) {
      console.error('[Agent Send] Save error:', saveErr)
    }

    await supabase.from('leads').update({
      last_contact: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)

    try {
      const result = await sendWhatsApp(lead.phone, message.trim())
      if (!result.sid) {
        return NextResponse.json(
          { error: result.error_message || 'Error al enviar mensaje' },
          { status: 500 }
        )
      }
    } catch (e: any) {
      console.error('[Agent Send] WhatsApp error:', e)
      return NextResponse.json(
        { error: 'Error enviando mensaje por WhatsApp' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Mensaje enviado',
      lead_id: lead.id,
    })
  } catch (error: any) {
    console.error('[Agent Send] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error al procesar solicitud' },
      { status: 500 }
    )
  }
}
