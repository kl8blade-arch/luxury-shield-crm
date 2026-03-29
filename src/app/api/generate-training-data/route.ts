import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const PROFILES = [
  { state: 'FL', family: 'pareja', last_dentist: '2_años', has_insurance: false, language: 'es', scenario: 'precio' },
  { state: 'FL', family: 'familia_5', last_dentist: '1_año', has_insurance: false, language: 'spanglish', scenario: 'desconfianza' },
  { state: 'TX', family: 'individual', last_dentist: 'nunca', has_insurance: false, language: 'es', scenario: 'cierre_rapido' },
  { state: 'FL', family: 'pareja', last_dentist: '6_meses', has_insurance: true, language: 'es', scenario: 'comparacion' },
  { state: 'CA', family: 'familia_3', last_dentist: '2_años', has_insurance: false, language: 'en', scenario: 'precio' },
  { state: 'FL', family: 'individual', last_dentist: 'nunca', has_insurance: false, language: 'es', scenario: 'desconfianza_colombia' },
  { state: 'GA', family: 'familia_5', last_dentist: '1_año', has_insurance: false, language: 'spanglish', scenario: 'cierre_rapido' },
  { state: 'FL', family: 'pareja', last_dentist: '2_años', has_insurance: false, language: 'es', scenario: 'objecion_tiempo' },
  { state: 'TX', family: 'familia_3', last_dentist: '2_años', has_insurance: false, language: 'es', scenario: 'precio' },
  { state: 'NC', family: 'individual', last_dentist: '1_año', has_insurance: true, language: 'es', scenario: 'comparacion' },
]

export async function POST(req: NextRequest) {
  try {
    const { count = 10 } = await req.json()
    const total = Math.min(count, 50)
    const generated: any[] = []

    for (let i = 0; i < total; i++) {
      const profile = PROFILES[i % PROFILES.length]

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{ role: 'user', content: `Genera una conversación REALISTA de WhatsApp entre Sophia (asesora de seguros dentales Luxury Shield) y un lead latino en USA.

PERFIL: Estado:${profile.state} Familia:${profile.family} Dentista:${profile.last_dentist} Seguro:${profile.has_insurance} Idioma:${profile.language} Escenario:${profile.scenario}

ESCENARIOS: precio=objeta costo, desconfianza=pregunta si es estafa, cierre_rapido=listo msg 3, comparacion=tiene seguro quiere comparar, desconfianza_colombia=colombiano desconfía, objecion_tiempo=lo va a pensar

REGLAS: 8-16 msgs total. Lead CIERRA al final. Sophia NUNCA repite preguntas. Msgs del lead cortos y naturales. Sophia max 3-4 líneas. Usa "plan de protección" no "seguro". Color de seguridad al inicio.

PRODUCTO: Cigna DVH Plus. Sin espera día 1. Pareja FL:$65-80/mes. Individual:$35-45/mes. Familia 5:$120-150/mes. $280 beneficios→$0. $200 visión/2años. Emisión garantizada 18-89.

Devuelve SOLO JSON: {"lead_name":"nombre latino","conversation":[{"role":"assistant","content":"..."},{"role":"user","content":"..."}],"closing_trigger":"frase cierre","objections_handled":["lista"],"turns_to_close":number}` }],
        }),
      })

      if (!res.ok) { console.error(`[SYNTHETIC] API error ${res.status}`); continue }

      const d = await res.json()
      const text = d.content?.[0]?.text || ''

      try {
        const clean = text.replace(/```json\n?|\n?```/g, '').trim()
        const data = JSON.parse(clean)

        const qualityScore = 50 + (data.conversation?.length >= 10 ? 15 : 0) + ((data.objections_handled?.length || 0) > 0 ? 20 : 0) + (data.closing_trigger ? 15 : 0)

        const history = (data.conversation || []).slice(0, -1)
        const trainingPrompt = `Eres Sophia, asesora de Luxury Shield Insurance.\nPerfil: ${JSON.stringify(profile)}\n${history.map((m: any) => `${m.role === 'user' ? 'Lead' : 'Sophia'}: ${m.content}`).join('\n')}\nÚltimo: ${(data.conversation || []).slice(-2, -1)[0]?.content || ''}`
        const trainingCompletion = (data.conversation || []).slice(-1)[0]?.content || ''

        const { data: saved } = await supabase.from('sophia_training_data').insert({
          source: 'synthetic', quality_score: qualityScore, approved: true,
          lead_profile: { ...profile },
          conversation: data.conversation,
          outcome: 'cerrado', turns_to_close: data.turns_to_close || Math.round((data.conversation?.length || 8) / 2),
          objections_handled: data.objections_handled || [],
          closing_trigger: data.closing_trigger || null,
          training_prompt: trainingPrompt, training_completion: trainingCompletion,
        }).select().single()

        if (saved) generated.push(saved)
        console.log(`[SYNTHETIC] ${i + 1}/${total}: ${data.lead_name} — score ${qualityScore}`)
      } catch (e) { console.error(`[SYNTHETIC] Parse error at ${i}:`, e) }

      if (i < total - 1) await new Promise(r => setTimeout(r, 300))
    }

    const avgScore = generated.length > 0 ? Math.round(generated.reduce((s, g) => s + (g.quality_score || 0), 0) / generated.length) : 0

    return NextResponse.json({ generated: generated.length, requested: total, avg_quality_score: avgScore })
  } catch (error: any) {
    console.error('Generate training error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
