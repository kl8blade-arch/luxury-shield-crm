import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function generateMessage(prompt: string): Promise<string> {
  try {
    const { callAI } = await import('@/lib/token-tracker')
    const result = await callAI({ feature: 'other', model: 'claude-haiku-4-5-20251001', maxTokens: 200, messages: [{ role: 'user', content: prompt }] })
    return result.text || ''
  } catch { return '' }
}

export async function POST(req: NextRequest) {
  try {
    const { lead_id, motivo_perdida, lead_phone, lead_name, estado, familia } = await req.json()

    if (!lead_id || !lead_phone) {
      return NextResponse.json({ error: 'lead_id and lead_phone required' }, { status: 400 })
    }

    const name = lead_name || 'amigo/a'
    const motivo = motivo_perdida || 'no especificado'
    const now = Date.now()

    // Generate 3 rescue messages
    const msg1 = await generateMessage(
      `Eres Sophia de Luxury Shield. El lead ${name} en ${estado || 'FL'} rechazó activar el plan. Motivo: ${motivo}. Escribe un mensaje de WhatsApp de máximo 4 líneas que: NO mencione que rechazó ni que hubo una llamada. Use ángulo emocional: familia, salud, estética dental. Incluya UNA pregunta abierta al final. Tono cálido, sin presión. NO uses 'seguro', usa 'plan de protección'. Responde SOLO el mensaje.`
    )

    const msg2 = await generateMessage(
      `Eres Sophia. Han pasado 7 días desde que ${name} consideró el plan DVH en ${estado || 'FL'} para ${familia || 'su familia'}. Escribe un mensaje de WhatsApp de máximo 4 líneas que: Calcule cuánto dinero perdió esa semana sin cobertura (limpieza=$100, evaluación=$95, radiografías=$85). Use pérdida concreta: 'Esta semana, sin el plan...' Una sola pregunta: si algo cambió en su situación. Tono de amiga que recuerda, no vendedora. Responde SOLO el mensaje.`
    )

    const msg3 = await generateMessage(
      `Eres Sophia. Han pasado 30 días. ${name} en ${estado || 'FL'} nunca activó. Motivo original: ${motivo}. Escribe un mensaje completamente diferente que: Abra con algo nuevo (un dato, cambio de precios, noticia dental). Mencione que HAY opciones nuevas en ${estado || 'FL'}. Invite a conversación sin compromiso. Máximo 3 líneas + pregunta. Tono: como si no hubiera pasado nada. Responde SOLO el mensaje.`
    )

    const day1 = new Date(now + 24 * 60 * 60 * 1000).toISOString()
    const day7 = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString()
    const day30 = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Save 3 scheduled messages
    const reminders = [
      { lead_id, lead_phone, message_text: msg1 || `Hola ${name} 😊 Solo quería saber cómo estás. ¿Tuviste oportunidad de pensar en lo de tu cobertura dental?`, scheduled_for: day1, type: 'rescue_sequence', sequence_step: 1, status: 'pending' },
      { lead_id, lead_phone, message_text: msg2 || `${name}, esta semana una limpieza sin cobertura cuesta $100. Con el plan DVH, estaría cubierta. ¿Cambió algo en tu situación?`, scheduled_for: day7, type: 'rescue_sequence', sequence_step: 2, status: 'pending' },
      { lead_id, lead_phone, message_text: msg3 || `Hola ${name}! Hay nuevas opciones disponibles en ${estado || 'tu estado'}. ¿Te gustaría saber más?`, scheduled_for: day30, type: 'rescue_sequence', sequence_step: 3, status: 'pending' },
    ]

    const { error } = await supabase.from('reminders').insert(reminders)
    if (error) console.error('Rescue sequence insert error:', error)

    console.log(`[Rescue] Scheduled 3 messages for ${name} (${lead_phone})`)
    return NextResponse.json({ success: true, messages_scheduled: 3 })

  } catch (error: any) {
    console.error('Rescue sequence error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
