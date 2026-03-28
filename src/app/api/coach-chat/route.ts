import { NextRequest, NextResponse } from 'next/server'
import { INSURANCE_KNOWLEDGE } from '@/lib/knowledge-base'

export async function POST(req: NextRequest) {
  try {
    const { question, coach_history, lead_context, conversation_history } = await req.json()
    if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 })

    const ctx = lead_context || {}
    const convSummary = (conversation_history || [])
      .map((m: any) => `${m.direction === 'inbound' ? ctx.name || 'Lead' : 'Sophia'}: ${m.message}`)
      .join('\n')

    const systemPrompt = `Eres un coach experto en ventas de seguros dentales para el mercado latino en USA.

CONTEXTO DEL LEAD:
- Nombre: ${ctx.name || '?'}
- Estado: ${ctx.state || '?'}
- Familia: ${ctx.family || 'desconocido'}
- Última visita dentista: ${ctx.last_dentist || 'desconocido'}
- Tiene seguro: ${ctx.has_insurance || 'no'}
- Color: ${ctx.color || 'no asignado'}
- Score: ${ctx.score || 50}/100
- Stage: ${ctx.stage || '?'}
- Horas sin actividad: ${ctx.hours_inactive || 0}h
- Cross-sell: ${JSON.stringify(ctx.product_opportunities || [])}

CONVERSACIÓN CON EL LEAD:
${convSummary || 'Sin mensajes aún'}

${INSURANCE_KNOWLEDGE}

MISIÓN: Responder preguntas del agente de forma práctica y directa.
- Conoces TODA la conversación con el lead
- Sugiere mensajes exactos entre comillas listos para enviar
- Explica la psicología del lead según su comportamiento
- Da datos específicos del producto
- Detecta momento de cerrar o reconectar
- Máximo 4-5 líneas. Español natural, tono de colega experto.
- NUNCA "seguro" → "plan de protección" o "cobertura"`

    const messages = (coach_history || []).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, system: systemPrompt, messages }),
    })

    if (!res.ok) return NextResponse.json({ response: 'Error al consultar al coach. Intenta de nuevo.' })

    const data = await res.json()
    return NextResponse.json({ response: data.content?.[0]?.text || 'Sin respuesta del coach.' })
  } catch (error: any) {
    console.error('Coach chat error:', error)
    return NextResponse.json({ response: 'Error interno. Intenta de nuevo.' })
  }
}
