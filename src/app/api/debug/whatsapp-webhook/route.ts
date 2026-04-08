import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = formData.get('From')
  const body = formData.get('Body')
  const timestamp = new Date().toISOString()

  const log = {
    timestamp,
    from,
    body,
    headers: Object.fromEntries(req.headers.entries()),
    all_fields: Array.from(formData.entries())
  }

  console.log('[DEBUG] WhatsApp webhook received:', JSON.stringify(log, null, 2))

  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  })
}

export async function GET() {
  return NextResponse.json({
    status: 'Debug endpoint active',
    message: 'POST /api/debug/whatsapp-webhook to test',
    timestamp: new Date().toISOString()
  })
}
