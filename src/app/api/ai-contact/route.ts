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

// Single welcome message with color + quiz personalization
function getFirstMessage(lead: any): string {
  const name = lead.name?.split(' ')[0] || 'Hola'
  const color = lead.favorite_color || lead.color_favorito
  const quiz = lead.quiz_dentist_last_visit
  const coverage = lead.quiz_coverage_type
  const colorLine = color ? `\nVi que elegiste el color *${color}* — ese es tu código de seguridad personal. Cualquier asesor nuestro lo mencionará antes de darte información.\n` : ''

  // Personalize based on quiz answers
  if (quiz === 'Nunca he ido') {
    return `Hola ${name} 😊 Soy Sophia del equipo de *Luxury Shield*.
${colorLine}
Vi que nunca has ido al dentista — ¡este es el momento perfecto para empezar! Con tu plan de protección, tu primera evaluación, radiografías y limpieza salen por **$0**. Sin período de espera.

¿Tienes un momento? Te cuento cómo funciona 💙`
  }

  if (coverage === 'Familia con hijos' || coverage === 'Familia grande (5+)') {
    return `Hola ${name} 😊 Soy Sophia del equipo de *Luxury Shield*.
${colorLine}
Vi que quieres proteger a toda tu familia — ¡excelente decisión! El plan cubre evaluación, radiografías y limpieza para todos por **$0** desde el día 1. Una familia en Texas ahorró $1,474 en un solo mes.

¿Cuántos son en total? Así te doy el precio exacto 💙`
  }

  if (lead.quiz_has_insurance === 'No tengo nada') {
    return `Hola ${name} 😊 Soy Sophia del equipo de *Luxury Shield*.
${colorLine}
Vi que actualmente no tienes cobertura dental. ¿Sabías que una evaluación + radiografías + limpieza cuestan $280 sin plan? Con el plan DVH, todo eso es **$0** desde el primer mes.

¿Tienes un momento para contarte los detalles? 💙`
  }

  if (lead.quiz_has_insurance === 'Sí pero quiero comparar') {
    return `Hola ${name} 😊 Soy Sophia del equipo de *Luxury Shield*.
${colorLine}
Vi que ya tienes algo de cobertura pero quieres comparar. ¡Me encanta que busques lo mejor! Nuestro plan DVH cubre limpieza desde el día 1 sin espera — muchos planes tienen 6-12 meses de espera para eso.

¿Qué cubre tu plan actual? Así te digo exactamente en qué mejoramos 💙`
  }

  // Default with color
  return `Hola ${name} 😊 Soy Sophia del equipo de *Luxury Shield*.
${colorLine}
Vi que quieres información sobre protección dental en ${lead.state || 'tu estado'}. ¡Tenemos muy buenas noticias!

Tu evaluación, radiografías y limpieza quedan cubiertos por **$0** desde el día 1. ¿Tienes un momento? 💙`
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
