import { SupabaseClient } from '@supabase/supabase-js'

export async function extractTrainingData(supabase: SupabaseClient, leadId: string) {
  try {
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
    if (!lead) return null

    const { data: convs } = await supabase.from('conversations').select('*').eq('lead_id', leadId).order('created_at', { ascending: true })
    if (!convs || convs.length < 6) return null

    const conversation = convs
      .filter(c => c.message && c.message.length > 2)
      .map(c => ({
        role: c.direction === 'inbound' ? 'user' as const : 'assistant' as const,
        content: c.message.replace(/\[LISTO_PARA_COMPRAR\]/g, '').replace(/\*\*/g, '').trim(),
      }))

    const msgText = convs.map(c => (c.message || '').toLowerCase()).join(' ')
    const objections: string[] = []
    if (msgText.match(/caro|precio|cuesta|costo/)) objections.push('precio')
    if (msgText.match(/pensarlo|después|luego/)) objections.push('tiempo')
    if (msgText.match(/no sé|no se|duda/)) objections.push('duda')
    if (msgText.match(/estafa|desconfian|colombia/)) objections.push('desconfianza')

    const closingMsg = convs.find(c =>
      c.direction === 'inbound' && (
        /ya mismo|quiero|llamen|llámame|consígueme|actív/i.test(c.message || '') ||
        /\d{10}/.test(c.message || '')
      )
    )

    let qualityScore = 0
    if (lead.resultado_final === 'vendido') qualityScore += 40
    if (conversation.length >= 10) qualityScore += 20
    if (objections.length > 0) qualityScore += 20
    if (closingMsg) qualityScore += 20

    const leadProfile = {
      state: lead.state || 'FL',
      family: lead.quiz_coverage_type || (lead.dependents ? `familia_${lead.dependents}` : 'desconocido'),
      last_dentist: lead.quiz_dentist_last_visit || 'desconocido',
      has_insurance: lead.has_insurance === true,
      language: lead.preferred_language || 'es',
      lead_temperature: lead.score || 50,
    }

    const lastTwo = conversation.slice(-2)
    const trainingPrompt = `Eres Sophia, asesora de Luxury Shield Insurance.\nPerfil: ${JSON.stringify(leadProfile)}\n${conversation.slice(0, -1).map(m => `${m.role === 'user' ? 'Lead' : 'Sophia'}: ${m.content}`).join('\n')}\nÚltimo mensaje del lead: ${lastTwo[0]?.content || ''}`
    const trainingCompletion = lastTwo[1]?.content || conversation[conversation.length - 1]?.content || ''

    const { data: saved } = await supabase.from('sophia_training_data').insert({
      source: 'real',
      quality_score: qualityScore,
      approved: qualityScore >= 60,
      lead_profile: leadProfile,
      conversation,
      outcome: lead.resultado_final || 'sin_resultado',
      turns_to_close: Math.round(conversation.length / 2),
      objections_handled: objections,
      closing_trigger: closingMsg?.message || null,
      training_prompt: trainingPrompt,
      training_completion: trainingCompletion,
      lead_id: leadId,
    }).select().single()

    console.log(`[TRAINING] Extracted from ${lead.name}: score ${qualityScore}, ${conversation.length} msgs`)
    return saved
  } catch (err) {
    console.error('[TRAINING] Error:', err)
    return null
  }
}
