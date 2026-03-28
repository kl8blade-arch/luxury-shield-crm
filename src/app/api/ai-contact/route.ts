import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/*
  SQL — ejecutar en Supabase si no existen:
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS color_favorito text;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS resumen_sophia text;
*/

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!

async function sendWhatsApp(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const body = new URLSearchParams({
    From: `whatsapp:${TWILIO_FROM}`,
    To: `whatsapp:${cleanTo}`,
    Body: message,
  })
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  )
  return res.json()
}

// Single welcome message with color security integrated
function getFirstMessage(lead: any): string {
  const name = lead.name?.split(' ')[0] || 'Hola'
  const color = lead.favorite_color || lead.color_favorito

  if (color) {
    return `Hola ${name} 😊 Soy Sophia de *Luxury Shield Insurance*.

Vi que elegiste el color *${color}* — ese es tu código de seguridad personal. Cualquier asesor nuestro lo mencionará antes de darte información confidencial.

¿Tienes un momento? Quiero explicarte cómo funciona tu bono de beneficios de visión 💙`
  }

  return `Hola ${name} 😊 Soy Sophia de *Luxury Shield Insurance*.

Vi que solicitaste información sobre tu cobertura dental en ${lead.state || 'tu estado'}. ¡Tenemos muy buenas noticias para ti! 🦷

¿Tienes un momento? Quiero contarte cómo puedes cubrir tu limpieza, evaluación y radiografías por $0 💙`
}

// Called by save-lead API — sends ONE welcome message, Sophia responds only when lead replies
export async function POST(req: NextRequest) {
  try {
    const { lead_id } = await req.json()

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 })
    }

    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
    }

    if (!lead.phone) {
      return NextResponse.json({ error: 'Lead sin teléfono' }, { status: 400 })
    }

    // Check if already contacted
    const { count } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', lead_id)
      .eq('direction', 'outbound')

    if (count && count > 0) {
      return NextResponse.json({ message: 'Lead ya contactado', already_contacted: true })
    }

    const message = getFirstMessage(lead)

    // Send single welcome message
    const result = await sendWhatsApp(lead.phone, message)

    if (result.error_code) {
      throw new Error(`Twilio error: ${result.message}`)
    }

    // Save to conversations
    await supabase.from('conversations').insert({
      lead_id: lead.id,
      lead_name: lead.name,
      lead_phone: lead.phone,
      channel: 'ai_text',
      direction: 'outbound',
      message,
      ai_summary: 'Primer contacto — Sophia IA (con color de seguridad)',
    })

    // Update lead — Sophia waits for lead to reply
    await supabase.from('leads').update({
      stage: 'contact',
      ia_active: true,
      last_contact: new Date().toISOString(),
      contact_attempts: 1,
    }).eq('id', lead.id)

    return NextResponse.json({
      success: true,
      message_sent: message,
      twilio_sid: result.sid,
    })

  } catch (error: any) {
    console.error('AI outbound error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
