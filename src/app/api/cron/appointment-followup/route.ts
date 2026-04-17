// src/app/api/cron/appointment-followup/route.ts
// Cron: corre cada hora — Vercel cron schedule: "0 * * * *"
// Maneja el ciclo completo post-cita: recordatorios → checkin → referido orgánico

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase   = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function isAuthorized(req: NextRequest) {
  const auth   = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (req.headers.get('x-vercel-cron') === '1') return true
  if (secret && auth === `Bearer ${secret}`) return true
  if (process.env.NODE_ENV === 'development') return true
  return false
}

async function sendWhatsApp(to: string, body: string, fromNumber?: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken  = process.env.TWILIO_AUTH_TOKEN!
  const from       = fromNumber ?? process.env.TWILIO_WHATSAPP_FROM ?? process.env.TWILIO_PHONE_NUMBER ?? '+17722772510'

  const toFormatted   = `whatsapp:${to.startsWith('+') ? to : '+' + to}`
  const fromFormatted = `whatsapp:${from.startsWith('+') ? from : '+' + from}`

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromFormatted,
        To:   toFormatted,
        Body: body,
      }).toString(),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error(`[sendWhatsApp] Twilio error ${res.status}:`, data)
      return null
    }
    console.log(`[sendWhatsApp] ✅ Sent to ${to} | SID: ${data.sid}`)
    return { sid: data.sid }
  } catch (e: any) {
    console.error('[sendWhatsApp] Fatal error:', e.message)
    return null
  }
}

// Construir link de Google Maps desde dirección
function buildMapsLink(address: string, doctorName: string): string {
  const query = encodeURIComponent(`${doctorName} ${address}`)
  return `https://maps.google.com/?q=${query}`
}

// Generar mensaje con Claude Haiku — personalizado para cada momento
async function generateMessage(params: {
  touchpoint: 'reminder_24h' | 'reminder_2h' | 'checkin' | 'referral' | 'thankyou'
  leadName:   string
  doctorName: string
  specialty:  string
  address:    string
  mapsLink?:  string
  agentName:  string
  agencyName: string
  checkInSentiment?: string
}): Promise<string> {

  const prompts: Record<string, string> = {
    reminder_24h: `Eres parte del equipo de ${params.agencyName}. Escribe un recordatorio de cita para mañana a ${params.leadName}.

CITA: ${params.doctorName} (${params.specialty})
DIRECCIÓN: ${params.address}

TONO: Cálido, como un amigo que se preocupa. No corporativo.
REGLAS:
- Máximo 4 oraciones
- Menciona el nombre del médico
- Di que te alegra que se estén cuidando
- Incluye un emoji de corazón o salud
- NO uses saludos corporativos
- NO prometas cosas que no controlas
- Termina recordando que cualquier duda puede escribirte`,

    reminder_2h: `Eres parte del equipo de ${params.agencyName}. Escribe un recordatorio para ${params.leadName} — su cita es en 2 horas.

MÉDICO: ${params.doctorName}
LINK MAPS: ${params.mapsLink}

TONO: Amigable, práctico, breve.
REGLAS:
- Máximo 3 oraciones
- Incluye el link de Maps de forma natural ("para que llegues fácil")
- Diles que estás pensando en ellos
- Un emoji apropiado`,

    checkin: `Eres AgentePostCita de ${params.agencyName}. ${params.leadName} tuvo su cita hoy con ${params.doctorName}.

Escribe UN mensaje preguntando cómo le fue.

REGLAS ABSOLUTAS:
- Máximo 2 oraciones
- Pregunta genuina, no encuesta
- Como un amigo que estaba pensando en ellos
- SIN mencionar seguros, ventas, o referencias
- SIN palabras corporativas
- Que se sienta como un mensaje personal, no automático`,

    referral: `Eres AgentePostCita de ${params.agencyName}. ${params.leadName} tuvo una experiencia POSITIVA con su cita.

El cliente respondió positivamente. Ahora necesitas plantar una semilla de referido de manera completamente orgánica.

PSICOLOGÍA A USAR:
- Anclaje de identidad: "tú eres el tipo de persona que..."
- No pidas referidos. Crea el DESEO de compartir.
- Reciprocidad: ya les diste valor, ahora ellos querrán darlo a otros.

REGLAS:
- Máximo 4 oraciones
- Celebra que se estén cuidando
- Haz un comentario sobre cómo hay personas que no saben que pueden tener esto
- Una sola frase natural: si alguna vez quieren compartir esto con alguien, con gusto los atiendes igual
- NUNCA uses "referido", "comisión", "bono", "descuento"
- Termina de forma cálida, sin llamada a la acción obvia`,

    thankyou: `Eres parte del equipo de ${params.agencyName}. Han pasado 7 días desde la cita de ${params.leadName} con ${params.doctorName}.

Escribe un mensaje final de seguimiento genuino.

REGLAS:
- Máximo 3 oraciones
- Pregunta si todo sigue bien
- Recuérdale que siempre pueden contar con el equipo
- Muy cálido, muy humano
- Sin agenda oculta`
  }

  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages:   [{ role: 'user', content: prompts[params.touchpoint] }],
    })
    return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
  } catch (e) {
    console.error('[Followup] Claude error:', e)
    // Fallbacks hardcoded si Claude falla
    const fallbacks: Record<string, string> = {
      reminder_24h: `Hola ${params.leadName} 💙 Te recordamos que mañana tienes tu cita con ${params.doctorName}. Qué bueno que te estás cuidando. Cualquier cosa, aquí estamos.`,
      reminder_2h:  `${params.leadName}, en 2 horas tu cita con ${params.doctorName} 🏥 Para que llegues fácil: ${params.mapsLink}`,
      checkin:      `Hola ${params.leadName} 😊 ¿Cómo te fue hoy con el médico?`,
      referral:     `Me alegra que estés bien ${params.leadName}. Tú eres de las personas que se cuidan, eso se nota. Si en algún momento quieres que atendamos a alguien cercano con el mismo cuidado, aquí estamos 💙`,
      thankyou:     `Hola ${params.leadName}, ¿cómo has estado esta semana? Seguimos aquí para lo que necesites 💙`,
    }
    return fallbacks[params.touchpoint] ?? ''
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now       = new Date()
  const processed: { lead: string; touchpoint: string; status: string }[] = []

  try {
    // Cargar todas las citas con followups activos
    const { data: followups } = await supabase
      .from('appointment_followups')
      .select(`
        id, status, lead_id, agent_id, account_id,
        reminder_24h_at, reminder_2h_at, checkin_at, referral_at, thankyou_at,
        checkin_responded, checkin_sentiment,
        doctor_appointments!inner (
          scheduled_at, doctor_name, specialty,
          doctor_address, lead_phone, lead_name,
          in_network, insurance_carrier
        ),
        leads!inner ( name, phone, preferred_language )
      `)
      .eq('status', 'active')

    if (!followups?.length) {
      return NextResponse.json({ success: true, message: 'No active followups', processed: [] })
    }

    // Cargar datos de agentes (nombre + número WhatsApp)
    const agentIds  = [...new Set(followups.map(f => f.agent_id))]
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, company_name')
      .in('id', agentIds)

    const agentMap: Record<string, { name: string; company: string }> = {}
    agents?.forEach(a => { agentMap[a.id] = { name: a.name, company: a.company_name ?? 'SeguriSSimo' } })

    const { data: configs } = await supabase
      .from('agent_configs')
      .select('agent_id, whatsapp_number')
      .in('agent_id', agentIds)

    const configMap: Record<string, string> = {}
    configs?.forEach(c => { if (c.whatsapp_number) configMap[c.agent_id] = c.whatsapp_number })

    // ── Procesar cada followup ─────────────────────────────────────────────
    for (const f of followups) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appt   = (f as any).doctor_appointments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lead   = (f as any).leads
      const agent  = agentMap[f.agent_id]
      const from   = configMap[f.agent_id] ?? process.env.TWILIO_PHONE_NUMBER ?? '+17722772510'

      if (!appt || !lead || !agent) continue

      const leadPhone  = appt.lead_phone ?? lead.phone
      const leadName   = appt.lead_name  ?? lead.name
      const apptTime   = new Date(appt.scheduled_at)
      const hoursToAppt = (apptTime.getTime() - now.getTime()) / 3600000
      const hoursSince  = (now.getTime() - apptTime.getTime()) / 3600000

      const mapsLink = buildMapsLink(
        appt.doctor_address ?? 'Florida',
        appt.doctor_name
      )

      const msgParams = {
        leadName:   leadName,
        doctorName: appt.doctor_name,
        specialty:  appt.specialty ?? 'médico',
        address:    appt.doctor_address ?? 'Tu médico',
        mapsLink,
        agentName:  agent.name,
        agencyName: agent.company,
      }

      // ── T-24h: Recordatorio del día anterior ──────────────────────────────
      if (!f.reminder_24h_at && hoursToAppt >= 20 && hoursToAppt <= 26) {
        const msg = await generateMessage({ touchpoint: 'reminder_24h', ...msgParams })
        if (msg) {
          await sendWhatsApp(leadPhone, msg, from)
          await supabase.from('appointment_followups')
            .update({ reminder_24h_at: now.toISOString() }).eq('id', f.id)
          // También notificar al agente
          const agentMsg = `📅 Recordatorio enviado a ${leadName}\nCita mañana con ${appt.doctor_name}\n📞 ${leadPhone}`
          await sendWhatsApp(lead.phone ?? leadPhone, agentMsg, from).catch(() => null)
          processed.push({ lead: leadName, touchpoint: 'reminder_24h', status: 'sent' })
        }
      }

      // ── T-2h: Recordatorio con link de Maps ───────────────────────────────
      else if (!f.reminder_2h_at && hoursToAppt >= 1.5 && hoursToAppt <= 2.5) {
        const msg = await generateMessage({ touchpoint: 'reminder_2h', ...msgParams })
        if (msg) {
          // Enviar mensaje + link de Maps explícito si no está en el mensaje
          const fullMsg = msg.includes('maps.google') ? msg : `${msg}\n\n📍 Dirección: ${mapsLink}`
          await sendWhatsApp(leadPhone, fullMsg, from)
          await supabase.from('appointment_followups')
            .update({ reminder_2h_at: now.toISOString() }).eq('id', f.id)
          processed.push({ lead: leadName, touchpoint: 'reminder_2h', status: 'sent' })
        }
      }

      // ── T+4h: Checkin "¿cómo te fue?" ─────────────────────────────────────
      else if (!f.checkin_at && hoursSince >= 3.5 && hoursSince <= 6) {
        const msg = await generateMessage({ touchpoint: 'checkin', ...msgParams })
        if (msg) {
          await sendWhatsApp(leadPhone, msg, from)
          await supabase.from('appointment_followups')
            .update({ checkin_at: now.toISOString() }).eq('id', f.id)
          processed.push({ lead: leadName, touchpoint: 'checkin', status: 'sent' })
        }
      }

      // ── T+48h: Activación orgánica de referidos ────────────────────────────
      // Solo si el cliente respondió positivamente al checkin
      else if (!f.referral_at && hoursSince >= 47 && hoursSince <= 54) {
        // Solo enviar si hubo respuesta positiva o neutral (no negativa)
        const sentiment = f.checkin_sentiment
        if (!f.checkin_responded || sentiment === 'positive' || sentiment === 'neutral' || !sentiment) {
          const msg = await generateMessage({ touchpoint: 'referral', ...msgParams, checkInSentiment: sentiment ?? undefined })
          if (msg) {
            await sendWhatsApp(leadPhone, msg, from)
            await supabase.from('appointment_followups')
              .update({ referral_at: now.toISOString() }).eq('id', f.id)
            processed.push({ lead: leadName, touchpoint: 'referral', status: 'sent' })
          }
        } else {
          // Sentimiento negativo — marcar como completado sin enviar referral
          await supabase.from('appointment_followups')
            .update({ referral_at: now.toISOString(), status: 'completed' }).eq('id', f.id)
          processed.push({ lead: leadName, touchpoint: 'referral', status: 'skipped_negative_sentiment' })
        }
      }

      // ── T+7d: Mensaje final de cuidado ─────────────────────────────────────
      else if (!f.thankyou_at && hoursSince >= 167 && hoursSince <= 171) {
        const msg = await generateMessage({ touchpoint: 'thankyou', ...msgParams })
        if (msg) {
          await sendWhatsApp(leadPhone, msg, from)
          await supabase.from('appointment_followups')
            .update({ thankyou_at: now.toISOString(), status: 'completed' }).eq('id', f.id)
          processed.push({ lead: leadName, touchpoint: 'thankyou', status: 'sent' })
        }
      }

      // Rate limit entre mensajes
      await new Promise(r => setTimeout(r, 1200))
    }

    return NextResponse.json({
      success:   true,
      processed: processed.length,
      details:   processed,
      timestamp: now.toISOString(),
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Followup Cron] Fatal:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
