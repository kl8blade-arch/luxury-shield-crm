import { SupabaseClient } from '@supabase/supabase-js'

/*
  SQL:
  CREATE TABLE IF NOT EXISTS sophia_learnings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES leads(id),
    argumentos_ganadores jsonb DEFAULT '[]',
    objeciones_superadas jsonb DEFAULT '[]',
    fase_de_cierre integer,
    perfil_lead jsonb DEFAULT '{}',
    frase_clave text,
    resultado text DEFAULT 'vendido',
    created_at timestamptz DEFAULT now()
  );
*/

export async function learnFromClosedDeal(
  supabase: SupabaseClient,
  leadId: string,
  anthropicKey: string
): Promise<void> {
  try {
    const { data: messages } = await supabase
      .from('conversations')
      .select('direction, message')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .limit(20)

    if (!messages || messages.length < 4) return

    const convoText = messages.map((m: any) =>
      `${m.direction === 'inbound' ? 'Lead' : 'Sophia'}: ${m.message}`
    ).join('\n')

    const { callAI } = await import('@/lib/token-tracker')
    const result = await callAI({
      feature: 'other', model: 'claude-haiku-4-5-20251001', maxTokens: 400,
      system: `Analiza esta conversacion ganada. Devuelve SOLO JSON: {"argumentos_ganadores":[],"objeciones_superadas":[{"objecion":"","respuesta":""}],"fase_de_cierre":0,"perfil_lead":{},"frase_clave":""}`,
      messages: [{ role: 'user', content: convoText }],
    })

    if (!result.text) return

    const text = result.text
    let learning: any
    try {
      learning = JSON.parse(text.replace(/```json?\n?|\n?```/g, '').trim())
    } catch { return }

    await supabase.from('sophia_learnings').insert({
      lead_id: leadId,
      argumentos_ganadores: learning.argumentos_ganadores || [],
      objeciones_superadas: learning.objeciones_superadas || [],
      fase_de_cierre: learning.fase_de_cierre,
      perfil_lead: learning.perfil_lead || {},
      frase_clave: learning.frase_clave,
      resultado: 'vendido',
    })

    console.log(`[Learning] Saved insights from lead ${leadId}`)
  } catch (err) {
    console.error('[Learning] Error:', err)
  }
}

export async function getRelevantLearnings(
  supabase: SupabaseClient,
  leadState: string | null
): Promise<string> {
  try {
    let query = supabase
      .from('sophia_learnings')
      .select('argumentos_ganadores, objeciones_superadas, frase_clave, perfil_lead')
      .eq('resultado', 'vendido')
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: learnings } = await query
    if (!learnings || learnings.length === 0) return ''

    const lines: string[] = ['PATRONES GANADORES (aprendidos de cierres reales):']

    for (const l of learnings) {
      const profile = l.perfil_lead as any
      const args = l.argumentos_ganadores as string[]
      const objs = l.objeciones_superadas as any[]

      if (args?.length > 0) {
        lines.push(`- Argumento efectivo: "${args[0]}"`)
      }
      if (objs?.length > 0) {
        lines.push(`- Objeción "${objs[0].objecion}" → se superó con: "${objs[0].respuesta}"`)
      }
      if (l.frase_clave) {
        lines.push(`- Frase que cerró: "${l.frase_clave}"`)
      }
    }

    return lines.length > 1 ? '\n' + lines.join('\n') : ''
  } catch {
    return ''
  }
}
