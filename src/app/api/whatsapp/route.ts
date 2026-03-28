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

// ── Color detection ──
const COLORES = ['azul','verde','rojo','dorado','púrpura','purpura','naranja','blue','green','red','gold','purple','orange']

// ── Extract and save lead data from messages ──
async function extractAndUpdateLeadData(message: string, lead: any) {
  const msg = message.toLowerCase()
  const updates: Record<string, any> = {}

  // Detect state
  if (!lead.state) {
    const abbrMatch = message.match(/\b([A-Z]{2})\b/)
    if (abbrMatch && VALID_STATES.has(abbrMatch[1])) {
      updates.state = abbrMatch[1]
    }
    for (const [name, abbr] of Object.entries(STATE_MAP)) {
      if (msg.includes(name)) { updates.state = abbr; break }
    }
  }

  // Detect color
  if (!lead.favorite_color && !lead.color_favorito) {
    const colorDetectado = COLORES.find(c => msg.includes(c))
    if (colorDetectado) {
      const colorNormalized = colorDetectado.charAt(0).toUpperCase() + colorDetectado.slice(1)
      updates.favorite_color = colorNormalized
      updates.color_favorito = colorNormalized
      console.log(`[Sophia] Color detected: ${colorNormalized}`)
    }
  }

  // Detect name (me llamo X, soy X, my name is X)
  if (!lead.name || lead.name === lead.phone) {
    const nameMatch = message.match(/(?:me llamo|soy|my name is|i'm|i am)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i)
    if (nameMatch) {
      updates.name = nameMatch[1].trim()
      console.log(`[Sophia] Name detected: ${updates.name}`)
    }
  }

  // Detect family / dependents
  if (msg.match(/somos (\d+)|(\d+) personas|mi esposa|mi esposo|mis hijos|mi familia|mi pareja|my wife|my husband|my kids/)) {
    const numMatch = msg.match(/somos (\d+)|(\d+) personas/)
    if (numMatch) {
      updates.dependents = parseInt(numMatch[1] || numMatch[2])
    } else {
      updates.for_crossselling = true
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
    Object.assign(lead, updates)
  }
}

// ── Generate AI summary for Carlos ──
async function generateSummaryForCarlos(history: any[]): Promise<string> {
  try {
    const convoText = history.slice(-10).map((c: any) =>
      `${c.direction === 'inbound' ? 'Cliente' : 'Sophia'}: ${c.message}`
    ).join('\n')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: 'Resume en 5 bullets cortos esta conversación de ventas de seguros. Incluye: qué necesita el cliente, objeciones que tuvo, qué le interesó más, nivel de urgencia. Responde SOLO los bullets, sin introducción.',
        messages: [{ role: 'user', content: convoText }],
      }),
    })

    if (res.ok) {
      const data = await res.json()
      return data.content?.[0]?.text || 'Resumen no disponible'
    }
    return 'Resumen no disponible'
  } catch {
    return 'Resumen no disponible'
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
async function getAIResponse(lead: any, conversationHistory: any[], incomingMessage: string, alreadyIntroduced: boolean = false): Promise<string> {
  const color = lead.favorite_color || lead.color_favorito || ''
  const hasColor = !!color
  const messageNumber = conversationHistory.length + 1

  const systemPrompt = `Eres Sophia, asesora de Luxury Shield Insurance. Eres cálida, natural y conversacional — como una amiga que sabe de seguros, no una vendedora robótica.

IDIOMA: Responde en español. Si el cliente escribe en inglés, responde en inglés.

═══ REGLA #1 — MEMORIA ABSOLUTA ═══
El historial de conversación te lo dan completo. LÉELO COMPLETO antes de responder.
- Si el lead ya dio su nombre → úsalo, NUNCA lo pidas de nuevo
- Si ya dijo su estado → úsalo, NUNCA lo pidas de nuevo
- Si ya dijo cuántas personas → úsalo, NUNCA lo pidas de nuevo
- Si ya respondió una pregunta → NO la repitas
- Si ya mencionaste un ejemplo (Sarah/George) → USA OTRO argumento

═══ REGLA #2 — PRESENTACIÓN ÚNICA ═══
${alreadyIntroduced ? 'YA TE PRESENTASTE en un mensaje anterior. NUNCA digas "Hola, soy Sophia de Luxury Shield" de nuevo. Empieza directo respondiendo a lo que dijo el lead.' : 'Este es el primer contacto. Preséntate brevemente UNA sola vez.'}

═══ REGLA #3 — AVANZA LA CONVERSACIÓN ═══
Cada mensaje debe avanzar hacia la venta. No repitas información ya dada.
El flujo es:
1. Calificar (estado, personas, seguro actual)
2. Presentar el plan con precio específico
3. Manejar objeciones
4. Transferir a Carlos cuando esté listo

═══ REGLA #4 — UN SOLO EJEMPLO POR CONVERSACIÓN ═══
Solo usa el ejemplo de Sarah ($509→$11.10) O George ($1,895→$421) UNA vez en TODA la conversación. Revisa el historial — si ya lo usaste, usa otros argumentos:
- Limpieza cubierta desde día 1 ($100 ahorrados)
- Evaluación + radiografías = $0 ($280 ahorrados)
- Sin preguntas de salud, emisión garantizada
- Red de 85,000+ proveedores

═══ REGLA #5 — RESPONDE LO QUE PREGUNTARON ═══
- Si preguntan precio → da el precio: individual FL ~$35-45/mes, familia 5 ~$120-150/mes estimado. "Para el precio exacto, Carlos te prepara la cotización en 5 minutos."
- Si preguntan si eres IA → sé honesta: "Soy una asistente virtual, pero Carlos, nuestro asesor humano, te acompaña en el cierre y responde cualquier duda técnica."
- Si preguntan algo que ya dijeron → demuestra que lo recuerdas

═══ PRODUCTO: CIGNA DVH PLUS ═══
- Dental: sin espera día 1. Año 1: 60% básicos, 20% principales. Año 4+: hasta 90%
- Deducible: $0, $50 o $100/persona/año | Máximo anual: $1,000-$5,000
- Visión: $200 cada 2 años (espera 6 meses)
- Audición: $500/año (espera 12 meses)
- Emisión garantizada, 18-89 años, sin preguntas de salud, renovable de por vida
- Red PPO Careington: 85,000+ proveedores
- Estados: AK, AL, AR, AZ, CA, CO, CT, DC, DE, FL, GA, HI, IA, IL, IN, KS, KY, LA, ME, MI, MO, MS, MT, ND, NE, NH, NJ, NV, OK, PA, SC, SD, TX, UT, VT, WV, WI, WY

═══ DATOS DEL LEAD (de Supabase) ═══
- Nombre: ${lead.name || 'No proporcionado'}
- Estado: ${lead.state || 'No proporcionado'}
- Edad: ${lead.age || 'No proporcionada'}
- Seguro actual: ${lead.has_insurance === true ? 'Sí tiene' : lead.has_insurance === false ? 'No tiene' : 'No indicó'}
- Color de seguridad: ${hasColor ? color : 'No tiene'}
- Tipo de interés: ${lead.insurance_type || 'dental'}
${!hasColor && messageNumber >= 2 && messageNumber <= 4 ? '\n⚠️ El lead NO tiene color de seguridad. Pregúntalo naturalmente: "Para proteger tu información, ¿puedes elegir un color secreto? Azul, Verde, Rojo, Dorado, Púrpura o Naranja 🎨 Tu asesor lo mencionará antes de cualquier llamada."' : ''}

═══ MANEJO DE OBJECIONES ═══
- "Es caro" → Validar: "Entiendo, el presupuesto importa." Luego dato concreto.
- "Lo voy a pensar" → "Por supuesto. ¿Puedo preguntarte qué te genera más duda?"
- "Ya tengo seguro" → "¡Bien! ¿Tu plan cubre visión y audición? DVH Plus complementa."
- "No califico" → "Emisión garantizada — 18 a 89 años, sin preguntas de salud."

═══ CIERRE ═══
Cuando tengas estado + personas + seguro actual + nombre, di:
"Perfecto [nombre], Carlos puede prepararte una cotización exacta para [estado]. ¿Prefieres que te contacte hoy o mañana?"
${hasColor ? `Agrega: "Recuerda: Carlos se identificará con tu color *${color}*. Si alguien NO lo menciona, no compartas datos."` : ''}
Incluye [LISTO_PARA_COMPRAR] al final.

═══ FORMATO ═══
- Máximo 3-4 oraciones por mensaje
- NUNCA más de 1 pregunta por mensaje
- Siempre termina con pregunta O call-to-action
- Tono: amiga experta, natural — NUNCA robótica ni repetitiva`

  // Build message history — filter empty messages and ensure alternating roles
  const rawMessages = [
    ...conversationHistory
      .filter((c: any) => c.message && c.message.trim())
      .map((c: any) => ({
        role: c.direction === 'inbound' ? 'user' as const : 'assistant' as const,
        content: c.message.trim(),
      })),
    { role: 'user' as const, content: incomingMessage }
  ]
  // Claude requires alternating user/assistant — merge consecutive same-role messages
  const messages: { role: 'user' | 'assistant'; content: string }[] = []
  for (const msg of rawMessages) {
    if (messages.length > 0 && messages[messages.length - 1].role === msg.role) {
      messages[messages.length - 1].content += '\n' + msg.content
    } else {
      messages.push({ ...msg })
    }
  }

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
    // Check if ai-contact already sent a welcome message
    const priorOutbound = (history || []).filter((m: any) => m.direction === 'outbound')
    const alreadyIntroduced = priorOutbound.length > 0

    const aiResponse = await getAIResponse(lead, history || [], body, alreadyIntroduced)

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

    // If ready to buy — generate summary and notify Carlos
    if (isReadyToBuy) {
      const color = lead.favorite_color || lead.color_favorito || '—'
      const firstName = lead.name?.split(' ')[0] || 'el cliente'

      // Generate AI summary
      const allMessages = [...(history || []), { direction: 'inbound', message: body }, { direction: 'outbound', message: cleanResponse }]
      const summary = await generateSummaryForCarlos(allMessages)

      // Save summary to lead
      await supabase.from('leads').update({
        ready_to_buy: true,
        stage: 'interested',
        score: 95,
        score_recommendation: '🔥 Lead calificado por Sophia IA — listo para cerrar',
        ia_active: false,
        resumen_sophia: summary,
      }).eq('id', lead.id)

      const agentMsg = `🔥 *LEAD LISTO PARA HABLAR*

👤 *Nombre:* ${lead.name || from}
📱 *WhatsApp:* ${from}
📍 *Estado:* ${lead.state || '—'}
🎨 *Color secreto:* ${color} ← MENCIONA ESTO PRIMERO AL LLAMAR
⭐ *Score:* 95/100

📋 *RESUMEN DE SOPHIA:*
${summary}

💬 *Primera línea sugerida:*
"Hola ${firstName}, soy Carlos de Luxury Shield. Tu color es ${color}. ¿Tienes 10 minutos?"

🚀 ¡Llámalo ahora — está listo!`

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
