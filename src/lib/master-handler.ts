import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const MASTER_CLEAN = '17869435656'

export function isMaster(phone: string): boolean {
  const clean = phone.replace(/\D/g, '')
  return clean === MASTER_CLEAN || clean.endsWith(MASTER_CLEAN.slice(-10))
}

async function callClaude(system: string, user: string, model = 'claude-haiku-4-5-20251001', maxTokens = 500): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!res.ok) return ''
  const d = await res.json()
  return d.content?.[0]?.text || ''
}

async function sendWhatsApp(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const body = new URLSearchParams({ From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, To: `whatsapp:${cleanTo}`, Body: message })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

export async function handleMasterMessage(from: string, body: string, mediaUrl?: string, mediaType?: string) {
  console.log('[MASTER] Processing:', body?.substring(0, 60) || '[media]')

  // Handle PDF uploads — extract knowledge and auto-route to expert agent
  if (mediaUrl && (mediaType?.includes('pdf') || mediaType?.includes('application'))) {
    console.log('[MASTER] PDF detected, processing...')
    await sendWhatsApp(from, '📄 Recibí tu PDF. Extrayendo conocimiento y asignando al agente experto...')

    try {
      // Download PDF from Twilio (handle redirect)
      const twilioAuth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      const redirectRes = await fetch(mediaUrl, { headers: { 'Authorization': `Basic ${twilioAuth}` }, redirect: 'manual' })
      const finalUrl = redirectRes.status === 307 ? redirectRes.headers.get('location') || mediaUrl : mediaUrl
      const pdfRes = await fetch(finalUrl)
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
      const pdfBase64 = pdfBuffer.toString('base64')

      console.log(`[MASTER] PDF downloaded: ${pdfBuffer.length} bytes`)

      // Extract knowledge with Claude (using document type)
      const extractRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 3000,
          messages: [{ role: 'user', content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: `Analiza este documento de seguros. Devuelve SOLO JSON:
{"category":"dental"|"aca"|"vida"|"iul"|"medicare"|"suplementario"|"otro","carrier":"nombre del carrier/aseguradora","product_name":"nombre del producto","knowledge":"resumen completo de 500 palabras con: coberturas, precios, estados, elegibilidad, periodos de espera, redes, deducibles, beneficios clave, objeciones comunes y respuestas","keywords":["lista","de","keywords","relevantes"]}` }
          ] }],
        }),
      })

      if (!extractRes.ok) throw new Error(`Claude error: ${extractRes.status}`)

      const extractData = await extractRes.json()
      const rawText = extractData.content?.[0]?.text || ''
      let parsed: any
      try { parsed = JSON.parse(rawText.replace(/```json\n?|\n?```/g, '').trim()) } catch { parsed = { category: 'otro', knowledge: rawText, keywords: [] } }

      console.log(`[MASTER] PDF parsed: category=${parsed.category}, carrier=${parsed.carrier}`)

      // Find the best matching expert agent
      const { data: agents } = await supabase.from('sophia_agents').select('*').eq('active', true)
      let bestAgent: any = null
      let bestScore = 0

      for (const agent of agents || []) {
        let score = 0
        const keywords = agent.trigger_keywords || []
        for (const kw of keywords) {
          if (parsed.category?.toLowerCase().includes(kw) || parsed.carrier?.toLowerCase().includes(kw) || parsed.product_name?.toLowerCase().includes(kw)) score += 2
          if (parsed.keywords?.some((pk: string) => pk.toLowerCase().includes(kw))) score += 1
        }
        if (score > bestScore) { bestScore = score; bestAgent = agent }
      }

      // Save knowledge to sophia_knowledge
      await supabase.from('sophia_knowledge').insert({
        title: `${parsed.carrier || 'Documento'} — ${parsed.product_name || parsed.category}`,
        content: parsed.knowledge,
        source_type: 'pdf',
        source_name: mediaUrl.split('/').pop() || 'documento.pdf',
        embedding_summary: parsed.knowledge?.substring(0, 300),
        tags: [parsed.category, parsed.carrier, ...(parsed.keywords || [])].filter(Boolean),
        active: true,
      })

      // Save training source linked to the expert agent
      await supabase.from('sophia_training_sources').insert({
        title: `${parsed.carrier || 'PDF'} — ${parsed.product_name || parsed.category}`,
        source_type: 'pdf',
        content: parsed.knowledge,
        extracted_knowledge: parsed.knowledge,
        agent_id: bestAgent?.id || null,
        processed: true,
        uploaded_by: 'master',
      })

      // If agent found, update its prompt with the new knowledge
      if (bestAgent) {
        const updatedPrompt = bestAgent.system_prompt + `\n\nCONOCIMIENTO DE ${(parsed.carrier || '').toUpperCase()} — ${(parsed.product_name || '').toUpperCase()}:\n${parsed.knowledge}`
        await supabase.from('sophia_agents').update({
          system_prompt: updatedPrompt,
          knowledge_sources: [...(bestAgent.knowledge_sources || []), { carrier: parsed.carrier, product: parsed.product_name, date: new Date().toISOString() }],
        }).eq('id', bestAgent.id)

        await sendWhatsApp(from,
          `✅ PDF procesado y asignado!\n\n` +
          `📚 Carrier: ${parsed.carrier || '—'}\n` +
          `📦 Producto: ${parsed.product_name || '—'}\n` +
          `🤖 Agente experto: *${bestAgent.name}*\n` +
          `🏷️ Categoría: ${parsed.category}\n\n` +
          `${bestAgent.name} ya tiene este conocimiento y lo usará en sus conversaciones.`
        )
      } else {
        // No matching agent — offer to create one
        await sendWhatsApp(from,
          `✅ PDF procesado!\n\n` +
          `📚 Carrier: ${parsed.carrier || '—'}\n` +
          `📦 Producto: ${parsed.product_name || '—'}\n` +
          `🏷️ Categoría: ${parsed.category}\n\n` +
          `⚠️ No encontré un agente experto para esta categoría.\n` +
          `Sophia usará este conocimiento directamente.\n\n` +
          `¿Quieres que cree un agente experto? Escribe:\n` +
          `"crea un agente para ${parsed.category}"`
        )
      }
    } catch (err: any) {
      console.error('[MASTER] PDF error:', err.message)
      await sendWhatsApp(from, `⚠️ Error procesando el PDF: ${err.message}\nIntenta enviarlo de nuevo.`)
    }
    return
  }

  let text = body

  // Detect intent
  const intentText = await callClaude(
    `Detecta la intención del maestro de Sophia. Devuelve SOLO JSON: {"action":"learn"|"remember"|"forget"|"set_skill"|"show_memory"|"show_skills"|"test_sophia"|"chat","topic":string|null,"content":string|null,"skill_name":string|null,"skill_active":boolean|null}
Ejemplos: "aprende esto: deducible $0" → learn. "recuerda mensajes cortos" → remember. "olvida precio anterior" → forget. "activa coaching" → set_skill,active:true. "muéstrame memoria" → show_memory. "qué skills?" → show_skills. "simula lead TX" → test_sophia. Otro → chat`,
    text
  )

  let intent: any = { action: 'chat' }
  try { intent = JSON.parse(intentText.replace(/```json\n?|\n?```/g, '').trim()) } catch {}

  console.log('[MASTER] Intent:', intent.action)

  switch (intent.action) {
    case 'learn': {
      const content = intent.content || text
      await supabase.from('sophia_knowledge').insert({ title: intent.topic || 'general', content, source_type: 'text', source_name: 'Maestro', embedding_summary: content.substring(0, 200), tags: [intent.topic || 'master'], active: true })
      await sendWhatsApp(from, `✅ Aprendido y guardado.\n📚 Tema: ${intent.topic || 'general'}\nSophia usará esto en sus conversaciones.`)
      break
    }
    case 'remember': {
      const content = intent.content || text
      await supabase.from('sophia_memory').insert({ category: 'instruction', key: `instruccion_${Date.now()}`, value: content, source: 'master', importance: 8 })
      await sendWhatsApp(from, `🧠 Guardado en memoria permanente:\n"${content}"`)
      break
    }
    case 'forget': {
      const topic = intent.topic || intent.content || text
      await supabase.from('sophia_memory').update({ active: false }).ilike('value', `%${topic}%`)
      await supabase.from('sophia_knowledge').update({ active: false }).ilike('content', `%${topic}%`)
      await sendWhatsApp(from, `🗑️ Olvidado: "${topic}"`)
      break
    }
    case 'set_skill': {
      const name = intent.skill_name || ''
      const active = intent.skill_active ?? true
      const { data } = await supabase.from('sophia_skills').update({ active }).ilike('name', `%${name}%`).select()
      if (!data?.length) { await sendWhatsApp(from, `⚠️ Skill "${name}" no encontrado. Escribe "qué skills tienes?"`) }
      else { await sendWhatsApp(from, `${active ? '✅' : '⏸️'} Skill "${data[0].name}" ${active ? 'activado' : 'desactivado'}.`) }
      break
    }
    case 'show_memory': {
      const { data } = await supabase.from('sophia_memory').select('value, category, importance').eq('active', true).order('importance', { ascending: false }).limit(10)
      const list = data?.map(m => `• [${m.category}] ${m.value.substring(0, 80)}`).join('\n') || 'Vacía'
      await sendWhatsApp(from, `🧠 Mi memoria:\n\n${list}`)
      break
    }
    case 'show_skills': {
      const { data } = await supabase.from('sophia_skills').select('name, description, active').order('active', { ascending: false })
      const list = data?.map(s => `${s.active ? '✅' : '⏸️'} *${s.name}*: ${s.description}`).join('\n') || 'Sin skills'
      await sendWhatsApp(from, `⚡ Mis skills:\n\n${list}`)
      break
    }
    case 'test_sophia': {
      const scenario = intent.content || 'lead de FL interesado en dental'
      const { data: skills } = await supabase.from('sophia_skills').select('prompt_injection').eq('active', true)
      const skillsText = skills?.map(s => s.prompt_injection).join('\n') || ''
      const response = await callClaude(`Eres Sophia de Luxury Shield Insurance. ${skillsText}`, `[SIMULACIÓN - ${scenario}] Hola, quiero información sobre el seguro dental`)
      await sendWhatsApp(from, `🧪 *Test* (${scenario}):\n\n${response}`)
      break
    }
    default: {
      const { data: memory } = await supabase.from('sophia_memory').select('value').eq('active', true).eq('source', 'master').order('importance', { ascending: false }).limit(5)
      const memCtx = memory?.map(m => m.value).join('\n') || ''
      const response = await callClaude(
        `Eres Sophia hablando con Carlos Silva, tu maestro. Responde directo y útil. En español.\n\nLo que Carlos me enseñó:\n${memCtx}\n\nComandos: "aprende esto:", "recuerda que", "olvida [tema]", "activa/desactiva skill", "muéstrame memoria", "qué skills?", "simula [escenario]"`,
        text
      )
      await sendWhatsApp(from, response)
    }
  }
}
