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
  const body = new URLSearchParams({
    From: `whatsapp:${TWILIO_FROM}`,
    To: `whatsapp:${to}`,
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

// First message templates by insurance type
function getFirstMessage(lead: any): string {
  const name = lead.name.split(' ')[0]
  const type = lead.insurance_type

  const templates: Record<string, string> = {
    'Dental': `Hola ${name} 👋 Te habla Sophia de *Luxury Shield Insurance*.

Vi que solicitaste información sobre tu cobertura dental gratuita en ${lead.state}. ¡Tenemos muy buenas noticias para ti! 🦷

Con tu plan dental puedes cubrir:
✅ Consulta con doctor: $0
✅ Radiografías: $0  
✅ Limpieza profesional: $0

¿Es buen momento para contarte los detalles? Solo toma 5 minutos 😊`,

    'ACA': `Hola ${name} 👋 Soy Sophia de *Luxury Shield Insurance*.

Vi que quieres verificar tu elegibilidad para seguro médico en ${lead.state}. ¡Tengo una excelente noticia! 🏥

Con el subsidio del gobierno, muchas familias en tu estado pagan *$0 al mes* por cobertura completa.

¿Cuántas personas cubriría el plan? (tú solo, pareja, familia completa) 😊`,

    'IUL': `Hola ${name} 👋 Te habla Sophia de *Luxury Shield Insurance*.

Vi que te interesa proteger el futuro financiero de tu familia en ${lead.state}. ¡Hoy es el momento perfecto! 💼

El plan IUL que tenemos disponible:
✅ Protección de vida
✅ Ahorro con crecimiento garantizado
✅ Beneficios fiscales

¿Tienes 10 minutos para revisar las opciones disponibles para ti? 😊`,
  }

  return templates[type] || `Hola ${name} 👋 Te habla Sophia de *Luxury Shield Insurance*.

Vi que solicitaste información sobre seguro de ${type} en ${lead.state}. ¡Nos alegra mucho contactarte! 🛡️

Tenemos planes excelentes disponibles para residentes de ${lead.state}. ¿Es buen momento para contarte los detalles?`
}

// Called by save-lead API or manually to send first message
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

    // Check if already contacted by AI
    const { count } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', lead_id)
      .eq('direction', 'outbound')

    if (count && count > 0) {
      return NextResponse.json({ message: 'Lead ya contactado', already_contacted: true })
    }

    const message = getFirstMessage(lead)

    // Send first WhatsApp
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
      ai_summary: 'Primer contacto automático de Sophia IA',
    })

    // Update lead
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
