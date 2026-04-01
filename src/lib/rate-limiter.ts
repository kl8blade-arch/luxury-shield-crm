import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export interface RateLimitResult {
  allowed: boolean
  reason?: 'message_rate' | 'token_rate' | 'daily_cap' | 'trial_cap' | 'security_blocked' | 'trial_expired' | 'no_balance'
  retryAfterSeconds?: number
}

const ADMIN_ID = 'ee0389f9-6506-4a48-a6f0-6281ade670b9'

export async function checkRateLimit(agentId: string, estimatedTokens: number = 1000): Promise<RateLimitResult> {
  // Admin always allowed
  if (agentId === ADMIN_ID) return { allowed: true }

  const { data: agent } = await supabase.from('agents')
    .select('subscription_plan, role, status, paid, trial_ends_at, security_blocked, blocked_reason, tokens_used, tokens_limit, tokens_extra')
    .eq('id', agentId).single()

  if (!agent) return { allowed: false, reason: 'security_blocked' }
  if (agent.role === 'admin') return { allowed: true }
  if (agent.security_blocked) return { allowed: false, reason: 'security_blocked' }
  if (agent.status !== 'active' && agent.status !== 'verified') return { allowed: false, reason: 'security_blocked' }

  // Trial expired check
  if (!agent.paid && agent.trial_ends_at && new Date() > new Date(agent.trial_ends_at)) {
    return { allowed: false, reason: 'trial_expired' }
  }

  // Token balance check
  const remaining = (agent.tokens_limit || 0) + (agent.tokens_extra || 0) - (agent.tokens_used || 0)
  if (remaining <= 0) return { allowed: false, reason: 'no_balance' }

  // Get rate limits for this plan
  const plan = agent.subscription_plan || (agent.paid ? 'starter' : 'free')
  const { data: limits } = await supabase.from('token_rate_limits').select('*').eq('plan_name', plan).single()

  if (!limits) return { allowed: true } // No limits defined = allow

  const now = new Date()
  const minuteWindow = new Date(Math.floor(now.getTime() / 60000) * 60000)
  const hourWindow = new Date(Math.floor(now.getTime() / 3600000) * 3600000)
  const dayWindow = new Date(now.toISOString().split('T')[0])

  // Messages per minute
  if (limits.messages_per_minute) {
    const { data: mc } = await supabase.from('rate_limit_counters')
      .select('message_count').eq('agent_id', agentId).eq('window_type', 'minute').eq('window_start', minuteWindow.toISOString()).single()
    if ((mc?.message_count || 0) >= limits.messages_per_minute) {
      return { allowed: false, reason: 'message_rate', retryAfterSeconds: 60 - now.getSeconds() }
    }
  }

  // Tokens per hour
  if (limits.tokens_per_hour) {
    const { data: hc } = await supabase.from('rate_limit_counters')
      .select('token_count').eq('agent_id', agentId).eq('window_type', 'hour').eq('window_start', hourWindow.toISOString()).single()
    if ((hc?.token_count || 0) + estimatedTokens > limits.tokens_per_hour) {
      return { allowed: false, reason: 'token_rate', retryAfterSeconds: 3600 - (now.getMinutes() * 60 + now.getSeconds()) }
    }
  }

  // Daily hard cap
  if (limits.daily_hard_cap) {
    const { data: dc } = await supabase.from('rate_limit_counters')
      .select('token_count').eq('agent_id', agentId).eq('window_type', 'day').eq('window_start', dayWindow.toISOString()).single()
    if ((dc?.token_count || 0) + estimatedTokens > limits.daily_hard_cap) {
      return { allowed: false, reason: 'daily_cap' }
    }
  }

  // All good — increment message counter
  await supabase.rpc('increment_rate_counter', { p_agent_id: agentId, p_window_type: 'minute', p_window_start: minuteWindow.toISOString() })

  return { allowed: true }
}

export async function recordTokensUsed(agentId: string, tokensUsed: number) {
  if (agentId === ADMIN_ID) return
  const now = new Date()
  const hourWindow = new Date(Math.floor(now.getTime() / 3600000) * 3600000)
  const dayWindow = new Date(now.toISOString().split('T')[0])

  await Promise.all([
    supabase.rpc('add_tokens_to_counter', { p_agent_id: agentId, p_window_type: 'hour', p_window_start: hourWindow.toISOString(), p_tokens: tokensUsed }),
    supabase.rpc('add_tokens_to_counter', { p_agent_id: agentId, p_window_type: 'day', p_window_start: dayWindow.toISOString(), p_tokens: tokensUsed }),
  ])
}
