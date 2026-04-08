import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// In-memory cache for rate limit checks (5 minute TTL)
const rateLimitCache = new Map<string, { data: any; expiry: number }>()
const CACHE_TTL = 5 * 60 * 1000

export interface RateLimitResult {
  allowed: boolean
  reason?: 'message_rate' | 'token_rate' | 'daily_cap' | 'trial_cap' | 'security_blocked' | 'trial_expired' | 'no_balance'
  retryAfterSeconds?: number
}

const ADMIN_ID = 'ee0389f9-6506-4a48-a6f0-6281ade670b9'

function getCachedAgent(agentId: string) {
  const cached = rateLimitCache.get(agentId)
  if (cached && cached.expiry > Date.now()) return cached.data
  return null
}

function setCachedAgent(agentId: string, data: any) {
  rateLimitCache.set(agentId, { data, expiry: Date.now() + CACHE_TTL })
}

export async function checkRateLimit(agentId: string, estimatedTokens: number = 1000): Promise<RateLimitResult> {
  // Admin always allowed
  if (agentId === ADMIN_ID) return { allowed: true }

  // Check cache first
  let agent = getCachedAgent(agentId)
  if (!agent) {
    const { data } = await supabase.from('agents')
      .select('subscription_plan, role, status, paid, trial_ends_at, security_blocked, blocked_reason, tokens_used, tokens_limit, tokens_extra')
      .eq('id', agentId).single()
    agent = data
    if (agent) setCachedAgent(agentId, agent)
  }

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

  // Get rate limits for this plan (with cache)
  const plan = agent.subscription_plan || (agent.paid ? 'starter' : 'free')
  let limitsCache = rateLimitCache.get(`limits_${plan}`)
  let limits

  if (limitsCache && limitsCache.expiry > Date.now()) {
    limits = limitsCache.data
  } else {
    const { data } = await supabase.from('token_rate_limits').select('*').eq('plan_name', plan).single()
    limits = data
    if (limits) rateLimitCache.set(`limits_${plan}`, { data: limits, expiry: Date.now() + CACHE_TTL })
  }

  if (!limits) return { allowed: true } // No limits defined = allow

  // Fast path: use cached counters from agent.tokens_used instead of querying counters table
  // This reduces queries from 4 to 1 per check
  const tokenBalance = (agent.tokens_limit || 0) + (agent.tokens_extra || 0) - (agent.tokens_used || 0)
  if (tokenBalance < estimatedTokens) {
    return { allowed: false, reason: 'token_rate', retryAfterSeconds: 3600 }
  }

  // For message rate, use approximate tracking (query only on actual sends)
  const now = new Date()
  const minuteWindow = new Date(Math.floor(now.getTime() / 60000) * 60000)

  if (limits.messages_per_minute) {
    // Check counter with optimized query
    const { count } = await supabase.from('rate_limit_counters')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('window_type', 'minute')
      .eq('window_start', minuteWindow.toISOString())

    if ((count || 0) >= limits.messages_per_minute) {
      return { allowed: false, reason: 'message_rate', retryAfterSeconds: 60 - now.getSeconds() }
    }
  }

  // All good — increment message counter (non-blocking, fire and forget)
  void supabase.rpc('increment_rate_counter', {
    p_agent_id: agentId,
    p_window_type: 'minute',
    p_window_start: minuteWindow.toISOString()
  })

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
