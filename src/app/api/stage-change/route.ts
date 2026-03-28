import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STAGE_SCORE_RANGES } from '@/lib/stage-context'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!

async function sendWhatsApp(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const body = new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanTo}`, Body: message })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { lead_id, new_stage, changed_by } = await req.json()
    if (!lead_id || !new_stage) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single()
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // Update score based on new stage
    const range = STAGE_SCORE_RANGES[new_stage] || [lead.score, lead.score]
    const newScore = Math.round((range[0] + range[1]) / 2)

    await supabase.from('leads').update({
      stage: new_stage,
      score: newScore,
      updated_at: new Date().toISOString(),
    }).eq('id', lead_id)

    console.log(`[Stage] Lead ${lead.name} moved to ${new_stage} (score: ${newScore}) by ${changed_by}`)
    return NextResponse.json({ success: true, new_score: newScore })
  } catch (error: any) {
    console.error('Stage change error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
