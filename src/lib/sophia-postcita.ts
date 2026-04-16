// src/lib/sophia-postcita.ts
// Detecta respuestas de clientes después de una cita médica
// Actualiza el sentiment del followup para decidir si activar el referral orgánico

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Detectar si el mensaje es una respuesta al checkin post-cita
export function isPostCitaResponse(message: string): boolean {
  const signals = [
    'me fue bien','me fue muy bien','estuvo bien','todo bien',
    'me atendieron','me atendió','muy bien','excelente',
    'no me fue','no me gustó','no me atendieron','muy mal',
    'fui al médico','ya fui','ya fui al dentista','ya tuve mi cita',
    'gracias por recordarme','gracias por la cita',
    'el médico me dijo','me dijeron que','me recetaron',
    'me revisaron','me hicieron','me pusieron',
    'fue bien','quedé bien','todo salió bien',
    'i went','it went well','it was good','the doctor',
  ]
  const lower = message.toLowerCase()
  return signals.some(s => lower.includes(s))
}

// Analizar sentiment de la respuesta post-cita
export async function analyzePostCitaSentiment(
  message: string,
  leadId: string
): Promise<'positive' | 'neutral' | 'negative'> {
  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages:   [{
        role:    'user',
        content: `Clasifica el sentimiento de esta respuesta de un paciente después de su cita médica. Responde SOLO con: positive, neutral, o negative.

Mensaje: "${message}"

Responde solo: positive, neutral, o negative`,
      }],
    })
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim().toLowerCase()
    if (text.includes('positive'))  return 'positive'
    if (text.includes('negative'))  return 'negative'
    return 'neutral'
  } catch {
    return 'neutral'
  }
}

// Procesar respuesta del cliente al checkin
export async function handlePostCitaResponse(params: {
  leadId:  string
  message: string
  agentId: string
}): Promise<{ handled: boolean; sentiment?: string; response?: string }> {

  if (!isPostCitaResponse(params.message)) {
    return { handled: false }
  }

  // Buscar followup activo del lead
  const { data: followup } = await supabase
    .from('appointment_followups')
    .select('id, checkin_at, checkin_responded, doctor_appointments!inner(doctor_name, specialty)')
    .eq('lead_id', params.leadId)
    .eq('status', 'active')
    .not('checkin_at', 'is', null)
    .eq('checkin_responded', false)
    .maybeSingle()

  if (!followup) return { handled: false }

  // Analizar sentiment
  const sentiment = await analyzePostCitaSentiment(params.message, params.leadId)

  // Actualizar followup con respuesta
  await supabase.from('appointment_followups').update({
    checkin_responded: true,
    checkin_sentiment: sentiment,
    updated_at:        new Date().toISOString(),
  }).eq('id', followup.id)

  // Generar respuesta de AgentePostCita según el sentiment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appt = (followup as any).doctor_appointments

  let promptContext = ''
  if (sentiment === 'positive') {
    promptContext = `El cliente está muy contento con su cita con ${appt?.doctor_name}. Responde con alegría genuina, celebra que se estén cuidando. Máximo 3 oraciones. Cálido y humano. Sin agenda.`
  } else if (sentiment === 'negative') {
    promptContext = `El cliente no tuvo una buena experiencia con su cita con ${appt?.doctor_name}. Responde con empatía total. Escucha primero. Ofrece ayuda para encontrar otra opción si lo necesitan. Máximo 3 oraciones. No minimices su experiencia.`
  } else {
    promptContext = `El cliente tuvo una experiencia neutral con su cita. Responde de forma cálida y genuina. Pregunta si necesita algo más. Máximo 2 oraciones.`
  }

  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages:   [{ role: 'user', content: promptContext }],
    })
    const response = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
    return { handled: true, sentiment, response }
  } catch {
    const fallbacks = {
      positive: 'Qué alegría saber que todo salió bien 💙 Me alegra mucho que te estés cuidando.',
      negative: 'Ay, lo siento mucho 😔 Cuéntame qué pasó, queremos asegurarnos de que tengas la mejor atención.',
      neutral:  'Gracias por contarme 😊 Aquí estamos para lo que necesites.',
    }
    return { handled: true, sentiment, response: fallbacks[sentiment] }
  }
}

// Activar el followup cuando se crea una cita en doctor_appointments
export async function createFollowupForAppointment(appointmentId: string): Promise<boolean> {
  try {
    const { data: appt } = await supabase
      .from('doctor_appointments')
      .select('id, lead_id, agent_id, account_id, scheduled_at')
      .eq('id', appointmentId)
      .single()

    if (!appt) return false

    // Verificar que no existe ya un followup
    const { data: existing } = await supabase
      .from('appointment_followups')
      .select('id')
      .eq('appointment_id', appointmentId)
      .maybeSingle()

    if (existing) return false

    await supabase.from('appointment_followups').insert({
      appointment_id: appointmentId,
      lead_id:        appt.lead_id,
      agent_id:       appt.agent_id,
      account_id:     appt.account_id,
      status:         'active',
    })

    console.log(`[PostCita] Followup creado para cita ${appointmentId}`)
    return true
  } catch (e) {
    console.error('[PostCita] Error creating followup:', e)
    return false
  }
}
