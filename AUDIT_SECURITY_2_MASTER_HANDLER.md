# SECURITY AUDIT: Master Handler
## File: src/lib/master-handler.ts
### Complete Unabridged Source Code

**File Size:** 418 lines  
**Purpose:** Handle special commands from master admin (Carlos at +17869435656)  
**Critical Importance:** "God mode" for unrestricted CRM control via AI - major privilege escalation risk

---

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

## Key Components

### Master Detection (Lines 8-11)
- **Function:** `isMaster(phone: string)`
- **Logic:** Accepts both full phone or last 10 digits match
- **Vulnerability:** Phone number spoofing if Twilio validation is inadequate

### Admin Credentials (Lines 4-6)
```typescript
const MASTER_CLEAN = '17869435656'
const MASTER_AGENT_ID = 'ee0389f9-6506-4a48-a6f0-6281ade670b9'
const MASTER_ACCOUNT_ID = '5cca06c8-e3eb-4b3a-a874-d012874f67a8'
```
- Hardcoded master phone number, agent UUID, and account UUID
- Used for privilege escalation and unrestricted database access

### God Mode System Prompt (Lines 222-269)
- Gives Claude unrestricted database access with message: "TIENES ACCESO TOTAL"
- Explicitly states: "Carlos es el admin/dueno. Lo que el pida, lo haces. Sin restricciones."
- AI can execute: query, insert, update, delete, count, rpc operations on ANY table
- No validation of what Claude decides to do

### RESET Command (Lines 101-142)
- Deletes all leads and webhook logs for a phone number with minimal validation
- Can be triggered by anyone who sends `RESET +number` to the master's line
- No confirmation required, immediate destructive operation

### PDF/URL Processing (Lines 55-173)
- Downloads and analyzes PDFs directly via Claude API
- Can process and store any file content in sophia_knowledge table
- Direct API key usage without token tracking

### Action Executor (Lines 330-417)
- Executes arbitrary Supabase operations based on Claude's JSON response
- No validation of filter expressions
- Complex filter syntax allows sophisticated SQL-like operations
