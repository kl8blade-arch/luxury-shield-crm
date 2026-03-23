import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP || '+17869435656'

// Send WhatsApp message via Twilio
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
  const data = await res.json()
  console.log('WhatsApp sent:', data.sid, 'to:', to)
  return data
}

// Call Claude AI to generate response
async function getAIResponse(lead: any, conversationHistory: any[], incomingMessage: string): Promise<string> {
  const systemPrompt = `Eres Sophia, una asesora experta en seguros de Luxury Shield Insurance. 
Eres bilingüe (español/inglés), cálida pero muy directa y persuasiva. Eres una closer experta.

INFORMACIÓN DEL LEAD:
- Nombre: ${lead.name}
- Tipo de seguro de interés: ${lead.insurance_type}
- Estado: ${lead.state}
- Tiene seguro actualmente: ${lead.has_insurance ? 'Sí' : 'No'}
- Edad: ${lead.age || 'No especificada'}
- Score actual: ${lead.score}/100
- Color favorito: ${lead.favorite_color || 'No especificado'}

TU MISIÓN:
1. Contactar al lead calurosamente y personalizar el mensaje con su nombre
2. Identificar su necesidad específica de seguro
3. Crear urgencia real (cupos limitados, precios que suben, periodo de inscripción)
4. Manejar objeciones con empatía y datos reales
5. Cuando el lead muestre interés real, CERRAR pidiendo sus datos para la póliza
6. Si el lead está listo para comprar, incluir exactamente al final de tu mensaje: [LISTO_PARA_COMPRAR]

REGLAS IMPORTANTES:
- Mensajes cortos (máximo 3 párrafos)
- Usa su nombre frecuentemente
- Habla en el mismo idioma que el lead
- Nunca menciones competidores
- Crea urgencia sin mentir
- Si preguntan el precio, da rangos reales según el estado
- Cuando detectes que está listo: pide nombre completo, fecha de nacimiento y correo para activar la póliza
- SOLO agrega [LISTO_PARA_COMPRAR] cuando el lead confirme explícitamente que quiere proceder

SEÑALES DE QUE ESTÁ LISTO PARA COMPRAR:
- Pregunta cómo pagar o cuánto cuesta exactamente
- Dice "sí quiero", "me interesa", "cómo empezamos", "quiero aplicar"
- Pide más información para tomar la decisión final
- Da sus datos personales para la póliza

SEÑALES DE OBJECIÓN (maneja con empatía):
- "Está muy caro" → explica el valor y el subsidio del gobierno
- "Déjame pensar" → crea urgencia suave
- "No tengo tiempo" → ofrece llamada de 10 minutos
- "Ya tengo seguro" → compara beneficios, habla de cross-selling

Mantén la conversación natural, como un experto de confianza, no como un robot.`

  const messages = [
    ...conversationHistory.map((c: any) => ({
      role: c.direction === 'inbound' ? 'user' : 'assistant',
      content: c.message,
    })),
    { role: 'user', content: incomingMessage }
  ]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    }),
  })

  const data = await res.json()
  return data.content?.[0]?.text || 'Hola, ¿cómo puedo ayudarte?'
}

// Webhook: receives incoming WhatsApp messages from Twilio
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const from = (formData.get('From') as string || '').replace('whatsapp:', '')
    const body = formData.get('Body') as string || ''
    const profileName = formData.get('ProfileName') as string || ''

    console.log(`Incoming WhatsApp from ${from}: ${body}`)

    if (!from || !body) {
      return new NextResponse('OK', { status: 200 })
    }

    // Find lead by phone number
    const cleanPhone = from.replace(/\D/g, '')
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
      .order('created_at', { ascending: false })
      .limit(1)

    let lead = leads?.[0]

    // If no lead found, create one
    if (!lead) {
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          name: profileName || from,
          phone: from,
          stage: 'contacted',
          source: 'whatsapp_inbound',
          score: 40,
          ia_active: true,
        })
        .select()
        .single()
      lead = newLead
    }

    // Get conversation history (last 10 messages)
    const { data: history } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true })
      .limit(10)

    // Save incoming message
    await supabase.from('conversations').insert({
      lead_id: lead.id,
      lead_name: lead.name,
      lead_phone: from,
      channel: 'ai_text',
      direction: 'inbound',
      message: body,
    })

    // Update lead stage to contacted
    if (lead.stage === 'new' || lead.stage === 'contact') {
      await supabase.from('leads').update({
        stage: 'contacted',
        ia_active: true,
        last_contact: new Date().toISOString(),
        contact_attempts: (lead.contact_attempts || 0) + 1,
      }).eq('id', lead.id)
    }

    // Generate AI response
    const aiResponse = await getAIResponse(lead, history || [], body)

    // Check if lead is ready to buy
    const isReadyToBuy = aiResponse.includes('[LISTO_PARA_COMPRAR]')
    const cleanResponse = aiResponse.replace('[LISTO_PARA_COMPRAR]', '').trim()

    // Save AI response to conversation
    await supabase.from('conversations').insert({
      lead_id: lead.id,
      lead_name: lead.name,
      lead_phone: from,
      channel: 'ai_text',
      direction: 'outbound',
      message: cleanResponse,
      ai_summary: isReadyToBuy ? 'LISTO PARA COMPRAR' : null,
    })

    // Send AI response via WhatsApp
    await sendWhatsApp(from, cleanResponse)

    // If ready to buy — update lead and notify human agent
    if (isReadyToBuy) {
      // Update lead status
      await supabase.from('leads').update({
        ready_to_buy: true,
        stage: 'interested',
        score: 95,
        score_recommendation: '🔥 Lead calificado por IA — listo para cerrar',
        ia_active: false,
      }).eq('id', lead.id)

      // Get last messages for context
      const contextMessages = (history || []).slice(-4).map((c: any) =>
        `${c.direction === 'inbound' ? '👤' : '🤖'}: ${c.message}`
      ).join('\n')

      // Notify admin/agent
      const agentMsg = `🔥 *LEAD LISTO PARA COMPRAR — Luxury Shield*

👤 *${lead.name}*
📞 ${from}
📍 ${lead.state || '—'} · ${lead.insurance_type}
⭐ Score: 95/100
🎨 Color favorito: ${lead.favorite_color || '—'}

📋 *Resumen de la conversación:*
${contextMessages}

⚡ *Acción requerida: Llama AHORA para cerrar la venta*
_Este lead fue calificado por Sophia IA y está listo para activar su póliza._`

      await sendWhatsApp(ADMIN_PHONE, agentMsg)

      // If assigned to specific agent
      if (lead.agent_id) {
        const { data: agent } = await supabase
          .from('agents')
          .select('phone, name')
          .eq('id', lead.agent_id)
          .single()

        if (agent?.phone && agent.phone !== ADMIN_PHONE) {
          await sendWhatsApp(agent.phone, agentMsg)
        }
      }

      console.log(`Lead ${lead.name} is READY TO BUY — agent notified`)
    }

    // Return TwiML empty response (Twilio expects this)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    )

  } catch (error: any) {
    console.error('WhatsApp webhook error:', error)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    )
  }
}

export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook active' })
}
