// SophiaOS Orchestrator v2 — con capa de seguridad completa
// Reglas: no cross-tenant, no prompt injection, audit log, rate limit de sub-agentes

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface ExpertAgent {
  id: string
  name: string
  system_prompt: string
  trigger_keywords: string[]
  knowledge_sources: any[]
}

// ── Patrones de prompt injection hardcodeados como fallback ──
const INJECTION_PATTERNS_FALLBACK = [
  'ignore previous instructions', 'ignore all previous', 'disregard your instructions',
  'you are now', 'act as if', 'pretend you are', 'forget everything', 'new instructions:',
  'ignora las instrucciones', 'olvida todo', 'ahora eres', 'actúa como',
  'nuevas instrucciones', 'system prompt:', 'jailbreak', 'dan mode',
]

// ── Cargar config de seguridad del tenant (o global) ──
async function getSecurityConfig(accountId?: string | null) {
  // Intentar config específica del tenant primero
  if (accountId) {
    const { data } = await supabase
      .from('sophia_security_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()
    if (data) return data
  }
  // Fallback a config global
  const { data } = await supabase
    .from('sophia_security_config')
    .select('*')
    .is('account_id', null)
    .maybeSingle()
  return data
}

// ── Detección de prompt injection ──
export function detectPromptInjection(
  message: string,
  injectionPatterns?: string[]
): { detected: boolean; pattern: string | null } {
  const msgLower = message.toLowerCase().trim()
  const patterns = injectionPatterns?.length ? injectionPatterns : INJECTION_PATTERNS_FALLBACK

  for (const pattern of patterns) {
    if (msgLower.includes(pattern.toLowerCase())) {
      return { detected: true, pattern }
    }
  }
  return { detected: false, pattern: null }
}

// ── Sanitizar mensaje antes de enviarlo a Claude ──
export function sanitizeLeadMessage(message: string): string {
  // Truncar a 1000 chars — un lead real no escribe más
  let safe = message.slice(0, 1000)
  // Remover caracteres de control que podrían manipular el prompt
  safe = safe.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return safe
}

// ── Registrar acción en audit log ──
async function logAction(params: {
  accountId?: string | null
  agentId?: string | null
  leadId?: string | null
  leadPhone?: string | null
  actionType: string
  subAgentName?: string | null
  skillName?: string | null
  triggerText?: string | null
  blocked?: boolean
  blockReason?: string | null
  sessionActionCount?: number
  tokensUsed?: number
}) {
  try {
    await supabase.from('sophia_action_log').insert({
      account_id: params.accountId || null,
      agent_id: params.agentId || null,
      lead_id: params.leadId || null,
      lead_phone: params.leadPhone || null,
      action_type: params.actionType,
      sub_agent_name: params.subAgentName || null,
      skill_name: params.skillName || null,
      trigger_text: params.triggerText?.slice(0, 200) || null,
      blocked: params.blocked || false,
      block_reason: params.blockReason || null,
      session_action_count: params.sessionActionCount || 1,
      tokens_used: params.tokensUsed || 0,
    })
  } catch (e) {
    // Log errors are non-blocking — never break the main flow
    console.error('[AUDIT] Log insert failed (non-blocking):', e)
  }
}

// ── Contar switches de sub-agente en esta sesión ──
async function getSessionSwitchCount(leadId: string): Promise<number> {
  try {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString() // última 30 min
    const { count } = await supabase
      .from('sophia_action_log')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('action_type', 'routed_to_expert')
      .eq('blocked', false)
      .gte('created_at', since)
    return count || 0
  } catch {
    return 0
  }
}

// ══════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL — routeToExpert
// Sophia decide a qué sub-agente delegar (silenciosamente)
// ══════════════════════════════════════════════════════════
export async function routeToExpert(
  message: string,
  leadContext: any,
  accountId?: string | null
): Promise<ExpertAgent | null> {

  const leadId = leadContext?.id || null
  const agentId = leadContext?.agent_id || null

  // ── SEGURIDAD 1: detectar prompt injection ANTES de cualquier lógica ──
  const securityConfig = await getSecurityConfig(accountId)
  const injectionCheck = detectPromptInjection(
    message,
    securityConfig?.injection_patterns
  )

  if (injectionCheck.detected) {
    console.warn(`[SECURITY] 🚨 Prompt injection detectado: "${injectionCheck.pattern}" en mensaje de lead ${leadId}`)
    await logAction({
      accountId, agentId, leadId,
      leadPhone: leadContext?.phone,
      actionType: 'prompt_injection_blocked',
      triggerText: message.slice(0, 200),
      blocked: true,
      blockReason: `Patrón detectado: "${injectionCheck.pattern}"`,
    })
    // Devolver null — Sophia maneja el mensaje con su prompt normal, sin inyección
    return null
  }

  // ── SEGURIDAD 2: límite de switches de sub-agente por sesión ──
  const maxSwitches = securityConfig?.max_sub_agent_switches ?? 5
  if (leadId) {
    const switchCount = await getSessionSwitchCount(leadId)
    if (switchCount >= maxSwitches) {
      console.log(`[SECURITY] Session switch limit reached for lead ${leadId}: ${switchCount}/${maxSwitches}`)
      await logAction({
        accountId, agentId, leadId,
        actionType: 'session_limit_hit',
        triggerText: message.slice(0, 200),
        blocked: true,
        blockReason: `Límite de ${maxSwitches} switches de sub-agente alcanzado`,
        sessionActionCount: switchCount,
      })
      return null
    }
  }

  // ── SEGURIDAD 3: solo cargar agentes del mismo tenant (nunca cross-tenant) ──
  const msgLower = message.toLowerCase()

  // Cargar SOLO agentes del account correcto o del master (account_id NULL)
  let query = supabase
    .from('sophia_agents')
    .select('*')
    .eq('active', true)
    .or(`agent_type.eq.product_expert,agent_type.eq.sales_specialist`)

  if (accountId) {
    // Agentes del tenant O agentes globales (account_id null)
    query = query.or(`account_id.eq.${accountId},account_id.is.null`)
  } else {
    // Sin account_id: solo agentes globales
    query = query.is('account_id', null)
  }

  const { data: agents } = await query

  if (!agents || agents.length === 0) return null

  // ── Scoring: keyword match + contexto del lead ──
  let bestAgent: any = null
  let bestScore = 0

  for (const agent of agents) {
    const keywords: string[] = agent.trigger_keywords || []
    let score = 0

    for (const kw of keywords) {
      if (msgLower.includes(kw.toLowerCase())) score += 1
    }

    // Boost si el insurance_type del lead coincide con este agente
    if (leadContext?.insurance_type) {
      const type = leadContext.insurance_type.toLowerCase()
      if (
        agent.name.toLowerCase().includes(type) ||
        keywords.some((k: string) => type.includes(k.toLowerCase()))
      ) score += 3
    }

    // Boost al AgenteCierre si el lead tiene score alto o está en etapa avanzada
    if (
      agent.name === 'AgenteCierre' &&
      (leadContext?.score >= 70 || ['presentando', 'objecion', 'listo_comprar'].includes(leadContext?.stage))
    ) score += 2

    // Boost al AgenteCitas si el lead ya mostró interés en llamada
    if (
      agent.name === 'AgenteCitas' &&
      leadContext?.ready_to_buy === true
    ) score += 4

    if (score > bestScore) {
      bestScore = score
      bestAgent = agent
    }
  }

  // Solo enrutar si hay match claro (score >= 1)
  if (bestScore < 1 || !bestAgent) return null

  // ── Cargar conocimiento adicional del agente ──
  let extraKnowledge = ''
  try {
    const { data: sources } = await supabase
      .from('sophia_training_sources')
      .select('extracted_knowledge')
      .eq('agent_id', bestAgent.id)
      .eq('processed', true)
      .not('extracted_knowledge', 'is', null)
    extraKnowledge = sources?.map((s: any) => s.extracted_knowledge).join('\n') || ''
  } catch {}

  // ── AUDIT: registrar el enrutamiento ──
  await logAction({
    accountId,
    agentId,
    leadId,
    leadPhone: leadContext?.phone,
    actionType: 'routed_to_expert',
    subAgentName: bestAgent.name,
    triggerText: message.slice(0, 200),
    blocked: false,
  })

  console.log(`[ORCHESTRATOR] ✅ Routed to ${bestAgent.name} (score: ${bestScore}) for "${message.slice(0, 50)}"`)

  return {
    id: bestAgent.id,
    name: bestAgent.name,
    system_prompt: bestAgent.system_prompt + (extraKnowledge ? `\n\nCONOCIMIENTO ADICIONAL:\n${extraKnowledge}` : ''),
    trigger_keywords: bestAgent.trigger_keywords || [],
    knowledge_sources: bestAgent.knowledge_sources || [],
  }
}

// ── Build del prompt orquestado — Sophia como cerebro, experto como conocimiento ──
export function buildOrchestratedPrompt(sophiaBasePrompt: string, expert: ExpertAgent | null): string {
  if (!expert) return sophiaBasePrompt

  return `${sophiaBasePrompt}

═══ MÓDULO ACTIVO: ${expert.name} ═══
INSTRUCCIÓN INTERNA (no mencionar al lead):
Tienes acceso al conocimiento especializado de ${expert.name}.
Usa su expertise para responder con precisión.
NUNCA menciones que cambiaste de modo, agente, o especialista.
NUNCA menciones "protocolo", "módulo", ni "sistema".
Simplemente responde con la profundidad y calidez de siempre.

CONOCIMIENTO ESPECIALIZADO:
${expert.system_prompt}
═══════════════════════════════════════`
}

// ── Función pública para validar si Sophia puede crear un agente ──
// (Sophia nunca puede — siempre requiere admin)
export async function canSophiaCreateAgent(accountId?: string | null): Promise<boolean> {
  const config = await getSecurityConfig(accountId)
  const allowed = config?.can_create_agents === true
  if (!allowed) {
    await logAction({
      accountId,
      actionType: 'agent_created_request',
      blocked: true,
      blockReason: 'Sophia no tiene permiso para crear agentes — requiere aprobación de admin',
    })
  }
  return allowed
}

// ── Verificar que Sophia no intente acceder a otro tenant ──
export function validateTenantBoundary(
  requestedAccountId: string | null,
  actualAccountId: string | null
): boolean {
  if (!requestedAccountId) return true // acceso a recursos globales OK
  if (!actualAccountId) return false   // sin account_id no puede acceder a recursos de tenant
  return requestedAccountId === actualAccountId
}
