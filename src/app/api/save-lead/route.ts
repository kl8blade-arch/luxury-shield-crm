import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assignLeadToAgent } from '@/lib/lead-distribution'

/*
  SQL — ejecutar en Supabase si no existen:
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS color_favorito text;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS resumen_sophia text;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS dependents integer;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_detail jsonb;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS agente_feedback jsonb;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_cierre timestamptz;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS resultado_final text;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS nivel_interes integer;

  ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'elite',
  ADD COLUMN IF NOT EXISTS available boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS monthly_lead_limit integer,
  ADD COLUMN IF NOT EXISTS leads_this_month integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_lead_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_number text;
*/

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CROSSSELL: Record<string, string> = {
  'Dental': 'Visión, Accidentes, Hospitalización, ACA',
  'Vision': 'Dental, Accidentes, ACA',
  'ACA': 'Dental, Visión, Gastos Finales, IUL',
  'IUL': 'Gastos Finales, Medicare, Accidentes, ACA',
  'Vida': 'Gastos Finales, IUL, Accidentes',
  'Medicare': 'Gastos Finales, IUL, Dental',
  'Gastos Finales': 'Medicare, IUL, Vida, Dental',
  'Accidentes': 'Dental, Hospitalización, ACA, IUL',
  'Hospitalización': 'Accidentes, ACA, Dental',
  'Cáncer': 'Hospitalización, Gastos Finales, IUL',
  'Corazón': 'Hospitalización, Gastos Finales, IUL',
}

function calcScore(data: any): { score: number; recommendation: string } {
  let score = 50
  if (!data.has_insurance)            score += 15
  if (data.insurance_type === 'Dental') score += 8
  if (data.age >= 25 && data.age <= 55) score += 8
  if (data.email)                     score += 5
  if (data.favorite_color)            score += 5
  if (data.message && data.message.length > 10) score += 4
  score = Math.min(100, Math.max(0, score))
  const recommendation =
    score >= 75 ? '🔥 Llama ahora — alta probabilidad de cierre' :
    score >= 50 ? '📱 Sophia IA contactará al lead automáticamente' :
    '🤖 Agente IA activado para calentar este lead'
  return { score, recommendation }
}

async function sendWhatsApp(to: string, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!sid || !token || !from) return
  try {
    const body = new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}`, Body: message })
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
  } catch (e) { console.error('WhatsApp error:', e) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = body.nombre || body.name
    const phone = (body.telefono || body.phone || '').replace(/\D/g, '')
    const state = body.estado || body.state
    const insuranceType = body.tipo_seguro || body.insurance_type || 'Dental'

    if (!name || !phone || !state) {
      return NextResponse.json({ error: 'Nombre, teléfono y estado son requeridos' }, { status: 400 })
    }

    const { score, recommendation } = calcScore({
      has_insurance: body.tiene_seguro_actual ?? body.has_insurance ?? false,
      insurance_type: insuranceType,
      age: body.edad || body.age || 0,
      email: body.email,
      favorite_color: body.color_favorito || body.favorite_color,
      message: body.mensaje || body.message,
    })

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        name, phone, email: body.email || null, state,
        age: body.edad || body.age || null,
        has_insurance: body.tiene_seguro_actual ?? body.has_insurance ?? false,
        message: body.mensaje || body.message || null,
        favorite_color: body.color_favorito || body.favorite_color || null,
        insurance_type: insuranceType,
        stage: 'new', source: body.fuente || body.source || 'landing',
        score, score_recommendation: recommendation,
        ready_to_buy: score >= 85,
        for_crossselling: false,
        crossselling_products: CROSSSELL[insuranceType] || null,
        utm_source: body.utm_source || null,
        utm_campaign: body.utm_campaign || null,
        url_origin: body.url_origen || body.url_origin || null,
      })
      .select().single()

    if (leadError) throw leadError

    // Weighted round-robin lead distribution by agent plan
    const assigned = await assignLeadToAgent(supabase)
    let assignedTo = 'SeguriSSimo'

    if (assigned) {
      await supabase.from('leads').update({
        agent_id: assigned.agentId,
        assigned_to: assigned.agentName,
        stage: 'contact',
      }).eq('id', lead.id)
      assignedTo = assigned.agentName
    }

    // Agent is NOT notified here — only when Sophia detects [LISTO_PARA_COMPRAR]
    // Trigger AI agent (non-blocking)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'
    fetch(`${appUrl}/api/ai-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id }),
    }).catch(e => console.error('AI contact error:', e))

    return NextResponse.json({ success: true, lead_id: lead.id, score, assigned_to: assignedTo, message: 'Lead guardado correctamente' })

  } catch (error: any) {
    console.error('save-lead error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
  })
}
