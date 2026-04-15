// lib/reactivation.ts
// Sophia v3 — Secuencias de reactivación 14 días / 5 toques
// ⚠️  NUNCA Opus aquí. Solo Haiku en procesos automáticos.

import { SupabaseClient } from '@supabase/supabase-js'

export type ReactivationProduct =
  | 'dental' | 'aca' | 'iul' | 'medicare'
  | 'vida' | 'gastos_finales' | 'general'

export type ReactivationStatus =
  | 'active' | 'paused' | 'completed' | 'cancelled' | 'converted'

export interface ReactivationSequence {
  id: string
  account_id: string
  lead_id: string
  product: ReactivationProduct
  status: ReactivationStatus
  current_touch: number
  next_touch: number
  next_send_at: string
  touch_1_sent_at?: string | null
  touch_2_sent_at?: string | null
  touch_3_sent_at?: string | null
  touch_4_sent_at?: string | null
  touch_5_sent_at?: string | null
  last_response_at?: string | null
  started_at: string
}

export interface ReactivationLead {
  id: string
  name: string
  phone: string
  account_id: string
  conversation_mode?: string
  reactivation_product?: ReactivationProduct
  reactivation_opt_out?: boolean
  stage?: string
}

export const TOUCH_SCHEDULE: Record<number, number> = {
  1: 1, 2: 3, 3: 6, 4: 10, 5: 14,
}

const STOP_KEYWORDS = [
  'stop', 'para', 'parar', 'detener', 'cancelar', 'basta',
  'no me escribas', 'no quiero', 'eliminar', 'borrar',
  'unsubscribe', 'salir',
]

export function isStopKeyword(message: string): boolean {
  const n = message.toLowerCase().trim()
  return STOP_KEYWORDS.some(kw => n.includes(kw))
}

export function detectProduct(message: string): ReactivationProduct | null {
  const m = message.toLowerCase()
  if (m.includes('dental') || m.includes('diente') || m.includes('muela') || m.includes('cigna')) return 'dental'
  if (m.includes('aca') || m.includes('marketplace') || m.includes('obamacare') || m.includes('médico') || m.includes('salud')) return 'aca'
  if (m.includes('iul') || m.includes('indexad') || m.includes('acumular') || m.includes('retiro')) return 'iul'
  if (m.includes('medicare') || m.includes('parte a') || m.includes('parte b') || m.includes('advantage')) return 'medicare'
  if (m.includes('funeral') || m.includes('gastos finales') || m.includes('entierro') || m.includes('fallec')) return 'gastos_finales'
  if (m.includes('vida') || m.includes('beneficiario') || m.includes('term') || m.includes('whole life')) return 'vida'
  return null
}

export function buildReactivationMessage(
  touch: number,
  product: ReactivationProduct,
  leadName: string
): string {
  const name = leadName?.split(' ')[0] || 'amigo/a'

  const msgs: Record<number, Partial<Record<ReactivationProduct | 'default', string>>> = {
    1: {
      dental:         `Hola ${name} 👋 Sophia de SeguriSSimo. ¿Pudiste pensar en lo que hablamos sobre tu cobertura dental? Aquí estoy si tienes alguna pregunta.`,
      aca:            `Hola ${name} 👋 Sophia de SeguriSSimo. ¿Pudiste pensar en lo que hablamos sobre el seguro médico? Aquí estoy cuando tengas un momento.`,
      iul:            `Hola ${name} 👋 Sophia de SeguriSSimo. ¿Pudiste pensar en lo que hablamos sobre proteger a tu familia? Sin presión — aquí estoy.`,
      medicare:       `Hola ${name} 👋 Sophia de SeguriSSimo. ¿Pudiste pensar en lo que hablamos sobre tu Medicare? Aquí estoy si tienes alguna duda.`,
      vida:           `Hola ${name} 👋 Sophia de SeguriSSimo. ¿Pudiste pensar en lo que hablamos sobre el seguro de vida? Aquí estoy cuando quieras.`,
      gastos_finales: `Hola ${name} 👋 Sophia de SeguriSSimo. ¿Pudiste pensar en lo que hablamos? Sin apuro — aquí estoy cuando tengas un momento.`,
      default:        `Hola ${name} 👋 Sophia de SeguriSSimo. ¿Pudiste pensar en lo que hablamos? Aquí estoy si tienes alguna pregunta.`,
    },
    2: {
      dental:         `${name}, un dato que quería compartirte: una extracción de emergencia sin seguro cuesta entre $300 y $600 aquí.\n\nCon el plan de Cigna DVH Plus eso quedaría cubierto desde el primer mes. 😊\n\n¿Quieres que te diga el precio exacto para tu edad?`,
      aca:            `${name}, hay algo que quizás no te dije claramente: dependiendo de tus ingresos, el gobierno puede cubrir *toda* tu prima de seguro médico.\n\nHay familias que tienen cobertura completa a $0/mes. ¿Quieres saber si tú calificas?`,
      iul:            `${name}, una cosa que no mencioné antes: el IUL te permite sacar dinero en vida — para emergencias, retiro o la universidad de tus hijos — sin penalidades.\n\nNo es solo para cuando falleces. Es un instrumento financiero completo. ¿Te cuento más?`,
      medicare:       `${name}, algo importante: si cumples 65 en los próximos 3 meses, tu ventana de inscripción sin penalidad ya está corriendo.\n\nFuera de ese período, los cambios se complican. ¿Tienes un momento esta semana?`,
      vida:           `${name}, un dato: $500,000 de cobertura de vida por 20 años puede costar menos de $30/mes si eres joven y saludable.\n\nLa mayoría lo sobreestima 3-4 veces. ¿Quieres saber el número real para tu caso?`,
      gastos_finales: `${name}, un dato que mucha gente no sabe: el costo promedio de un funeral en USA es $11,000.\n\nSin planificación, eso cae sobre la familia en el peor momento. Los planes de gastos finales empiezan desde $30-40/mes. ¿Quieres saber más?`,
      default:        `${name}, quería compartirte algo: hay opciones de cobertura que la mayoría de personas no sabe que existen, a veces a un costo mucho menor del que imaginan.\n\n¿Me dices qué es lo que más te preocupa de tu salud o la de tu familia?`,
    },
    3: {
      dental:         `${name}, te cuento algo que pasó la semana pasada.\n\nUna señora me escribió igual que tú, pensando que el seguro dental era muy caro. Lina revisó su caso y resultó en $28/mes con cobertura dental, visión y audición.\n\nA veces la información cambia todo. ¿Quieres que Lina revise el tuyo?`,
      aca:            `${name}, te cuento algo real.\n\nUn señor trabajador independiente, igual que tú, pensaba que no calificaba para nada. Lina revisó su caso y tenía seguro médico a $0/mes con el subsidio del gobierno.\n\n¿Quieres que Lina calcule el tuyo? Son 5 minutos.`,
      iul:            `${name}, algo que me contó un cliente la semana pasada.\n\nLlevaba años mandando remesas a su familia en México sin saber que si algo le pasaba, ese flujo de dinero paraba de golpe. Ahora tiene un IUL con beneficiarios en México.\n\n¿Quieres que Lina te muestre cómo funciona?`,
      medicare:       `${name}, algo que escucho seguido.\n\nMuchas personas con Medicare solo Parte A y B pagan el 20% de todo sin límite. Una hospitalización puede costar miles de su bolsillo.\n\nLina ha ayudado a cientos de personas a cerrar ese gap, gratis. ¿Cuándo tienes 15 minutos?`,
      vida:           `${name}, te cuento algo.\n\nUna familia que atendimos el mes pasado: el papá murió sin seguro de vida. La mamá tuvo que vender el carro para pagar el funeral y los primeros meses de renta.\n\nNadie debería pasar por eso. ¿Quieres que Lina te muestre cuánto costaría proteger a tu familia?`,
      gastos_finales: `${name}, algo que escucho muy seguido.\n\nFamilias que pensaban que sus padres "ya estaban mayores para asegurarse" — hasta que pasó algo y tuvieron que juntar $9,000 en 3 días para el entierro.\n\nHay planes que aceptan hasta los 85 años. ¿Quieres saber si aplica para tu familiar?`,
      default:        `${name}, algo que me pasa seguido: personas que dicen "lo pienso" y después me escriben "¿sigue disponible?" — y sí, sigue, pero los períodos cambian.\n\n¿Hay algo específico que todavía no te quedó claro?`,
    },
    4: {
      dental:         `${name}, una pregunta directa si me permites.\n\n¿Hay algo que te esté deteniendo que yo no haya podido aclarar? A veces es el precio, a veces una duda sobre cobertura, a veces simplemente el tiempo.\n\nSin compromiso — solo quiero asegurarme de que tienes toda la información.`,
      aca:            `${name}, te pregunto directamente: ¿hay alguna razón específica por la que no has avanzado?\n\nA veces es el tema migratorio, a veces el proceso parece complicado. Cuéntame y veo cómo ayudarte.`,
      iul:            `${name}, pregunta directa: ¿es el precio lo que te detiene, o hay algo más?\n\nSi es el precio, hay opciones más básicas que protegen lo esencial a menor costo. Si es otra cosa, cuéntame.`,
      medicare:       `${name}, el Open Enrollment de Medicare cierra el 7 de diciembre.\n\nDespués de esa fecha, los cambios se limitan hasta el próximo año. Si quieres revisar tu plan, el momento es ahora. ¿Hablamos esta semana?`,
      vida:           `${name}, una pregunta directa: ¿si algo te pasara mañana, tu familia podría cubrir los gastos del primer año sin tu ingreso?\n\nNo para asustarte — sino para tener el contexto correcto. ¿Cuál es tu situación?`,
      gastos_finales: `${name}, ¿hay algo que te esté deteniendo para tomar una decisión?\n\nA veces es el precio, a veces la duda de si califica por edad o condición. Cuéntame y te digo qué opciones hay.`,
      default:        `${name}, oye — pregunta directa.\n\n¿Hay algo que todavía no te haya quedado claro sobre tus opciones de seguro? A veces hay una duda pequeña que hace toda la diferencia. Sin compromiso.`,
    },
    5: {
      dental:         `Hola ${name}, este es mi último mensaje para no molestarte más. 😊\n\nSi en algún momento quieres revisar tus opciones de seguro dental, aquí voy a estar.\n\nCuídate mucho.`,
      aca:            `Hola ${name}, este es mi último mensaje.\n\nSi en algún momento quieres saber si calificas para seguro médico con subsidio del gobierno, aquí estaré. Cuídate mucho. 😊`,
      iul:            `Hola ${name}, último mensaje de mi parte.\n\nSi algún día quieres explorar cómo proteger a tu familia y acumular para tu retiro, aquí voy a estar. Cuídate mucho. 😊`,
      medicare:       `Hola ${name}, este es mi último mensaje.\n\nSi en algún momento quieres revisar tus opciones de Medicare — gratis, sin compromiso — aquí estoy. Cuídate mucho. 😊`,
      vida:           `Hola ${name}, último mensaje de mi parte.\n\nSi en algún momento quieres explorar opciones de seguro de vida para proteger a los tuyos, aquí voy a estar. Cuídate mucho. 😊`,
      gastos_finales: `Hola ${name}, último mensaje de mi parte.\n\nSi en algún momento quieres explorar opciones para que tu familia no tenga que preocuparse por gastos de final de vida, aquí estoy. Cuídate mucho. 😊`,
      default:        `Hola ${name}, este es mi último mensaje para no molestarte más. Si en algún momento quieres explorar tus opciones de seguro, aquí voy a estar. Cuídate mucho. 😊`,
    },
  }

  const t = msgs[touch]
  if (!t) return msgs[1].default!
  return t[product] ?? t.default ?? msgs[1].default!
}

export function calcNextSendAt(touchNumber: number, startedAt: Date): Date {
  const days = TOUCH_SCHEDULE[touchNumber] ?? 14
  const next = new Date(startedAt)
  next.setDate(next.getDate() + days)
  next.setUTCHours(15, 0, 0, 0) // 10 AM EST
  return next
}

export async function startReactivationSequence(
  supabase: SupabaseClient,
  leadId: string,
  accountId: string,
  product: ReactivationProduct
): Promise<{ ok: boolean; sequenceId?: string; error?: string }> {
  try {
    await supabase
      .from('reactivation_sequences')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: 'new_sequence_started',
      })
      .eq('lead_id', leadId)
      .eq('status', 'active')

    const startedAt = new Date()
    const { data, error } = await supabase
      .from('reactivation_sequences')
      .insert({
        account_id: accountId,
        lead_id: leadId,
        product,
        status: 'active',
        current_touch: 0,
        next_touch: 1,
        next_send_at: calcNextSendAt(1, startedAt).toISOString(),
        started_at: startedAt.toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error
    return { ok: true, sequenceId: data.id }
  } catch (err) {
    console.error('[reactivation] startSequence error:', err)
    return { ok: false, error: String(err) }
  }
}

export async function pauseReactivationSequence(
  supabase: SupabaseClient,
  leadId: string,
  reason: 'lead_responded' | 'manual_mode' | 'stop_keyword' | 'converted' | 'admin' = 'lead_responded'
): Promise<void> {
  const isFinal = ['stop_keyword', 'converted', 'admin'].includes(reason)
  await supabase
    .from('reactivation_sequences')
    .update({
      status: isFinal ? 'cancelled' : 'paused',
      last_response_at: new Date().toISOString(),
      ...(isFinal ? { cancelled_at: new Date().toISOString(), cancel_reason: reason } : {}),
    })
    .eq('lead_id', leadId)
    .eq('status', 'active')
}

export async function markSequenceConverted(
  supabase: SupabaseClient,
  leadId: string
): Promise<void> {
  await supabase
    .from('reactivation_sequences')
    .update({ status: 'converted', completed_at: new Date().toISOString(), cancel_reason: 'converted' })
    .eq('lead_id', leadId)
    .in('status', ['active', 'paused'])
}

export async function completeReactivationSequence(
  supabase: SupabaseClient,
  sequenceId: string
): Promise<void> {
  await supabase
    .from('reactivation_sequences')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sequenceId)
}
