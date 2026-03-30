import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!

async function sendWhatsApp(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const body = new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanTo}`, Body: message })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST', headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

async function sendSMS(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const smsFrom = TWILIO_FROM.replace('whatsapp:', '')
  const body = new URLSearchParams({ From: smsFrom, To: cleanTo, Body: message })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST', headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (cronSecret && auth !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const now = new Date()
    const in60 = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

    const { data: events } = await supabase.from('calendar_events').select('*, agents!agent_id(name, whatsapp_number)').eq('notification_sent', false).eq('status', 'scheduled').gte('start_time', now.toISOString()).lte('start_time', in60)

    let notified = 0
    for (const event of events || []) {
      const minsUntil = Math.round((new Date(event.start_time).getTime() - now.getTime()) / 60000)
      if (minsUntil > event.notify_minutes_before) continue

      const agent = event.agents as any
      const timeStr = new Date(event.start_time).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' })
      const msg = `🔔 Recordatorio: ${event.title}\n⏰ Hoy a las ${timeStr}\n${event.description ? '📝 ' + event.description + '\n' : ''}${event.lead_name ? '👤 ' + event.lead_name + '\n' : ''}${event.location ? '📍 ' + event.location : ''}`

      try {
        if (event.notify_whatsapp && agent?.whatsapp_number) await sendWhatsApp(agent.whatsapp_number, msg)
        if (event.notify_sms && agent?.whatsapp_number) await sendSMS(agent.whatsapp_number, msg)
        await supabase.from('calendar_events').update({ notification_sent: true }).eq('id', event.id)
        notified++
      } catch (err) { console.error('[CALENDAR] Notify error:', err) }
    }

    return NextResponse.json({ notified, total: events?.length || 0 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
