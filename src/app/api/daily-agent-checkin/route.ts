import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cleanOldAudios } from '@/lib/voice-response'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!

async function sendWhatsApp(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const body = new URLSearchParams({
    From: `whatsapp:${TWILIO_FROM}`,
    To: `whatsapp:${cleanTo}`,
    Body: message,
  })
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  )
}

const STAGE_LABELS: Record<string, string> = {
  listo_comprar: 'listo para cerrar 🎯',
  agendado: 'cita agendada 📅',
  seguimiento_agente: 'en seguimiento 📞',
  interested: 'interesado 🔥',
  presentando: 'en presentación',
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

    // Check if already sent today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count: alreadySent } = await supabase
      .from('reminders')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'daily_checkin')
      .gte('created_at', todayStart.toISOString())

    if (alreadySent && alreadySent > 0) {
      return NextResponse.json({ message: 'Already sent today', skipped: true })
    }

    // Get pending leads grouped by agent
    const { data: pendingLeads } = await supabase
      .from('leads')
      .select('*, agents!agent_id(id, name, whatsapp_number)')
      .in('stage', ['listo_comprar', 'agendado', 'seguimiento_agente', 'interested'])
      .is('fecha_cierre', null)
      .lt('updated_at', threeHoursAgo)
      .not('agent_id', 'is', null)

    if (!pendingLeads || pendingLeads.length === 0) {
      // Still clean old audios
      const cleaned = await cleanOldAudios()
      return NextResponse.json({ message: 'No pending leads', audios_cleaned: cleaned })
    }

    // Group by agent
    const byAgent: Record<string, { agent: any; leads: any[] }> = {}
    for (const lead of pendingLeads) {
      const agent = lead.agents as any
      if (!agent?.whatsapp_number) continue
      if (!byAgent[agent.id]) {
        byAgent[agent.id] = { agent, leads: [] }
      }
      byAgent[agent.id].leads.push(lead)
    }

    let sentCount = 0
    for (const { agent, leads } of Object.values(byAgent)) {
      const leadLines = leads.map((l: any, i: number) => {
        const stageLabel = STAGE_LABELS[l.stage] || l.stage
        return `${i + 1}. ${l.name} — ${stageLabel} — ${l.state || '?'}`
      }).join('\n')

      const message = `Hola ${agent.name.split(' ')[0]} 👋 Cierre del día de Sophia:

Tienes ${leads.length} lead(s) pendiente(s):

${leadLines}

¿Cómo terminó cada uno? Respóndeme así:
VENDIDO [nombre] [monto]
PERDIDO [nombre] [motivo]
SEGUIMIENTO [nombre] [fecha]

O cuéntame en tus palabras, yo entiendo 😊`

      await sendWhatsApp(agent.whatsapp_number, message)

      // Record reminder
      await supabase.from('reminders').insert({
        type: 'daily_checkin',
        notes: `Checkin enviado a ${agent.name}: ${leads.length} leads pendientes`,
        status: 'completed',
      })

      sentCount++
    }

    // Clean old audio files
    const cleaned = await cleanOldAudios()

    return NextResponse.json({
      agents_notified: sentCount,
      total_pending_leads: pendingLeads.length,
      audios_cleaned: cleaned,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Daily agent checkin error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
