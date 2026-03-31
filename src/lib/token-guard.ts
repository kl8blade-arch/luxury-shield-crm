import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const PLAN_TOKEN_LIMITS: Record<string, number> = {
  free: 0, starter: 300, professional: 1000, agency: 3000, enterprise: 10000,
}

export const TOKEN_PACKAGES = [
  { id: 'tokens_100', name: '100 Tokens', tokens: 100, price: 15, perToken: '0.15' },
  { id: 'tokens_500', name: '500 Tokens', tokens: 500, price: 59, perToken: '0.12', badge: 'Popular' },
  { id: 'tokens_1000', name: '1,000 Tokens', tokens: 1000, price: 99, perToken: '0.10', badge: 'Mejor valor' },
  { id: 'tokens_3000', name: '3,000 Tokens', tokens: 3000, price: 249, perToken: '0.08' },
]

/**
 * Check if agent has tokens available. Auto-resets monthly.
 */
export async function checkTokens(agentId: string): Promise<{ allowed: boolean; used: number; limit: number; extra: number; remaining: number }> {
  const { data: agent } = await supabase.from('agents')
    .select('tokens_used, tokens_limit, tokens_extra, tokens_reset_at, role, subscription_plan')
    .eq('id', agentId).single()

  if (!agent) return { allowed: false, used: 0, limit: 0, extra: 0, remaining: 0 }

  // Admin always allowed
  if (agent.role === 'admin') return { allowed: true, used: agent.tokens_used || 0, limit: 999999, extra: 0, remaining: 999999 }

  // Monthly reset check
  const resetAt = new Date(agent.tokens_reset_at || 0)
  const now = new Date()
  if (resetAt.getMonth() !== now.getMonth() || resetAt.getFullYear() !== now.getFullYear()) {
    await supabase.from('agents').update({
      tokens_used: 0, tokens_extra: 0, tokens_reset_at: now.toISOString(),
    }).eq('id', agentId)
    return { allowed: true, used: 0, limit: agent.tokens_limit || 300, extra: 0, remaining: (agent.tokens_limit || 300) }
  }

  const used = agent.tokens_used || 0
  const limit = agent.tokens_limit || PLAN_TOKEN_LIMITS[agent.subscription_plan || 'free'] || 0
  const extra = agent.tokens_extra || 0
  const remaining = (limit + extra) - used

  return { allowed: remaining > 0, used, limit, extra, remaining }
}

/**
 * Consume a token after successful AI response
 */
export async function consumeToken(
  agentId: string, leadId: string | null, leadPhone: string,
  inputTokens: number, outputTokens: number, accountId?: string | null,
) {
  const cost = (inputTokens * 0.0000008) + (outputTokens * 0.000004)

  // Increment tokens_used
  const { data: agent } = await supabase.from('agents').select('tokens_used').eq('id', agentId).single()
  await supabase.from('agents').update({ tokens_used: (agent?.tokens_used || 0) + 1 }).eq('id', agentId)

  // Log usage
  await supabase.from('token_usage').insert({
    agent_id: agentId, account_id: accountId, lead_id: leadId, lead_phone: leadPhone,
    tokens_input: inputTokens, tokens_output: outputTokens, cost_usd: cost,
  })
}
