import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const MIN_MESSAGES = 5
const MIN_QUALITY = 50
const GHOST_DAYS = 3

// PII patterns to strip
const PII = [
  /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /\b[A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,15}\b/g,
  /\d{3}-?\d{2}-?\d{4}/g,
  /\b\d{5}(-\d{4})?\b/g,
  /[A-Z]{2,3}-?\d{6,}/g,
  /\b\d{16}\b/g,
]

function anonymize(text: string): string {
  let clean = text
  PII.forEach(p => { clean = clean.replace(p, '[REDACTED]') })
  if (/\b\d{8,}\b/.test(clean)) clean = '[MENSAJE REDACTADO]'
  return clean
}

function detectLang(text: string): string {
  const es = (text.match(/\b(el|la|los|las|que|de|en|con|por|para|una|un|es)\b/gi) || []).length
  const en = (text.match(/\b(the|is|are|and|for|with|that|this|have|from|you)\b/gi) || []).length
  return es > en ? 'es' : en > es ? 'en' : 'es'
}

function getOutcome(stage: string, updatedAt: string): string | null {
  if (stage === 'closed_won') return 'closed'
  if (stage === 'closed_lost') return 'lost'
  const days = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (days >= GHOST_DAYS) return 'ghost'
  return null
}

export async function processConversation(leadId: string, batchDate: string): Promise<{ extracted: boolean; reason: string }> {
  // Get lead (without PII fields)
  const { data: lead } = await supabase.from('leads')
    .select('id, stage, updated_at, training_excluded, training_processed, insurance_type, account_id')
    .eq('id', leadId).single()

  if (!lead) return { extracted: false, reason: 'not_found' }
  if (lead.training_excluded) return { extracted: false, reason: 'excluded' }
  if (lead.training_processed) return { extracted: false, reason: 'already_done' }

  // Get account industry
  let industry = lead.insurance_type || 'other'
  if (lead.account_id) {
    const { data: acc } = await supabase.from('accounts').select('industry').eq('id', lead.account_id).single()
    if (acc?.industry) industry = acc.industry
  }

  // Get conversations
  const { data: convos } = await supabase.from('conversations')
    .select('direction, message, created_at')
    .eq('lead_id', leadId).order('created_at', { ascending: true })

  if (!convos || convos.length < MIN_MESSAGES) {
    await markProcessed(leadId, 'insufficient')
    return { extracted: false, reason: 'insufficient_messages' }
  }

  const outcome = getOutcome(lead.stage, lead.updated_at)
  if (!outcome) return { extracted: false, reason: 'no_outcome_yet' }

  // Anonymize
  const cleanMsgs = convos.map(c => ({
    role: c.direction === 'outbound' ? 'sophia' : 'lead',
    content: anonymize(c.message || ''),
  }))

  const convoText = cleanMsgs.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')
  const durationHrs = convos.length >= 2
    ? (new Date(convos[convos.length - 1].created_at).getTime() - new Date(convos[0].created_at).getTime()) / 3600000
    : 0

  // Extract pattern with Claude
  try {
    const { callAI } = await import('../token-tracker')
    const result = await callAI({
      feature: 'other',
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 600,
      system: `Analiza esta conversacion de ventas y extrae un patron anonimo. REGLAS: 1.NUNCA incluir datos personales 2.Describir patrones generales y replicables 3.Responder SOLO JSON valido`,
      messages: [{ role: 'user', content: `Industria: ${industry} | Resultado: ${outcome} | Msgs: ${convos.length} | Duracion: ${durationHrs.toFixed(1)}h\n\nCONVERSACION:\n${convoText}\n\nJSON: {"pattern_type":"winning_sequence|losing_sequence|ghost_sequence|objection_handler|opening_hook","pattern_title":"titulo max 200 chars","pattern_summary":"2-3 oraciones","pattern_data":{"trigger":"","what_worked":"","what_failed":"","lesson":""},"quality_score":0-100,"is_useful":true|false}` }],
    })

    if (!result.text) { await markProcessed(leadId, outcome); return { extracted: false, reason: 'empty_response' } }

    let parsed: any
    try { parsed = JSON.parse(result.text.replace(/```json?\n?|\n?```/g, '').trim()) } catch { await markProcessed(leadId, outcome); return { extracted: false, reason: 'parse_error' } }

    if (!parsed.is_useful || (parsed.quality_score || 0) < MIN_QUALITY) {
      await markProcessed(leadId, outcome)
      return { extracted: false, reason: 'low_quality' }
    }

    // Check for similar existing pattern
    const { data: similar } = await supabase.from('collective_patterns')
      .select('id').eq('industry', industry).eq('pattern_type', parsed.pattern_type).eq('outcome', outcome)
      .ilike('pattern_title', `%${(parsed.pattern_title || '').slice(0, 30)}%`).limit(1)

    if (similar && similar.length > 0) {
      await supabase.rpc('increment_pattern_confidence', { p_pattern_id: similar[0].id, p_was_success: outcome === 'closed' })
    } else {
      await supabase.from('collective_patterns').insert({
        industry, language: detectLang(convoText), pattern_type: parsed.pattern_type,
        outcome, pattern_title: parsed.pattern_title, pattern_summary: parsed.pattern_summary,
        pattern_data: parsed.pattern_data, quality_score: parsed.quality_score,
        confidence_score: parsed.quality_score, instance_count: 1,
        success_rate: outcome === 'closed' ? 100 : 0,
      })
    }

    // Create training example
    const lastSophia = [...cleanMsgs].reverse().find(m => m.role === 'sophia')
    const trainingPrompt = JSON.stringify({ system: `Sophia ventas IA para ${industry}`, conversation: cleanMsgs.slice(0, -1) })
    const trainingCompletion = outcome === 'closed'
      ? (lastSophia?.content || '')
      : `[LECCION: ${parsed.pattern_data?.lesson || ''}] Aplicar: ${parsed.pattern_title}`

    if (trainingCompletion.length > 10) {
      await supabase.from('sophia_training_data').insert({
        source_type: 'federated', industry, quality_score: 70, approved: true,
        lead_profile: { industry, outcome, msg_count: convos.length, duration_h: durationHrs },
        conversation: cleanMsgs, outcome: outcome === 'closed' ? 'closed' : outcome === 'lost' ? 'lost' : 'no_response',
        training_prompt: trainingPrompt, training_completion: trainingCompletion,
        batch_date: batchDate,
      })
    }

    await markProcessed(leadId, outcome)
    return { extracted: true, reason: 'success' }

  } catch (err: any) {
    console.error('[PATTERN]', err.message)
    await markProcessed(leadId, outcome)
    return { extracted: false, reason: err.message }
  }
}

async function markProcessed(leadId: string, outcome: string) {
  await supabase.from('leads').update({ training_processed: true, training_processed_at: new Date().toISOString(), training_outcome: outcome }).eq('id', leadId)
}
