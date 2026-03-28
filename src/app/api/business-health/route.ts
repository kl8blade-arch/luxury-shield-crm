import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP || '+17869435656'

async function sendWhatsApp(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const body = new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanTo}`, Body: message })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

    // Gather metrics
    const [
      { count: activeLeads },
      { count: closedWon },
      { count: totalContacted },
      { count: readyToBuy },
      { count: atRisk },
      { count: newToday },
      { data: topArg },
    ] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('stage', 'in', '("closed_won","closed_lost","unqualified")').gte('created_at', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('stage', 'closed_won').gte('fecha_cierre', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('stage', 'eq', 'new').gte('created_at', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('ready_to_buy', true).is('fecha_cierre', null),
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('stage', 'in', '("closed_won","closed_lost","unqualified")').lt('updated_at', sixHoursAgo).gte('created_at', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('sophia_learnings').select('argumentos_ganadores').order('created_at', { ascending: false }).limit(1),
    ])

    const closeRate = totalContacted ? Math.round(((closedWon || 0) / (totalContacted || 1)) * 100) : 0
    const sophiaRate = totalContacted ? Math.round(((readyToBuy || 0) / (totalContacted || 1)) * 100) : 0

    // Calculate score
    let score = 50
    if ((newToday || 0) > 0) score += 10
    if (closeRate > 20) score += 20; else if (closeRate > 10) score += 10
    if (sophiaRate > 30) score += 20; else if (sophiaRate > 15) score += 10
    if ((atRisk || 0) === 0) score += 10
    if ((readyToBuy || 0) > 0) score += 10
    score -= Math.min(30, (atRisk || 0) * 5)
    if ((newToday || 0) === 0) score -= 10
    score = Math.max(0, Math.min(100, score))

    const actions: string[] = []
    if ((atRisk || 0) > 0) actions.push(`${atRisk} leads sin actividad >6h — activar reengagement`)
    if ((readyToBuy || 0) > 0) actions.push(`${readyToBuy} leads calientes pendientes de llamada`)
    if ((newToday || 0) === 0) actions.push('Sin leads nuevos hoy — revisar landing/campaña')
    if (closeRate < 15) actions.push('Tasa de cierre baja — revisar objeciones frecuentes')

    const topArgText = topArg?.[0]?.argumentos_ganadores?.[0] || 'Ahorro $280 en evaluación + limpieza'

    const result = {
      score,
      status: score >= 80 ? 'saludable' : score >= 60 ? 'atencion' : 'urgente',
      metrics: {
        active_leads: activeLeads || 0,
        close_rate: closeRate,
        sophia_conversion: sophiaRate,
        hot_leads: readyToBuy || 0,
        at_risk: atRisk || 0,
        new_today: newToday || 0,
        closed_won_week: closedWon || 0,
      },
      actions: actions.slice(0, 3),
      top_argument: topArgText,
    }

    // If Monday — send weekly summary to Carlos
    if (now.getUTCDay() === 1) {
      const comisiones = (closedWon || 0) * 45
      const emoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴'
      await sendWhatsApp(ADMIN_PHONE, `Buenos días Carlos! Resumen semanal Luxury Shield:\n\n${emoji} Score de salud: ${score}/100\n💰 Pólizas cerradas: ${closedWon || 0} ($${comisiones} en comisiones)\n🔥 Leads calientes activos: ${readyToBuy || 0}\n⚠️ ${actions[0] || 'Todo en orden'}\n💡 Argumento top: "${topArgText}"`)
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Business health error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
