import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// Cron: every hour — send pending scheduled messages
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date().toISOString()

    const { data: pending } = await supabase
      .from('reminders')
      .select('*')
      .lte('scheduled_for', now)
      .eq('status', 'pending')
      .in('type', ['rescue_sequence', 'referral_followup'])
      .not('lead_phone', 'is', null)
      .not('message_text', 'is', null)
      .limit(30)

    if (!pending || pending.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No pending messages' })
    }

    let sent = 0
    for (const reminder of pending) {
      try {
        await sendWhatsApp(reminder.lead_phone, reminder.message_text)
        await supabase.from('reminders').update({
          status: 'completed',
          completed_at: now,
        }).eq('id', reminder.id)

        // Save to conversations
        if (reminder.lead_id) {
          await supabase.from('conversations').insert({
            lead_id: reminder.lead_id,
            lead_phone: reminder.lead_phone,
            channel: 'ai_text',
            direction: 'outbound',
            message: reminder.message_text,
            ai_summary: `${reminder.type} step ${reminder.sequence_step || ''}`,
          })
        }

        sent++
      } catch (err) {
        console.error(`Failed to send reminder ${reminder.id}:`, err)
        await supabase.from('reminders').update({ status: 'failed' }).eq('id', reminder.id)
      }
    }

    console.log(`[Scheduled] Sent ${sent}/${pending.length} messages`)

    // Also trigger reengagement and daily-agent-checkin (consolidated cron for Hobby plan)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'
    const hour = new Date().getUTCHours()
    if (hour === 14) { // 10am ET — reengagement
      fetch(`${appUrl}/api/reengagement`).catch(() => {})
    }
    if (hour === 1) { // 8pm ET — agent checkin
      fetch(`${appUrl}/api/daily-agent-checkin`).catch(() => {})
    }

    return NextResponse.json({ sent, total: pending.length, timestamp: now })

  } catch (error: any) {
    console.error('Send scheduled error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
