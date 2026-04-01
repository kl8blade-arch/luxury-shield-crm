import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type TokenFeature = 'sophia_whatsapp' | 'coach_realtime' | 'training_generation' | 'audio_transcription' | 'master_command' | 'landing_builder' | 'other'

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

  // 1. Rate limiting + token check (non-admin only)
  if (!isAdmin && agentId) {
    try {
      const { checkRateLimit } = await import('@/lib/rate-limiter')
      const rateResult = await checkRateLimit(agentId, 1000)
      if (!rateResult.allowed) {
        console.log(`[AI] Rate limited: agent=${agentId} reason=${rateResult.reason}`)
        return { text: '', inputTokens: 0, outputTokens: 0, cost: 0 }
      }
    } catch (e: any) { console.error('[RATE-LIMIT]', e.message) }
  }

  // 2. Get API key (agent's own encrypted key → decrypt, or platform managed)
  let apiKey = process.env.ANTHROPIC_API_KEY!
  if (!isAdmin && agentId) {
    const { data: agent } = await supabase.from('agents')
      .select('uses_own_ai_keys, anthropic_api_key, anthropic_key_encrypted, anthropic_key_iv, anthropic_key_tag')
      .eq('id', agentId).single()
    if (agent?.uses_own_ai_keys) {
      // Try encrypted key first
      if (agent.anthropic_key_encrypted && agent.anthropic_key_iv && agent.anthropic_key_tag) {
        try {
          const { decryptApiKey } = await import('@/lib/encryption')
          apiKey = decryptApiKey(agent.anthropic_key_encrypted, agent.anthropic_key_iv, agent.anthropic_key_tag)
        } catch { /* fallback to plain */ }
      }
      // Fallback to plain key
      if (apiKey === process.env.ANTHROPIC_API_KEY && agent.anthropic_api_key && !agent.anthropic_api_key.includes('•')) {
        apiKey = agent.anthropic_api_key
      }
    }
  }

  // 3. Call Claude
  const body: any = { model, max_tokens: maxTokens, messages }
  if (system) body.system = system

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    console.error(`[AI] Error ${res.status}:`, err.substring(0, 200))
    return { text: '', inputTokens: 0, outputTokens: 0, cost: 0 }
  }

  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  const inputTokens = data.usage?.input_tokens || 0
  const outputTokens = data.usage?.output_tokens || 0
  const cost = (inputTokens * 0.0000008) + (outputTokens * 0.000004)

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
