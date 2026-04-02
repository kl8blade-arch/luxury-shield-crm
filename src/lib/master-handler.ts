import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const MASTER_CLEAN = '17869435656'

export function isMaster(phone: string): boolean {
  const clean = phone.replace(/\D/g, '')
  return clean === MASTER_CLEAN || clean.endsWith(MASTER_CLEAN.slice(-10))
}

async function callClaude(system: string, user: string, model = 'claude-haiku-4-5-20251001', maxTokens = 500): Promise<string> {
  const { callAI } = await import('@/lib/token-tracker')
  const result = await callAI({
    feature: 'master_command', model, maxTokens, system,
    messages: [{ role: 'user', content: user }],
  })
  return result.text || ''
}

async function sendWhatsApp(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const auth = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
  const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`

  const chunks: string[] = []
  if (message.length <= 1500) { chunks.push(message) }
  else {
    const parts = message.split('\n\n')
    let current = ''
    for (const part of parts) {
      if ((current + '\n\n' + part).length > 1500 && current) { chunks.push(current.trim()); current = part }
      else { current = current ? current + '\n\n' + part : part }
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

  // ══════════════════════════════════════════════
  // HANDLE PDF UPLOADS
  // ══════════════════════════════════════════════
  if (mediaUrl && (mediaType?.includes('pdf') || mediaType?.includes('application'))) {
    console.log('[MASTER] PDF detected, processing...')
    await sendWhatsApp(from, '📄 Recibi tu PDF. Extrayendo conocimiento y asignando al agente experto...')

    try {
      const twilioAuth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      const redirectRes = await fetch(mediaUrl, { headers: { 'Authorization': `Basic ${twilioAuth}` }, redirect: 'manual' })
      const finalUrl = redirectRes.status === 307 ? redirectRes.headers.get('location') || mediaUrl : mediaUrl
      const pdfRes = await fetch(finalUrl)
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
      const pdfBase64 = pdfBuffer.toString('base64')

      // PDF extraction uses direct API call (multimodal content not supported by callAI wrapper)
      const extractRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 3000,
          messages: [{ role: 'user', content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: `Analiza este documento. Devuelve SOLO JSON: {"category":"dental"|"aca"|"vida"|"iul"|"medicare"|"otro","carrier":"nombre","product_name":"producto","knowledge":"resumen 500 palabras","keywords":["lista"]}` }
          ] }],
        }),
      })

      if (!extractRes.ok) throw new Error(`Claude error: ${extractRes.status}`)
      const extractData = await extractRes.json()
      const rawText = extractData.content?.[0]?.text || ''
      let parsed: any
      try { parsed = JSON.parse(rawText.replace(/```json\n?|\n?```/g, '').trim()) } catch { parsed = { category: 'otro', knowledge: rawText, keywords: [] } }

      const { data: agents } = await supabase.from('sophia_agents').select('*').eq('active', true)
      let bestAgent: any = null, bestScore = 0
      for (const agent of agents || []) {
        let score = 0
        for (const kw of (agent.trigger_keywords || [])) {
          if (parsed.category?.toLowerCase().includes(kw) || parsed.carrier?.toLowerCase().includes(kw)) score += 2
          if (parsed.keywords?.some((pk: string) => pk.toLowerCase().includes(kw))) score += 1
        }
        if (score > bestScore) { bestScore = score; bestAgent = agent }
      }

      await supabase.from('sophia_knowledge').insert({
        title: `${parsed.carrier || 'Documento'} — ${parsed.product_name || parsed.category}`,
        content: parsed.knowledge, source_type: 'pdf', source_name: mediaUrl.split('/').pop() || 'documento.pdf',
        embedding_summary: parsed.knowledge?.substring(0, 300),
        tags: [parsed.category, parsed.carrier, ...(parsed.keywords || [])].filter(Boolean), active: true,
      })

      await supabase.from('sophia_training_sources').insert({
        title: `${parsed.carrier || 'PDF'} — ${parsed.product_name || parsed.category}`,
        source_type: 'pdf', content: parsed.knowledge, extracted_knowledge: parsed.knowledge,
        agent_id: bestAgent?.id || null, processed: true, uploaded_by: 'master',
      })

      if (bestAgent) {
        await supabase.from('sophia_agents').update({
          system_prompt: bestAgent.system_prompt + `\n\n${(parsed.carrier || '').toUpperCase()}:\n${parsed.knowledge}`,
          knowledge_sources: [...(bestAgent.knowledge_sources || []), { carrier: parsed.carrier, product: parsed.product_name, date: new Date().toISOString() }],
        }).eq('id', bestAgent.id)
        await sendWhatsApp(from, `✅ PDF procesado!\n📚 ${parsed.carrier || '—'} — ${parsed.product_name || '—'}\n🤖 Asignado a: *${bestAgent.name}*`)
      } else {
        await sendWhatsApp(from, `✅ PDF procesado!\n📚 ${parsed.carrier || '—'} — ${parsed.product_name || '—'}\nSophia usara este conocimiento directamente.`)
      }
    } catch (err: any) {
      console.error('[MASTER] PDF error:', err.message)
      await sendWhatsApp(from, `⚠️ Error procesando PDF: ${err.message}`)
    }
    return
  }

  // ══════════════════════════════════════════════
  // HANDLE URLs
  // ══════════════════════════════════════════════
  const urlMatch = (body || '').match(/https?:\/\/[^\s]+/i)
  if (urlMatch && !mediaUrl) {
    const url = urlMatch[0]
    await sendWhatsApp(from, `🌐 Analizando: ${url}...`)
    try {
      const pageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SophiaBot/1.0)' }, redirect: 'follow' })
      if (!pageRes.ok) throw new Error(`Page fetch failed: ${pageRes.status}`)
      const html = await pageRes.text()
      const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 15000)

      const analysisRes = await callClaude(
        `Analiza esta pagina de seguros. Devuelve SOLO JSON: {"category":"dental"|"aca"|"vida"|"iul"|"medicare"|"otro","carrier":"nombre","product_name":"producto","knowledge":"resumen 500 palabras","keywords":["lista"]}`,
        `URL: ${url}\n\n${textContent}`
      )
      let parsed: any
      try { parsed = JSON.parse(analysisRes.replace(/```json\n?|\n?```/g, '').trim()) } catch { parsed = { category: 'otro', knowledge: analysisRes } }

      await supabase.from('sophia_knowledge').insert({
        title: `${parsed.carrier || 'Web'} — ${parsed.product_name || parsed.category}`,
        content: parsed.knowledge, source_type: 'url', source_name: url,
        embedding_summary: parsed.knowledge?.substring(0, 300),
        tags: [parsed.category, parsed.carrier, 'url', ...(parsed.keywords || [])].filter(Boolean), active: true,
      })

      await sendWhatsApp(from, `✅ URL procesada!\n📚 ${parsed.carrier || '—'} — ${parsed.product_name || '—'}\n🏷️ ${parsed.category}`)
    } catch (err: any) {
      await sendWhatsApp(from, `⚠️ Error: ${err.message}`)
    }
    return
  }

  // Helper: send + save to conversation history
  async function sendAndLog(msg: string) {
    await sendWhatsApp(from, msg)
    await supabase.from('conversations').insert({ lead_phone: from, message: msg, direction: 'outbound', created_at: new Date().toISOString() })
  }

  let text = body
  // Save incoming message to history
  await supabase.from('conversations').insert({ lead_phone: from, message: text, direction: 'inbound', created_at: new Date().toISOString() })

  // ══════════════════════════════════════════════
  // LOAD CONVERSATION HISTORY — for context
  // ══════════════════════════════════════════════
  const { data: recentHistory } = await supabase
    .from('conversations')
    .select('message, direction, created_at')
    .or(`lead_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(12)

  // Also check master-specific messages (stored as lead_id = null or via phone)
  const { data: masterHistory } = await supabase
    .from('conversations')
    .select('message, direction, created_at')
    .ilike('lead_phone', `%${from.replace(/\D/g, '').slice(-10)}%`)
    .order('created_at', { ascending: false })
    .limit(12)

  const history = (masterHistory || recentHistory || []).reverse()
  const historyText = history.map(h =>
    `${h.direction === 'inbound' ? 'Carlos' : 'Sophia'}: ${h.message}`
  ).join('\n')

  // ══════════════════════════════════════════════
  // DETECT INTENT — Now includes CRM actions + history context
  // ══════════════════════════════════════════════
  const intentText = await callClaude(
    `Detecta la intencion del maestro. CONTEXTO de la conversacion reciente:
${historyText || '(sin historial)'}

Devuelve SOLO JSON:
{"action":"schedule"|"reminder"|"find_lead"|"pipeline_status"|"daily_summary"|"commissions"|"send_campaign"|"learn"|"remember"|"forget"|"set_skill"|"show_memory"|"show_skills"|"test_sophia"|"chat",
"topic":string|null,"content":string|null,"skill_name":string|null,"skill_active":boolean|null,
"lead_name":string|null,"lead_phone":string|null,"date":string|null,"time":string|null,"event_title":string|null,"reminder_type":string|null}

Acciones CRM:
- "agendame cita con Maria manana a las 3pm" → schedule, lead_name:"Maria", date:"manana", time:"3pm", event_title:"Cita con Maria"
- "ponme un recordatorio de llamar a Juan el viernes" → reminder, lead_name:"Juan", date:"viernes", reminder_type:"call"
- "recordatorio seguimiento Pedro en 2 horas" → reminder, lead_name:"Pedro", time:"2 horas", reminder_type:"followup"
- "busca el lead de Miami que pregunto por dental" → find_lead, content:"Miami dental"
- "como va el pipeline?" → pipeline_status
- "manda campana de rescate a leads frios" → send_campaign, content:"rescue cold"

- "dame un resumen del dia" → daily_summary
- "como esta la salud del negocio" → daily_summary
- "cuanto llevo en comisiones" → commissions
- "total de comisiones" → commissions

Acciones Sophia:
- "aprende esto: X" → learn
- "recuerda que X" → remember
- "olvida X" → forget
- "activa/desactiva skill X" → set_skill
- "muestrame memoria/skills" → show_memory/show_skills
- "simula X" → test_sophia
- Todo lo demas → chat`,
    text
  )

  let intent: any = { action: 'chat' }
  try { intent = JSON.parse(intentText.replace(/```json\n?|\n?```/g, '').trim()) } catch {}

  console.log('[MASTER] Intent:', intent.action, JSON.stringify(intent).substring(0, 100))

  switch (intent.action) {

    // ══════════════════════════════════════════════
    // CRM: SCHEDULE — Create calendar event
    // ══════════════════════════════════════════════
    case 'schedule': {
      const title = intent.event_title || `Cita con ${intent.lead_name || 'lead'}`
      const now = new Date()

      // Parse relative dates
      let eventDate = new Date()
      const dateStr = (intent.date || '').toLowerCase()
      const timeStr = (intent.time || '').toLowerCase()

      if (dateStr.includes('manana') || dateStr.includes('mañana')) eventDate.setDate(now.getDate() + 1)
      else if (dateStr.includes('lunes')) { eventDate.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7)) }
      else if (dateStr.includes('martes')) { eventDate.setDate(now.getDate() + ((2 - now.getDay() + 7) % 7 || 7)) }
      else if (dateStr.includes('miercoles') || dateStr.includes('miércoles')) { eventDate.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7)) }
      else if (dateStr.includes('jueves')) { eventDate.setDate(now.getDate() + ((4 - now.getDay() + 7) % 7 || 7)) }
      else if (dateStr.includes('viernes')) { eventDate.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7)) }
      else if (dateStr.includes('sabado') || dateStr.includes('sábado')) { eventDate.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7)) }
      else if (dateStr.includes('domingo')) { eventDate.setDate(now.getDate() + ((7 - now.getDay() + 7) % 7 || 7)) }

      // Parse time
      const timeMatch = timeStr.match(/(\d{1,2})\s*(am|pm|a\.m|p\.m)?/i) || (intent.time || '').match(/(\d{1,2})\s*(am|pm)?/i)
      if (timeMatch) {
        let hours = parseInt(timeMatch[1])
        const period = (timeMatch[2] || '').toLowerCase()
        if (period.includes('p') && hours < 12) hours += 12
        if (period.includes('a') && hours === 12) hours = 0
        if (!period && hours < 8) hours += 12 // Assume PM for business hours
        eventDate.setHours(hours, 0, 0, 0)
      } else {
        eventDate.setHours(10, 0, 0, 0) // Default 10am
      }

      // Find lead if name provided
      let leadId = null, leadPhone = null
      if (intent.lead_name) {
        const { data: leads } = await supabase.from('leads').select('id, name, phone').ilike('name', `%${intent.lead_name}%`).limit(1)
        if (leads?.[0]) { leadId = leads[0].id; leadPhone = leads[0].phone }
      }

      // Create calendar event — scoped to master agent
      const { data: masterAgent } = await supabase.from('agents').select('id, account_id').eq('phone', MASTER_CLEAN).single()
      const endDate = new Date(eventDate.getTime() + 30 * 60 * 1000) // 30 min default
      await supabase.from('calendar_events').insert({
        title, start_time: eventDate.toISOString(), end_time: endDate.toISOString(),
        event_type: 'lead_call', status: 'scheduled',
        lead_name: intent.lead_name || null, lead_phone: leadPhone,
        agent_id: masterAgent?.id || null,
        account_id: masterAgent?.account_id || null,
      })

      // Also create a reminder
      await supabase.from('reminders').insert({
        lead_id: leadId, type: 'meeting', status: 'pending',
        scheduled_for: eventDate.toISOString(),
        notes: title,
      })

      const dateFormatted = eventDate.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })
      const timeFormatted = eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

      await sendAndLog(
        `📅 Listo! Cita agendada:\n\n` +
        `📌 ${title}\n` +
        `🗓️ ${dateFormatted}\n` +
        `⏰ ${timeFormatted}\n` +
        `${leadPhone ? `📱 ${leadPhone}\n` : ''}` +
        `\nTe recordare antes de la cita.`
      )
      break
    }

    // ══════════════════════════════════════════════
    // CRM: REMINDER — Create follow-up reminder
    // ══════════════════════════════════════════════
    case 'reminder': {
      const now = new Date()
      let reminderDate = new Date()

      const dateStr = (intent.date || '').toLowerCase()
      const timeStr = (intent.time || '').toLowerCase()

      // Parse relative time
      const hoursMatch = timeStr.match(/(\d+)\s*hora/i)
      const minsMatch = timeStr.match(/(\d+)\s*min/i)
      const daysMatch = dateStr.match(/(\d+)\s*dia/i)

      if (hoursMatch) reminderDate = new Date(now.getTime() + parseInt(hoursMatch[1]) * 60 * 60 * 1000)
      else if (minsMatch) reminderDate = new Date(now.getTime() + parseInt(minsMatch[1]) * 60 * 1000)
      else if (daysMatch) { reminderDate.setDate(now.getDate() + parseInt(daysMatch[1])); reminderDate.setHours(9, 0, 0, 0) }
      else if (dateStr.includes('manana') || dateStr.includes('mañana')) { reminderDate.setDate(now.getDate() + 1); reminderDate.setHours(9, 0, 0, 0) }
      else if (dateStr.includes('lunes')) { reminderDate.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7)); reminderDate.setHours(9, 0, 0, 0) }
      else if (dateStr.includes('viernes')) { reminderDate.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7)); reminderDate.setHours(9, 0, 0, 0) }
      else { reminderDate = new Date(now.getTime() + 60 * 60 * 1000) } // Default: 1 hour

      let leadId = null
      if (intent.lead_name) {
        const { data: leads } = await supabase.from('leads').select('id').ilike('name', `%${intent.lead_name}%`).limit(1)
        if (leads?.[0]) leadId = leads[0].id
      }

      const typeMap: Record<string, string> = { call: 'call', llamar: 'call', followup: 'followup', seguimiento: 'followup', whatsapp: 'whatsapp', mensaje: 'whatsapp' }
      const reminderType = typeMap[intent.reminder_type || ''] || 'followup'

      await supabase.from('reminders').insert({
        lead_id: leadId, type: reminderType, status: 'pending',
        scheduled_for: reminderDate.toISOString(),
        notes: intent.content || `${intent.reminder_type || 'Seguimiento'} ${intent.lead_name || ''}`.trim(),
      })

      const dateFormatted = reminderDate.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })
      const timeFormatted = reminderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

      await sendAndLog(
        `⏰ Recordatorio creado!\n\n` +
        `📌 ${intent.content || intent.reminder_type || 'Seguimiento'} ${intent.lead_name || ''}\n` +
        `🗓️ ${dateFormatted} a las ${timeFormatted}\n` +
        `📋 Tipo: ${reminderType}`
      )
      break
    }

    // ══════════════════════════════════════════════
    // CRM: FIND LEAD — Search leads
    // ══════════════════════════════════════════════
    case 'find_lead': {
      const searchTerm = intent.content || intent.lead_name || text
      const { data: leads } = await supabase.from('leads')
        .select('name, phone, state, stage, score, insurance_type, purchased_products, updated_at')
        .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%,insurance_type.ilike.%${searchTerm}%`)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (!leads?.length) {
        await sendAndLog(`🔍 No encontre leads con "${searchTerm}". Intenta con otro nombre, telefono o estado.`)
      } else {
        const list = leads.map((l, i) =>
          `${i + 1}. *${l.name}* — ${l.phone}\n   ${l.state || '?'} | ${l.insurance_type || '?'} | Score: ${l.score || 0} | ${l.stage}${l.purchased_products?.length ? '\n   Ya tiene: ' + l.purchased_products.join(', ') : ''}`
        ).join('\n\n')
        await sendAndLog(`🔍 Encontre ${leads.length} lead${leads.length > 1 ? 's' : ''}:\n\n${list}`)
      }
      break
    }

    // ══════════════════════════════════════════════
    // CRM: PIPELINE STATUS — Quick overview
    // ══════════════════════════════════════════════
    case 'pipeline_status': {
      const stages = ['new', 'contacted', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
      const stageLabels: Record<string, string> = { new: 'Nuevos', contacted: 'Contactados', qualification: 'Calificacion', proposal: 'Propuesta', negotiation: 'Negociacion', closed_won: 'Cerrados ✅', closed_lost: 'Perdidos ❌' }

      let report = '📊 *Estado del Pipeline:*\n\n'
      let totalActive = 0

      for (const stage of stages) {
        const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('stage', stage)
        const c = count || 0
        if (stage !== 'closed_won' && stage !== 'closed_lost') totalActive += c
        report += `${stageLabels[stage]}: *${c}*\n`
      }

      // Hot leads
      const { count: hot } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gte('score', 75).not('stage', 'in', '("closed_won","closed_lost")')
      // Today's leads
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const { count: today } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString())
      // Pending reminders
      const { count: reminders } = await supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('status', 'pending')

      report += `\n🔥 Leads calientes (75+): *${hot || 0}*`
      report += `\n📥 Leads hoy: *${today || 0}*`
      report += `\n⏰ Recordatorios pendientes: *${reminders || 0}*`
      report += `\n\n💼 Total activos: *${totalActive}*`

      await sendAndLog(report)
      break
    }

    // ══════════════════════════════════════════════
    // SOPHIA: LEARN
    // ══════════════════════════════════════════════
    // ══════════════════════════════════════════════
    // CRM: DAILY SUMMARY
    // ══════════════════════════════════════════════
    case 'daily_summary': {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const [
        { count: newToday },
        { count: totalActive },
        { count: closedToday },
        { count: hotLeads },
        { count: pendingReminders },
        { data: recentLeads },
      ] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }).not('stage', 'in', '("closed_won","closed_lost","unqualified")'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('stage', 'closed_won').gte('updated_at', todayStart.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('score', 75).not('stage', 'in', '("closed_won","closed_lost")'),
        supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('leads').select('name, stage, score').gte('created_at', todayStart.toISOString()).order('created_at', { ascending: false }).limit(5),
      ])

      let report = `📊 *Resumen del dia*\n\n`
      report += `📥 Leads nuevos hoy: *${newToday || 0}*\n`
      report += `✅ Cerrados hoy: *${closedToday || 0}*\n`
      report += `🔥 Leads calientes (75+): *${hotLeads || 0}*\n`
      report += `💼 Total activos: *${totalActive || 0}*\n`
      report += `⏰ Recordatorios pendientes: *${pendingReminders || 0}*\n`

      if (recentLeads?.length) {
        report += `\n📋 *Ultimos leads:*\n`
        recentLeads.forEach((l: any) => { report += `• ${l.name} — ${l.stage} (score: ${l.score || 0})\n` })
      }

      await sendAndLog(report)
      break
    }

    // ══════════════════════════════════════════════
    // CRM: COMMISSIONS
    // ══════════════════════════════════════════════
    case 'commissions': {
      const { data: comms } = await supabase.from('commissions').select('carrier, product, commission_amount, premium').order('created_at', { ascending: false }).limit(20)
      const total = (comms || []).reduce((s: number, c: any) => s + (c.commission_amount || 0), 0)
      const totalPremium = (comms || []).reduce((s: number, c: any) => s + (c.premium || 0), 0)

      let report = `💰 *Comisiones*\n\n`
      report += `📊 Total: *$${total.toFixed(2)}*\n`
      report += `💎 Prima total: *$${totalPremium.toFixed(2)}*\n`
      report += `📋 Registros: *${comms?.length || 0}*\n`

      if (comms?.length) {
        report += `\n📋 *Ultimas:*\n`
        comms.slice(0, 5).forEach((c: any) => {
          report += `• ${c.carrier} — ${c.product}: *$${(c.commission_amount || 0).toFixed(2)}*\n`
        })
      }

      await sendAndLog(report)
      break
    }

    // ══════════════════════════════════════════════
    // SOPHIA: LEARN
    // ══════════════════════════════════════════════
    case 'learn': {
      const content = intent.content || text
      await supabase.from('sophia_knowledge').insert({ title: intent.topic || 'general', content, source_type: 'text', source_name: 'Maestro', embedding_summary: content.substring(0, 200), tags: [intent.topic || 'master'], active: true })
      await sendAndLog(`✅ Aprendido.\n📚 Tema: ${intent.topic || 'general'}`)
      break
    }
    case 'remember': {
      const content = intent.content || text
      await supabase.from('sophia_memory').insert({ category: 'instruction', key: `instruccion_${Date.now()}`, value: content, source: 'master', importance: 8 })
      await sendAndLog(`🧠 Guardado en memoria:\n"${content}"`)
      break
    }
    case 'forget': {
      const topic = intent.topic || intent.content || text
      await supabase.from('sophia_memory').update({ active: false }).ilike('value', `%${topic}%`)
      await supabase.from('sophia_knowledge').update({ active: false }).ilike('content', `%${topic}%`)
      await sendAndLog(`🗑️ Olvidado: "${topic}"`)
      break
    }
    case 'set_skill': {
      const name = intent.skill_name || ''
      const active = intent.skill_active ?? true
      const { data } = await supabase.from('sophia_skills').update({ active }).ilike('name', `%${name}%`).select()
      if (!data?.length) await sendAndLog(`⚠️ Skill "${name}" no encontrado.`)
      else await sendAndLog(`${active ? '✅' : '⏸️'} Skill "${data[0].name}" ${active ? 'activado' : 'desactivado'}.`)
      break
    }
    case 'show_memory': {
      const { data } = await supabase.from('sophia_memory').select('value, category, importance').eq('active', true).order('importance', { ascending: false }).limit(10)
      const list = data?.map(m => `• [${m.category}] ${m.value.substring(0, 80)}`).join('\n') || 'Vacia'
      await sendAndLog(`🧠 Mi memoria:\n\n${list}`)
      break
    }
    case 'show_skills': {
      const { data } = await supabase.from('sophia_skills').select('name, description, active').order('active', { ascending: false })
      const list = data?.map(s => `${s.active ? '✅' : '⏸️'} *${s.name}*: ${s.description}`).join('\n') || 'Sin skills'
      await sendAndLog(`⚡ Mis skills:\n\n${list}`)
      break
    }
    case 'test_sophia': {
      const scenario = intent.content || 'lead de FL interesado en dental'
      const { data: skills } = await supabase.from('sophia_skills').select('prompt_injection').eq('active', true)
      const response = await callClaude(`Eres Sophia de Luxury Shield Insurance. ${skills?.map(s => s.prompt_injection).join('\n')}`, `[SIMULACION - ${scenario}] Hola, quiero informacion sobre seguro`, 'claude-haiku-4-5-20251001', 400)
      await sendAndLog(`🧪 Test (${scenario}):\n\n${response}`)
      break
    }

    // ══════════════════════════════════════════════
    // DEFAULT: CHAT — Sophia as colleague with CRM awareness
    // ══════════════════════════════════════════════
    default: {
      const [{ data: memory }, { data: knowledge }, { data: agentKnowledge }] = await Promise.all([
        supabase.from('sophia_memory').select('value, category').eq('active', true).order('importance', { ascending: false }).limit(10),
        supabase.from('sophia_knowledge').select('title, content').eq('active', true).order('created_at', { ascending: false }).limit(5),
        supabase.from('sophia_agents').select('name, system_prompt').eq('active', true).is('account_id', null),
      ])

      const { count: totalLeads } = await supabase.from('leads').select('*', { count: 'exact', head: true }).not('stage', 'in', '("closed_won","closed_lost","unqualified")')
      const { count: pendingReminders } = await supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('status', 'pending')

      const memoryText = memory?.map(m => `[${m.category}] ${m.value}`).join('\n') || ''
      const knowledgeText = knowledge?.map(k => `[${k.title}]: ${k.content?.substring(0, 300)}`).join('\n') || ''
      const agentsText = agentKnowledge?.map(a => `${a.name}`).join(', ') || 'ninguno'

      const systemPrompt = `Eres Sophia, la mano derecha de Carlos Silva en Luxury Shield Insurance.
Habla como colega de confianza — directo, sin rodeos.
NO uses **bold** ni headers. Solo texto plano natural.
Responde en maximo 4-5 oraciones.

CRITICO — MANTENER CONTEXTO:
- Recuerdas TODA la conversacion anterior. Si Carlos dijo "cita con Lina a las 2:50" hace 2 mensajes, lo recuerdas.
- Si te pide "recuerdamelo 3 minutos antes", sabes que se refiere a la cita que acabas de agendar.
- NUNCA preguntes "con quien?" o "que cita?" si ya se hablo de eso en los mensajes anteriores.
- Si hay ambiguedad, usa el contexto reciente para resolverla.

TIENES ACCESO AL CRM:
- Agendar citas, crear recordatorios, buscar leads, ver pipeline
- Si Carlos te pide algo del CRM, HAZLO. No preguntes "en que sistema". TU ERES EL SISTEMA.
- Si te pide corregir algo que acabas de hacer, corrigelo sin pedir mas datos.

CRM: ${totalLeads || 0} leads activos, ${pendingReminders || 0} recordatorios, agentes: ${agentsText}

${knowledgeText ? 'CONOCIMIENTO:\n' + knowledgeText : ''}
${memoryText ? 'INSTRUCCIONES:\n' + memoryText : ''}`

      // Build multi-turn conversation from history
      const messages: { role: 'user' | 'assistant'; content: string }[] = []
      for (const h of history) {
        const role = h.direction === 'inbound' ? 'user' as const : 'assistant' as const
        if (h.message?.trim()) {
          if (messages.length > 0 && messages[messages.length - 1].role === role) {
            messages[messages.length - 1].content += '\n' + h.message.trim()
          } else {
            messages.push({ role, content: h.message.trim() })
          }
        }
      }
      // Add current message
      if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        messages[messages.length - 1].content += '\n' + text
      } else {
        messages.push({ role: 'user', content: text })
      }
      // Ensure first is user
      while (messages.length > 0 && messages[0].role === 'assistant') messages.shift()

      // Call Claude with full conversation history via token tracker
      const { callAI } = await import('@/lib/token-tracker')
      const aiResult = await callAI({
        feature: 'master_command', model: 'claude-haiku-4-5-20251001', maxTokens: 600,
        system: systemPrompt, messages,
      })
      let response = aiResult.text || 'Disculpa, no pude procesar tu mensaje. Intenta de nuevo.'

      // Save outbound to history (inbound already saved at top)
      await supabase.from('conversations').insert({ lead_phone: from, message: response, direction: 'outbound', created_at: new Date().toISOString() })
      await sendWhatsApp(from, response)
    }
  }
}
