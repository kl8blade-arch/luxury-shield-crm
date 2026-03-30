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
// ── Response speed detection ──
function getSpeedContext(history: any[]): string {
  const inbound = history.filter((m: any) => m.direction === 'inbound' && m.created_at)
  if (inbound.length < 2) return ''
  const last = new Date(inbound[inbound.length - 1].created_at).getTime()
  const prev = new Date(inbound[inbound.length - 2].created_at).getTime()
  const mins = Math.round((last - prev) / 60000)
  if (mins < 3) return '\nESTADO: Lead CALIENTE. Respondió en menos de 3 min. Acelera hacia el cierre. Si ya tienes estado y familia, presenta el plan y crea urgencia. Máximo 2 mensajes más antes de pedir la llamada.'
  if (mins < 60) return ''
  if (mins < 240) return '\nESTADO: Lead enfriándose. Reconecta emocionalmente antes de continuar. Una línea que recuerde por qué empezó esta conversación.'
  if (mins < 1440) return '\nESTADO: Lead frío. NO continúes donde quedaste. Abre con algo nuevo o personal. Reconstruye rapport antes de vender.'
  return '\nESTADO: Lead muy frío (>24h). Trátalo casi como nuevo. Saluda cálidamente, menciona que habían hablado antes. No menciones el plan hasta el 2do mensaje.'
}

async function getAIResponse(lead: any, conversationHistory: any[], incomingMessage: string, alreadyIntroduced: boolean = false): Promise<string> {
  const color = lead.favorite_color || lead.color_favorito || ''
  const hasColor = !!color
  const messageNumber = conversationHistory.length + 1

  // Module: Stage context
  let stageContext = ''
  try {
    const { STAGE_SOPHIA_CONTEXT } = await import('@/lib/stage-context')
    const ctx = STAGE_SOPHIA_CONTEXT[lead.stage] || STAGE_SOPHIA_CONTEXT.nuevo
    stageContext = `\n═══ STAGE ACTUAL: ${(lead.stage || 'nuevo').toUpperCase()} ═══\n${ctx}`
    // Check if manual mode just ended (sophia retaking)
    if (lead.manual_ended_at) {
      const minsSince = (Date.now() - new Date(lead.manual_ended_at).getTime()) / 60000
      if (minsSince < 10) {
        stageContext += '\nIMPORTANTE: Un agente humano acaba de devolverte esta conversación. Retoma naturalmente sin presentarte de nuevo. Reconecta con el lead.'
      }
    }
  } catch {}

  // Module 1: Sophia learnings
  let learningsContext = ''
  try {
    const { getRelevantLearnings } = await import('@/lib/sophia-learning')
    learningsContext = await getRelevantLearnings(supabase, lead.state)
  } catch {}

  // Module 2: Speed detection
  const speedContext = getSpeedContext(conversationHistory)

  // Module 3: Multi-language (EN/ES/ZH/HT)
  const lang = lead.preferred_language || 'es'
  const langNotes: Record<string, string> = {
    en: 'IMPORTANT: This lead speaks ENGLISH. Respond entirely in English. Use American insurance terminology.',
    zh: 'IMPORTANT: 这位客户说中文。用简体中文回复。Use Chinese (Simplified) for all responses. Be respectful and formal.',
    ht: 'IMPORTANT: Kliyan sa a pale Kreyòl Ayisyen. Reponn an Kreyòl Ayisyen. Respond in Haitian Creole. Be warm and community-oriented.',
    es: '',
  }
  const langNote = langNotes[lang] || ''

  const systemPrompt = `══ REGLA #0 — DETECCIÓN DE CIERRE — MÁXIMA PRIORIDAD ══
Si el lead dice "ya mismo", "ahora mismo", "quiero que me llamen", "consígueme el plan", "quiero empezar", "dónde firmo", "cómo activo", "ok me interesa", "sí quiero", confirma un número de teléfono, o CUALQUIER frase que indique que quiere proceder:
→ INCLUIR [LISTO_PARA_COMPRAR] en tu respuesta
→ Tu mensaje debe ser SOLO: "Perfecto [nombre]! Nuestro especialista te llama en los próximos 15 minutos. ${hasColor ? `Recuerda: mencionará tu color ${color} al inicio.` : ''} ¡Ya casi están protegidos! 🎉"
→ NO hacer más preguntas. NO repetir el pitch. SOLO confirmar.

══ REGLA #0B — NUNCA RE-PREGUNTAR ══
Lee TODO el historial. Extrae lo que el lead YA dijo:
- Estado, familia, dentista, seguro, interés en llamada
Si alguno ya está → NUNCA volver a preguntarlo.
Si el lead dice "ya te dije" → pedir disculpas UNA vez y avanzar.

Eres Sophia, parte del equipo de asesores de Luxury Shield Insurance. Eres cálida, inteligente, empática y persuasiva — como una amiga cercana que trabaja en salud y quiere que su gente esté protegida. No eres una vendedora. Eres alguien que genuinamente se preocupa.

IDIOMA: Responde en español. Si el cliente escribe en inglés, responde en inglés.

━━━ REGLAS ABSOLUTAS ━━━

1. MEMORIA: Lee TODO el historial antes de responder. Nunca pidas información que el lead ya dio. ${alreadyIntroduced ? 'YA TE PRESENTASTE — NUNCA te presentes de nuevo.' : 'Este es el primer contacto, preséntate brevemente UNA vez.'}

2. IDENTIDAD: Eres parte del equipo de Luxury Shield. Si preguntan si eres IA → "Soy parte del equipo de asesores de Luxury Shield 😊 ¿Seguimos?"
NUNCA menciones "agente humano" ni "inteligencia artificial".

3. VOCABULARIO: ❌ "seguro" → ✅ "plan de protección", "cobertura", "plan DVH". ❌ "vender/comprar" → ✅ "activar", "iniciar tu cobertura". ❌ "agente humano te contactará".

4. [LISTO_PARA_COMPRAR]: Solo incluirlo cuando el lead CONFIRME que quiere la llamada para activar. Esta señal notifica al especialista.

━━━ FASES DE LA CONVERSACIÓN ━━━

── FASE 1: CONECTAR ──
Objetivo: Entender situación. Recopilar: estado, composición familiar, último dentista, cobertura actual.
Tono: curioso, cálido, sin presión.
"¿Cuándo fue la última vez que fuiste al dentista? (Sin presión, solo para entender tu situación 😊)"
${!hasColor && messageNumber >= 2 && messageNumber <= 4 ? 'También pregunta color de seguridad: "Para proteger tu info, elige un color secreto: Azul, Verde, Rojo, Dorado, Púrpura o Naranja 🎨"' : ''}

── FASE 2: SENSIBILIZAR ──
Elige UNO según contexto del lead:
- DOLOR/URGENCIA: "El 80% de problemas dentales serios empezaron como algo que 'todavía no duele'. El dolor no avisa — un día está bien, al siguiente es urgencia de $800."
- ESTÉTICA/TRABAJO: "En una entrevista, una cita, una reunión — la gente nota la sonrisa antes que nada. Una sonrisa saludable aumenta 40% la percepción de confianza."
- FAMILIA/HIJOS: "Los niños aprenden hábitos dentales de sus padres. Si los llevas desde pequeños, tienen 60% menos probabilidad de tratamientos costosos de adultos."
- MIEDO AL COSTO: "Muchos evitan el dentista por el costo, no por miedo. Y esperan hasta que duele, que es cuando cuesta 5 veces más."

── FASE 3: BENEFICIOS ──
Presentar UNA vez:
"Con tu plan de protección activado:
🦷 Evaluación con doctor ($95) → CUBIERTO
📷 Radiografías ($85) → CUBIERTO
✨ Limpieza profesional ($100) → CUBIERTO
Total: $280 en beneficios → **$0** con tu plan.
Y como extra: $200 para lentes o exámenes de vista."

── FASE 4: EJEMPLO PERSONALIZADO ──
Fabricar ejemplo usando contexto del lead (mismo estado, situación similar):
"La semana pasada, [nombre latino], también en ${lead.state || 'tu estado'}, [situación similar]. Fue al dentista — sin plan: $[monto]. Con DVH: $[monto bajo]. Ese dinero se quedó en su bolsillo."
Nombres latinos por estado: FL→María/Carmen/Luis, TX→Ana/Roberto/Diego, CA→Valentina/Andrés

── FASE 5: URGENCIA (sin presión) ──
"Por esta semana, la emisión sigue garantizada sin preguntas de salud."
"Cada mes sin plan son $[precio]/mes que gastas, pero también un mes donde cualquier urgencia te cuesta $500-$2,000 de bolsillo."
"La mayoría de familias latinas en ${lead.state || 'tu estado'} ya tienen esto cubierto."

── FASE 6: CIERRE ──
"Lo que sigue es simple: nuestro especialista te llama para revisar planes en ${lead.state || 'tu estado'} y activar el tuyo. La llamada dura 15 minutos. ¿Cuándo te viene mejor — esta tarde o mañana?"
Cuando confirme → ${hasColor ? `"Recuerda: cuando te llame, mencionará tu color *${color}* para que sepas que es de nuestro equipo."` : ''}
→ Incluir [LISTO_PARA_COMPRAR]

━━━ OBJECIONES ━━━
- "Es caro" → "Entiendo 🙏 ¿Cuánto pagaste la última vez en el dentista? Con el plan, esa visita hubiera sido $0. Cuesta menos que una visita sin cobertura."
- "Lo voy a pensar" → "Claro 😊 Los precios pueden subir y la emisión garantizada no siempre está. ¿Qué te genera más duda?"
- "No lo necesito" → "Nadie lo necesita hasta que lo necesita de verdad. ¿Cuándo fue tu última limpieza? Ya tienes meses de beneficio perdido."
- "¿Cuánto cuesta?" → Individual FL: ~$35-45/mes, Pareja: ~$65-80/mes, Familia 4-5: ~$120-150/mes. "El precio exacto te lo confirma el especialista."
- "Ya tengo seguro" → "¿Te cubre la limpieza desde el primer mes sin espera? Muchos planes tienen 6-12 meses de espera. DVH no — desde el día 1."

━━━ PRODUCTO: CIGNA DVH PLUS ━━━
- Dental SIN espera día 1. Año 1: 60% básicos, 20% principales. Año 4+: hasta 90%
- Deducible: $0, $50 o $100 | Máximo anual: $1,000-$5,000/persona
- Visión: $200 cada 2 años (espera 6 meses) | Audición: $500/año (espera 12 meses)
- Emisión garantizada, 18-89 años, sin preguntas de salud, renovable de por vida
- Red PPO Careington: 85,000+ proveedores
- Estados: FL, TX, CA, IL, GA, NC, SC, TN, NJ, AL y 28 más

━━━ DATOS DEL LEAD ━━━
- Nombre: ${lead.name || 'No proporcionado'}
- Estado: ${lead.state || 'No proporcionado'}
- Edad: ${lead.age || 'No proporcionada'}
- Cobertura actual: ${lead.has_insurance === true ? 'Sí tiene' : lead.has_insurance === false ? 'No tiene' : 'No indicó'}
- Color: ${hasColor ? color : 'No tiene'}
${lead.quiz_dentist_last_visit ? `- Última visita dentista: ${lead.quiz_dentist_last_visit} (del quiz — NO preguntar de nuevo)` : ''}
${lead.quiz_coverage_type ? `- Tipo cobertura: ${lead.quiz_coverage_type} (del quiz — NO preguntar de nuevo)` : ''}
${lead.quiz_has_insurance ? `- Cobertura actual: ${lead.quiz_has_insurance} (del quiz — NO preguntar de nuevo)` : ''}

━━━ FORMATO ━━━
- Máximo 5-6 líneas por mensaje
- Una sola pregunta por mensaje
- Emojis: 1-2, nunca en exceso
- Negrita para datos: **$0**, **día 1**
- Tono: conversacional, nunca corporativo ni repetitivo
${langNote}${speedContext}${stageContext}${learningsContext}`

  // Inject known context into system prompt so Sophia never re-asks
  const contextSummary = `
CONTEXTO YA RECOPILADO (NO PREGUNTAR DE NUEVO):
- Nombre: ${lead.name || 'desconocido'}
- Estado: ${lead.state || 'desconocido'}
- Composición: ${lead.quiz_coverage_type || (lead.dependents ? lead.dependents + ' personas' : 'desconocido')}
- Última visita dentista: ${lead.quiz_dentist_last_visit || 'desconocido'}
- Tiene seguro: ${lead.has_insurance === true ? 'Sí' : lead.has_insurance === false ? 'No' : lead.quiz_has_insurance || 'desconocido'}
- Color de seguridad: ${hasColor ? color : 'no asignado'}
- Mensajes intercambiados: ${conversationHistory.length}
Si algún dato dice 'desconocido', puedes preguntarlo. Si ya está, NUNCA volver a preguntarlo.
`

  // Inject dynamic layers from Sophia OS (memory + skills + knowledge)
  let dynamicLayers = ''
  try {
    const { buildDynamicPromptLayers } = await import('@/lib/build-sophia-prompt')
    dynamicLayers = await buildDynamicPromptLayers()
  } catch {}

  // Sophia Orchestrator — route to expert agent if needed
  let expertLayer = ''
  try {
    const { routeToExpert, buildOrchestratedPrompt } = await import('@/lib/sophia-orchestrator')
    const expert = await routeToExpert(incomingMessage, lead)
    if (expert) {
      expertLayer = `\n═══ ESPECIALISTA: ${expert.name} ═══\n${expert.system_prompt}\n═══════════════════════════════════`
      console.log(`[ORCHESTRATOR] Routed to ${expert.name} for "${incomingMessage.substring(0, 40)}"`)
    }
  } catch {}

  // Campaign-specific prompt override
  let campaignLayer = ''
  try {
    if (lead.utm_campaign) {
      const { data: campaign } = await supabase.from('campaigns').select('sophia_prompt_override, name').eq('utm_campaign', lead.utm_campaign).single()
      if (campaign?.sophia_prompt_override) {
        campaignLayer = `\n═══ CAMPAÑA: ${campaign.name} ═══\n${campaign.sophia_prompt_override}\n═══════════════════════════════`
        console.log(`[CAMPAIGN] Lead from campaign: ${campaign.name}`)
      }
    }
  } catch {}

  const fullSystemPrompt = contextSummary + '\n' + systemPrompt + dynamicLayers + expertLayer + campaignLayer

  // Build message history for Claude API
  const rawMessages: { role: 'user' | 'assistant'; content: string }[] = []

  for (const msg of conversationHistory) {
    if (!msg.message || !msg.message.trim()) continue
    const role = msg.direction === 'inbound' ? 'user' as const : 'assistant' as const
    rawMessages.push({ role, content: msg.message.trim() })
  }

  rawMessages.push({ role: 'user', content: incomingMessage })

  // Ensure first message is 'user' (Claude API requirement)
  while (rawMessages.length > 0 && rawMessages[0].role === 'assistant') {
    rawMessages.shift()
  }

  // Merge consecutive same-role messages
  const messages: { role: 'user' | 'assistant'; content: string }[] = []
  for (const msg of rawMessages) {
    if (messages.length > 0 && messages[messages.length - 1].role === msg.role) {
      messages[messages.length - 1].content += '\n' + msg.content
    } else {
      messages.push({ ...msg })
    }
  }

  console.log(`[SOPHIA] messages enviados a Claude: ${messages.length}`)
  console.log(`[SOPHIA] estructura: ${messages.map(m => m.role).join(' → ')}`)

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
        system: fullSystemPrompt,
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
            system: fullSystemPrompt,
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

// ── SYSTEM 1: Handle agent messages (parser) ──
async function handleAgentMessage(agent: any, message: string, agentPhone: string) {
  const TWIML_OK = new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  )

  try {
    // Parse agent message with Claude
    const parseRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `Eres un parser de reportes de ventas. El agente envió: "${message}"
Devuelve SOLO un JSON sin texto adicional:
{"accion":"vendido"|"perdido"|"seguimiento"|"no_califica"|"desconocido","lead_referencia":string|null,"monto":number|null,"motivo":string|null,"fecha_seguimiento":string|null,"notas":string}
Ejemplos:
- "vendido 500 María la de Florida" → {"accion":"vendido","lead_referencia":"María","monto":500,"motivo":null,"fecha_seguimiento":null,"notas":"cliente de Florida"}
- "perdido precio para Juan" → {"accion":"perdido","lead_referencia":"Juan","monto":null,"motivo":"precio","fecha_seguimiento":null,"notas":""}
- "llamo a Pedro mañana 3pm" → {"accion":"seguimiento","lead_referencia":"Pedro","monto":null,"motivo":null,"fecha_seguimiento":"mañana 3pm","notas":""}
- "cerré a la señora por 350" → {"accion":"vendido","lead_referencia":null,"monto":350,"motivo":null,"fecha_seguimiento":null,"notas":"la señora"}`,
        messages: [{ role: 'user', content: message }],
      }),
    })

    let parsed: any = { accion: 'desconocido' }
    if (parseRes.ok) {
      const data = await parseRes.json()
      const text = data.content?.[0]?.text || ''
      try {
        parsed = JSON.parse(text.replace(/```json?\n?|\n?```/g, '').trim())
      } catch { console.error('[Agent Parser] JSON parse failed:', text) }
    }

    console.log('[Agent Parser] Parsed:', parsed)

    // CASE A: Unknown action
    if (parsed.accion === 'desconocido') {
      await sendWhatsApp(agentPhone, `No entendí bien 😅 ¿Puedes decirme el resultado?\n\nEscríbeme así:\n- VENDIDO [nombre] [monto]\n- PERDIDO [nombre] [motivo]\n- SEGUIMIENTO [nombre] [fecha]\n- NO CALIFICA [nombre]`)
      return TWIML_OK
    }

    // Find the lead
    let lead: any = null

    // Try by name reference
    if (parsed.lead_referencia) {
      const { data: matchedLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('agent_id', agent.id)
        .ilike('name', `%${parsed.lead_referencia}%`)
        .is('fecha_cierre', null)
        .order('updated_at', { ascending: false })
        .limit(1)
      lead = matchedLeads?.[0]
    }

    // CASE B: No lead found — try last pending lead
    if (!lead) {
      const { data: pendingLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('agent_id', agent.id)
        .in('stage', ['listo_comprar', 'agendado', 'interested', 'seguimiento_agente'])
        .is('fecha_cierre', null)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (!pendingLeads || pendingLeads.length === 0) {
        await sendWhatsApp(agentPhone, `No encontré leads pendientes asignados a ti. ¿Puedes darme el nombre o teléfono del cliente?`)
        return TWIML_OK
      }
      if (pendingLeads.length === 1) {
        lead = pendingLeads[0]
      } else {
        const list = pendingLeads.map((l: any, i: number) => `${i + 1}. ${l.name} (${l.state || '?'})`).join('\n')
        await sendWhatsApp(agentPhone, `¿Sobre cuál lead es el reporte?\n\n${list}\n\nResponde con el número o el nombre 😊`)
        return TWIML_OK
      }
    }

    // CASE C: Action recognized + lead identified
    const now = new Date().toISOString()
    const feedback = {
      resultado: parsed.accion,
      notas: parsed.notas || '',
      monto: parsed.monto,
      motivo_perdida: parsed.motivo,
      fecha_reporte: now,
      agente: agent.name,
    }

    const stageMap: Record<string, string> = {
      vendido: 'closed_won',
      perdido: 'closed_lost',
      seguimiento: 'seguimiento_agente',
      no_califica: 'unqualified',
    }

    const updates: Record<string, any> = {
      stage: stageMap[parsed.accion] || lead.stage,
      agente_feedback: feedback,
      updated_at: now,
    }

    if (parsed.accion === 'vendido' || parsed.accion === 'perdido' || parsed.accion === 'no_califica') {
      updates.fecha_cierre = now
      updates.resultado_final = parsed.accion
    }

    await supabase.from('leads').update(updates).eq('id', lead.id)
    console.log(`[Agent Parser] Updated lead ${lead.name}: ${parsed.accion}`)

    // Confirm to agent
    const firstName = lead.name?.split(' ')[0] || 'el lead'
    const agentFirst = agent.name?.split(' ')[0] || ''

    const confirmations: Record<string, string> = {
      vendido: `🎉 ¡Cerraste a ${firstName}! Actualicé el CRM.\nComisión estimada: $${Math.round((parsed.monto || 0) * 0.15)}.\n¡Excelente trabajo ${agentFirst}! 💪`,
      perdido: `Anotado. ${firstName} queda en lista para reengagement en 30 días con otro ángulo.\nMotivo guardado: ${parsed.motivo || 'no especificado'} 📝`,
      seguimiento: `Listo, agendé seguimiento para ${parsed.fecha_seguimiento || 'próximo contacto'}.\nTe recuerdo ese día ${agentFirst} 👍`,
      no_califica: `Entendido, ${firstName} marcado como no califica.\nGuardé el motivo para futuros filtros.`,
    }

    await sendWhatsApp(agentPhone, confirmations[parsed.accion] || 'Actualizado ✅')

    // Module 1: Learn from closed deal
    if (parsed.accion === 'vendido') {
      try {
        const { learnFromClosedDeal } = await import('@/lib/sophia-learning')
        learnFromClosedDeal(supabase, lead.id, process.env.ANTHROPIC_API_KEY!).catch(() => {})
        const { extractTrainingData } = await import('@/lib/training-pipeline')
        extractTrainingData(supabase, lead.id).catch(() => {})
      } catch {}
    }

    // If sold — welcome message + schedule referral followup (48h)
    if (parsed.accion === 'vendido' && lead.phone) {
      await sendWhatsApp(lead.phone, `¡${firstName}! 🎉 Tu plan de protección familiar ya está en proceso. Recibirás los detalles completos muy pronto.\n\n¡Bienvenido/a a la familia Luxury Shield! 💙`)

      // Schedule referral followup for 48h later (System 3)
      const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      try {
        const refRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 150,
            messages: [{ role: 'user', content: `Eres Sophia de Luxury Shield. ${firstName} activó su plan DVH hace 2 días. Escribe un mensaje de seguimiento de máximo 4 líneas que: pregunte cómo se siente con su nuevo plan, mencione naturalmente que si conoce a alguien sin cobertura dental hay un beneficio especial. NO uses 'referido' ni 'comisión'. Usa 'si conoces a alguien que lo necesite...'. Que suene como amiga. Responde SOLO el mensaje.` }],
          }),
        })
        const refMsg = refRes.ok ? (await refRes.json()).content?.[0]?.text : ''
        await supabase.from('reminders').insert({
          lead_id: lead.id, lead_phone: lead.phone,
          message_text: refMsg || `Hola ${firstName} 😊 ¿Cómo te va con tu nuevo plan? Si conoces a alguien que lo necesite, hay algo especial para ti 💙`,
          scheduled_for: in48h, type: 'referral_followup', status: 'pending',
        })
      } catch (e) { console.error('[Referral followup] Error:', e) }
    }

    // If lost — trigger rescue sequence (System 2)
    if (parsed.accion === 'perdido' && lead.phone) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'
      fetch(`${appUrl}/api/rescue-sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id, motivo_perdida: parsed.motivo,
          lead_phone: lead.phone, lead_name: lead.name,
          estado: lead.state, familia: lead.dependents ? `${lead.dependents} personas` : '',
        }),
      }).catch(e => console.error('[Rescue] Trigger error:', e))
    }

    // If follow-up — create reminder
    if (parsed.accion === 'seguimiento') {
      await supabase.from('reminders').insert({
        lead_id: lead.id,
        type: 'agent_followup',
        notes: `Seguimiento: ${parsed.fecha_seguimiento || 'pendiente'} — ${parsed.notas}`,
        status: 'pending',
      })
    }

    return TWIML_OK
  } catch (error: any) {
    console.error('[Agent Parser] Error:', error)
    await sendWhatsApp(agentPhone, 'Hubo un error procesando tu reporte. Intenta de nuevo en unos segundos.')
    return TWIML_OK
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
    const numMedia = parseInt(formData.get('NumMedia') as string || '0')
    const mediaType = formData.get('MediaContentType0') as string || ''

    console.log(`[TWILIO RAW] From: ${from} | Body: "${body}" | MediaUrl: ${mediaUrl ? 'yes' : 'no'} | NumMedia: ${numMedia} | Type: ${mediaType}`)

    // ══════════════════════════════════════════════
    // MASTER DETECTION — Carlos trains Sophia via WhatsApp
    // ══════════════════════════════════════════════
    const MASTER_NUM = '17869435656'
    const fromDigits = from.replace(/\D/g, '')
    if (fromDigits === MASTER_NUM || fromDigits.endsWith(MASTER_NUM.slice(-10))) {
      console.log('[MASTER] Message from master — training mode')

      // Transcribe audio if needed
      let masterBody = body
      if (!masterBody && mediaUrl && (mediaType.includes('audio') || mediaType.includes('ogg'))) {
        try {
          const twilioAuth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
          const rRes = await fetch(mediaUrl, { headers: { 'Authorization': `Basic ${twilioAuth}` }, redirect: 'manual' })
          const audioUrl = rRes.status === 307 ? rRes.headers.get('location') || mediaUrl : mediaUrl
          const aRes = await fetch(audioUrl)
          const aBuf = Buffer.from(await aRes.arrayBuffer())
          const wForm = new FormData()
          wForm.append('file', new Blob([aBuf], { type: 'audio/ogg' }), 'audio.ogg')
          wForm.append('model', 'whisper-1')
          wForm.append('language', 'es')
          const wRes = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, body: wForm })
          if (wRes.ok) { const r = await wRes.json(); masterBody = r.text || '' }
        } catch (e) { console.error('[MASTER] Audio transcription error:', e) }
      }

      if (masterBody || mediaUrl) {
        const { handleMasterMessage } = await import('@/lib/master-handler')
        await handleMasterMessage(from, masterBody || '', mediaUrl || undefined, mediaType || undefined)
      }

      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { status: 200, headers: { 'Content-Type': 'text/xml' } })
    }

    // Handle audio/media messages
    const isAudio = numMedia > 0 && (mediaType.includes('audio') || mediaType.includes('ogg') || mediaType.includes('mpeg') || mediaType.includes('mp4') || mediaUrl.includes('audio'))

    if (isAudio || (mediaUrl && !body)) {
      console.log(`[AUDIO] Detected — URL: ${mediaUrl} | Type: ${mediaType}`)

      try {
        const openaiKey = process.env.OPENAI_API_KEY
        if (!openaiKey || openaiKey === 'pendiente') throw new Error('No OpenAI key')

        // Download audio from Twilio — handle 307 redirect
        const twilioAuth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')

        // Step 1: Get redirect URL (Twilio returns 307)
        const redirectRes = await fetch(mediaUrl, {
          headers: { 'Authorization': `Basic ${twilioAuth}` },
          redirect: 'manual',
        })

        let audioUrl = mediaUrl
        if (redirectRes.status === 307 || redirectRes.status === 302 || redirectRes.status === 301) {
          audioUrl = redirectRes.headers.get('location') || mediaUrl
          console.log(`[AUDIO] Redirect to: ${audioUrl.substring(0, 80)}...`)
        }

        // Step 2: Download from final URL (no auth needed after redirect)
        const dlController = new AbortController()
        const dlTimeout = setTimeout(() => dlController.abort(), 5000)

        const audioRes = await fetch(audioUrl, { signal: dlController.signal })
        clearTimeout(dlTimeout)

        if (!audioRes.ok) throw new Error(`Download ${audioRes.status}`)

        const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
        console.log(`[AUDIO] Downloaded: ${audioBuffer.length} bytes`)

        if (audioBuffer.length < 100) throw new Error('Audio too small')

        // Whisper transcription with 5s timeout
        const whisperController = new AbortController()
        const whisperTimeout = setTimeout(() => whisperController.abort(), 5000)

        const whisperForm = new FormData()
        whisperForm.append('file', new Blob([audioBuffer], { type: mediaType || 'audio/ogg' }), 'audio.ogg')
        whisperForm.append('model', 'whisper-1')
        whisperForm.append('language', 'es')

        const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}` },
          body: whisperForm,
          signal: whisperController.signal,
        })
        clearTimeout(whisperTimeout)

        if (!whisperRes.ok) {
          const err = await whisperRes.text()
          console.error(`[WHISPER] Error ${whisperRes.status}: ${err}`)
          throw new Error(`Whisper ${whisperRes.status}`)
        }

        const result = await whisperRes.json()
        const transcription = result.text || ''
        console.log(`[WHISPER] Result: "${transcription}"`)

        if (transcription.trim()) {
          body = transcription.trim()
        } else {
          throw new Error('Empty transcription')
        }
      } catch (audioErr: any) {
        console.error('[AUDIO] Error:', audioErr.message)
        if (!body) {
          await sendWhatsApp(from, 'Recibí tu audio 😊 ¿Puedes escribirme lo que dijiste? Así te ayudo mejor.')
          return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
            { status: 200, headers: { 'Content-Type': 'text/xml' } }
          )
        }
      }
    }

    if (!from || !body) {
      return new NextResponse('OK', { status: 200 })
    }

    // ── SYSTEM 1: Detect if message is from an AGENT ──
    const cleanFromPhone = from.replace(/\D/g, '')
    const { data: agentMatches } = await supabase
      .from('agents')
      .select('*')
      .or(`whatsapp_number.eq.${from},whatsapp_number.eq.+${cleanFromPhone},phone.eq.${cleanFromPhone},phone.eq.+${cleanFromPhone}`)
      .limit(1)
    const senderAgent = agentMatches?.[0] || null

    if (senderAgent) {
      console.log(`[Agent Parser] Message from agent: ${senderAgent.name} — "${body}"`)
      const agentResult = await handleAgentMessage(senderAgent, body, from)
      return agentResult
    }

    // Find lead by phone — try ALL possible formats
    const digitsOnly = from.replace(/\D/g, '')        // 17869435656
    const last10 = digitsOnly.slice(-10)               // 7869435656
    const withPlus = from.startsWith('+') ? from : `+${digitsOnly}` // +17869435656
    const with1 = digitsOnly.startsWith('1') ? digitsOnly : `1${digitsOnly}`

    console.log(`[Sophia] Looking up lead: digits=${digitsOnly} last10=${last10} withPlus=${withPlus}`)

    const { data: allLeads, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .or(`phone.eq.${digitsOnly},phone.eq.${last10},phone.eq.${withPlus},phone.eq.+${digitsOnly},phone.eq.${from},phone.eq.${with1}`)
      .order('created_at', { ascending: false })

    if (leadErr) console.error('[Sophia] Lead lookup error:', leadErr)
    console.log(`[SOPHIA] leads encontrados para este número: ${allLeads?.length || 0}`)

    // Select the lead with the most conversations (the "primary" one)
    let lead: any = null
    if (allLeads && allLeads.length > 0) {
      if (allLeads.length === 1) {
        lead = allLeads[0]
      } else {
        let maxMsgs = -1
        for (const candidate of allLeads) {
          const { count } = await supabase
            .from('conversations')
            .select('id', { count: 'exact', head: true })
            .eq('lead_id', candidate.id)
          const c = count || 0
          if (c > maxMsgs) { maxMsgs = c; lead = candidate }
        }
        // If none have conversations, use most recent
        if (!lead || maxMsgs === 0) lead = allLeads[0]
        console.log(`[SOPHIA] lead seleccionado (${allLeads.length} candidatos): ${lead.id} — ${lead.name} (${maxMsgs} msgs)`)
      }
    }

    // Create lead ONLY if none found
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
          conversation_mode: 'sophia',
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
            conversation_mode: 'sophia',
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

    console.log(`[Sophia] Lead found: ${lead.id} — ${lead.name} — stage: ${lead.stage} — mode: ${lead.conversation_mode || 'sophia'}`)

    // ══════════════════════════════════════════════
    // FRESH MODE CHECK — check ALL leads with this phone for manual mode
    // This handles duplicates: if ANY lead with this phone is manual, block
    // ══════════════════════════════════════════════
    const { data: allModes } = await supabase
      .from('leads')
      .select('conversation_mode')
      .or(`phone.eq.${digitsOnly},phone.eq.${last10},phone.eq.${withPlus},phone.eq.+${digitsOnly},phone.eq.${from}`)

    const anyManual = (allModes || []).some((m: any) => m.conversation_mode === 'manual' || m.conversation_mode === 'coaching')
    const currentMode = anyManual ? (allModes || []).find((m: any) => m.conversation_mode === 'manual')?.conversation_mode || 'coaching' : 'sophia'

    console.log(`[MODE CHECK] ${lead.name} | phone matches: ${allModes?.length || 0} | modes: ${(allModes || []).map((m: any) => m.conversation_mode).join(',')} | effective: ${currentMode}`)

    // Update lead object with fresh mode
    lead.conversation_mode = currentMode

    // BLOCK SOPHIA IF MODE IS MANUAL/COACHING
    if (currentMode === 'manual' || currentMode === 'coaching') {
      console.log(`[SOPHIA BLOCKED] ${lead.name} en modo ${currentMode}`)

      await supabase.from('conversations').insert({
        lead_id: lead.id, lead_name: lead.name, lead_phone: from,
        channel: 'whatsapp', direction: 'inbound', message: body,
        created_at: new Date().toISOString(),
      })
      await supabase.from('leads').update({
        last_contact: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      }).eq('id', lead.id)

      if (currentMode === 'coaching') {
        const { data: hist } = await supabase.from('conversations').select('direction, message').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(20)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'
        fetch(`${appUrl}/api/coaching`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id, last_message: body,
            conversation_history: hist || [],
            lead_context: { name: lead.name, state: lead.state, family: lead.quiz_coverage_type, color: lead.color_favorito, score: lead.score },
          }),
        }).catch(() => {})
      }

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      )
    }

    console.log(`[SOPHIA ACTIVE] Processing response for ${lead.name}`)

    // ══════════════════════════════════════════════
    // BUG FIX 5: Processing lock + rate limit
    // ══════════════════════════════════════════════
    if (lead.sophia_processing) {
      console.log(`[SOPHIA] Already processing for ${lead.name}, skip`)
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { status: 200, headers: { 'Content-Type': 'text/xml' } })
    }

    // Rate limit: max 1 response per 3 seconds per lead
    const { data: lastOut } = await supabase.from('conversations').select('created_at').eq('lead_id', lead.id).eq('direction', 'outbound').order('created_at', { ascending: false }).limit(1)
    if (lastOut?.[0]) {
      const secsSince = (Date.now() - new Date(lastOut[0].created_at).getTime()) / 1000
      if (secsSince < 3) {
        console.log(`[RATE LIMIT] ${lead.name}: ${secsSince.toFixed(1)}s since last msg, skip`)
        return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { status: 200, headers: { 'Content-Type': 'text/xml' } })
      }
    }

    // Set processing lock
    await supabase.from('leads').update({ sophia_processing: true }).eq('id', lead.id)

    // Get conversation history — try lead_id, then phone variants
    let history: any[] | null = null

    const { data: histById, error: histErr } = await supabase
      .from('conversations')
      .select('direction, message, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true })
      .limit(30)

    if (histErr) console.error('[Sophia] History error:', histErr)
    history = histById

    // Fallback: try by phone (multiple formats)
    if (!history || history.length === 0) {
      const { data: histByPhone } = await supabase
        .from('conversations')
        .select('direction, message, created_at, lead_id')
        .or(`lead_phone.eq.${from},lead_phone.eq.${digitsOnly},lead_phone.eq.${last10},lead_phone.eq.${withPlus}`)
        .order('created_at', { ascending: true })
        .limit(30)

      if (histByPhone && histByPhone.length > 0) {
        history = histByPhone
        console.log(`[Sophia] History found by phone fallback: ${history.length} msgs`)
        // Fix: update old conversations to use correct lead_id
        const oldLeadIds = [...new Set(histByPhone.map((m: any) => m.lead_id).filter((id: any) => id && id !== lead.id))]
        if (oldLeadIds.length > 0) {
          console.log(`[Sophia] Fixing ${oldLeadIds.length} orphaned lead_ids in conversations`)
          for (const oldId of oldLeadIds) {
            await supabase.from('conversations').update({ lead_id: lead.id }).eq('lead_id', oldId)
          }
        }
      }
    }

    console.log(`[SOPHIA] lead.id: ${lead.id} | lead.name: ${lead.name} | phone: ${from}`)
    console.log(`[SOPHIA] historial encontrado: ${history?.length ?? 0} mensajes`)
    if (history && history.length > 0) {
      console.log(`[SOPHIA] primer msg: ${history[0].direction} — "${history[0].message?.substring(0, 50)}"`)
    }

    // Save incoming message
    const { error: saveErr } = await supabase.from('conversations').insert({
      lead_id: lead.id,
      lead_name: lead.name,
      lead_phone: from,
      channel: 'whatsapp',
      direction: 'inbound',
      message: body,
    })
    if (saveErr) console.error('[Sophia] Save message error:', saveErr)

    // Module 3: Multi-language detection (EN/ES/ZH/HT)
    const detectLang = (text: string): string => {
      const t = text.toLowerCase()
      const en = t.match(/\b(the|is|are|want|have|how|much|need|yes|no|please|thank|what|when|where|can|do|my|your|would|could|about|with)\b/gi)
      const zh = t.match(/[\u4e00-\u9fff]/g)
      const ht = t.match(/\b(mwen|ou|ki|pou|nan|pa|gen|yo|sa|ak|fe|tanpri|bondye|kontan|anpil|kijan)\b/gi)
      if (zh && zh.length >= 2) return 'zh'
      if (ht && ht.length >= 2) return 'ht'
      if (en && en.length >= 3) return 'en'
      return 'es'
    }
    const detectedLang = detectLang(body)
    if (detectedLang !== (lead.preferred_language || 'es')) {
      await supabase.from('leads').update({ preferred_language: detectedLang, detected_language: detectedLang }).eq('id', lead.id)
      lead.preferred_language = detectedLang
    }

    // Update message tracking
    await supabase.from('leads').update({
      last_message_at: new Date().toISOString(),
      total_messages: (lead.total_messages || 0) + 1,
    }).eq('id', lead.id)

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

    let aiResponse = await getAIResponse(lead, history || [], body, alreadyIntroduced)

    // ══════════════════════════════════════════════
    // BUG FIX 2: Force closing signal detection
    // ══════════════════════════════════════════════
    const CLOSING_SIGNALS = ['ya mismo', 'ahora mismo', 'quiero que me llamen', 'llamenme', 'llamame', 'llámame', 'consígueme', 'consigueme', 'quiero empezar', 'dónde firmo', 'donde firmo', 'cómo activo', 'como activo', 'cuándo me llaman', 'cuando me llaman', 'ok me interesa', 'si quiero', 'sí quiero', 'quiero el plan', 'activa el plan', 'actívalo']
    const msgLC = body.toLowerCase()
    const isClosingSignal = CLOSING_SIGNALS.some(s => msgLC.includes(s))

    let isReadyToBuy = aiResponse.includes('[LISTO_PARA_COMPRAR]')

    // Force closing if lead gave explicit signal but Sophia missed it
    if (isClosingSignal && !isReadyToBuy) {
      console.log(`[SOPHIA] Closing signal FORCED: "${body}"`)
      isReadyToBuy = true
      // Sophia's response should have included it — append if not
      if (!aiResponse.includes('[LISTO_PARA_COMPRAR]')) {
        aiResponse = aiResponse + '\n[LISTO_PARA_COMPRAR]'
      }
    }

    const cleanResponse = aiResponse.replace(/\[LISTO_PARA_COMPRAR\]/g, '').trim()

    // BUG FIX 4: Smart stage detection
    function detectStage(leadMsg: string, currentStage: string, ready: boolean): string {
      if (ready) return 'listo_comprar'
      const m = leadMsg.toLowerCase()
      if (/\d{10}/.test(leadMsg)) return 'listo_comprar'
      if (m.match(/cu[aá]nto|precio|cuesta|costo|how much/)) return currentStage === 'new' || currentStage === 'nuevo' || currentStage === 'contacted' || currentStage === 'calificando' ? 'interested' : currentStage
      if (m.match(/no s[eé]|pensarlo|despu[eé]s|after|caro|expensive/)) return 'objecion'
      if (currentStage === 'new' || currentStage === 'nuevo') return 'calificando'
      return currentStage
    }

    const newStage = detectStage(body, lead.stage, isReadyToBuy)

    if (newStage !== lead.stage) {
      console.log(`[STAGE] ${lead.name}: ${lead.stage} → ${newStage}`)
    }

    await supabase.from('leads').update({
      stage: newStage,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)

    // Save AI response
    await supabase.from('conversations').insert({
      lead_id: lead.id,
      lead_name: lead.name,
      lead_phone: from,
      channel: 'whatsapp',
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

    // ── SYSTEM 4: Voice response (non-blocking) ──
    const messageCount = (history || []).length + 1
    const shouldSendVoice = messageCount >= 3
      && cleanResponse.length > 80
      && !['cerrado_ganado', 'cerrado_perdido', 'closed_won', 'closed_lost'].includes(lead.stage)

    if (shouldSendVoice && lead.agent_id) {
      const { data: assignedAgent } = await supabase
        .from('agents')
        .select('voice_enabled')
        .eq('id', lead.agent_id)
        .single()

      if (assignedAgent?.voice_enabled) {
        // Import dynamically to avoid breaking if module has issues
        import('@/lib/voice-response').then(({ generateAndUploadVoice, sendVoiceWhatsApp }) => {
          generateAndUploadVoice(cleanResponse, from).then(audioUrl => {
            if (audioUrl) sendVoiceWhatsApp(from, audioUrl)
          })
        }).catch(err => console.error('[Voice] Non-blocking error:', err))
      }
    }

    // If ready to buy — generate structured summary and notify ASSIGNED AGENT ONLY
    if (isReadyToBuy) {
      const color = lead.favorite_color || lead.color_favorito || '—'

      // Generate structured analysis with Claude
      const allMessages = [...(history || []), { direction: 'inbound', message: body }, { direction: 'outbound', message: cleanResponse }]
      const convoText = allMessages.slice(-12).map((c: any) =>
        `${c.direction === 'inbound' ? 'Lead' : 'Sophia'}: ${c.message}`
      ).join('\n')

      // Module 4: Product radar
      let productOppsText = ''
      try {
        const { detectProductOpportunities, formatOpportunitiesForAgent } = await import('@/lib/product-radar')
        const opps = detectProductOpportunities(lead, convoText)
        productOppsText = formatOpportunitiesForAgent(opps)
        await supabase.from('leads').update({ product_opportunities: opps }).eq('id', lead.id)
      } catch {}

      // Module 1: Trigger learning + training data extraction
      try {
        const { learnFromClosedDeal } = await import('@/lib/sophia-learning')
        learnFromClosedDeal(supabase, lead.id, process.env.ANTHROPIC_API_KEY!).catch(() => {})
        const { extractTrainingData } = await import('@/lib/training-pipeline')
        extractTrainingData(supabase, lead.id).catch(() => {})
      } catch {}

      // Generate battle card with Claude
      let bc: any = { nombre: lead.name, estado: lead.state, familia: '', telefono: from, color, nivel_interes: 8, argumento_ganador: 'Cobertura dental', objecion_probable: 'Ninguna', contraargumento: '', dias_considerando: 1, como_abrir: `Hola, soy de Luxury Shield. Tu color es ${color}.`, estado_emocional: 'curioso', resumen: 'Lead interesado en plan dental' }

      try {
        const bcRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system: `Analiza esta conversación entre Sophia y un lead. Devuelve SOLO JSON:
{"nombre":"string","estado":"string","familia":"string","telefono":"string","color":"string","nivel_interes":number(1-10),"argumento_ganador":"qué le resonó más","objecion_probable":"la objeción más probable","contraargumento":"mejor respuesta a esa objeción","dias_considerando":number,"como_abrir":"frase exacta para abrir la llamada","estado_emocional":"ansioso|curioso|desconfiado|convencido|indeciso","resumen":"2 líneas máximo"}`,
            messages: [{ role: 'user', content: convoText }],
          }),
        })
        if (bcRes.ok) {
          const d = await bcRes.json()
          const t = d.content?.[0]?.text || ''
          try { bc = { ...bc, ...JSON.parse(t.replace(/```json?\n?|\n?```/g, '').trim()) } } catch {}
        }
      } catch {}

      // Save to lead
      await supabase.from('leads').update({
        ready_to_buy: true,
        stage: 'interested',
        score: 95,
        score_recommendation: '🔥 Lead calificado por Sophia IA — listo para cerrar',
        ia_active: false,
        resumen_sophia: bc.resumen,
        nivel_interes: bc.nivel_interes,
      }).eq('id', lead.id)

      const agentMsg = `🔥 *LEAD CALIENTE* — ${bc.nombre || lead.name || from}
━━━━━━━━━━━━━━━━━━━
📱 Llamar a: ${from}
📍 ${bc.estado || lead.state || '—'} • ${bc.familia || (lead.dependents ? lead.dependents + ' personas' : '—')}
🎨 Color: *${color}* ← mencionar al inicio
⭐ Interés: ${bc.nivel_interes}/10 • ${bc.estado_emocional}
━━━━━━━━━━━━━━━━━━━
🎯 *CÓMO ABRIR LA LLAMADA:*
_"${bc.como_abrir}"_
━━━━━━━━━━━━━━━━━━━
💡 *LO QUE MÁS LE RESONÓ:*
${bc.argumento_ganador}
━━━━━━━━━━━━━━━━━━━
⚠️ *OBJECIÓN PROBABLE:*
${bc.objecion_probable}
💬 *RESPÓNDELE:*
${bc.contraargumento}
━━━━━━━━━━━━━━━━━━━
📝 ${bc.resumen}
${productOppsText}
━━━━━━━━━━━━━━━━━━━
⏰ Lead caliente — llamar en los próximos 20 min`

      // Send ONLY to assigned agent (not to admin separately)
      if (lead.agent_id) {
        const { data: assignedAgent } = await supabase
          .from('agents')
          .select('phone, name, whatsapp_number')
          .eq('id', lead.agent_id)
          .single()

        const agentPhone = assignedAgent?.whatsapp_number || assignedAgent?.phone
        if (agentPhone) {
          await sendWhatsApp(agentPhone, agentMsg)
          console.log(`[Sophia] Lead ${lead.name} READY — notified agent ${assignedAgent?.name}`)
        } else {
          // Fallback to admin if no agent phone
          await sendWhatsApp(ADMIN_PHONE, agentMsg)
          console.log(`[Sophia] Lead ${lead.name} READY — notified admin (no agent phone)`)
        }
      } else {
        // No agent assigned — notify admin
        await sendWhatsApp(ADMIN_PHONE, agentMsg)
        console.log(`[Sophia] Lead ${lead.name} READY — notified admin (no agent assigned)`)
      }
    }

    // Release processing lock + return
    if (lead?.id) await supabase.from('leads').update({ sophia_processing: false }).eq('id', lead.id)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    )

  } catch (error: any) {
    console.error('[Sophia] FATAL webhook error:', error?.message || error, error?.stack)
    // Always release lock on error
    // Release lock best-effort (from may not be in scope)
    try { await supabase.from('leads').update({ sophia_processing: false }).eq('sophia_processing', true) } catch {}
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
