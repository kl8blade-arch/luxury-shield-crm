// Sophia v2 — Luxury Shield CRM — Updated 2026-03-27
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

// ── Send WhatsApp via Twilio ──
async function sendWhatsApp(to: string, message: string) {
  // Ensure phone has + prefix
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
  const data = await res.json()
  console.log('WhatsApp sent:', data.sid, 'to:', to)
  return data
}

// ── Determine stage from conversation context ──
function determineStage(messageCount: number, isReadyToBuy: boolean, currentStage: string): string {
  if (isReadyToBuy) return 'listo_comprar'
  if (messageCount <= 1) return 'nuevo'
  if (messageCount <= 3) return 'calificando'
  if (messageCount <= 6) return 'presentando'
  if (currentStage === 'objecion') return 'objecion'
  return currentStage
}

// ── Claude AI — Sophia Agent ──
async function getAIResponse(lead: any, conversationHistory: any[], incomingMessage: string): Promise<string> {
  const systemPrompt = `Eres Sophia, asesora experta de Luxury Shield Insurance. Eres una amiga experta que guía con calidez, NUNCA una vendedora agresiva.

IDIOMA: Responde en español. Si el cliente escribe en inglés, responde en inglés.

PRODUCTO PRINCIPAL — Cigna DVH Plus (Dental + Visión + Audición):
- Sin periodo de espera para dental
- $200 de beneficio en visión el primer año
- $5,000 de cobertura anual máxima
- Red de 85,000+ proveedores a nivel nacional
- Emisión garantizada: NO hay preguntas de salud
- Edades: 18 a 89 años
- Renovable de por vida
- Deducible desde $0
- Estados disponibles: FL, TX, CA, IL, GA, NC, SC, TN, NJ, AL

INFORMACIÓN DEL LEAD:
- Nombre: ${lead.name || 'Amigo/a'}
- Estado: ${lead.state || 'No especificado'}
- Edad: ${lead.age || 'No especificada'}
- Seguro actual: ${lead.has_insurance ? 'Sí tiene' : 'No tiene / No indicó'}
- Tipo de interés: ${lead.insurance_type || 'dental'}
- Stage actual: ${lead.stage || 'nuevo'}

FLUJO DE CONVERSACIÓN (sigue este orden natural):
1. BIENVENIDA CÁLIDA — Preséntate, usa su nombre, pregunta cómo está
2. CALIFICACIÓN — Una sola pregunta por mensaje: ¿estado donde vive? ¿edad? ¿tiene seguro dental actualmente? ¿qué le preocupa más de su salud dental?
3. PRESENTACIÓN PERSONALIZADA — Basada en sus respuestas, destaca los beneficios más relevantes para esa persona
4. MANEJO DE OBJECIONES — Con empatía y datos reales
5. CIERRE — Agendar llamada con Carlos, nuestro especialista

MANEJO DE OBJECIONES:
- "Es caro" / "No tengo dinero" → "Entiendo perfectamente. Lo bueno es que hay planes desde $X al mes, y muchas personas califican para subsidios que reducen el costo significativamente. ¿Te gustaría que revisemos si calificas?"
- "Lo voy a pensar" → "¡Claro que sí! Es una decisión importante. Solo te comento que los precios suelen ajustarse cada trimestre. ¿Hay algo específico que te genere duda? Con gusto te lo aclaro."
- "Ya tengo seguro" → "¡Excelente que ya estés protegido/a! Muchos de nuestros clientes usan Cigna DVH Plus como complemento, especialmente por los $200 en visión y la cobertura dental sin espera. ¿Tu plan actual cubre visión?"
- "No creo que califique" → "¡Buenas noticias! Cigna DVH Plus tiene emisión garantizada — no hay preguntas de salud ni rechazos. Si tienes entre 18 y 89 años, calificas automáticamente."

SEÑALES DE COMPRA (cuando detectes estas, escribe exactamente [LISTO_PARA_COMPRAR] al final):
- "Sí quiero", "me interesa", "¿cómo empezamos?", "quiero aplicar"
- Pregunta cómo pagar o precio exacto después de la presentación
- Da datos personales voluntariamente para la póliza
- Acepta agendar llamada con Carlos

REGLAS ESTRICTAS:
- Máximo 3-4 oraciones por mensaje
- NUNCA más de 1 pregunta por mensaje
- Siempre termina con una pregunta O un call-to-action claro
- Usa el nombre del lead naturalmente (no en cada oración)
- Tono: amiga experta, cálida, empática — como si hablaras con alguien que aprecias
- NO uses jerga de seguros complicada
- NO menciones competidores
- NO presiones ni uses tácticas de miedo
- Cuando el lead esté listo, ofrece agendar llamada con Carlos (especialista) para finalizar
- SOLO agrega [LISTO_PARA_COMPRAR] cuando el lead confirme explícitamente interés de compra`

  const messages = [
    ...conversationHistory.map((c: any) => ({
      role: c.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: c.message,
    })),
    { role: 'user' as const, content: incomingMessage }
  ]

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt,
        messages,
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      console.error(`Claude API error (${res.status}):`, errorBody)
      // Fallback to older model if current one fails
      if (res.status === 404 || res.status === 400) {
        console.log('Retrying with claude-3-5-sonnet-20241022...')
        const retryRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 400,
            system: systemPrompt,
            messages,
          }),
        })
        if (retryRes.ok) {
          const retryData = await retryRes.json()
          return retryData.content?.[0]?.text || 'Hola, soy Sophia de Luxury Shield 😊 ¿En qué puedo ayudarte hoy?'
        }
        const retryError = await retryRes.text()
        console.error(`Claude API retry also failed (${retryRes.status}):`, retryError)
      }
      return 'Hola, soy Sophia de Luxury Shield 😊 ¿En qué puedo ayudarte hoy?'
    }

    const data = await res.json()
    const text = data.content?.[0]?.text
    if (!text) {
      console.error('Claude API returned empty content:', JSON.stringify(data))
    }
    return text || 'Hola, soy Sophia de Luxury Shield 😊 ¿En qué puedo ayudarte hoy?'
  } catch (err) {
    console.error('Claude API fetch error:', err)
    return 'Hola, soy Sophia de Luxury Shield 😊 ¿En qué puedo ayudarte hoy?'
  }
}

// ── POST: Twilio Webhook — incoming WhatsApp messages ──
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

    // Find lead by phone
    const cleanPhone = from.replace(/\D/g, '')
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
      .order('created_at', { ascending: false })
      .limit(1)

    let lead = leads?.[0]

    // Create lead if not found
    if (!lead) {
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          name: profileName || from,
          phone: from,
          stage: 'nuevo',
          source: 'whatsapp_inbound',
          score: 40,
          ia_active: true,
        })
        .select()
        .single()
      lead = newLead
    }

    // Get conversation history (last 15 messages for context)
    const { data: history } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true })
      .limit(15)

    // Save incoming message
    await supabase.from('conversations').insert({
      lead_id: lead.id,
      phone: from,
      role: 'user',
      content: body,
      lead_name: lead.name,
      lead_phone: from,
      channel: 'ai_text',
      direction: 'inbound',
      message: body,
    })

    // Update lead contact info
    await supabase.from('leads').update({
      ia_active: true,
      last_contact: new Date().toISOString(),
      contact_attempts: (lead.contact_attempts || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)

    // Generate AI response
    const aiResponse = await getAIResponse(lead, history || [], body)

    // Check for buy signal
    const isReadyToBuy = aiResponse.includes('[LISTO_PARA_COMPRAR]')
    const cleanResponse = aiResponse.replace('[LISTO_PARA_COMPRAR]', '').trim()

    // Determine and update stage
    const messageCount = (history || []).length + 1
    const newStage = determineStage(messageCount, isReadyToBuy, lead.stage)

    await supabase.from('leads').update({
      stage: isReadyToBuy ? 'interested' : newStage,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)

    // Save AI response
    await supabase.from('conversations').insert({
      lead_id: lead.id,
      phone: from,
      role: 'assistant',
      content: cleanResponse,
      lead_name: lead.name,
      lead_phone: from,
      channel: 'ai_text',
      direction: 'outbound',
      message: cleanResponse,
      ai_summary: isReadyToBuy ? 'LISTO PARA COMPRAR' : null,
    })

    // Send response via WhatsApp
    await sendWhatsApp(from, cleanResponse)

    // If ready to buy — notify Carlos
    if (isReadyToBuy) {
      await supabase.from('leads').update({
        ready_to_buy: true,
        stage: 'interested',
        score: 95,
        score_recommendation: '🔥 Lead calificado por Sophia IA — listo para cerrar',
        ia_active: false,
      }).eq('id', lead.id)

      const contextMessages = (history || []).slice(-5).map((c: any) =>
        `${c.direction === 'inbound' ? '👤' : '🤖'}: ${c.message}`
      ).join('\n')

      const agentMsg = `🔥 *LEAD LISTO PARA COMPRAR — Luxury Shield*

👤 *${lead.name}*
📞 ${from}
📍 ${lead.state || '—'} · ${lead.insurance_type || 'dental'}
⭐ Score: 95/100

📋 *Últimos mensajes:*
${contextMessages}

⚡ *Acción: Llama AHORA para cerrar la venta*
_Sophia IA calificó este lead como listo para comprar._`

      await sendWhatsApp(ADMIN_PHONE, agentMsg)

      // Notify assigned agent if different from admin
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

      console.log(`Lead ${lead.name} READY TO BUY — admin notified`)
    }

    // Return TwiML empty response
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
  return NextResponse.json({ status: '✅ online', agent: 'Sophia v2' })
}
