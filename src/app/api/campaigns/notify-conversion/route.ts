import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM

/**
 * POST /api/campaigns/notify-conversion
 * Send WhatsApp notification when a lead converts from a campaign
 * Body: { campaignId, leadName, leadPhone, conversionValue }
 */
export async function POST(req: NextRequest) {
  try {
    const { campaignId, leadName, leadPhone, conversionValue } = await req.json()

    if (!campaignId || !leadPhone) {
      return NextResponse.json({ error: 'campaignId and leadPhone required' }, { status: 400 })
    }

    // Get campaign and agent info
    const { data: campaign, error: campaignError } = await supabase
      .from('meta_campaigns')
      .select('id, name, agent_id, notify_on_conversion')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check if notifications are enabled for this campaign
    if (!campaign.notify_on_conversion) {
      return NextResponse.json({
        success: false,
        message: 'Notifications disabled for this campaign',
      })
    }

    // Get agent phone
    const { data: agent } = await supabase
      .from('agents')
      .select('phone, name')
      .eq('id', campaign.agent_id)
      .single()

    if (!agent?.phone) {
      console.warn('[NOTIFY-CONVERSION] Agent has no phone number')
      return NextResponse.json({
        success: false,
        message: 'Agent has no phone number configured',
      })
    }

    // Send WhatsApp notification
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 })
    }

    const cleanPhone = agent.phone.startsWith('+') ? agent.phone : `+1${agent.phone.replace(/\D/g, '')}`
    const message = `🎉 *CONVERSIÓN REGISTRADA*

Campaña: ${campaign.name}
Cliente: ${leadName}
Teléfono: ${leadPhone}
Valor: $${conversionValue ? conversionValue.toFixed(2) : 'N/A'}

¡Excelente venta! 🚀`

    const auth = `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`

    const body = new URLSearchParams({
      From: `whatsapp:${TWILIO_FROM}`,
      To: `whatsapp:${cleanPhone}`,
      Body: message,
    })

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = await res.json()

    if (data.sid) {
      console.log(`[NOTIFY-CONVERSION] ✅ Notification sent to ${cleanPhone}`)
      return NextResponse.json({
        success: true,
        message: 'Notification sent',
        messageSid: data.sid,
      })
    } else {
      console.error('[NOTIFY-CONVERSION] Twilio error:', data)
      return NextResponse.json({
        success: false,
        error: data.error_message || 'Failed to send notification',
      })
    }
  } catch (err: any) {
    console.error('[NOTIFY-CONVERSION] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
