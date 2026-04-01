import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { INSURANCE_KNOWLEDGE } from '@/lib/knowledge-base'

/*
  SQL:
  CREATE TABLE IF NOT EXISTS coaching_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES leads(id),
    trigger_message text,
    suggested_response text,
    objection_detected jsonb,
    relevant_facts text,
    heat_score integer,
    close_signal boolean,
    created_at timestamptz DEFAULT now()
  );
*/

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function callClaude(system: string, userMsg: string): Promise<string> {
  const { callAI } = await import('@/lib/token-tracker')
  const result = await callAI({
    feature: 'coach_realtime', model: 'claude-haiku-4-5-20251001', maxTokens: 400,
    system, messages: [{ role: 'user', content: userMsg }],
  })
  return result.text || ''
}

export async function POST(req: NextRequest) {
  try {
    const { lead_id, last_message, conversation_history, lead_context } = await req.json()
    if (!lead_id || !last_message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const convoText = (conversation_history || []).slice(-10).map((m: any) =>
      `${m.direction === 'inbound' ? 'Lead' : 'Agente'}: ${m.message}`
    ).join('\n') + `\nLead: ${last_message}`

    const ctx = lead_context || {}
    const contextLine = `Lead: ${ctx.name || '?'} en ${ctx.state || '?'}, ${ctx.family || '?'}, color: ${ctx.color || 'no tiene'}`

    // 4 parallel AI agents
    const [suggestedRes, objectionRes, factsRes, heatRes] = await Promise.all([
      // Agent 1: Response coach
      callClaude(
        `Eres un coach de ventas de seguros. Sugiere la respuesta perfecta para el próximo mensaje del agente. Máximo 3 líneas, natural, en español. No uses 'seguro', usa 'plan de protección'. Devuelve SOLO el mensaje, sin explicación.\n\nContexto: ${contextLine}`,
        convoText
      ),
      // Agent 2: Objection detector
      callClaude(
        `Detecta objeciones en el último mensaje del lead. Devuelve SOLO JSON: {"tiene_objecion":boolean,"tipo":"precio"|"tiempo"|"duda"|"rechazo"|"otro"|null,"objecion_exacta":string|null,"respuesta_sugerida":string|null}`,
        `Último mensaje del lead: "${last_message}"\n\nHistorial:\n${convoText}`
      ),
      // Agent 3: Data researcher
      callClaude(
        `Eres experto en Cigna DVH Plus para el mercado latino en USA. Conoces:\n${INSURANCE_KNOWLEDGE}\n\nProvee 1-2 datos específicos y relevantes que el agente puede usar AHORA. Bullet points cortos, máximo 2.\n\nContexto: ${contextLine}`,
        convoText
      ),
      // Agent 4: Close thermometer
      callClaude(
        `Analiza la conversación y devuelve SOLO JSON: {"score":number(0-100),"fase":"frio"|"tibio"|"caliente"|"listo_para_cerrar","momento_cierre":boolean,"razon":"máximo 15 palabras"}`,
        convoText
      ),
    ])

    // Parse JSON responses
    let objection: any = { tiene_objecion: false }
    try { objection = JSON.parse(objectionRes.replace(/```json?\n?|\n?```/g, '').trim()) } catch {}

    let heat: any = { score: 50, fase: 'tibio', momento_cierre: false, razon: '' }
    try { heat = JSON.parse(heatRes.replace(/```json?\n?|\n?```/g, '').trim()) } catch {}

    // Save coaching session
    await supabase.from('coaching_sessions').insert({
      lead_id,
      trigger_message: last_message,
      suggested_response: suggestedRes,
      objection_detected: objection,
      relevant_facts: factsRes,
      heat_score: heat.score,
      close_signal: heat.momento_cierre,
    })

    return NextResponse.json({
      suggested_response: suggestedRes,
      objection: objection,
      facts: factsRes,
      heat: heat,
    })
  } catch (error: any) {
    console.error('Coaching error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
