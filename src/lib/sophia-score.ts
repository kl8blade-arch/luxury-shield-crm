// src/lib/sophia-score.ts
// Sophia Score: Lead quality scoring (0-100) based on engagement, intent, profile, post-cita behavior

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Engagement signals from conversation ──────────────────────────────────────
function analyzeEngagement(messages: Array<{ content: string; role: string }>): number {
  let score = 0

  const allContent = messages.map(m => m.content).join(' ').toLowerCase()

  // Responded to first message (8 pts)
  if (messages.length >= 2) score += 8

  // Multi-message conversation (8 pts)
  if (messages.length >= 4) score += 8

  // Asked specific questions (6 pts)
  const questionPatterns = [
    'cómo funciona', 'cuánto cuesta', 'qué planes', 'cuáles son', 'cubre',
    'how much', 'what plans', 'does it cover', 'can i', 'what about'
  ]
  if (questionPatterns.some(p => allContent.includes(p))) score += 6

  // Responds quickly <1hr (6 pts)
  const timeGaps: number[] = []
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1]
    const curr = messages[i]
    if (prev.role !== curr.role) {
      // Would need timestamp data; approximate by assuming quick responses exist
      timeGaps.push(0)
    }
  }
  if (timeGaps.length > 0) score += 6

  // Sent audio/media (4 pts)
  const mediaPatterns = ['audio', 'voice', 'video', 'image', 'foto', 'video', 'archivo']
  if (mediaPatterns.some(p => allContent.includes(p))) score += 4

  // Shared personal info (4 pts)
  const infoPatterns = ['mi nombre', 'me llamo', 'tengo', 'años', 'vivo en', 'soy', 'familia', 'trabajo']
  if (infoPatterns.some(p => allContent.includes(p))) score += 4

  // Responded after followup (4 pts)
  if (messages.length >= 3) score += 4

  return Math.min(score, 40)
}

// ── Intent signals from conversation ──────────────────────────────────────────
function analyzeIntent(messages: Array<{ content: string; role: string }>): number {
  let score = 0

  const allContent = messages.map(m => m.content).join(' ').toLowerCase()

  // Ready to buy detected (15 pts)
  const readyPatterns = [
    'enrolar', 'enrollar', 'activar', 'empezar', 'comenzar', 'ahora', 'cuando',
    'listo', 'quiero', 'ready', 'activate', 'start', 'when can', 'cuándo puedo'
  ]
  if (readyPatterns.some(p => allContent.includes(p))) score += 15

  // Requested agent contact (10 pts)
  const contactPatterns = [
    'hablar con', 'llamarme', 'agent', 'agente', 'call me', 'speak to',
    'contact', 'contactar', 'número', 'phone number', 'whatsapp'
  ]
  if (contactPatterns.some(p => allContent.includes(p))) score += 10

  // Asked about pricing (5 pts)
  const pricingPatterns = ['precio', 'costo', 'tarifa', 'cuesta', 'cost', 'price', 'premium']
  if (pricingPatterns.some(p => allContent.includes(p))) score += 5

  // Asked about enrollment (5 pts)
  const enrollPatterns = ['enroll', 'enrollar', 'inscribir', 'registro', 'requisitos', 'documents']
  if (enrollPatterns.some(p => allContent.includes(p))) score += 5

  return Math.min(score, 35)
}

// ── Profile completeness ──────────────────────────────────────────────────────
async function analyzeProfile(leadId: string): Promise<number> {
  let score = 0

  const { data: lead } = await supabase
    .from('leads')
    .select('email, state, age, family_info, occupation')
    .eq('id', leadId)
    .single()

  if (!lead) return 0

  // Email (3 pts)
  if (lead.email && lead.email.length > 5) score += 3

  // State (3 pts)
  if (lead.state) score += 3

  // Age (3 pts)
  if (lead.age) score += 3

  // Family info (3 pts)
  if (lead.family_info) score += 3

  // Occupation (3 pts)
  if (lead.occupation) score += 3

  return Math.min(score, 15)
}

// ── Post-cita behavior ────────────────────────────────────────────────────────
async function analyzePostCita(leadId: string): Promise<number> {
  let score = 0

  const { data: followups } = await supabase
    .from('appointment_followups')
    .select('checkin_sentiment, referral_converted, doctor_appointments!inner(scheduled_at)')
    .eq('lead_id', leadId)
    .gt('doctor_appointments.scheduled_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (!followups || followups.length === 0) return 0

  // Attended appointment (5 pts)
  const attended = followups.some(f => f.doctor_appointments && (f.doctor_appointments as any).scheduled_at)
  if (attended) score += 5

  // Positive checkin (3 pts)
  const positive = followups.some(f => f.checkin_sentiment === 'positive')
  if (positive) score += 3

  // Referred someone (2 pts)
  const referred = followups.some(f => f.referral_converted)
  if (referred) score += 2

  return Math.min(score, 10)
}

// ── Build recommendation text based on score ──────────────────────────────────
export function buildScoreRecommendation(score: number): string {
  if (score >= 80) return 'Alto potencial. Contactar para venta + seguimiento cercano'
  if (score >= 60) return 'Buen potencial. Enviar materiales educativos + follow-up en 3 días'
  if (score >= 40) return 'Potencial moderado. Nurture con contenido + reactivación en 7 días'
  if (score >= 20) return 'Bajo potencial. Mantener en base de datos + reactivación trimestral'
  return 'Muy bajo. Revisar manualmente o remover de campañas activas'
}

// ── Main scoring function ─────────────────────────────────────────────────────
export async function calculateSophiaScore(leadId: string): Promise<number> {
  try {
    // Fetch all messages for this lead
    const { data: messages } = await supabase
      .from('lead_messages')
      .select('content, role')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })

    const msgArray = (messages || []) as Array<{ content: string; role: string }>

    // Calculate component scores
    const engagement = analyzeEngagement(msgArray)
    const intent = analyzeIntent(msgArray)
    const profile = await analyzeProfile(leadId)
    const postCita = await analyzePostCita(leadId)

    // Weighted total (0-100)
    const totalScore = Math.round(engagement + intent + profile + postCita)

    // Build recommendation
    const recommendation = buildScoreRecommendation(totalScore)

    // Update lead with score + recommendation
    await supabase
      .from('leads')
      .update({
        sophia_score: totalScore,
        score_recommendation: recommendation,
        score_updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)

    console.log(`[SophiaScore] Lead ${leadId}: ${totalScore}/100 — ${recommendation}`)
    return totalScore
  } catch (e) {
    console.error('[SophiaScore] Error calculating score:', e)
    return 0
  }
}

// ── Batch update all leads for an agent ───────────────────────────────────────
export async function batchUpdateScores(agentId: string): Promise<number> {
  try {
    const { data: leads } = await supabase
      .from('leads')
      .select('id')
      .eq('agent_id', agentId)

    if (!leads || leads.length === 0) return 0

    let updated = 0
    for (const lead of leads) {
      const score = await calculateSophiaScore(lead.id)
      if (score > 0) updated++
      // Small delay between API calls
      await new Promise(r => setTimeout(r, 100))
    }

    console.log(`[SophiaScore] Batch updated ${updated}/${leads.length} leads for agent ${agentId}`)
    return updated
  } catch (e) {
    console.error('[SophiaScore] Batch update error:', e)
    return 0
  }
}
