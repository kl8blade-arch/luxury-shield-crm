import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/*
  SQL — ejecutar en Supabase si no existen:
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS referred_by text;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrals_count integer DEFAULT 0;
  ALTER TABLE reminders ADD COLUMN IF NOT EXISTS lead_phone text;
  ALTER TABLE reminders ADD COLUMN IF NOT EXISTS message_text text;
  ALTER TABLE reminders ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
  ALTER TABLE reminders ADD COLUMN IF NOT EXISTS sequence_step integer;
*/

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

// POST: Create referral lead from existing customer
export async function POST(req: NextRequest) {
  try {
    const { referrer_phone, new_lead_name, new_lead_phone } = await req.json()

    if (!referrer_phone || !new_lead_phone) {
      return NextResponse.json({ error: 'referrer_phone and new_lead_phone required' }, { status: 400 })
    }

    // Find the referrer (must be a sold customer)
    const cleanReferrer = referrer_phone.replace(/\D/g, '')
    const { data: referrer } = await supabase
      .from('leads')
      .select('*')
      .or(`phone.eq.${cleanReferrer},phone.eq.+${cleanReferrer}`)
      .eq('resultado_final', 'vendido')
      .limit(1)
      .single()

    if (!referrer) {
      return NextResponse.json({ error: 'Referrer not found or not a customer' }, { status: 404 })
    }

    // Create new lead
    const { data: newLead, error } = await supabase
      .from('leads')
      .insert({
        name: new_lead_name || `Referido de ${referrer.name}`,
        phone: new_lead_phone,
        source: 'referido',
        referred_by: referrer_phone,
        stage: 'new',
        score: 60, // Higher score for referrals
        ia_active: true,
      })
      .select()
      .single()

    if (error) throw error

    // Increment referrer's count
    await supabase
      .from('leads')
      .update({ referrals_count: (referrer.referrals_count || 0) + 1 })
      .eq('id', referrer.id)

    // Send welcome to new lead
    const referrerFirst = referrer.name?.split(' ')[0] || 'Un amigo'
    const newFirst = new_lead_name?.split(' ')[0] || ''
    const greeting = newFirst
      ? `Hola ${newFirst}! 😊 ${referrerFirst} me habló de ti — dice que podrías estar interesado/a en proteger tu salud dental.\n\n¿Tienes un momento? 💙`
      : `Hola! 😊 ${referrerFirst} nos pasó tu contacto — dice que podrías beneficiarte de un plan de protección dental.\n\n¿Tienes un momento? 💙`

    await sendWhatsApp(new_lead_phone, greeting)

    // Save conversation
    await supabase.from('conversations').insert({
      lead_id: newLead.id,
      lead_phone: new_lead_phone,
      channel: 'ai_text',
      direction: 'outbound',
      message: greeting,
      ai_summary: `Referido por ${referrer.name}`,
    })

    // Thank the referrer
    await sendWhatsApp(referrer_phone, `¡Gracias por la referencia ${referrerFirst}! 🙌 Ya contacté a ${newFirst || 'tu contacto'}. Te avisaré cómo va 💙`)

    return NextResponse.json({ success: true, new_lead_id: newLead.id, referrer: referrer.name })

  } catch (error: any) {
    console.error('Referral error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
