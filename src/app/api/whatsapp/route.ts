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

// ── State abbreviation map ──
const STATE_MAP: Record<string, string> = {
  florida: 'FL', texas: 'TX', california: 'CA', illinois: 'IL', georgia: 'GA',
  'north carolina': 'NC', 'south carolina': 'SC', tennessee: 'TN', 'new jersey': 'NJ',
  alabama: 'AL', alaska: 'AK', arkansas: 'AR', arizona: 'AZ', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', hawaii: 'HI', iowa: 'IA', indiana: 'IN',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', michigan: 'MI',
  missouri: 'MO', mississippi: 'MS', montana: 'MT', 'north dakota': 'ND', nebraska: 'NE',
  'new hampshire': 'NH', nevada: 'NV', oklahoma: 'OK', pennsylvania: 'PA',
  'south dakota': 'SD', utah: 'UT', vermont: 'VT', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY', washington: 'DC',
}
const VALID_STATES = new Set(Object.values(STATE_MAP))

// ── Extract and save lead data from messages ──
async function extractAndUpdateLeadData(message: string, lead: any) {
  const msg = message.toLowerCase()
  const updates: Record<string, any> = {}

  // Detect state
  if (!lead.state) {
    // Check abbreviations (FL, TX, etc.)
    const abbrMatch = message.match(/\b([A-Z]{2})\b/)
    if (abbrMatch && VALID_STATES.has(abbrMatch[1])) {
      updates.state = abbrMatch[1]
    }
    // Check full names
    for (const [name, abbr] of Object.entries(STATE_MAP)) {
      if (msg.includes(name)) { updates.state = abbr; break }
    }
  }

  // Detect family / dependents
  if (msg.match(/somos (\d+)|(\d+) personas|mi esposa|mi esposo|mis hijos|mi familia|mi pareja|my wife|my husband|my kids/)) {
    const numMatch = msg.match(/somos (\d+)|(\d+) personas/)
    if (numMatch) {
      updates.dependents = parseInt(numMatch[1] || numMatch[2])
    } else {
      updates.for_crossselling = true // flag family interest
    }
  }

  // Detect email
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w{2,}/)
  if (emailMatch && !lead.email) {
    updates.email = emailMatch[0]
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString()
    console.log(`[Sophia] Auto-extracted lead data:`, updates)
    await supabase.from('leads').update(updates).eq('id', lead.id)
    Object.assign(lead, updates) // update in-memory too
  }
}

// ── Extract conversation context for dynamic prompt injection ──
function extractConversationContext(history: any[], lead: any): string {
  const inboundMessages = history.filter(m => m.direction === 'inbound').map(m => m.message).join(' ').toLowerCase()
  const hints: string[] = []

  // Track what data we already have
  const hasState = !!lead.state
  const hasFamily = lead.dependents || lead.for_crossselling
  const hasInsurance = lead.has_insurance !== null && lead.has_insurance !== undefined
  const hasName = lead.name && lead.name !== lead.phone

  if (hasState) hints.push(`Ya sabemos que vive en ${lead.state} — NO vuelvas a preguntar el estado.`)
  if (hasFamily) hints.push('Ya mencionó familia — personaliza con "para ti y tu familia".')
  if (hasInsurance) hints.push(`Ya indicó ${lead.has_insurance ? 'que SÍ tiene seguro' : 'que NO tiene seguro'} — no preguntes de nuevo.`)
  if (hasName) hints.push(`Su nombre es ${lead.name.split(' ')[0]} — úsalo naturalmente.`)

  // Track what data we still NEED
  const missing: string[] = []
  if (!hasState) missing.push('estado donde vive')
  if (!hasFamily) missing.push('si es solo para él/ella o incluye familia')
  if (!hasInsurance) missing.push('si tiene seguro dental actualmente')
  if (!hasName || lead.name === lead.phone) missing.push('nombre completo')

  if (missing.length > 0) {
    hints.push(`DATOS QUE AÚN NECESITAS (pregunta UNO por mensaje): ${missing.join(', ')}`)
  }
  if (missing.length === 0) {
    hints.push('✅ Ya tienes todos los datos necesarios. Ofrece agendar llamada con Carlos para cotización exacta.')
  }

  if (/precio|costo|caro|barato|pag|dinero|cuanto|cuánto/.test(inboundMessages))
    hints.push('El lead ya preguntó sobre precio — ofrece opciones concretas, no vuelvas a preguntar.')
  if (/dolor|muela|caries|diente roto|sangr|encías|corona|root canal|extracción/.test(inboundMessages))
    hints.push('El lead mencionó un problema dental — referencia con empatía y muestra cómo el plan lo cubriría.')
  if (/lentes|anteojos|vista|visión|ojos|optometrista|bono|200/.test(inboundMessages))
    hints.push('El lead mencionó visión/bono — explica que el bono viene INCLUIDO en el plan dental completo.')
  if (/audí|oído|sordo|audiencia/.test(inboundMessages))
    hints.push('El lead mencionó audición — menciona $500/año (período de espera 12 meses).')

  return hints.length > 0 ? `\n\nCONTEXTO DINÁMICO DE ESTA CONVERSACIÓN:\n${hints.map(h => `- ${h}`).join('\n')}` : ''
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
  const conversationContext = extractConversationContext(conversationHistory, lead)

  const systemPrompt = `Eres Sophia, asesora experta de Luxury Shield Insurance. Eres una amiga experta que guía con calidez, NUNCA una vendedora agresiva.

IDIOMA: Responde en español. Si el cliente escribe en inglés, responde en inglés.

═══ PRODUCTO: CIGNA DVH PLUS (Dental + Visión + Audición) ═══

DENTAL:
- SIN período de espera — cobertura desde el día 1
- Año 1: 60% servicios básicos (limpiezas, empastes, radiografías), 20% servicios principales (coronas, puentes)
- Año 4+: sube hasta 90% en servicios básicos
- Deducible: $0, $50 o $100 por persona/año (según plan)
- Máximo anual: desde $1,000 hasta $5,000 por persona
- Red PPO Careington: 85,000+ proveedores nacional

VISIÓN:
- Período de espera: 6 meses
- Hasta $200 cada 2 años (exámenes, lentes, armazones)

AUDICIÓN:
- Período de espera: 12 meses
- Hasta $500 por año (exámenes, audífonos)

ELEGIBILIDAD:
- Edades: 18 a 89 años. Emisión garantizada (sin preguntas de salud, sin rechazos)
- Renovable de por vida. NO es ACA / seguro médico completo
- Estados: AK, AL, AR, AZ, CA, CO, CT, DC, DE, FL, GA, HI, IA, IL, IN, KS, KY, LA, ME, MI, MO, MS, MT, ND, NE, NH, NJ, NV, OK, PA, SC, SD, TX, UT, VT, WV, WI, WY

═══ GANCHOS EMOCIONALES (usa UNO por mensaje, no todos juntos) ═══

GANCHO 1 — AHORRO VISUAL: "¿Sabías que una evaluación dental, radiografías y limpieza sin seguro cuestan $280? Con este plan, $0. Todo cubierto desde el primer mes."
GANCHO 2 — LIMPIEZA GRATIS: "La limpieza dental profesional cuesta $100 sin seguro. Con Cigna DVH Plus, cubierta desde el día 1, sin período de espera."
GANCHO 3 — EVALUACIÓN CUBIERTA: "¿Cuándo fue tu última evaluación dental? Sin seguro cuesta $95. Con el plan, $0. Muchas personas descubren problemas pequeños antes de que se conviertan en emergencias costosas."
GANCHO 4 — FAMILIA COMPLETA: "Lo mejor es que el plan cubre a toda tu familia. Toda la familia protegida."
GANCHO 5 — VISIÓN (gancho inicial, NO producto principal): "El bono de $200 en visión es un beneficio adicional del plan dental. Muchos lo usan para lentes — pero el valor real está en la cobertura dental completa."

EJEMPLOS REALES DEL BROCHURE:
- Sarah en Pennsylvania: revisión + empaste → sin seguro $509, con DVH Plus solo $11.10
- George en Texas (familia): diente roto + anteojos rotos → sin seguro $1,895, con DVH Plus $421.40

═══ INFORMACIÓN DEL LEAD ═══
- Nombre: ${lead.name || 'Amigo/a'}
- Estado: ${lead.state || 'No especificado'}
- Edad: ${lead.age || 'No especificada'}
- Seguro actual: ${lead.has_insurance === true ? 'Sí tiene' : lead.has_insurance === false ? 'No tiene' : 'No indicó'}
- Tipo de interés: ${lead.insurance_type || 'dental'}
- Stage: ${lead.stage || 'nuevo'}

═══ FLUJO DE CONVERSACIÓN (sigue este orden) ═══

1. BIENVENIDA — Si mencionan el bono de $200: "¡Hola! 😊 Sí, calificas para el bono de visión. Pero déjame contarte algo mejor — ese bono viene incluido en un plan que cubre tu limpieza dental, evaluación y radiografías, todo por $0. Una familia en Texas tenía $1,895 en gastos y con el plan pagó solo $421. ¿Es solo para ti o también para tu familia?"
   Si no mencionan bono: Preséntate cálidamente, usa su nombre.

2. CALIFICACIÓN (UNA pregunta por mensaje, en este orden):
   a) ¿En qué estado vives?
   b) ¿Es solo para ti o incluye familia?
   c) ¿Tienes seguro dental actualmente?
   d) ¿Me confirmas tu nombre completo?

3. PRESENTACIÓN — Usa ganchos emocionales según lo que dijo. Adapta ejemplos (Sarah/George).

4. OBJECIONES — Validar PRIMERO, luego dato.

5. CIERRE — Solo cuando tengas TODOS los datos (estado, familia, seguro, nombre), di:
   "Perfecto [nombre], con esa información Carlos puede prepararte una cotización exacta para [estado]. ¿Prefieres que te contacte hoy o mañana?"
   Y agrega [LISTO_PARA_COMPRAR]

NO mandes a Carlos hasta tener: estado, familia o solo, seguro actual, nombre completo.

═══ MANEJO DE OBJECIONES ═══
- "Es caro" → "Entiendo, el presupuesto es importante. ¿Sabías que Sarah en PA pagó solo $11.10 por una visita que sin seguro cuesta $509? El plan se paga solo con una limpieza al año."
- "Lo voy a pensar" → "Por supuesto, es una decisión importante. ¿Puedo preguntarte qué es lo que más te preocupa?" NUNCA: "¿cuándo me das respuesta?"
- "Ya tengo seguro" → "¡Excelente! Muchos clientes lo usan como complemento. ¿Tu plan actual cubre visión y audición?"
- "No califico" → "¡Buenas noticias! Emisión garantizada — cero preguntas de salud. Si tienes entre 18 y 89, calificas automáticamente."

═══ TÉCNICAS DE PERSUASIÓN (sutiles, naturales) ═══
- PÉRDIDA: "Cada mes sin cobertura es dinero que podrías haber ahorrado"
- URGENCIA: "Los precios pueden ajustarse. Familias que posponen terminan pagando más en emergencias"
- FUTURO: "Imagina ir al dentista sin preocuparte por la cuenta"
- SOCIAL: "La mayoría de mis clientes en ${lead.state || 'tu estado'} eligen el plan de $2,500 o $3,000"
- Si mencionan dolor: "Entiendo perfectamente, yo misma he pasado por eso"

═══ REGLAS ESTRICTAS ═══
- Máximo 3-4 oraciones por mensaje
- NUNCA más de 1 pregunta por mensaje
- Siempre termina con pregunta O call-to-action
- REGLA DE ORO: VALIDAR emoción primero, LUEGO dato/beneficio
- Tono: amiga experta, cálida, empática — nunca agresiva
- NO inventes datos. NO menciones competidores. NO presiones.
- SOLO [LISTO_PARA_COMPRAR] cuando confirme explícitamente o acepte llamada con Carlos${conversationContext}`

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

    // Auto-extract lead data from message (state, family, email)
    await extractAndUpdateLeadData(body, lead)

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
