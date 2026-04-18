// Test endpoint that simulates a Twilio webhook
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const params = new URLSearchParams(body)

  const message = {
    From: params.get('From') || '+17869927765',
    To: params.get('To') || process.env.TWILIO_WHATSAPP_FROM,
    Body: params.get('Body') || 'Test mensaje',
    AccountSid: params.get('AccountSid') || process.env.TWILIO_ACCOUNT_SID,
    ProfileName: params.get('ProfileName') || 'Test User',
    MediaUrl0: params.get('MediaUrl0') || '',
    NumMedia: params.get('NumMedia') || '0',
  }

  console.log('[TEST-WEBHOOK] Simulating Twilio webhook:', {
    from: message.From,
    body: message.Body,
    timestamp: new Date().toISOString(),
  })

  // Forward to actual POST endpoint
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      From: message.From,
      To: message.To || '+17722772510',
      Body: message.Body,
      AccountSid: message.AccountSid || '',
      ProfileName: message.ProfileName || '',
      MediaUrl0: message.MediaUrl0 || '',
      NumMedia: message.NumMedia || '0',
    }).toString(),
  })

  const responseText = await res.text()
  console.log('[TEST-WEBHOOK] Response:', res.status)

  return NextResponse.json({
    success: res.ok,
    status: res.status,
    message: 'Webhook simulation sent to /api/whatsapp',
  })
}

export async function GET() {
  return NextResponse.json({
    info: 'Test webhook endpoint',
    usage: 'POST with Body param',
    example: `curl -X POST https://luxury-shield-crm.vercel.app/api/test-webhook -d 'Body=Hello&From=%2B17869927765'`,
  })
}
