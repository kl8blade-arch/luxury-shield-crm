import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, apiError, hasScope } from '@/lib/api-key-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/v1/webhooks/inbound — Universal inbound webhook
 * Accepts leads from: Facebook Lead Ads, Google Ads, GoHighLevel, Wix, n8n, Zapier, Make, etc.
 *
 * Body (flexible — maps common fields):
 * {
 *   name?: string,
 *   full_name?: string,        // Facebook format
 *   first_name?: string,       // Google Ads format
 *   last_name?: string,
 *   phone?: string,
 *   phone_number?: string,     // Facebook format
 *   email?: string,
 *   state?: string,
 *   city?: string,
 *   product?: string,
 *   source?: string,           // e.g. "facebook_lead_ads"
 *   campaign?: string,
 *   ad_id?: string,
 *   form_id?: string,
 *   custom_fields?: Record<string, any>,
 *   platform?: string,         // "facebook", "google", "gohighlevel", "wix", etc.
 * }
 */
export async function POST(req: NextRequest) {
  const key = await validateApiKey(req)
  if (!key) return apiError('API key invalida', 401)
  if (!hasScope(key, 'webhooks')) return apiError('Scope webhooks requerido', 403)

  let body: any
  try {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('form')) {
      const formData = await req.formData()
      body = Object.fromEntries(formData.entries())
    } else {
      body = await req.json()
    }
  } catch {
    return apiError('Body invalido (JSON o form-data requerido)')
  }

  // Normalize fields from different platforms
  const name = body.name || body.full_name || `${body.first_name || ''} ${body.last_name || ''}`.trim() || 'Lead API'
  const phone = body.phone || body.phone_number || body.telefono || body.mobile || ''
  const email = body.email || body.correo || ''
  const state = body.state || body.estado || body.region || body.city || ''
  const product = body.product || body.insurance_type || body.producto || body.interest || ''
  const source = body.source || body.platform || body.fuente || 'webhook'
  const campaign = body.campaign || body.campaign_name || body.utm_campaign || body.ad_name || ''

  // Create lead
  const { data: lead, error } = await supabase.from('leads').insert({
    name, phone, email, state,
    insurance_type: product,
    stage: 'new', score: 30,
    source: `api_${source}`,
    utm_source: source,
    utm_campaign: campaign,
    notes: body.notes || (body.custom_fields ? JSON.stringify(body.custom_fields) : '') || '',
    agent_id: key.agentId,
    account_id: key.accountId,
  }).select().single()

  if (error) return apiError(error.message, 500)

  // Log integration
  await supabase.from('integration_log').insert({
    account_id: key.accountId, platform: source,
    event_type: 'lead.inbound', payload: body, status: 'success',
  })

  return NextResponse.json({
    success: true,
    lead_id: lead?.id,
    message: `Lead "${name}" creado desde ${source}`,
  }, { status: 201 })
}
