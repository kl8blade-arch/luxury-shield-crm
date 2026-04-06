import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const GOOGLE_WEBHOOK_KEY = process.env.GOOGLE_WEBHOOK_KEY || ''

/**
 * POST /api/webhooks/google — Receive Google Ads lead form extensions
 *
 * Google Ads sends lead data when someone fills a lead form extension.
 * Can also receive from Google Sheets webhook (via Apps Script) or Zapier.
 *
 * Expected body formats:
 *
 * 1. Google Ads Webhook (direct):
 * { lead_id, campaign_id, form_id, user_column_data: [{ column_id, string_value }], ...}
 *
 * 2. Google Ads via Zapier/Make:
 * { name, phone, email, campaign, ad_group, ... }
 *
 * 3. Google Sheets trigger:
 * { row: { name, phone, email, ... }, sheet_name, timestamp }
 */
export async function POST(req: NextRequest) {
  try {
    // Optional key verification
    const key = req.nextUrl.searchParams.get('key') || req.headers.get('x-google-key') || ''
    if (GOOGLE_WEBHOOK_KEY && key !== GOOGLE_WEBHOOK_KEY) {
      // Also check x-api-key for generic auth
      const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '') || ''
      if (!apiKey) {
        return NextResponse.json({ error: 'Invalid key' }, { status: 403 })
      }
      // Validate via api_keys table
      const { data: keyData } = await supabase.from('api_keys')
        .select('id, account_id, agent_id, active')
        .eq('key', apiKey).eq('active', true).single()
      if (!keyData) return NextResponse.json({ error: 'Invalid API key' }, { status: 403 })
    }

    const body = await req.json()
    console.log('[GOOGLE] Webhook received:', JSON.stringify(body).substring(0, 300))

    // Determine the format and extract lead data
    let name = '', phone = '', email = '', city = '', state = ''
    let campaign = '', adGroup = '', formId = ''
    const customFields: Record<string, string> = {}

    // Format 1: Google Ads direct webhook
    if (body.user_column_data || body.lead_id) {
      formId = body.form_id || ''
      campaign = body.campaign_id || ''

      if (body.user_column_data) {
        for (const col of body.user_column_data) {
          const id = (col.column_id || '').toLowerCase()
          const val = col.string_value || ''
          if (id.includes('full_name') || id.includes('name')) name = name ? `${name} ${val}` : val
          else if (id.includes('phone')) phone = val
          else if (id.includes('email')) email = val
          else if (id.includes('city')) city = val
          else if (id.includes('state') || id.includes('region')) state = val
          else customFields[id] = val
        }
      }
    }
    // Format 2: Zapier/Make/generic
    else if (body.name || body.phone || body.email || body.first_name) {
      name = body.name || body.full_name || `${body.first_name || ''} ${body.last_name || ''}`.trim()
      phone = body.phone || body.phone_number || body.telefono || ''
      email = body.email || body.correo || ''
      city = body.city || body.ciudad || ''
      state = body.state || body.estado || body.region || ''
      campaign = body.campaign || body.campaign_name || body.utm_campaign || ''
      adGroup = body.ad_group || body.adgroup || ''
      formId = body.form_id || ''

      // Capture any extra fields
      const knownFields = new Set(['name', 'full_name', 'first_name', 'last_name', 'phone', 'phone_number', 'telefono', 'email', 'correo', 'city', 'ciudad', 'state', 'estado', 'region', 'campaign', 'campaign_name', 'utm_campaign', 'ad_group', 'adgroup', 'form_id'])
      for (const [k, v] of Object.entries(body)) {
        if (!knownFields.has(k) && v && typeof v === 'string') customFields[k] = v
      }
    }
    // Format 3: Google Sheets
    else if (body.row) {
      const row = body.row
      name = row.name || row.nombre || row.Name || ''
      phone = row.phone || row.telefono || row.Phone || ''
      email = row.email || row.Email || row.correo || ''
      state = row.state || row.estado || row.State || ''
      city = row.city || row.ciudad || row.City || ''
      campaign = body.sheet_name || 'google_sheets'
    }

    if (!name && !phone && !email) {
      return NextResponse.json({ error: 'No lead data found in payload' }, { status: 400 })
    }

    // Find account by key or form mapping
    let agentId = null, accountId = null

    // Check api key association
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '') || ''
    if (apiKey) {
      const { data: keyData } = await supabase.from('api_keys')
        .select('account_id, agent_id')
        .eq('key', apiKey).eq('active', true).single()
      if (keyData) {
        agentId = keyData.agent_id
        accountId = keyData.account_id
      }
    }

    // Check for duplicate
    let isDuplicate = false
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '')
      if (cleanPhone.length >= 7) {
        const { data: existing } = await supabase.from('leads')
          .select('id')
          .like('phone', `%${cleanPhone.slice(-7)}%`)
          .limit(1)
        if (existing?.length) isDuplicate = true
      }
    }

    if (isDuplicate) {
      return NextResponse.json({ received: true, duplicate: true, message: 'Lead already exists' })
    }

    // Determine insurance_type from custom fields
    let product = customFields.product || customFields.interest || customFields.service || ''
    if (!product && customFields.tipo) product = customFields.tipo
    // Validate against allowed values
    const validTypes = ['Dental', 'Vision', 'ACA', 'IUL', 'Vida', 'Medicare', 'Auto', 'Hogar', 'Bienes Raices', 'Infoproductos', 'Dropshipping', 'Inversiones', 'Otro']
    const matchedType = validTypes.find(t => t.toLowerCase() === product.toLowerCase()) || 'Otro'

    const { data: lead, error } = await supabase.from('leads').insert({
      name: name || 'Google Lead',
      phone: phone || '',
      email: email || null,
      state: state || null,
      city: city || null,
      insurance_type: matchedType,
      stage: 'new',
      score: 40,
      source: 'google_ads',
      utm_source: 'google',
      utm_campaign: campaign || adGroup || '',
      notes: Object.keys(customFields).length > 0 ? `Campos extra: ${JSON.stringify(customFields)}` : null,
      agent_id: agentId,
      account_id: accountId,
    }).select('id').single()

    // Log
    await supabase.from('integration_log').insert({
      account_id: accountId,
      platform: 'google_ads',
      event_type: 'lead.inbound',
      payload: { name, phone, email, campaign, formId },
      status: error ? 'error' : 'success',
    })

    if (error) {
      console.error('[GOOGLE] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[GOOGLE] Lead created: ${name} (${phone})`)
    return NextResponse.json({ received: true, lead_id: lead?.id, message: `Lead "${name}" created` }, { status: 201 })

  } catch (err: any) {
    console.error('[GOOGLE] Webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * GET /api/webhooks/google — Health check
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', platform: 'google_ads', message: 'Google Ads webhook active' })
}
