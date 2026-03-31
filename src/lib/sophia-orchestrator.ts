import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export interface ExpertAgent {
  id: string
  name: string
  system_prompt: string
  trigger_keywords: string[]
  knowledge_sources: any[]
}

// Sophia analyzes the message and decides which expert should handle it
export async function routeToExpert(message: string, leadContext: any, accountId?: string | null): Promise<ExpertAgent | null> {
  const msgLower = message.toLowerCase()

  // Get active agents for this specific account (or master if no account)
  let q = supabase.from('sophia_agents').select('*').eq('active', true).eq('agent_type', 'product_expert')
  if (accountId) {
    q = q.eq('account_id', accountId)
  } else {
    q = q.is('account_id', null)
  }
  const { data: agents } = await q

  if (!agents || agents.length === 0) return null

  // Score each agent by keyword matches
  let bestAgent: any = null
  let bestScore = 0

  for (const agent of agents) {
    const keywords = agent.trigger_keywords || []
    let score = 0
    for (const kw of keywords) {
      if (msgLower.includes(kw.toLowerCase())) score += 1
    }
    // Boost if lead's insurance_type matches
    if (leadContext?.insurance_type) {
      const type = leadContext.insurance_type.toLowerCase()
      if (agent.name.toLowerCase().includes(type) || keywords.some((k: string) => type.includes(k))) score += 3
    }
    if (score > bestScore) {
      bestScore = score
      bestAgent = agent
    }
  }

  // Only route if there's a clear match (score >= 1)
  if (bestScore >= 1 && bestAgent) {
    // Load any additional knowledge sources for this agent
    const { data: sources } = await supabase
      .from('sophia_training_sources')
      .select('extracted_knowledge')
      .eq('agent_id', bestAgent.id)
      .eq('processed', true)
      .not('extracted_knowledge', 'is', null)

    const extraKnowledge = sources?.map(s => s.extracted_knowledge).join('\n') || ''

    return {
      id: bestAgent.id,
      name: bestAgent.name,
      system_prompt: bestAgent.system_prompt + (extraKnowledge ? `\n\nCONOCIMIENTO ADICIONAL:\n${extraKnowledge}` : ''),
      trigger_keywords: bestAgent.trigger_keywords || [],
      knowledge_sources: bestAgent.knowledge_sources || [],
    }
  }

  return null // Sophia handles it herself
}

// Build the orchestrated prompt — Sophia as brain, expert as knowledge
export function buildOrchestratedPrompt(sophiaBasePrompt: string, expert: ExpertAgent | null): string {
  if (!expert) return sophiaBasePrompt

  return `${sophiaBasePrompt}

═══ AGENTE ESPECIALISTA ACTIVO: ${expert.name} ═══
Sophia, para esta conversación tienes acceso al conocimiento de ${expert.name}.
Usa su expertise para dar respuestas precisas sobre este producto.
NO menciones que eres un "agente especializado" — siempre eres Sophia.
Simplemente responde con la profundidad y precisión de un experto en este tema.

CONOCIMIENTO DEL ESPECIALISTA:
${expert.system_prompt}
═══════════════════════════════════════════════`
}
