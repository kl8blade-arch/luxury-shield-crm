import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM

export async function GET() {
  const now = new Date().toISOString()

  // Find expired trials (trial_ends_at < now, still active, not paid)
  const { data: expired } = await supabase.from('agents')
    .select('id, name, phone, email')
    .eq('status', 'active').eq('paid', false)
    .not('trial_ends_at', 'is', null)
    .lt('trial_ends_at', now)
    .not('role', 'eq', 'admin')

  let count = 0
  for (const agent of expired || []) {
    // GAP 3 fix: verificar que realmente no haya pagado antes de marcar como expired
    const { data: fresh } = await supabase.from('agents').select('paid').eq('id', agent.id).single()
    if (fresh?.paid) {
      console.log(`[EXPIRE] Skipping ${agent.id} — already paid`)
      continue
    }

    await supabase.from('agents').update({ status: 'trial_expired' }).eq('id', agent.id)

    // Notify via WhatsApp
    if (agent.phone && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      const cleanPhone = agent.phone.startsWith('+') ? agent.phone : `+1${agent.phone.replace(/\D/g, '')}`
      const msg = `⏰ Tu periodo de prueba de 7 dias ha terminado.\n\nPara seguir usando Sophia IA y todas las funciones del CRM, elige un plan:\n\n💼 Starter — $47/mes\n🚀 Professional — $97/mes\n⚡ Agency — $197/mes\n\n👉 luxury-shield-crm.vercel.app/packages`
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanPhone}`, Body: msg }).toString(),
      })
    }
    count++
  }

  return NextResponse.json({ expired: count })
}
