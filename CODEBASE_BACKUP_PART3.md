# CODEBASE_BACKUP_PART3.md
## Complete Unabridged Source Code for Security Audit

**Total Files:** 5 critical files  
**Total Lines:** 955 lines of complete, unabridged TypeScript source code  
**Purpose:** Security analysis and vulnerability assessment — literal code with no summaries or truncation

---

## 1. src/lib/master-handler.ts

### Complete File — 418 Lines — Admin God Mode Handler

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const MASTER_CLEAN = '17869435656'
const MASTER_AGENT_ID = 'ee0389f9-6506-4a48-a6f0-6281ade670b9'
const MASTER_ACCOUNT_ID = '5cca06c8-e3eb-4b3a-a874-d012874f67a8'

export function isMaster(phone: string): boolean {
  const clean = phone.replace(/\D/g, '')
  return clean === MASTER_CLEAN || clean.endsWith(MASTER_CLEAN.slice(-10))
}

async function callClaude(system: string, user: string, model = 'claude-haiku-4-5-20251001', maxTokens = 800): Promise<string> {
  const { callAI } = await import('@/lib/token-tracker')
  const result = await callAI({ feature: 'master_command', model, maxTokens, system, messages: [{ role: 'user', content: user }] })
  return result.text || ''
}

async function callClaudeMulti(system: string, messages: { role: 'user' | 'assistant'; content: string }[], model = 'claude-haiku-4-5-20251001', maxTokens = 800): Promise<string> {
  const { callAI } = await import('@/lib/token-tracker')
  const result = await callAI({ feature: 'master_command', model, maxTokens, system, messages })
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
    await sendWhatsApp(from, '📄 Recibi tu PDF. Extrayendo conocimiento...')
    try {
      const twilioAuth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      const redirectRes = await fetch(mediaUrl, { headers: { 'Authorization': `Basic ${twilioAuth}` }, redirect: 'manual' })
      const finalUrl = redirectRes.status === 307 ? redirectRes.headers.get('location') || mediaUrl : mediaUrl
      const pdfRes = await fetch(finalUrl)
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
      const pdfBase64 = pdfBuffer.toString('base64')

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

      await supabase.from('sophia_knowledge').insert({
        title: `${parsed.carrier || 'Documento'} — ${parsed.product_name || parsed.category}`,
        content: parsed.knowledge, source_type: 'pdf', source_name: mediaUrl.split('/').pop() || 'documento.pdf',
        embedding_summary: parsed.knowledge?.substring(0, 300),
        tags: [parsed.category, parsed.carrier, ...(parsed.keywords || [])].filter(Boolean), active: true,
      })
      await sendWhatsApp(from, `✅ PDF procesado!\n📚 ${parsed.carrier || '—'} — ${parsed.product_name || '—'}\n🏷️ ${parsed.category}`)
    } catch (err: any) {
      await sendWhatsApp(from, `⚠️ Error procesando PDF: ${err.message}`)
    }
    return
  }

  // ══════════════════════════════════════════════
  // RESET COMMAND — borra lead + webhook log por número
  // Uso: RESET +17869435656  o  RESET 7869435656
  // Solo Carlos puede ejecutarlo (ya estamos en master handler)
  // ══════════════════════════════════════════════
  const resetMatch = (body || '').match(/^RESET\s+([+\d\s()-]+)/i)
  if (resetMatch) {
    const rawPhone = resetMatch[1].trim()
    const digitsOnly = rawPhone.replace(/\D/g, '')
    const last10 = digitsOnly.slice(-10)
    const withPlus = `+${digitsOnly}`
    const with1 = digitsOnly.startsWith('1') ? digitsOnly : `1${digitsOnly}`

    try {
      // Buscar leads con cualquier variante del número
      const { data: leadsToDelete } = await supabase
        .from('leads')
        .select('id, name')
        .or(`phone.eq.${digitsOnly},phone.eq.${last10},phone.eq.${withPlus},phone.eq.+${digitsOnly},phone.eq.${rawPhone},phone.eq.${with1}`)

      let deletedLeads = 0
      if (leadsToDelete && leadsToDelete.length > 0) {
        const ids = leadsToDelete.map((l: any) => l.id)
        await supabase.from('leads').delete().in('id', ids)
        deletedLeads = ids.length
      }

      // Borrar webhook_request_log del número
      await supabase
        .from('webhook_request_log')
        .delete()
        .or(`from_number.eq.${digitsOnly},from_number.eq.${withPlus},from_number.eq.+${digitsOnly},from_number.eq.${rawPhone}`)

      const leadNames = leadsToDelete?.map((l: any) => l.name).join(', ') || 'ninguno'
      await sendWhatsApp(from,
        `✅ *RESET completado* para ${withPlus}\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `🗑️ Leads borrados: ${deletedLeads} (${leadNames})\n` +
        `🗑️ Webhook log: limpio\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `El número puede volver a escribir como nuevo lead 👍`
      )
    } catch (err: any) {
      await sendWhatsApp(from, `❌ Error en RESET: ${err.message}`)
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
        `Analiza esta pagina. Devuelve SOLO JSON: {"category":"string","carrier":"nombre","product_name":"producto","knowledge":"resumen 500 palabras","keywords":["lista"]}`,
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
      await sendWhatsApp(from, `✅ URL procesada!\n📚 ${parsed.carrier || '—'} — ${parsed.product_name || '—'}`)
    } catch (err: any) {
      await sendWhatsApp(from, `⚠️ Error: ${err.message}`)
    }
    return
  }

  // Helper: send + save
  async function sendAndLog(msg: string) {
    await sendWhatsApp(from, msg)
    await supabase.from('conversations').insert({ lead_phone: from, message: msg, direction: 'outbound', created_at: new Date().toISOString() })
  }

  let text = body
  await supabase.from('conversations').insert({ lead_phone: from, message: text, direction: 'inbound', created_at: new Date().toISOString() })

  // ══════════════════════════════════════════════
  // LOAD CONVERSATION HISTORY
  // ══════════════════════════════════════════════
  const { data: masterHistory } = await supabase
    .from('conversations')
    .select('message, direction, created_at')
    .ilike('lead_phone', `%${from.replace(/\D/g, '').slice(-10)}%`)
    .order('created_at', { ascending: false })
    .limit(16)

  const history = (masterHistory || []).reverse()
  const historyText = history.map(h =>
    `${h.direction === 'inbound' ? 'Carlos' : 'Sophia'}: ${h.message}`
  ).join('\n')

  // ══════════════════════════════════════════════
  // GATHER LIVE CRM STATE FOR CONTEXT
  // ══════════════════════════════════════════════
  const [
    { count: totalLeads },
    { count: hotLeads },
    { count: pendingReminders },
    { data: allAgents },
    { data: recentLeads },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).not('stage', 'in', '("closed_won","closed_lost","unqualified")'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).gte('score', 75).not('stage', 'in', '("closed_won","closed_lost")'),
    supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('agents').select('id, name, email, phone, role, status, paid, subscription_plan, tokens_used, tokens_limit, created_at, account_id').order('created_at', { ascending: false }).limit(20),
    supabase.from('leads').select('id, name, phone, state, stage, score, insurance_type, agent_id, account_id, created_at').order('created_at', { ascending: false }).limit(10),
  ])

  const agentsInfo = (allAgents || []).map(a => `${a.name} (${a.email}) - ${a.role}/${a.status} - plan:${a.subscription_plan || 'free'} - paid:${a.paid ? 'si' : 'no'} - tokens:${a.tokens_used || 0}/${a.tokens_limit || 0}`).join('\n')
  const leadsInfo = (recentLeads || []).map(l => `${l.name} (${l.phone}) - ${l.state || '?'} - ${l.insurance_type} - stage:${l.stage} - score:${l.score}`).join('\n')

  // ══════════════════════════════════════════════
  // SOPHIA GOD MODE — Full CRM control via AI
  // ══════════════════════════════════════════════
  const godSystemPrompt = `Eres Sophia, la IA con CONTROL TOTAL del CRM de Carlos Silva.
Carlos es el admin/dueno. Lo que el pida, lo haces. Sin restricciones.

CONVERSACION RECIENTE:
${historyText || '(inicio)'}

ESTADO ACTUAL DEL CRM:
- ${totalLeads || 0} leads activos, ${hotLeads || 0} calientes, ${pendingReminders || 0} recordatorios
- Agentes registrados:\n${agentsInfo || 'ninguno'}
- Leads recientes:\n${leadsInfo || 'ninguno'}

TIENES ACCESO TOTAL. Responde con JSON para ejecutar acciones.
Devuelve SOLO un JSON con esta estructura (sin markdown, sin explicacion):

{
  "reply": "texto para Carlos (corto, directo, sin bold)",
  "actions": [
    { "type": "query", "table": "leads", "filter": {"stage": "new"}, "select": "name,phone,score", "limit": 10 },
    { "type": "insert", "table": "agents", "data": {...} },
    { "type": "update", "table": "leads", "filter": {"id": "uuid"}, "data": {"stage": "contacted"} },
    { "type": "delete", "table": "tabla", "filter": {"id": "uuid"} },
    { "type": "count", "table": "leads", "filter": {"stage": "new"} },
    { "type": "rpc", "function": "register_agent", "args": {...} }
  ]
}

ACCIONES DISPONIBLES:
1. query — consultar cualquier tabla (leads, agents, accounts, conversations, calendar_events, reminders, commissions, sophia_knowledge, sophia_skills, sophia_agents, sophia_memory, token_usage, social_content)
2. insert — crear registros (leads, agents, calendar_events, reminders, sophia_knowledge, sophia_memory)
3. update — modificar registros
4. delete — eliminar registros
5. count — contar registros
6. rpc — llamar funciones SQL (register_agent)

CREAR AGENTE NUEVO:
Para crear un agente, usa insert en "agents" con: name, email, phone, role:"agent", status:"active", subscription_plan:"starter", paid:false, tokens_limit:300, tokens_used:0, onboarding_complete:false, account_id:(nuevo uuid)
Tambien inserta en "accounts" con: name (del agente), slug (generado), plan:"starter"

REGLAS:
- Si Carlos pide algo, HAZLO. No digas "no puedo" ni "necesito acceso".
- Si pide datos, consultalos y muestralos en reply.
- Si pide crear/modificar/eliminar, genera las acciones correspondientes.
- Si pide investigar, haz las queries necesarias.
- reply debe ser texto plano, conciso, sin markdown. Usa emojis moderados.
- Si no necesitas acciones, pon "actions": []
- SIEMPRE responde en espanol
- Para filtros complejos usa: {"column.operator": "value"} ej: {"score.gte": 75}, {"name.ilike": "%maria%"}, {"stage.in": "(new,contacted)"}
- Maximo 5 acciones por mensaje`

  // Build multi-turn messages
  const messages: { role: 'user' | 'assistant'; content: string }[] = []
  for (const h of history.slice(-12)) {
    const role = h.direction === 'inbound' ? 'user' as const : 'assistant' as const
    if (h.message?.trim()) {
      if (messages.length > 0 && messages[messages.length - 1].role === role) {
        messages[messages.length - 1].content += '\n' + h.message.trim()
      } else {
        messages.push({ role, content: h.message.trim() })
      }
    }
  }
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    messages[messages.length - 1].content += '\n' + text
  } else {
    messages.push({ role: 'user', content: text })
  }
  while (messages.length > 0 && messages[0].role === 'assistant') messages.shift()

  try {
    const rawResponse = await callClaudeMulti(godSystemPrompt, messages, 'claude-haiku-4-5-20251001', 1200)

    let parsed: { reply: string; actions: any[] }
    try {
      parsed = JSON.parse(rawResponse.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      // If not JSON, treat as plain chat reply
      await sendAndLog(rawResponse)
      return
    }

    // Execute actions
    const actionResults: string[] = []
    for (const action of (parsed.actions || []).slice(0, 5)) {
      try {
        const result = await executeAction(action)
        if (result) actionResults.push(result)
      } catch (err: any) {
        actionResults.push(`⚠️ Error en ${action.type}: ${err.message}`)
      }
    }

    // Build final reply
    let finalReply = parsed.reply || ''
    if (actionResults.length > 0) {
      finalReply += '\n\n' + actionResults.join('\n')
    }

    await sendAndLog(finalReply || 'Listo.')

  } catch (err: any) {
    console.error('[MASTER] God mode error:', err)
    await sendAndLog(`⚠️ Error: ${err.message}`)
  }
}

// ══════════════════════════════════════════════
// ACTION EXECUTOR — Runs Supabase operations
// ══════════════════════════════════════════════
async function executeAction(action: any): Promise<string> {
  const { type, table, filter, data, select, limit: lim, function: fn, args } = action

  // Build filter for supabase
  function applyFilters(query: any, filters: Record<string, any>) {
    for (const [key, value] of Object.entries(filters || {})) {
      if (key.includes('.')) {
        const [col, op] = key.split('.')
        switch (op) {
          case 'gte': query = query.gte(col, value); break
          case 'lte': query = query.lte(col, value); break
          case 'gt': query = query.gt(col, value); break
          case 'lt': query = query.lt(col, value); break
          case 'ilike': query = query.ilike(col, value); break
          case 'like': query = query.like(col, value); break
          case 'neq': query = query.neq(col, value); break
          case 'in': query = query.in(col, value); break
          case 'is': query = query.is(col, value === 'null' ? null : value); break
          default: query = query.eq(col, value)
        }
      } else {
        query = query.eq(key, value)
      }
    }
    return query
  }

  switch (type) {
    case 'query': {
      let q = supabase.from(table).select(select || '*')
      q = applyFilters(q, filter)
      q = q.order('created_at', { ascending: false }).limit(lim || 10)
      const { data: rows, error } = await q
      if (error) return `⚠️ Query error: ${error.message}`
      if (!rows?.length) return `📭 Sin resultados en ${table}`

      // Format results compactly
      const formatted = rows.map((r: any, i: number) => {
        const vals = Object.entries(r).filter(([_, v]) => v !== null && v !== '' && v !== false).map(([k, v]) => {
          if (typeof v === 'string' && v.length > 60) return `${k}: ${(v as string).substring(0, 57)}...`
          return `${k}: ${v}`
        }).join(' | ')
        return `${i + 1}. ${vals}`
      }).join('\n')

      return `📊 ${table} (${rows.length}):\n${formatted}`
    }

    case 'count': {
      let q = supabase.from(table).select('*', { count: 'exact', head: true })
      q = applyFilters(q, filter)
      const { count, error } = await q
      if (error) return `⚠️ Count error: ${error.message}`
      return `📊 ${table}: ${count || 0} registros`
    }

    case 'insert': {
      const { data: inserted, error } = await supabase.from(table).insert(data).select().single()
      if (error) return `⚠️ Insert error: ${error.message}`
      return `✅ Creado en ${table}: ${inserted?.name || inserted?.title || inserted?.id || 'ok'}`
    }

    case 'update': {
      let q = supabase.from(table).update(data)
      q = applyFilters(q, filter)
      const { data: updated, error } = await q.select()
      if (error) return `⚠️ Update error: ${error.message}`
      return `✅ Actualizado ${updated?.length || 0} registro(s) en ${table}`
    }

    case 'delete': {
      let q = supabase.from(table).delete()
      q = applyFilters(q, filter)
      const { error } = await q
      if (error) return `⚠️ Delete error: ${error.message}`
      return `🗑️ Eliminado de ${table}`
    }

    case 'rpc': {
      const { data: result, error } = await supabase.rpc(fn, args)
      if (error) return `⚠️ RPC error: ${error.message}`
      return `✅ ${fn}: ${JSON.stringify(result).substring(0, 200)}`
    }

    default:
      return `⚠️ Accion desconocida: ${type}`
  }
}
```

---

## 2. src/lib/sophia-context.ts

### Complete File — 110 Lines — Lead Context Loader

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ConversationMessage {
  direction: 'inbound' | 'outbound'
  message: string
  created_at: string
}

interface SophiaContext {
  conversations: ConversationMessage[]
  contextSummary?: string
  family?: any
  insights?: any
}

/**
 * Load full Sophia context for a lead
 * Includes: conversation history + family info + extracted insights
 */
export async function loadSophiaContext(
  leadId: string,
  agentId: string | null,
  limit: number = 20
): Promise<SophiaContext | null> {
  try {
    // Load conversation history
    const { data: conversations, error: convErr } = await supabase
      .from('conversations')
      .select('direction, message, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (convErr) {
      console.error('[sophia-context] Error loading conversations:', convErr)
      return null
    }

    // Load lead info for context summary
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name, phone, insurance_type, stage, score, family_relationships, extracted_insights')
      .eq('id', leadId)
      .single()

    let contextSummary = ''
    if (lead) {
      contextSummary = `
Lead: ${lead.name}
Phone: ${lead.phone}
Stage: ${lead.stage}
Score: ${lead.score}
Insurance Type: ${lead.insurance_type}
`
      if (lead.extracted_insights) {
        contextSummary += `Insights: ${lead.extracted_insights}`
      }
    }

    return {
      conversations: conversations || [],
      contextSummary: contextSummary.trim(),
      family: lead?.family_relationships,
      insights: lead?.extracted_insights,
    }
  } catch (e) {
    console.error('[sophia-context] Error in loadSophiaContext:', e)
    return null
  }
}

/**
 * Build Claude message array from conversation history
 * Merges consecutive messages from same direction
 */
export function buildClaudeMessages(
  conversations: ConversationMessage[],
  newMessage: string
): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = []

  // Convert history to Claude format
  for (const conv of conversations) {
    const role = conv.direction === 'inbound' ? 'user' : 'assistant'
    const lastMsg = messages[messages.length - 1]

    if (lastMsg && lastMsg.role === role) {
      // Merge consecutive messages from same sender
      lastMsg.content += `\n${conv.message}`
    } else {
      messages.push({ role, content: conv.message })
    }
  }

  // Add new incoming message
  const lastMsg = messages[messages.length - 1]
  if (lastMsg && lastMsg.role === 'user') {
    lastMsg.content += `\n${newMessage}`
  } else {
    messages.push({ role: 'user', content: newMessage })
  }

  return messages
}
```

---

## 3. src/lib/agent-onboarding.ts

### Complete File — 186 Lines — WhatsApp Agent Onboarding Flow

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!

async function sendWA(to: string, msg: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const auth = `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`
  const body = new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanTo}`, Body: msg })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

async function sendMediaWA(to: string, msg: string, mediaUrl: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const auth = `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`
  const body = new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanTo}`, Body: msg, MediaUrl: mediaUrl })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

/**
 * Check if an incoming WhatsApp message is from an agent in onboarding
 * Returns true if handled (caller should stop processing)
 */
export async function handleAgentOnboarding(
  from: string,
  body: string,
  mediaUrl?: string,
  mediaType?: string,
): Promise<boolean> {
  const fromDigits = from.replace(/\D/g, '')
  const last10 = fromDigits.slice(-10)

  // Find agent by phone who is in onboarding
  const { data: agent } = await supabase.from('agents')
    .select('id, name, phone, wa_onboarding_step, account_id, company_name')
    .or(`phone.like.%${last10}%,phone.eq.${from},phone.eq.+1${last10}`)
    .not('wa_onboarding_step', 'is', null)
    .not('wa_onboarding_step', 'eq', 'done')
    .limit(1)
    .single()

  if (!agent) return false

  const step = agent.wa_onboarding_step
  const firstName = agent.name?.split(' ')[0] || 'agente'

  console.log(`[ONBOARDING] Agent ${agent.name} — step: ${step} — body: "${body}" — media: ${mediaUrl ? 'yes' : 'no'}`)

  // ══════════════════════════════
  // STEP: LOGO — waiting for logo image
  // ══════════════════════════════
  if (step === 'logo') {
    if (mediaUrl && mediaType && (mediaType.includes('image') || mediaType.includes('png') || mediaType.includes('jpeg') || mediaType.includes('jpg'))) {
      // Download image from Twilio
      const twilioAuth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
      const redirectRes = await fetch(mediaUrl, { headers: { 'Authorization': `Basic ${twilioAuth}` }, redirect: 'manual' })
      const finalUrl = redirectRes.status === 307 || redirectRes.status === 302 ? redirectRes.headers.get('location') || mediaUrl : mediaUrl

      // Download the image
      const imgRes = await fetch(finalUrl)
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
      const imgBase64 = imgBuffer.toString('base64')
      const imgDataUrl = `data:${mediaType};base64,${imgBase64}`

      // Save logo to account
      if (agent.account_id) {
        await supabase.from('accounts').update({ logo_url: imgDataUrl }).eq('id', agent.account_id)
      }
      // Also save to agent profile
      await supabase.from('agents').update({ profile_photo: imgDataUrl }).eq('id', agent.id)

      // Move to next step
      await supabase.from('agents').update({ wa_onboarding_step: 'color' }).eq('id', agent.id)

      await sendWA(from,
        `✅ *Logo recibido!*\n\nYa lo aplique a tu CRM, ${firstName}.\n\nAhora dime: cual es el color principal de tu marca? Puedes decirme:\n\n• Un nombre de color (ej: "azul", "rojo", "dorado")\n• Un codigo hex (ej: "#FF5733")\n\nO escribe *"saltar"* para usar el dorado por defecto.`
      )
      return true
    }

    // Not an image — ask again
    if (body.toLowerCase().includes('saltar') || body.toLowerCase().includes('skip') || body.toLowerCase().includes('no tengo')) {
      await supabase.from('agents').update({ wa_onboarding_step: 'color' }).eq('id', agent.id)
      await sendWA(from, `Sin problema! Puedes subir tu logo despues desde el CRM.\n\nAhora dime: cual es el *color principal* de tu marca?\n\nEj: "azul", "rojo", "#FF5733" o "saltar" para usar dorado.`)
      return true
    }

    await sendWA(from, `${firstName}, necesito que me envies tu *logo como imagen* (PNG o JPG).\n\nSi no tienes uno ahora, escribe *"saltar"* y lo subes despues.`)
    return true
  }

  // ══════════════════════════════
  // STEP: COLOR — waiting for brand color
  // ══════════════════════════════
  if (step === 'color') {
    let color = '#C9A84C' // default gold
    const text = body.toLowerCase().trim()

    const colorMap: Record<string, string> = {
      'azul': '#2563eb', 'azul marino': '#1e3a5f', 'rojo': '#dc2626', 'verde': '#059669',
      'dorado': '#C9A84C', 'oro': '#C9A84C', 'gold': '#C9A84C', 'morado': '#7c3aed',
      'violeta': '#8b5cf6', 'naranja': '#ea580c', 'negro': '#1a1a2e', 'blanco': '#f8fafc',
      'rosa': '#ec4899', 'amarillo': '#eab308', 'turquesa': '#06b6d4', 'gris': '#6b7280',
    }

    if (text.startsWith('#') && text.length >= 4) {
      color = text
    } else if (colorMap[text]) {
      color = colorMap[text]
    } else if (text === 'saltar' || text === 'skip') {
      color = '#C9A84C'
    }

    if (agent.account_id) {
      await supabase.from('accounts').update({ brand_color: color }).eq('id', agent.account_id)
    }

    await supabase.from('agents').update({ wa_onboarding_step: 'welcome' }).eq('id', agent.id)

    await sendWA(from,
      `🎨 Color configurado!\n\nUltimo paso: escribe un *mensaje de bienvenida* para tus clientes. Este es el primer mensaje que Sophia enviara cuando un lead te escriba.\n\nEjemplo: "Hola! Gracias por contactar a ${agent.company_name || 'nuestra agencia'}. Mi nombre es ${firstName}, como te puedo ayudar hoy?"\n\nO escribe *"usar default"* para uno automatico.`
    )
    return true
  }

  // ══════════════════════════════
  // STEP: WELCOME — waiting for welcome message
  // ══════════════════════════════
  if (step === 'welcome') {
    const text = body.trim()
    let welcomeMsg = text

    if (text.toLowerCase() === 'usar default' || text.toLowerCase() === 'default' || text.toLowerCase() === 'saltar') {
      welcomeMsg = `Hola! Gracias por contactarnos. Soy ${firstName} de ${agent.company_name || 'nuestra agencia'}. En que te puedo ayudar?`
    }

    if (agent.account_id) {
      await supabase.from('accounts').update({ welcome_message: welcomeMsg }).eq('id', agent.account_id)
    }

    // Mark onboarding complete
    await supabase.from('agents').update({ wa_onboarding_step: 'done', onboarding_complete: true }).eq('id', agent.id)

    await sendWA(from,
      `🎉 *Tu CRM esta listo, ${firstName}!*\n\n✅ Logo configurado\n✅ Color de marca aplicado\n✅ Mensaje de bienvenida guardado\n\nYa puedes acceder a tu panel:\n👉 https://luxury-shield-crm.vercel.app/login\n\nDesde ahi veras tu dashboard, pipeline, leads, y toda la plataforma.\n\nSi necesitas ayuda, escribeme aqui. Soy Sophia, tu asistente de IA. 🛡️`
    )
    return true
  }

  return false
}

/**
 * Trigger the onboarding flow for a newly registered agent via WhatsApp
 */
export async function startAgentOnboarding(agentId: string) {
  const { data: agent } = await supabase.from('agents')
    .select('id, name, phone, email, company_name')
    .eq('id', agentId)
    .single()

  if (!agent || !agent.phone) {
    console.log(`[ONBOARDING] Can't start — agent ${agentId} has no phone`)
    return
  }

  // Set onboarding step
  await supabase.from('agents').update({ wa_onboarding_step: 'logo' }).eq('id', agentId)

  const firstName = agent.name?.split(' ')[0] || 'agente'

  // Send initial onboarding message
  await sendWA(agent.phone,
    `👋 *Hola ${firstName}! Soy Sophia, tu asistente de IA en Luxury Shield CRM.*\n\nTu cuenta ya esta creada! Ahora necesito configurar tu CRM. Son solo 3 pasos rapidos:\n\n*Paso 1/3:* Envíame el *logo de tu agencia* como imagen (PNG o JPG).\n\nEste logo aparecera en tu CRM y en las comunicaciones con tus clientes.\n\nSi no tienes uno, escribe *"saltar"*.`
  )
}
```

---

## 4. src/app/api/sophia/knowledge/route.ts

### Complete File — 200 Lines — RAG Semantic Search for Sophia

```typescript
// src/app/api/sophia/knowledge/route.ts
// RAG semántico para Sophia — busca productos relevantes por intención del lead
// NO incluye precios — solo beneficios, oportunidades y limitaciones

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { errorHandler } from '@/lib/errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mapeo de intenciones del lead a líneas de producto
const INTENT_MAP: Record<string, string[]> = {
  // Dental
  'dental':       ['dental'],
  'diente':       ['dental'],
  'dentista':     ['dental'],
  'limpieza':     ['dental'],
  'caries':       ['dental'],
  'empaste':      ['dental'],
  'corona':       ['dental'],

  // Visión
  'vision':       ['vision'],
  'visión':       ['vision'],
  'vista':        ['vision'],
  'lente':        ['vision'],
  'contacto':     ['vision'],
  'optometrista': ['vision'],
  'ojo':          ['vision'],

  // ACA / Salud
  'médico':       ['aca'],
  'medico':       ['aca'],
  'salud':        ['aca'],
  'doctor':       ['aca'],
  'hospital':     ['aca', 'hospital_indemnity'],
  'seguro medico':['aca'],
  'aca':          ['aca'],
  'obamacare':    ['aca'],
  'marketplace':  ['aca'],
  'subsidio':     ['aca'],

  // IUL / Vida
  'vida':         ['iul', 'term_life'],
  'seguro vida':  ['iul', 'term_life'],
  'retiro':       ['iul'],
  'ahorro':       ['iul'],
  'acumular':     ['iul'],
  'invertir':     ['iul'],
  'iul':          ['iul'],
  'familia':      ['term_life', 'iul', 'final_expense'],

  // Final Expense
  'funeral':      ['final_expense'],
  'gastos final': ['final_expense'],
  'entierro':     ['final_expense'],
  'muerte':       ['final_expense', 'term_life'],

  // Accident
  'accidente':    ['accident'],
  'fractura':     ['accident'],
  'golpe':        ['accident'],
  'lesión':       ['accident'],
  'trabajo':      ['accident', 'hospital_indemnity'],

  // Cancer
  'cáncer':       ['cancer'],
  'cancer':       ['cancer'],
  'quimio':       ['cancer'],
  'tumor':        ['cancer'],

  // Hospital
  'hospitalización': ['hospital_indemnity'],
  'internado':       ['hospital_indemnity'],
  'deductible':      ['hospital_indemnity'],

  // Medicare
  'medicare':     ['medicare_advantage'],
  'adulto mayor': ['medicare_advantage', 'final_expense'],
  '65':           ['medicare_advantage'],
}

function detectIntents(message: string): string[] {
  const lower   = message.toLowerCase()
  const lines   = new Set<string>()
  for (const [keyword, productLines] of Object.entries(INTENT_MAP)) {
    if (lower.includes(keyword)) productLines.forEach(l => lines.add(l))
  }
  return Array.from(lines)
}

export async function POST(request: NextRequest) {
  try {
    const { message, accountId, agentId } = await request.json()
    if (!message || (!accountId && !agentId)) {
      return NextResponse.json({ success: true, knowledge: '', products: [] })
    }

    // Resolver account_id si solo tenemos agentId
    let resolvedAccountId = accountId
    if (!resolvedAccountId && agentId) {
      const { data: agent } = await supabase
        .from('agents').select('account_id').eq('id', agentId).single()
      resolvedAccountId = agent?.account_id
    }

    // Detectar intenciones del mensaje
    const intents = detectIntents(message)
    if (intents.length === 0) {
      return NextResponse.json({ success: true, knowledge: '', products: [] })
    }

    // Buscar carriers activos de la cuenta
    const { data: activeCarriers } = await supabase
      .from('account_carrier_config')
      .select('carrier_id')
      .eq('account_id', resolvedAccountId)
      .eq('active', true)

    const carrierIds = (activeCarriers ?? []).map(c => c.carrier_id)
    if (carrierIds.length === 0) {
      return NextResponse.json({ success: true, knowledge: '', products: [] })
    }

    // Buscar productos relevantes por línea de producto y carrier activo
    const { data: products } = await supabase
      .from('carrier_products')
      .select(`
        product_name, product_line, knowledge_text,
        sophia_pitch, target_profile, cross_sell_with,
        guaranteed_issue, waiting_period_days, age_min, age_max,
        commission_first_year,
        insurance_carriers!inner(name, short_name)
      `)
      .in('carrier_id', carrierIds)
      .in('product_line', intents)
      .eq('active', true)
      .limit(3)  // máx 3 productos por búsqueda para no saturar el prompt

    if (!products?.length) {
      return NextResponse.json({ success: true, knowledge: '', products: [] })
    }

    // Construir el bloque de conocimiento para el system prompt de Sophia
    // Solo beneficios, oportunidades y limitaciones — SIN precios
    const knowledgeBlocks = products.map(p => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const carrier = (p as any).insurance_carriers
      const lines: string[] = [
        `═══ ${p.product_name} (${carrier?.name ?? 'Carrier'}) ═══`,
        p.knowledge_text ?? '',
      ]

      if (p.sophia_pitch) {
        lines.push(`\nCÓMO PRESENTARLO: ${p.sophia_pitch}`)
      }
      if (p.target_profile) {
        lines.push(`PERFIL IDEAL: ${p.target_profile}`)
      }
      if (p.guaranteed_issue) {
        lines.push('EMISIÓN: Garantizada — sin preguntas médicas')
      }
      if (p.waiting_period_days && p.waiting_period_days > 0) {
        lines.push(`PERÍODO DE ESPERA: ${p.waiting_period_days} días para cobertura completa`)
      }
      if (p.age_min || p.age_max) {
        lines.push(`ELEGIBILIDAD: ${p.age_min ?? 18}-${p.age_max ?? 99} años`)
      }
      if (p.cross_sell_with?.length) {
        lines.push(`CROSS-SELL: Combina bien con ${p.cross_sell_with.join(', ')}`)
      }

      lines.push('IMPORTANTE: No menciones precios ni primas. Siempre conecta con el especialista para cotización.')

      return lines.join('\n')
    })

    const knowledge = knowledgeBlocks.join('\n\n')

    return NextResponse.json({
      success:  true,
      knowledge,
      products: products.map(p => ({
        name:       p.product_name,
        line:       p.product_line,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        carrier:    (p as any).insurance_carriers?.name,
        pitch:      p.sophia_pitch,
      })),
      intentsDetected: intents,
    })

  } catch (error) {
    return errorHandler(error)
  }
}
```

---

## 5. src/app/api/stripe/checkout/route.ts

### Complete File — 41 Lines — Stripe Checkout Session Creator

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { priceId, agentId, email, planName, isAnnual } = await request.json()

    if (!priceId || !agentId || !email || !planName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?checkout=success&plan=${planName}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/register?checkout=cancelled`,
      customer_email: email,
      metadata: {
        agentId,
        planName,
        isAnnual: isAnnual ? 'true' : 'false',
      },
      subscription_data: {
        metadata: {
          agentId,
          planName,
          isAnnual: isAnnual ? 'true' : 'false',
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('[Stripe Checkout]', error)
    return NextResponse.json({ error: error.message || 'Error creating checkout session' }, { status: 500 })
  }
}
```

---

## NOTES ON MISSING FILES

- **middleware.ts** — Referenced in request but **DOES NOT EXIST** at project root. Only exists in `node_modules` (Next.js internal). No custom middleware found in src/, app/, or lib/ directories.

---

## DOCUMENT SUMMARY

- **Files Included:** 5 of 5 critical files (master-handler.ts, sophia-context.ts, agent-onboarding.ts, sophia/knowledge/route.ts, stripe/checkout/route.ts)
- **Total Lines:** 955 lines of complete, unabridged TypeScript
- **Format:** Markdown fenced code blocks with full source (no summaries, no truncation)
- **Date Generated:** 2026-04-17
- **Purpose:** Security audit and vulnerability assessment

This backup contains complete code for security analysis purposes. All code is literal and unabbreviated.
