import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM

export async function GET(req: NextRequest) {
  // Only run from cron or with auth
  const authHeader = req.headers.get('authorization')
  const isAuthorized = authHeader?.includes('Bearer') || req.headers.get('x-api-secret')
  if (!isAuthorized && !req.headers.get('x-vercel-cron')) {
    // Allow manual trigger too
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Get all active paid agents with managed AI
  const { data: agents } = await supabase.from('agents')
    .select('id, name, phone, tokens_used, tokens_limit, tokens_extra, subscription_plan')
    .eq('status', 'active').eq('paid', true)
    .not('role', 'eq', 'admin')

  let reportsSent = 0

  for (const agent of agents || []) {
    if (!agent.phone) continue

    // Get usage in last 24h
    const { data: usage } = await supabase.from('token_usage')
      .select('tokens_input, tokens_output, cost_usd, conversation_type')
      .eq('agent_id', agent.id)
      .gte('created_at', yesterday)

    if (!usage?.length) continue // No usage = no report

    const totalTokensUsed = usage.reduce((s, u) => s + (u.tokens_input || 0) + (u.tokens_output || 0), 0)
    const totalCost = usage.reduce((s, u) => s + (u.cost_usd || 0), 0)
    const remaining = Math.max(0, (agent.tokens_limit || 0) + (agent.tokens_extra || 0) - (agent.tokens_used || 0))

    // Group by feature
    const byFeature: Record<string, number> = {}
    for (const u of usage) { byFeature[u.conversation_type || 'other'] = (byFeature[u.conversation_type || 'other'] || 0) + 1 }

    const featureNames: Record<string, string> = {
      sophia_whatsapp: 'Sophia WhatsApp', coach_realtime: 'Coaching', master_command: 'Comandos master',
      training_generation: 'Training', audio_transcription: 'Audio', landing_builder: 'Landings', other: 'Otros',
    }

    const breakdown = Object.entries(byFeature).map(([k, v]) => `• ${featureNames[k] || k}: ${v} conversaciones`).join('\n')

    // Count leads attended today
    const { count: leadsToday } = await supabase.from('conversations')
      .select('lead_id', { count: 'exact', head: true })
      .gte('created_at', yesterday)

    const lowBalance = remaining < (agent.tokens_limit || 300) * 0.2

    const message = `📊 *Reporte diario de IA*\n${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n` +
      `🎟️ Tokens restantes: *${remaining.toLocaleString()}*\n` +
      `📉 Usados hoy: *${usage.length}* ($${totalCost.toFixed(4)})\n\n` +
      `📋 Desglose:\n${breakdown}\n\n` +
      `👥 Leads atendidos: *${leadsToday || 0}*` +
      (lowBalance ? `\n\n⚠️ *Saldo bajo*. Recarga en luxury-shield-crm.vercel.app/packages` : '')

    // Send via WhatsApp
    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      const cleanPhone = agent.phone.startsWith('+') ? agent.phone : `+1${agent.phone.replace(/\D/g, '')}`
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanPhone}`, Body: message }).toString(),
      })
      reportsSent++
    }
  }

  return NextResponse.json({ sent: reportsSent })
}
