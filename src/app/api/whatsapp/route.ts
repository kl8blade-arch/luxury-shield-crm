// Sophia v3 — Luxury Shield CRM — Updated 2026-03-27
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
  console.log('WhatsApp sent:', data.sid, 'to:', cleanTo)
  return data
}

// ── Transcribe audio via Whisper ──
async function transcribeAudio(mediaUrl: string): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return null

  try {
    // Download audio from Twilio (requires auth)
    const audioRes = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
      },
    })
    if (!audioRes.ok) {
      console.error('[Sophia] Audio download failed:', audioRes.status)
      return null
    }

    const audioBuffer = await audioRes.arrayBuffer()
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg')
    formData.append('model', 'whisper-1')
    formData.append('language', 'es')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: formData,
    })

    if (!whisperRes.ok) {
      console.error('[Sophia] Whisper error:', await whisperRes.text())
      return null
    }

    const result = await whisperRes.json()
    console.log('[Sophia] Audio transcribed:', result.text)
    return result.text
  } catch (err) {
    console.error('[Sophia] Transcription error:', err)
    return null
  }
}

// ── Extract conversation context for dynamic prompt injection ──
function extractConversationContext(history: any[]): string {
  const inboundMessages = history.filter(m => m.direction === 'inbound').map(m => m.message).join(' ').toLowerCase()
  const hints: string[] = []

  if (/precio|costo|caro|barato|pag|dinero|cuanto|cuánto/.test(inboundMessages))
    hints.push('El lead ya preguntó sobre precio — no vuelvas a preguntar, ofrece opciones concretas.')
  if (/familia|hijos?|esposa|esposo|pareja|niños/.test(inboundMessages))
    hints.push('El lead mencionó familia — personaliza con "para ti y tu familia" y menciona planes familiares.')
  if (/dolor|muela|caries|diente roto|sangr|encías|corona|root canal|extracción/.test(inboundMessages))
    hints.push('El lead mencionó un problema dental específico — referencia su situación con empatía y muestra cómo el plan lo cubriría.')
  if (/lentes|anteojos|vista|visión|ojos|optometrista/.test(inboundMessages))
    hints.push('El lead mencionó visión — destaca el beneficio de $200 en visión (cada 2 años, período de espera 6 meses).')
  if (/audí|oído|sordo|audiencia/.test(inboundMessages))
    hints.push('El lead mencionó audición — menciona el beneficio de $500/año en audición (período de espera 12 meses).')

  return hints.length > 0 ? `\nCONTEXTO DE ESTA CONVERSACIÓN (usa naturalmente, NO repitas preguntas ya hechas):\n${hints.map(h => `- ${h}`).join('\n')}` : ''
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
  const conversationContext = extractConversationContext(conversationHistory)

  const systemPrompt = `Eres Sophia, asesora experta de Luxury Shield Insurance. Eres una amiga experta que guía con calidez, NUNCA una vendedora agresiva.

IDIOMA: Responde en español. Si el cliente escribe en inglés, responde en inglés.

═══ PRODUCTO: CIGNA DVH PLUS (Dental + Visión + Audición) ═══

DENTAL:
- SIN período de espera — cobertura desde el día 1
- Año 1: 60% en servicios básicos (limpiezas, empastes, radiografías), 20% en servicios principales (coronas, puentes)
- Año 4+: sube hasta 90% en servicios básicos
- Deducible: $0, $50 o $100 por persona por año (según plan elegido)
- Máximo anual: desde $1,000 hasta $5,000 por persona (según plan)
- Red PPO Careington: más de 85,000 proveedores a nivel nacional

VISIÓN:
- Período de espera: 6 meses
- Paga hasta $200 cada 2 años para exámenes, lentes, armazones
- Usa proveedores dentro de la red para máximo beneficio

AUDICIÓN:
- Período de espera: 12 meses
- Paga hasta $500 por año en servicios auditivos (exámenes, audífonos)

ELEGIBILIDAD:
- Edades: 18 a 89 años
- Emisión garantizada: NO hay preguntas de salud, NO hay rechazos
- Renovable de por vida sin importar edad, salud o reclamaciones pasadas
- NO es seguro médico completo (no es ACA)
- Estados disponibles: AK, AL, AR, AZ, CA, CO, CT, DC, DE, FL, GA, HI, IA, IL, IN, KS, KY, LA, ME, MI, MO, MS, MT, ND, NE, NH, NJ, NV, OK, PA, SC, SD, TX, UT, VT, WV, WI, WY

EJEMPLOS REALES (usa cuando sea relevante):
- Sarah en Pennsylvania: revisión dental + empaste → sin seguro pagó $509, con DVH Plus pagó solo $11.10
- George en Texas (familia): diente roto + anteojos rotos → sin seguro $1,895, con DVH Plus pagó $421.40

═══ INFORMACIÓN DEL LEAD ═══
- Nombre: ${lead.name || 'Amigo/a'}
- Estado: ${lead.state || 'No especificado'}
- Edad: ${lead.age || 'No especificada'}
- Seguro actual: ${lead.has_insurance ? 'Sí tiene' : 'No tiene / No indicó'}
- Tipo de interés: ${lead.insurance_type || 'dental'}
- Stage actual: ${lead.stage || 'nuevo'}

═══ FLUJO DE CONVERSACIÓN ═══
1. BIENVENIDA CÁLIDA — Preséntate, usa su nombre, pregunta cómo está
2. CALIFICACIÓN — Una sola pregunta por mensaje: ¿estado? ¿edad? ¿tiene seguro dental? ¿qué le preocupa más?
3. PRESENTACIÓN PERSONALIZADA — Basada en sus respuestas, destaca beneficios relevantes con ejemplos reales
4. MANEJO DE OBJECIONES — Con empatía y datos reales
5. CIERRE — Agendar llamada con Carlos, nuestro especialista

═══ TÉCNICAS DE PERSUASIÓN (usa de forma natural y sutil) ═══

SENTIDO DE PÉRDIDA (loss aversion):
- "Cada mes sin cobertura es dinero que podrías haber ahorrado en tu próxima limpieza"
- "Una limpieza de rutina sin seguro cuesta $150-$250... con este plan, mucho menos"
- "Si algo le pasa a un diente esta semana, ¿cuánto terminarías pagando?"

URGENCIA EMOCIONAL (sin presión):
- Mencionar que los precios pueden ajustarse
- "Hay familias que llevan años posponiendo esto y terminan pagando mucho más en emergencias"
- Si mencionan dolor: "Entiendo perfectamente, yo misma he pasado por eso"

VISIÓN FUTURA (imaginar el beneficio):
- "Imagina ir al dentista este mes sin preocuparte por la cuenta"
- "¿Cuándo fue la última vez que fuiste al dentista sin estrés?"
- "Tu familia merece sonreír sin miedo al costo"

PRUEBA SOCIAL:
- Usar los ejemplos de Sarah y George cuando sea natural
- "La mayoría de mis clientes en ${lead.state || 'tu estado'} eligen el plan de $2,500 o $3,000 de máximo anual"

═══ MANEJO DE OBJECIONES ═══
- "Es caro" → Validar primero: "Entiendo, el presupuesto es importante." Luego: "¿Sabías que Sarah en PA pagó solo $11.10 por una visita que sin seguro cuesta $509? El plan se paga solo con una limpieza al año."
- "Lo voy a pensar" → "Por supuesto, es una decisión importante. ¿Puedo preguntarte qué es lo que más te preocupa? Así te ayudo a tener toda la información." NUNCA: "¿cuándo me das respuesta?"
- "Ya tengo seguro" → "¡Excelente! Muchos clientes usan DVH Plus como complemento. ¿Tu plan actual cubre visión y audición? DVH Plus agrega esos beneficios."
- "No califico" → "¡Buenas noticias! DVH Plus tiene emisión garantizada — cero preguntas de salud. Si tienes entre 18 y 89, calificas automáticamente."

═══ SEÑALES DE COMPRA ═══
Cuando detectes estas, escribe exactamente [LISTO_PARA_COMPRAR] al final:
- "Sí quiero", "me interesa", "¿cómo empezamos?", "quiero aplicar"
- Pregunta cómo pagar o precio exacto después de la presentación
- Da datos personales voluntariamente
- Acepta agendar llamada con Carlos

═══ REGLAS ESTRICTAS ═══
- Máximo 3-4 oraciones por mensaje
- NUNCA más de 1 pregunta por mensaje
- Siempre termina con una pregunta O un call-to-action claro
- Usa el nombre del lead naturalmente (no en cada oración)
- Tono: amiga experta, cálida, empática
- REGLA DE ORO: Siempre VALIDAR primero la emoción del lead, LUEGO el dato o beneficio
- NO uses jerga de seguros complicada
- NO menciones competidores
- NO presiones ni uses tácticas de miedo
- NO inventes datos que no están en este prompt
- Cuando esté listo, ofrece agendar llamada con Carlos (especialista)
- SOLO agrega [LISTO_PARA_COMPRAR] cuando el lead confirme explícitamente${conversationContext}`

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages,
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      console.error(`Claude API error (${res.status}):`, errorBody)
      if (res.status === 404 || res.status === 400) {
        console.log('Retrying with claude-3-haiku-20240307...')
        const retryRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
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
    let body = formData.get('Body') as string || ''
    const profileName = formData.get('ProfileName') as string || ''
    const mediaUrl = formData.get('MediaUrl0') as string || ''

    console.log(`Incoming WhatsApp from ${from}: ${body || '[audio/media]'}`)

    // Handle audio messages
    if (mediaUrl && !body) {
      console.log(`[Sophia] Audio received: ${mediaUrl}`)
      const transcription = await transcribeAudio(mediaUrl)
      if (transcription) {
        body = transcription
        console.log(`[Sophia] Transcribed: ${body}`)
      } else {
        // No OpenAI key or transcription failed — ask for text
        await sendWhatsApp(from, 'Recibí tu audio 😊 Por ahora solo puedo leer texto. ¿Puedes escribirme lo que me dijiste?')
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
          { status: 200, headers: { 'Content-Type': 'text/xml' } }
        )
      }
    }

    if (!from || !body) {
      return new NextResponse('OK', { status: 200 })
    }

    // Find lead by phone
    const cleanPhone = from.replace(/\D/g, '')
    console.log(`[Sophia] Looking up lead: ${cleanPhone}`)
    const { data: leads, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.eq.${from}`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (leadErr) console.error('[Sophia] Lead lookup error:', leadErr)

    let lead = leads?.[0]

    // Create lead if not found
    if (!lead) {
      console.log(`[Sophia] Creating new lead for ${from}`)
      const { data: newLead, error: insertErr } = await supabase
        .from('leads')
        .insert({
          name: profileName || from,
          phone: from,
          stage: 'new',
          source: 'whatsapp_inbound',
          score: 40,
          ia_active: true,
        })
        .select()
        .single()

      if (insertErr) {
        console.error('[Sophia] Lead insert error:', insertErr)
        const { data: fallbackLead, error: fallbackErr } = await supabase
          .from('leads')
          .insert({
            name: profileName || from,
            phone: from,
            source: 'whatsapp_inbound',
            score: 40,
          })
          .select()
          .single()
        if (fallbackErr) console.error('[Sophia] Fallback lead insert also failed:', fallbackErr)
        lead = fallbackLead
      } else {
        lead = newLead
      }
    }

    if (!lead) {
      console.error('[Sophia] CRITICAL: Could not find or create lead for', from)
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      )
    }

    console.log(`[Sophia] Lead found: ${lead.id} — ${lead.name} — stage: ${lead.stage}`)

    // Get conversation history (last 15 messages for context)
    const { data: history, error: histErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true })
      .limit(15)

    if (histErr) console.error('[Sophia] History error:', histErr)

    // Save incoming message
    const { error: saveErr } = await supabase.from('conversations').insert({
      lead_id: lead.id,
      lead_name: lead.name,
      lead_phone: from,
      channel: 'ai_text',
      direction: 'inbound',
      message: body,
    })
    if (saveErr) console.error('[Sophia] Save message error:', saveErr)

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
      lead_name: lead.name,
      lead_phone: from,
      channel: 'ai_text',
      direction: 'outbound',
      message: cleanResponse,
      ai_summary: isReadyToBuy ? 'LISTO PARA COMPRAR' : null,
    })

    // Human-like typing delay before sending
    const len = cleanResponse.length
    const [min, max] = len < 100 ? [3, 5] : len < 200 ? [5, 7] : [7, 9]
    const delay = Math.floor(Math.random() * (max - min + 1)) + min
    console.log(`[Sophia] Typing delay: ${delay}s for ${len} chars`)
    await new Promise(resolve => setTimeout(resolve, delay * 1000))

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
    console.error('[Sophia] FATAL webhook error:', error?.message || error, error?.stack)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    )
  }
}

// ── GET: Health check + debug info ──
export async function GET() {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const hasTwilioSid = !!process.env.TWILIO_ACCOUNT_SID
  const hasOpenaiKey = !!process.env.OPENAI_API_KEY
  return NextResponse.json({
    status: '✅ online',
    agent: 'Sophia v3',
    env: { anthropic: hasAnthropicKey, supabase: hasSupabaseUrl && hasSupabaseKey, twilio: hasTwilioSid, whisper: hasOpenaiKey },
  })
}
