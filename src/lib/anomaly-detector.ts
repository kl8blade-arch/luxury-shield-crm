import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ANOMALY_THRESHOLD_PCT = 30
const ANOMALY_WINDOW_MIN = 60
const ADMIN_PHONE = '+17869435656'
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM

/**
 * Check if an agent's token consumption is anomalous.
 * Call AFTER each token usage, async (don't block response).
 */
export async function checkForAnomaly(agentId: string): Promise<void> {
  try {
    const { data: agent } = await supabase.from('agents')
      .select('id, name, email, phone, tokens_used, tokens_limit, tokens_extra, role')
      .eq('id', agentId).single()

    if (!agent || agent.role === 'admin') return

    const totalBalance = (agent.tokens_limit || 0) + (agent.tokens_extra || 0)
    if (totalBalance === 0) return

    // Get tokens consumed in last 60 minutes
    const windowStart = new Date(Date.now() - ANOMALY_WINDOW_MIN * 60 * 1000).toISOString()
    const { data: recent } = await supabase.from('token_usage')
      .select('tokens_input, tokens_output')
      .eq('agent_id', agentId)
      .gte('created_at', windowStart)

    const tokensInWindow = (recent || []).reduce((s, u) => s + (u.tokens_input || 0) + (u.tokens_output || 0), 0)
    const pctConsumed = (tokensInWindow / totalBalance) * 100

    if (pctConsumed < ANOMALY_THRESHOLD_PCT) return

    // Check if already reported (don't spam)
    const { data: existing } = await supabase.from('tenant_security_events')
      .select('id').eq('agent_id', agentId).eq('event_type', 'anomaly_detected')
      .eq('resolved', false).gte('created_at', windowStart).limit(1)

    if (existing && existing.length > 0) return

    // Block the agent
    await supabase.from('agents').update({
      security_blocked: true,
      blocked_reason: `Consumo anomalo: ${pctConsumed.toFixed(1)}% en ${ANOMALY_WINDOW_MIN} min`,
      blocked_at: new Date().toISOString(),
    }).eq('id', agentId)

    // Log security event
    await supabase.from('tenant_security_events').insert({
      agent_id: agentId,
      event_type: 'anomaly_detected',
      details: { tokens_in_window: tokensInWindow, total_balance: totalBalance, pct: pctConsumed.toFixed(2), window_minutes: ANOMALY_WINDOW_MIN },
      resolved: false,
    })

    // Alert Carlos via WhatsApp
    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      const msg = `🚨 *ALERTA SEGURIDAD*\n\nAgente: ${agent.name}\nEmail: ${agent.email}\n\n⚠️ Consumio ${pctConsumed.toFixed(1)}% de tokens en <60 min\nTokens en ventana: ${tokensInWindow.toLocaleString()}\n\n✅ Cuenta BLOQUEADA automaticamente.\n\nDesbloquear desde Configuracion > Sub-cuentas.`
      const auth = `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${ADMIN_PHONE}`, Body: msg }).toString(),
      })
    }
  } catch (err: any) {
    console.error('[ANOMALY]', err.message)
  }
}
