import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type TokenFeature = 'sophia_whatsapp' | 'coach_realtime' | 'training_generation' | 'audio_transcription' | 'master_command' | 'landing_builder' | 'social_content' | 'other'

interface AICallOptions {
  agentId?: string | null
  accountId?: string | null
  feature: TokenFeature
  model: string
  messages: { role: string; content: string }[]
  system?: string
  maxTokens?: number
  leadId?: string | null
}

interface AIResponse {
  text: string
  inputTokens: number
  outputTokens: number
  cost: number
}

const ADMIN_ID = 'ee0389f9-6506-4a48-a6f0-6281ade670b9' // Carlos

/**
 * Central AI call wrapper. Every Claude call in the system should use this.
 * Handles: token checking, API key selection, call execution, usage logging.
 */
export async function callAI(options: AICallOptions): Promise<AIResponse> {
  const { agentId, accountId, feature, model, messages, system, maxTokens = 400, leadId } = options

  // Admin bypasses everything
  const isAdmin = agentId === ADMIN_ID || !agentId

  // 0. Check if AI is blocked for this agent
  if (!isAdmin && agentId) {
    const { data: blockCheck } = await supabase.from('agents').select('ai_blocked, ai_blocked_reason').eq('id', agentId).single()
    console.log(`[TOKEN-TRACKER] Agent ${agentId} ai_blocked check:`, { blocked: blockCheck?.ai_blocked, reason: blockCheck?.ai_blocked_reason })
    if (blockCheck?.ai_blocked) {
      console.error(`[TOKEN-TRACKER] ❌ BLOCKING: Agent ${agentId} AI is BLOCKED (reason: ${blockCheck?.ai_blocked_reason}). Returning empty response.`)
      return { text: '', inputTokens: 0, outputTokens: 0, cost: 0 }
    }
  }

  // 1. Rate limiting + token check (non-admin only)
  if (!isAdmin && agentId) {
    try {
      const { checkRateLimit } = await import('@/lib/rate-limiter')
      const rateResult = await checkRateLimit(agentId, 1000)
      console.log(`[TOKEN-TRACKER] Rate limit check for agent ${agentId}:`, { allowed: rateResult.allowed, reason: rateResult.reason })
      if (!rateResult.allowed) {
        console.error(`[TOKEN-TRACKER] ❌ BLOCKING: Rate limited for agent ${agentId}. Reason: ${rateResult.reason}. Returning empty response.`)
        // If no balance, block AI
        if (rateResult.reason === 'no_balance') {
          console.log(`[TOKEN-TRACKER] Blocking agent AI due to no_balance`)
          blockAgentAI(agentId, 'tokens_depleted').catch(() => {})
        }
        return { text: '', inputTokens: 0, outputTokens: 0, cost: 0 }
      }
    } catch (e: any) { console.error('[RATE-LIMIT]', e.message) }
  }

  // 2. Get API key (agent's own encrypted key → decrypt, or platform managed)
  const platformKey = process.env.ANTHROPIC_API_KEY
  console.log(`[TOKEN-TRACKER] Platform ANTHROPIC_API_KEY exists:`, !!platformKey, `(length: ${platformKey?.length || 0})`)

  let apiKey = platformKey || ''
  if (!isAdmin && agentId) {
    const { data: agent } = await supabase.from('agents')
      .select('uses_own_ai_keys, anthropic_api_key, anthropic_key_encrypted, anthropic_key_iv, anthropic_key_tag')
      .eq('id', agentId).single()
    console.log(`[TOKEN-TRACKER] Agent ${agentId} uses_own_ai_keys:`, agent?.uses_own_ai_keys)

    if (agent?.uses_own_ai_keys) {
      // Try encrypted key first
      if (agent.anthropic_key_encrypted && agent.anthropic_key_iv && agent.anthropic_key_tag) {
        try {
          const { decryptApiKey } = await import('@/lib/encryption')
          apiKey = decryptApiKey(agent.anthropic_key_encrypted, agent.anthropic_key_iv, agent.anthropic_key_tag)
          console.log(`[TOKEN-TRACKER] Using decrypted agent API key (length: ${apiKey.length})`)
        } catch (e) {
          console.error(`[TOKEN-TRACKER] Failed to decrypt agent key:`, (e as any).message)
        }
      }
      // Fallback to plain key
      if (apiKey === platformKey && agent.anthropic_api_key && !agent.anthropic_api_key.includes('•')) {
        apiKey = agent.anthropic_api_key
        console.log(`[TOKEN-TRACKER] Using plain agent API key (length: ${apiKey.length})`)
      }
    }
  }

  console.log(`[TOKEN-TRACKER] Final API key being used (length: ${apiKey.length}), starts with: ${apiKey.substring(0, 10)}...`)

  // 2.5. Check for active fine-tuned model (for sophia_whatsapp calls)
  let activeModel = model
  if (feature === 'sophia_whatsapp') {
    try {
      const { data: ftJob } = await supabase.from('fine_tuning_jobs').select('provider_model_id').eq('is_active', true).eq('status', 'succeeded').single()
      if (ftJob?.provider_model_id) activeModel = ftJob.provider_model_id
    } catch {}
  }

  // 3. Call Claude
  const body: any = { model: activeModel, max_tokens: maxTokens, messages }
  if (system) body.system = system

  console.log(`[TOKEN-TRACKER] 📤 Calling Anthropic API (model: ${activeModel}, feature: ${feature})`)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    console.error(`[AI] ❌ Claude API Error ${res.status} for agent ${agentId}:`, err.substring(0, 400))
    console.error(`[AI] Model: ${activeModel} | Messages: ${messages.length} | System length: ${system?.length || 0}`)
    return { text: '', inputTokens: 0, outputTokens: 0, cost: 0 }
  }

  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  const inputTokens = data.usage?.input_tokens || 0
  const outputTokens = data.usage?.output_tokens || 0
  const cost = (inputTokens * 0.0000008) + (outputTokens * 0.000004)

  console.log(`[TOKEN-TRACKER] 📥 Claude Response:`, {
    hasText: !!text,
    textLength: text.length,
    preview: text.substring(0, 80),
    inputTokens,
    outputTokens
  })

  // 4. Log usage and increment tokens (non-admin only)
  if (!isAdmin && agentId) {
    // Increment tokens_used
    const { data: agent } = await supabase.from('agents').select('tokens_used').eq('id', agentId).single()
    await supabase.from('agents').update({ tokens_used: (agent?.tokens_used || 0) + 1 }).eq('id', agentId)

    // Log detailed usage
    await supabase.from('token_usage').insert({
      agent_id: agentId, account_id: accountId, lead_id: leadId,
      tokens_input: inputTokens, tokens_output: outputTokens, cost_usd: cost,
      conversation_type: feature,
    })

    // Record in rate limiter counters
    try {
      const { recordTokensUsed } = await import('@/lib/rate-limiter')
      await recordTokensUsed(agentId, inputTokens + outputTokens)
    } catch {}

    // Anomaly detection (async, don't block response)
    import('@/lib/anomaly-detector').then(m => m.checkForAnomaly(agentId)).catch(() => {})
  }

  return { text, inputTokens, outputTokens, cost }
}

/**
 * Block an agent's AI when tokens depleted
 */
export async function blockAgentAI(agentId: string, reason: 'tokens_depleted' | 'payment_failed' | 'security') {
  await supabase.from('agents').update({ ai_blocked: true, ai_blocked_reason: reason, ai_blocked_at: new Date().toISOString() }).eq('id', agentId)
  await supabase.from('tenant_security_events').insert({ agent_id: agentId, event_type: 'ai_blocked', details: { reason } })

  // Notify agent via WhatsApp
  const { data: agent } = await supabase.from('agents').select('phone, name').eq('id', agentId).single()
  if (agent?.phone) {
    const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
    const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
    const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM
    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      const cleanPhone = agent.phone.startsWith('+') ? agent.phone : `+1${agent.phone.replace(/\D/g, '')}`
      const msgs: Record<string, string> = {
        tokens_depleted: `⚠️ *Tus tokens de IA se agotaron*\n\nSophia pauso sus respuestas automaticas.\nTu CRM sigue funcionando — puedes ver leads y conversaciones.\n\n💳 Recarga en: luxury-shield-crm.vercel.app/packages`,
        payment_failed: `⚠️ *Problema con tu pago*\n\nNo pudimos procesar el cobro. Sophia esta pausada.\n\n💳 Actualiza tu metodo de pago en: luxury-shield-crm.vercel.app/packages`,
        security: `⚠️ Tu cuenta fue pausada por seguridad. Contacta soporte.`,
      }
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST', headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanPhone}`, Body: msgs[reason] || msgs.tokens_depleted }).toString(),
      })
    }
  }
}

/**
 * Unblock AI when tokens are recharged
 */
export async function unblockAgentAI(agentId: string) {
  await supabase.from('agents').update({ ai_blocked: false, ai_blocked_reason: null, ai_blocked_at: null }).eq('id', agentId)
}

/**
 * Get token stats for dashboard
 */
export async function getTokenStats(agentId: string) {
  const { data: agent } = await supabase.from('agents')
    .select('tokens_used, tokens_limit, tokens_extra, tokens_reset_at, subscription_plan')
    .eq('id', agentId).single()

  if (!agent) return null

  const used = agent.tokens_used || 0
  const limit = agent.tokens_limit || 0
  const extra = agent.tokens_extra || 0
  const remaining = Math.max(0, limit + extra - used)
  const percentage = limit > 0 ? Math.round((used / (limit + extra)) * 100) : 0

  // Get cost this month
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
  const { data: usage } = await supabase.from('token_usage')
    .select('cost_usd').eq('agent_id', agentId)
    .gte('created_at', monthStart.toISOString())

  const costThisMonth = (usage || []).reduce((s, u) => s + (u.cost_usd || 0), 0)

  return { used, limit, extra, remaining, percentage, costThisMonth, plan: agent.subscription_plan, resetAt: agent.tokens_reset_at }
}
