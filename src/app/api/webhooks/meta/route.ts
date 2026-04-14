import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'luxuryshield_meta_verify_2026'
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || ''
const GRAPH_API = 'https://graph.facebook.com/v19.0'

/**
 * GET /api/webhooks/meta — Meta webhook verification (required by Facebook)
 * Facebook sends: ?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[META] Webhook verified')
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

/**
 * POST /api/webhooks/meta — Receive Meta Lead Ads notifications
 *
 * Facebook sends leadgen events when someone fills a Lead Ad form.
 * The payload contains the lead ID — we fetch full data from Graph API.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[META] Webhook received:', JSON.stringify(body).substring(0, 300))

    // Meta sends { object, entry: [{ id, time, changes: [{ field, value }] }] }
    if (body.object !== 'page' && body.object !== 'instagram') {
      // Acknowledge but ignore non-lead events
      return NextResponse.json({ received: true })
    }

    const entries = body.entry || []
    let leadsCreated = 0

    for (const entry of entries) {
      const changes = entry.changes || []

      for (const change of changes) {
        if (change.field !== 'leadgen') continue

        const leadgenId = change.value?.leadgen_id
        const formId = change.value?.form_id
        const pageId = change.value?.page_id
        const adId = change.value?.ad_id
        const adgroupId = change.value?.adgroup_id
        const createdTime = change.value?.created_time

        if (!leadgenId) continue

        // Fetch full lead data from Graph API
        let leadData: any = null
        if (META_ACCESS_TOKEN) {
          try {
            const res = await fetch(`${GRAPH_API}/${leadgenId}?access_token=${META_ACCESS_TOKEN}`)
            if (res.ok) leadData = await res.json()
          } catch (e) {
            console.error('[META] Graph API fetch error:', e)
          }
        }

        // Parse lead fields from Graph API response
        let name = '', phone = '', email = '', city = '', state = ''
        const customFields: Record<string, string> = {}

        if (leadData?.field_data) {
          for (const field of leadData.field_data) {
            const val = field.values?.[0] || ''
            const key = (field.name || '').toLowerCase()

            if (key === 'full_name' || key === 'nombre_completo') name = val
            else if (key === 'first_name' || key === 'nombre') name = val
            else if (key === 'last_name' || key === 'apellido') name = name ? `${name} ${val}` : val
            else if (key === 'phone_number' || key === 'telefono' || key === 'phone') phone = val
            else if (key === 'email' || key === 'correo') email = val
            else if (key === 'city' || key === 'ciudad') city = val
            else if (key === 'state' || key === 'estado') state = val
            else customFields[key] = val
          }
        }

        // If no Graph API access, try to extract from change.value directly
        if (!name && change.value) {
          name = change.value.full_name || change.value.first_name || ''
          if (change.value.last_name) name = `${name} ${change.value.last_name}`.trim()
          phone = change.value.phone_number || change.value.phone || ''
          email = change.value.email || ''
        }

        if (!name && !phone && !email) {
          name = `Meta Lead ${leadgenId.substring(0, 8)}`
        }

        // Find the account that owns this page
        let agentId = null, accountId = null
        if (pageId) {
          const { data: connection } = await supabase.from('social_connections')
            .select('agent_id, account_id')
            .eq('platform', 'facebook')
            .eq('platform_user_id', pageId)
            .eq('active', true)
            .single()
          if (connection) {
            agentId = connection.agent_id
            accountId = connection.account_id
          }
        }

        // Fallback: find by form_id in meta_form_mappings
        if (!agentId && formId) {
          const { data: mapping } = await supabase.from('meta_form_mappings')
            .select('agent_id, account_id')
            .eq('form_id', formId)
            .single()
          if (mapping) {
            agentId = mapping.agent_id
            accountId = mapping.account_id
          }
        }

        // Check for duplicate by phone (last 7 digits)
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

        if (!isDuplicate) {
          const { data: lead, error } = await supabase.from('leads').insert({
            name: name || 'Meta Lead',
            phone: phone || '',
            email: email || null,
            state: state || null,
            city: city || null,
            insurance_type: customFields.product || customFields.interest || 'Otro',
            stage: 'new',
            score: 40,
            source: 'meta_lead_ads',
            utm_source: 'facebook',
            utm_campaign: adgroupId || adId || formId || '',
            notes: Object.keys(customFields).length > 0 ? `Campos extra: ${JSON.stringify(customFields)}` : null,
            agent_id: agentId,
            account_id: accountId,
          }).select('id').single()

          if (!error) {
            leadsCreated++

            // Link lead to campaign automatically
            if (lead?.id && agentId) {
              try {
                const { linkLeadToCampaign, incrementCampaignLeadCount } = await import('@/lib/campaign-tracker')

                // Try to find campaign by trigger message or custom fields
                const triggerMessage = customFields.product || customFields.interest || customFields.service || ''
                if (triggerMessage) {
                  const campaignLink = await linkLeadToCampaign(lead.id, triggerMessage, agentId)

                  if (campaignLink.campaignId) {
                    // Update lead with campaign info
                    await supabase.from('leads')
                      .update({ campaign_id: campaignLink.campaignId, campaign_name: campaignLink.campaignName })
                      .eq('id', lead.id)

                    // Increment campaign leads count
                    await incrementCampaignLeadCount(campaignLink.campaignId)

                    console.log(`[META] Lead ${lead.id} linked to campaign: ${campaignLink.campaignName}`)
                  }
                }
              } catch (campaignErr: any) {
                console.warn('[META] Campaign linking failed:', campaignErr.message)
                // Continue anyway, lead is still created
              }
            }
          }

          // Log
          await supabase.from('integration_log').insert({
            account_id: accountId,
            platform: 'meta_lead_ads',
            event_type: 'lead.inbound',
            payload: { leadgenId, formId, pageId, adId, name, phone, email },
            status: error ? 'error' : 'success',
          })
        }
      }
    }

    console.log(`[META] Processed ${leadsCreated} new leads`)
    return NextResponse.json({ received: true, leads_created: leadsCreated })

  } catch (err: any) {
    console.error('[META] Webhook error:', err)
    // Always return 200 to Meta so they don't disable the webhook
    return NextResponse.json({ received: true, error: err.message })
  }
}
