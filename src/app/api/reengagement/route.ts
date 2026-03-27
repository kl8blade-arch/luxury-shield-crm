import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/*
  SQL para campos adicionales en tabla leads (ejecutar en Supabase si no existen):

  ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_reengagement timestamptz;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
*/

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!

async function sendWhatsApp(to: string, message: string) {
  const body = new URLSearchParams({
    From: `whatsapp:${TWILIO_FROM}`,
    To: `whatsapp:${to}`,
    Body: message,
  })
  const res = await fetch(
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
  return res.json()
}

function getReengagementMessage(lead: any): string {
  const name = lead.name?.split(' ')[0] || ''

  switch (lead.stage) {
    case 'calificando':
      return `Hola ${name}, soy Sophia de Luxury Shield 😊 Quería retomar nuestra conversación sobre tu cobertura dental. ¿Tuviste oportunidad de pensarlo?`

    case 'presentando':
      return `Hola ${name}, solo quería saber si tienes alguna pregunta sobre el plan Cigna DVH Plus que te mostré. El bono de $200 en visión sigue disponible para ti ✅`

    case 'objecion':
      return `Hola ${name}, entiendo que necesitabas tiempo para decidir. ¿Hay algo específico que te genere duda? Con gusto lo aclaro 💙`

    case 'nuevo':
    default:
      return `Hola, soy Sophia de Luxury Shield Insurance 😊 Vi que llenaste nuestro formulario sobre el seguro dental. ¿Pudiste revisar la información? ¿Tienes alguna pregunta?`
  }
}

// ── GET: Vercel Cron Job — Re-engagement automático ──
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()

    // Find silent leads: updated > 24h ago, not in final stages, not re-engaged in 72h
    const { data: silentLeads, error } = await supabase
      .from('leads')
      .select('*')
      .lt('updated_at', twentyFourHoursAgo)
      .not('stage', 'in', '("agendado","listo_comprar","perdido","closed_won","closed_lost","unqualified")')
      .or(`last_reengagement.is.null,last_reengagement.lt.${seventyTwoHoursAgo}`)
      .not('phone', 'is', null)
      .limit(50)

    if (error) {
      console.error('Re-engagement query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!silentLeads || silentLeads.length === 0) {
      console.log('Re-engagement: No silent leads found')
      return NextResponse.json({ reactivated: 0, message: 'No silent leads' })
    }

    let sent = 0
    let failed = 0

    for (const lead of silentLeads) {
      try {
        const message = getReengagementMessage(lead)
        const phone = lead.phone.startsWith('+') ? lead.phone : `+${lead.phone}`

        // Send WhatsApp
        await sendWhatsApp(phone, message)

        // Save message to conversations
        await supabase.from('conversations').insert({
          lead_id: lead.id,
          phone: lead.phone,
          role: 'assistant',
          content: message,
          lead_name: lead.name,
          lead_phone: lead.phone,
          channel: 'ai_text',
          direction: 'outbound',
          message: message,
          ai_summary: 'Re-engagement automático',
        })

        // Mark lead as re-engaged
        await supabase.from('leads').update({
          last_reengagement: now.toISOString(),
          updated_at: now.toISOString(),
        }).eq('id', lead.id)

        sent++
        console.log(`Re-engagement sent to ${lead.name} (${lead.phone}) — stage: ${lead.stage}`)
      } catch (err) {
        failed++
        console.error(`Re-engagement failed for ${lead.name}:`, err)
      }
    }

    const result = {
      reactivated: sent,
      failed,
      total_found: silentLeads.length,
      timestamp: now.toISOString(),
    }

    console.log('Re-engagement complete:', result)
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Re-engagement error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
