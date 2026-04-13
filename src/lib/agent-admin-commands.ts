// SophiaOS — Comandos de administración por WhatsApp para agentes
// El agente administra su cuenta sin tocar ningún panel web

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendWA(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const auth = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, To: `whatsapp:${cleanTo}`, Body: message }).toString(),
  })
}

// ── Detecta si el mensaje es un comando de administración ──
export function isAdminCommand(message: string): boolean {
  const upper = message.trim().toUpperCase()
  return (
    upper.startsWith('MI AGENCIA') ||
    upper.startsWith('MI TONO') ||
    upper.startsWith('MI INDUSTRIA') ||
    upper.startsWith('MODO ') ||
    upper === 'MIS LEADS' ||
    upper === 'MI REPORTE' ||
    upper === 'MIS AGENTES' ||
    upper === 'MI CUENTA' ||
    upper === 'AYUDA' ||
    upper === 'HELP' ||
    upper === 'COMANDOS'
  )
}

// ── Procesar comando de administración ──
export async function handleAgentAdminCommand(
  agentId: string,
  phone: string,
  message: string
): Promise<boolean> {
  const msg = message.trim()
  const upper = msg.toUpperCase()

  // MI AGENCIA [nuevo nombre]
  if (upper.startsWith('MI AGENCIA ')) {
    const nombre = msg.substring(11).trim()
    if (!nombre) {
      await sendWA(phone, '⚠️ Escribe el nombre después del comando. Ejemplo: `MI AGENCIA Lopez Insurance`')
      return true
    }
    await supabase.from('agents').update({ company_name: nombre, updated_at: new Date().toISOString() }).eq('id', agentId)
    await sendWA(phone, `✅ Nombre de agencia actualizado a *${nombre}*\nSophia ya está usando el nuevo nombre.`)
    return true
  }

  // MI TONO [amigable/profesional/energico]
  if (upper.startsWith('MI TONO')) {
    const tonoRaw = msg.substring(7).trim().toLowerCase()
    const tonoMap: Record<string, string> = { amigable: 'amigable', profesional: 'profesional', energico: 'energico', enérgico: 'energico' }
    const tono = tonoMap[tonoRaw]
    if (!tono) {
      await sendWA(phone, '⚠️ Tono no reconocido. Opciones: `MI TONO amigable` · `MI TONO profesional` · `MI TONO energico`')
      return true
    }
    await supabase.from('agent_configs').upsert({
      agent_id: agentId,
      custom_prompt: `Tono de Sophia: ${tono}.`,
    }, { onConflict: 'agent_id' })
    const desc: Record<string, string> = {
      amigable: 'cálida y cercana como una amiga de confianza 🤝',
      profesional: 'formal y experta, orientada a datos 📊',
      energico: 'entusiasta y motivadora ⚡',
    }
    await sendWA(phone, `✅ Tono actualizado a *${tono}*\nSophia ahora suena ${desc[tono]}`)
    return true
  }

  // MI INDUSTRIA [sector]
  if (upper.startsWith('MI INDUSTRIA ')) {
    const industria = msg.substring(13).trim()
    if (!industria) {
      await sendWA(phone, '⚠️ Escribe la industria. Ejemplo: `MI INDUSTRIA seguros` o `MI INDUSTRIA real estate`')
      return true
    }
    await supabase.from('agents').update({ industry: industria.toLowerCase(), updated_at: new Date().toISOString() }).eq('id', agentId)
    await sendWA(phone, `✅ Industria actualizada a *${industria}*\nSophia filtrará el conocimiento relevante para este nicho.`)
    return true
  }

  // MODO [autopilot/confirmacion/hibrido]
  if (upper.startsWith('MODO ')) {
    const modoRaw = msg.substring(5).trim().toLowerCase()
    const modoMap: Record<string, string> = {
      autopilot: 'autopilot', automático: 'autopilot', auto: 'autopilot',
      confirmacion: 'confirmacion', confirmación: 'confirmacion', manual: 'confirmacion',
      hibrido: 'hibrido', híbrido: 'hibrido', mixto: 'hibrido',
    }
    const modo = modoMap[modoRaw]
    if (!modo) {
      await sendWA(phone, '⚠️ Modo no reconocido. Opciones:\n`MODO autopilot` — Sophia actúa sola\n`MODO confirmacion` — Sophia pide permiso\n`MODO hibrido` — Sophia decide según importancia')
      return true
    }
    await supabase.from('agents').update({ sophia_mode: modo as any, updated_at: new Date().toISOString() }).eq('id', agentId)
    const desc: Record<string, string> = {
      autopilot: 'actuará de forma completamente autónoma 🤖',
      confirmacion: 'te pedirá confirmación antes de cada cambio importante ✋',
      hibrido: 'actuará sola en lo pequeño y te consultará en lo grande ⚡',
    }
    await sendWA(phone, `✅ Modo cambiado a *${modo}*\nSophia ${desc[modo]}`)
    return true
  }

  // MIS LEADS
  if (upper === 'MIS LEADS') {
    const { data: leads } = await supabase
      .from('leads')
      .select('name, phone, stage, score, last_message_at')
      .eq('agent_id', agentId)
      .not('stage', 'in', '("closed_won","closed_lost","unqualified")')
      .order('score', { ascending: false })
      .limit(10)

    if (!leads || leads.length === 0) {
      await sendWA(phone, '📋 No tienes leads activos en este momento.\n\nCuando lleguen leads de tus campañas, aparecerán aquí.')
      return true
    }

    const stageEmoji: Record<string, string> = {
      new: '🆕', nuevo: '🆕', calificando: '🔍', presentando: '📊',
      interested: '⭐', objecion: '⚠️', listo_comprar: '🔥', agendado: '📅',
    }

    const list = leads.map((l: any, i: number) => {
      const emoji = stageEmoji[l.stage] || '📌'
      const tiempo = l.last_message_at ? `${Math.round((Date.now() - new Date(l.last_message_at).getTime()) / 3600000)}h` : '—'
      return `${i + 1}. ${emoji} *${l.name || l.phone}* — Score: ${l.score}/100 — hace ${tiempo}`
    }).join('\n')

    await sendWA(phone, `📋 *Tus leads activos (${leads.length}):*\n━━━━━━━━━━━━━━━━━\n${list}\n━━━━━━━━━━━━━━━━━\n🔥 = listo para cerrar · ⭐ = interesado · 🔍 = calificando`)
    return true
  }

  // MI REPORTE
  if (upper === 'MI REPORTE') {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [
      { count: totalLeads },
      { count: hotLeads },
      { count: closedWon },
      { data: topProduct },
    ] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agent_id', agentId).gte('created_at', since),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agent_id', agentId).eq('ready_to_buy', true),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agent_id', agentId).eq('stage', 'closed_won').gte('updated_at', since),
      supabase.from('leads').select('insurance_type').eq('agent_id', agentId).gte('created_at', since).not('insurance_type', 'is', null).limit(50),
    ])

    // Calcular producto más activo
    const productCount: Record<string, number> = {}
    for (const l of (topProduct || [])) {
      if (l.insurance_type) productCount[l.insurance_type] = (productCount[l.insurance_type] || 0) + 1
    }
    const topEntry = Object.entries(productCount).sort((a, b) => b[1] - a[1])[0]
    const topProductName = topEntry ? `${topEntry[0]} (${topEntry[1]} leads)` : 'sin datos'

    const conversion = totalLeads ? Math.round(((closedWon || 0) / totalLeads) * 100) : 0

    await sendWA(phone,
      `📊 *Tu reporte semanal*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `📥 Leads nuevos: *${totalLeads || 0}*\n` +
      `🔥 Listos para cerrar: *${hotLeads || 0}*\n` +
      `✅ Cierres esta semana: *${closedWon || 0}*\n` +
      `📈 Tasa de conversión: *${conversion}%*\n` +
      `🏆 Producto más activo: *${topProductName}*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `${hotLeads ? `🚨 Tienes ${hotLeads} lead(s) listo(s) para cerrar. ¡Llama hoy!` : '💪 Sigue trabajando, los leads están llegando.'}`
    )
    return true
  }

  // MIS AGENTES
  if (upper === 'MIS AGENTES') {
    const { data: agentes } = await supabase
      .from('sophia_agents')
      .select('name, purpose, active, conversations_handled, success_rate')
      .or(`account_id.eq.${agentId},account_id.is.null`)
      .order('active', { ascending: false })
      .limit(10)

    if (!agentes || agentes.length === 0) {
      await sendWA(phone, '🤖 No tienes sub-agentes configurados todavía.')
      return true
    }

    const list = agentes.map((a: any) => {
      const status = a.active ? '✅' : '⏸️'
      const stats = a.conversations_handled ? ` · ${a.conversations_handled} convs` : ''
      return `${status} *${a.name}*${stats}\n   _${a.purpose?.substring(0, 60) || '—'}_`
    }).join('\n\n')

    await sendWA(phone, `🤖 *Tus sub-agentes:*\n━━━━━━━━━━━━━━━━━\n${list}`)
    return true
  }

  // MI CUENTA
  if (upper === 'MI CUENTA') {
    const { data: agent } = await supabase
      .from('agents')
      .select('name, company_name, industry, sophia_mode, plan, tokens_used, tokens_limit, plan_status')
      .eq('id', agentId)
      .single()

    if (!agent) {
      await sendWA(phone, '⚠️ No pude cargar tu cuenta. Intenta de nuevo.')
      return true
    }

    const tokenPct = agent.tokens_limit ? Math.round((agent.tokens_used / agent.tokens_limit) * 100) : 0
    const bar = '█'.repeat(Math.floor(tokenPct / 10)) + '░'.repeat(10 - Math.floor(tokenPct / 10))

    await sendWA(phone,
      `👤 *Tu cuenta SophiaOS*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `🏢 Agencia: *${agent.company_name || '—'}*\n` +
      `🏭 Industria: ${agent.industry || '—'}\n` +
      `🤖 Modo Sophia: *${agent.sophia_mode || 'confirmacion'}*\n` +
      `📦 Plan: *${agent.plan || '—'}* (${agent.plan_status})\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `💰 Tokens: ${bar} ${tokenPct}%\n` +
      `   Usados: ${(agent.tokens_used || 0).toLocaleString()} / ${(agent.tokens_limit || 0).toLocaleString()}`
    )
    return true
  }

  // AYUDA / COMANDOS
  if (upper === 'AYUDA' || upper === 'HELP' || upper === 'COMANDOS') {
    await sendWA(phone,
      `🛡️ *Comandos SophiaOS*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `*⚙️ CONFIGURACIÓN:*\n` +
      `\`MI AGENCIA [nombre]\` — cambiar nombre\n` +
      `\`MI TONO [amigable/profesional/energico]\`\n` +
      `\`MI INDUSTRIA [sector]\`\n` +
      `\`MODO [autopilot/confirmacion/hibrido]\`\n\n` +
      `*📊 REPORTES:*\n` +
      `\`MIS LEADS\` — ver leads activos\n` +
      `\`MI REPORTE\` — métricas de la semana\n` +
      `\`MIS AGENTES\` — sub-agentes activos\n` +
      `\`MI CUENTA\` — plan, tokens, configuración\n\n` +
      `*📚 ENTRENAMIENTO:*\n` +
      `Envía un PDF o documento — Sophia aprende\n` +
      `Envía una URL — Sophia extrae conocimiento\n\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `¿Necesitas algo más? Escríbeme lo que necesitas en lenguaje natural 😊`
    )
    return true
  }

  return false
}
