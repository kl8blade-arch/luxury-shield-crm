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
  const auth = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
  const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`

  // WhatsApp limit is 1600 chars — split long messages
  const chunks: string[] = []
  if (message.length <= 1500) {
    chunks.push(message)
  } else {
    const parts = message.split('\n\n')
    let current = ''
    for (const part of parts) {
      if ((current + '\n\n' + part).length > 1500 && current) {
        chunks.push(current.trim())
        current = part
      } else {
        current = current ? current + '\n\n' + part : part
      }
    }
    if (current.trim()) chunks.push(current.trim())
  }

  for (const chunk of chunks) {
    const body = new URLSearchParams({ From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, To: `whatsapp:${cleanTo}`, Body: chunk })
    await fetch(url, { method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 500))
  }
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

  // Handle URL — Sophia crawls, learns, and auto-routes to expert
  const urlMatch = (body || '').match(/https?:\/\/[^\s]+/i)
  if (urlMatch && !mediaUrl) {
    const url = urlMatch[0]
    console.log('[MASTER] URL detected:', url)
    await sendWhatsApp(from, `🌐 Analizando: ${url}\nExtrayendo conocimiento, documentos y reglas...`)

    try {
      // Step 1: Fetch the page content
      const pageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SophiaBot/1.0)' }, redirect: 'follow' })
      if (!pageRes.ok) throw new Error(`Page fetch failed: ${pageRes.status}`)
      const html = await pageRes.text()

      // Step 2: Extract text content (strip HTML tags)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 15000) // Limit for Claude context

      // Step 3: Find PDF links on the page
      const pdfLinks: string[] = []
      const pdfMatches = html.match(/href=["']([^"']*\.pdf[^"']*)/gi) || []
      for (const match of pdfMatches.slice(0, 5)) {
        let pdfUrl = match.replace(/href=["']/i, '')
        if (pdfUrl.startsWith('/')) {
          const base = new URL(url)
          pdfUrl = `${base.origin}${pdfUrl}`
        } else if (!pdfUrl.startsWith('http')) {
          pdfUrl = new URL(pdfUrl, url).href
        }
        pdfLinks.push(pdfUrl)
      }

      console.log(`[MASTER] Page text: ${textContent.length} chars, PDFs found: ${pdfLinks.length}`)

      // Step 4: Claude analyzes the page content
      const analysisRes = await callClaude(
        `Eres un analista experto en seguros. Analiza esta página web y extrae TODO el conocimiento relevante. Devuelve SOLO JSON:
{"category":"dental"|"aca"|"vida"|"iul"|"medicare"|"suplementario"|"otro","carrier":"nombre del carrier","product_name":"nombre del producto si aplica","knowledge":"resumen COMPLETO de 800 palabras: coberturas, precios, estados, elegibilidad, periodos de espera, redes de proveedores, deducibles, copagos, máximos, exclusiones, reglas, lo que se puede y no se puede hacer, beneficios clave, comparación con competencia","rules":"lista de reglas y restricciones importantes separadas por |","exclusions":"lista de exclusiones separadas por |","keywords":["lista","de","keywords"],"skill_suggestion":"si este conocimiento justifica crear o mejorar un skill, describe qué skill en 1 línea, sino null","pdfs_found":${pdfLinks.length}}`,
        `URL: ${url}\n\nContenido de la página:\n${textContent}`
      )

      let parsed: any
      try { parsed = JSON.parse(analysisRes.replace(/```json\n?|\n?```/g, '').trim()) } catch { parsed = { category: 'otro', knowledge: analysisRes, keywords: [] } }

      // Step 5: Find matching expert agent
      const { data: agents } = await supabase.from('sophia_agents').select('*').eq('active', true)
      let bestAgent: any = null
      let bestScore = 0
      for (const agent of agents || []) {
        let score = 0
        for (const kw of (agent.trigger_keywords || [])) {
          if (parsed.category?.toLowerCase().includes(kw)) score += 2
          if (parsed.carrier?.toLowerCase().includes(kw)) score += 2
          if (parsed.keywords?.some((pk: string) => pk.toLowerCase().includes(kw))) score += 1
        }
        if (score > bestScore) { bestScore = score; bestAgent = agent }
      }

      // Step 6: Save knowledge
      await supabase.from('sophia_knowledge').insert({
        title: `${parsed.carrier || 'Web'} — ${parsed.product_name || parsed.category} (URL)`,
        content: parsed.knowledge + (parsed.rules ? `\n\nREGLAS:\n${parsed.rules.replace(/\|/g, '\n• ')}` : '') + (parsed.exclusions ? `\n\nEXCLUSIONES:\n${parsed.exclusions.replace(/\|/g, '\n• ')}` : ''),
        source_type: 'url',
        source_name: url,
        embedding_summary: parsed.knowledge?.substring(0, 300),
        tags: [parsed.category, parsed.carrier, 'url', ...(parsed.keywords || [])].filter(Boolean),
        active: true,
      })

      // Step 7: Save training source linked to agent
      await supabase.from('sophia_training_sources').insert({
        title: `URL: ${parsed.carrier || 'Web'} — ${parsed.product_name || url.substring(0, 50)}`,
        source_type: 'url', url,
        content: parsed.knowledge,
        extracted_knowledge: parsed.knowledge,
        agent_id: bestAgent?.id || null,
        processed: true,
      })

      // Step 8: Update expert agent if found
      if (bestAgent) {
        const newKnowledge = `\n\nDE ${url}:\n${parsed.knowledge}${parsed.rules ? '\nREGLAS: ' + parsed.rules : ''}${parsed.exclusions ? '\nEXCLUSIONES: ' + parsed.exclusions : ''}`
        await supabase.from('sophia_agents').update({
          system_prompt: bestAgent.system_prompt + newKnowledge,
          knowledge_sources: [...(bestAgent.knowledge_sources || []), { type: 'url', url, carrier: parsed.carrier, date: new Date().toISOString() }],
        }).eq('id', bestAgent.id)
      }

      // Step 9: Save rules to memory for permanent access
      if (parsed.rules) {
        await supabase.from('sophia_memory').insert({
          category: 'rules', key: `rules_${parsed.carrier || 'web'}_${Date.now()}`,
          value: `REGLAS de ${parsed.carrier || 'este producto'}: ${parsed.rules}`,
          source: 'url', importance: 9,
        })
      }
      if (parsed.exclusions) {
        await supabase.from('sophia_memory').insert({
          category: 'rules', key: `exclusions_${parsed.carrier || 'web'}_${Date.now()}`,
          value: `EXCLUSIONES de ${parsed.carrier || 'este producto'}: ${parsed.exclusions}`,
          source: 'url', importance: 9,
        })
      }

      // Step 10: Auto-create or suggest skill if needed
      if (parsed.skill_suggestion) {
        await supabase.from('sophia_memory').insert({
          category: 'instruction', key: `skill_suggestion_${Date.now()}`,
          value: `Sugerencia de skill: ${parsed.skill_suggestion} (de ${url})`,
          source: 'url', importance: 7,
        })
      }

      // Step 11: Try to download PDFs found on the page
      let pdfProcessed = 0
      for (const pdfUrl of pdfLinks.slice(0, 3)) {
        try {
          const pdfRes = await fetch(pdfUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
          if (!pdfRes.ok) continue
          const contentType = pdfRes.headers.get('content-type') || ''
          if (!contentType.includes('pdf') && !pdfUrl.endsWith('.pdf')) continue

          const pdfBuf = Buffer.from(await pdfRes.arrayBuffer())
          if (pdfBuf.length < 1000 || pdfBuf.length > 10000000) continue

          const pdfB64 = pdfBuf.toString('base64')
          const pdfExtract = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001', max_tokens: 2000,
              messages: [{ role: 'user', content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfB64 } },
                { type: 'text', text: 'Extrae todo el conocimiento de este documento de seguros en máximo 500 palabras. Incluye coberturas, precios, reglas, exclusiones, estados, elegibilidad.' }
              ] }],
            }),
          })

          if (pdfExtract.ok) {
            const pdfData = await pdfExtract.json()
            const pdfKnowledge = pdfData.content?.[0]?.text || ''
            if (pdfKnowledge.length > 50) {
              await supabase.from('sophia_training_sources').insert({
                title: `PDF de ${url}: ${pdfUrl.split('/').pop()}`,
                source_type: 'pdf', url: pdfUrl,
                content: pdfKnowledge, extracted_knowledge: pdfKnowledge,
                agent_id: bestAgent?.id || null, processed: true,
              })
              if (bestAgent) {
                await supabase.from('sophia_agents').update({
                  system_prompt: bestAgent.system_prompt + `\n\nPDF (${pdfUrl.split('/').pop()}):\n${pdfKnowledge}`,
                }).eq('id', bestAgent.id)
              }
              pdfProcessed++
            }
          }
        } catch (e) { console.log(`[MASTER] PDF download failed: ${pdfUrl}`) }
      }

      // Final confirmation
      const agentInfo = bestAgent ? `🤖 Agente: *${bestAgent.name}*` : '⚠️ Sin agente asignado (Sophia usará el conocimiento directamente)'
      await sendWhatsApp(from,
        `✅ URL procesada completamente!\n\n` +
        `📚 Carrier: ${parsed.carrier || '—'}\n` +
        `📦 Producto: ${parsed.product_name || '—'}\n` +
        `🏷️ Categoría: ${parsed.category}\n` +
        `${agentInfo}\n\n` +
        `📝 Conocimiento: ${parsed.knowledge?.substring(0, 100)}...\n` +
        `${parsed.rules ? `📋 Reglas: ${parsed.rules.split('|').length} reglas guardadas\n` : ''}` +
        `${parsed.exclusions ? `🚫 Exclusiones: ${parsed.exclusions.split('|').length} exclusiones guardadas\n` : ''}` +
        `${pdfProcessed > 0 ? `📄 PDFs descargados: ${pdfProcessed} documentos procesados\n` : ''}` +
        `${pdfLinks.length > 0 && pdfProcessed === 0 ? `📄 PDFs encontrados: ${pdfLinks.length} (no descargables)\n` : ''}` +
        `${parsed.skill_suggestion ? `\n💡 Sugerencia: ${parsed.skill_suggestion}` : ''}`
      )
    } catch (err: any) {
      console.error('[MASTER] URL error:', err.message)
      await sendWhatsApp(from, `⚠️ Error procesando la URL: ${err.message}`)
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
      // Load ALL knowledge: memory + PDFs + URLs + training sources
      const [{ data: memory }, { data: knowledge }, { data: agentKnowledge }] = await Promise.all([
        supabase.from('sophia_memory').select('value, category').eq('active', true).order('importance', { ascending: false }).limit(10),
        supabase.from('sophia_knowledge').select('title, content').eq('active', true).order('created_at', { ascending: false }).limit(5),
        supabase.from('sophia_agents').select('name, system_prompt').eq('active', true),
      ])

      const memoryText = memory?.map(m => `[${m.category}] ${m.value}`).join('\n') || 'Sin memoria'
      const knowledgeText = knowledge?.map(k => `[${k.title}]:\n${k.content}`).join('\n\n') || 'Sin documentos'
      const agentsText = agentKnowledge?.map(a => `[${a.name}]: ${a.system_prompt?.substring(0, 500)}`).join('\n\n') || ''

      const response = await callClaude(
        `Eres Sophia, la mano derecha de Carlos Silva en Luxury Shield Insurance.
Habla con él como colega de confianza — directo, sin rodeos, sin formalismos.
NO te auto-diagnostiques ni hables de tus limitaciones.
NO uses asteriscos (**bold**) ni headers (#). Solo texto plano natural.
NO listes lo que puedes o no puedes hacer — simplemente HAZLO.
Responde en máximo 4-5 oraciones a menos que Carlos pida más detalle.

Cuando Carlos pregunte sobre un producto, dale la respuesta con los datos que tienes.
Cuando Carlos pida una opinión, dala con seguridad.
Cuando Carlos dé una instrucción, confírmala en una línea.

CONOCIMIENTO QUE TIENES:
${knowledgeText}

AGENTES QUE MANEJAS:
${agentsText}

INSTRUCCIONES PREVIAS DE CARLOS:
${memoryText}`,
        text,
        'claude-haiku-4-5-20251001',
        600
      )
      await sendWhatsApp(from, response)
    }
  }
}
