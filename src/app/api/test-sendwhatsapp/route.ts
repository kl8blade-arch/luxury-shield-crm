// Debug endpoint to test sendWhatsApp directly
import { NextRequest, NextResponse } from 'next/server'

async function sendWhatsApp(to: string, body: string, fromNumber?: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken  = process.env.TWILIO_AUTH_TOKEN!
  const from       = fromNumber ?? process.env.TWILIO_WHATSAPP_FROM ?? process.env.TWILIO_PHONE_NUMBER ?? '+17722772510'

  const toFormatted   = `whatsapp:${to.startsWith('+') ? to : '+' + to}`
  const fromFormatted = `whatsapp:${from.startsWith('+') ? from : '+' + from}`

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const msgBody = body.length > 1500 ? body.substring(0, 1497) + '...' : body

    console.log(`[TEST-SEND] SEND_REQUEST - From: ${fromFormatted} | To: ${toFormatted} | BodyLen: ${msgBody.length}`)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromFormatted,
        To:   toFormatted,
        Body: msgBody,
      }).toString(),
    })

    console.log(`[TEST-SEND] TWILIO_RESPONSE - Status: ${res.status}`)

    const data = await res.json()
    if (!res.ok) {
      console.error(`[TEST-SEND] ❌ ERROR ${res.status}: ${JSON.stringify(data).substring(0, 200)}`)
      return { sid: null, error: data.message || `HTTP ${res.status}` }
    }
    console.log(`[TEST-SEND] ✅ SUCCESS - SID: ${data.sid}`)
    return { sid: data.sid }
  } catch (e: any) {
    console.error('[TEST-SEND] ❌ EXCEPTION:', e.message)
    return { sid: null, error: e.message }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { phone, message, number } = await req.json()

    if (!phone || !message) {
      return NextResponse.json({ error: 'Missing phone or message' }, { status: 400 })
    }

    console.log(`[TEST-SEND] Testing sendWhatsApp with phone=${phone}, msgLen=${message.length}`)

    const result = await sendWhatsApp(phone, message, number)

    return NextResponse.json({
      success: !!result.sid,
      sid: result.sid,
      error: result.error,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('[TEST-SEND] Error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
