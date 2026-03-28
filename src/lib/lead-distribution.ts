import { SupabaseClient } from '@supabase/supabase-js'

/*
  SQL — ejecutar en Supabase:
  ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'elite',
  ADD COLUMN IF NOT EXISTS available boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS monthly_lead_limit integer,
  ADD COLUMN IF NOT EXISTS leads_this_month integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_lead_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_number text;
*/

const PLAN_CONFIG: Record<string, { monthly_limit: number | null; weight: number; voice: boolean }> = {
  starter:      { monthly_limit: 10,   weight: 1, voice: false },
  basic:        { monthly_limit: 25,   weight: 2, voice: false },
  professional: { monthly_limit: 60,   weight: 3, voice: false },
  elite:        { monthly_limit: null,  weight: 4, voice: true },
  unlimited:    { monthly_limit: null,  weight: 4, voice: true },
}

export async function assignLeadToAgent(supabase: SupabaseClient): Promise<{ agentId: string; agentName: string } | null> {
  // 1. Get active available agents
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .eq('available', true)
    .eq('status', 'active')

  if (!agents || agents.length === 0) {
    return await getCarlos(supabase)
  }

  // 2. Filter by monthly limit
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const eligible: (typeof agents[0] & { weight: number })[] = []
  for (const agent of agents) {
    const plan = PLAN_CONFIG[agent.plan] || PLAN_CONFIG.starter

    if (plan.monthly_limit !== null) {
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agent.id)
        .gte('created_at', monthStart)

      if ((count || 0) >= plan.monthly_limit) continue
    }

    eligible.push({ ...agent, weight: plan.weight })
  }

  if (eligible.length === 0) return await getCarlos(supabase)

  // 3. Weighted round-robin: score = leads_today / weight (lower is better)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let bestAgent = eligible[0]
  let bestScore = Infinity

  for (const agent of eligible) {
    const { count: todayCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agent.id)
      .gte('created_at', todayStart.toISOString())

    const score = (todayCount || 0) / agent.weight
    if (score < bestScore) {
      bestScore = score
      bestAgent = agent
    }
  }

  // 4. Update last_lead_assigned_at
  await supabase
    .from('agents')
    .update({ last_lead_assigned_at: new Date().toISOString() })
    .eq('id', bestAgent.id)

  return { agentId: bestAgent.id, agentName: bestAgent.name }
}

async function getCarlos(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('agents')
    .select('id, name')
    .eq('role', 'admin')
    .single()
  return data ? { agentId: data.id, agentName: data.name } : null
}
