import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * Campaign Tracker v1
 * Tracks leads, conversions, and campaign statistics for Meta campaigns
 */

interface CampaignStats {
  campaignId: string
  campaignName: string
  leadsCount: number
  conversionsCount: number
  conversionRate: number
  totalSpent: number
  costPerLead: number
}

/**
 * 1. Link lead to campaign automatically by trigger message
 * Called when a lead comes from Meta
 */
export async function linkLeadToCampaign(
  leadId: string,
  message: string,
  agentId: string
): Promise<{ campaignId?: string; campaignName?: string; error?: string }> {
  try {
    if (!message || !agentId) {
      return { error: 'Message and agentId required' }
    }

    const messageLower = message.toLowerCase().trim()

    // Find campaign by trigger_message matching
    const { data: campaign, error } = await supabase
      .from('meta_campaigns')
      .select('id, name')
      .eq('agent_id', agentId)
      .eq('status', 'active')
      .like('trigger_message', `%${messageLower}%`)
      .single()

    if (error || !campaign) {
      console.log(`[CAMPAIGN-TRACKER] No campaign found for trigger: "${messageLower}"`)
      return { error: 'Campaign not found' }
    }

    // Link lead to campaign
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
      })
      .eq('id', leadId)

    if (updateError) {
      console.error(`[CAMPAIGN-TRACKER] Failed to link lead ${leadId} to campaign:`, updateError)
      return { error: updateError.message }
    }

    console.log(`[CAMPAIGN-TRACKER] ✅ Lead ${leadId} linked to campaign: ${campaign.name}`)
    return { campaignId: campaign.id, campaignName: campaign.name }
  } catch (err: any) {
    console.error('[CAMPAIGN-TRACKER] Error linking lead to campaign:', err.message)
    return { error: err.message }
  }
}

/**
 * 2. Record a conversion (lead became customer)
 * Called when a lead is marked as converted/won
 */
export async function recordConversion(
  leadId: string,
  conversionValue?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the lead to find its campaign
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('campaign_id, stage, converted_at')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return { success: false, error: 'Lead not found' }
    }

    // If no campaign, can't record conversion for campaign
    if (!lead.campaign_id) {
      console.log(`[CAMPAIGN-TRACKER] Lead ${leadId} has no campaign, skipping conversion tracking`)
      return { success: true } // Not an error, just no campaign
    }

    // Mark lead as converted
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        stage: 'converted',
        converted_at: new Date().toISOString(),
        conversion_value: conversionValue || 0,
      })
      .eq('id', leadId)

    if (updateError) {
      console.error(`[CAMPAIGN-TRACKER] Failed to mark lead as converted:`, updateError)
      return { success: false, error: updateError.message }
    }

    // Record in conversion log
    await supabase.from('campaign_conversions').insert({
      lead_id: leadId,
      campaign_id: lead.campaign_id,
      conversion_value: conversionValue || 0,
      converted_at: new Date().toISOString(),
    })

    console.log(`[CAMPAIGN-TRACKER] ✅ Conversion recorded for lead ${leadId}, value: $${conversionValue || 0}`)
    return { success: true }
  } catch (err: any) {
    console.error('[CAMPAIGN-TRACKER] Error recording conversion:', err.message)
    return { success: false, error: err.message }
  }
}

/**
 * 3. Get campaign statistics
 * Returns leads count, conversions, rates, and ROI metrics
 */
export async function getCampaignStats(campaignId: string): Promise<CampaignStats | null> {
  try {
    // Get campaign info
    const { data: campaign, error: campaignError } = await supabase
      .from('meta_campaigns')
      .select('id, name, leads_count')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error(`[CAMPAIGN-TRACKER] Campaign ${campaignId} not found`)
      return null
    }

    // Count total leads for this campaign
    const { count: leadsCount, error: leadsError } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId)

    if (leadsError) {
      console.error(`[CAMPAIGN-TRACKER] Error counting leads:`, leadsError)
      return null
    }

    // Count conversions
    const { data: conversions, error: convError } = await supabase
      .from('campaign_conversions')
      .select('conversion_value')
      .eq('campaign_id', campaignId)

    if (convError) {
      console.error(`[CAMPAIGN-TRACKER] Error counting conversions:`, convError)
      return null
    }

    const conversionsCount = conversions?.length || 0
    const totalSpent = conversions?.reduce((sum, c) => sum + (c.conversion_value || 0), 0) || 0
    const conversionRate = leadsCount && leadsCount > 0 ? (conversionsCount / leadsCount) * 100 : 0
    const costPerLead = leadsCount && leadsCount > 0 ? totalSpent / leadsCount : 0

    const stats: CampaignStats = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      leadsCount: leadsCount || 0,
      conversionsCount,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      costPerLead: parseFloat(costPerLead.toFixed(2)),
    }

    console.log(`[CAMPAIGN-TRACKER] Stats for ${campaign.name}:`, stats)
    return stats
  } catch (err: any) {
    console.error('[CAMPAIGN-TRACKER] Error getting campaign stats:', err.message)
    return null
  }
}

/**
 * 4. Update campaign leads count
 * Called after a new lead is created from Meta
 */
export async function incrementCampaignLeadCount(campaignId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment_campaign_leads', {
      campaign_id: campaignId,
    })

    if (error) {
      console.error(`[CAMPAIGN-TRACKER] Error incrementing leads count:`, error)
      // Fallback: update directly
      const { data: campaign } = await supabase
        .from('meta_campaigns')
        .select('leads_count')
        .eq('id', campaignId)
        .single()

      if (campaign) {
        await supabase
          .from('meta_campaigns')
          .update({ leads_count: (campaign.leads_count || 0) + 1 })
          .eq('id', campaignId)
      }
    }

    console.log(`[CAMPAIGN-TRACKER] ✅ Campaign ${campaignId} leads count incremented`)
    return true
  } catch (err: any) {
    console.error('[CAMPAIGN-TRACKER] Error incrementing leads:', err.message)
    return false
  }
}

/**
 * 5. Get all campaigns for an agent with their stats
 */
export async function getAgentCampaigns(agentId: string): Promise<CampaignStats[]> {
  try {
    const { data: campaigns, error } = await supabase
      .from('meta_campaigns')
      .select('id')
      .eq('agent_id', agentId)
      .eq('status', 'active')

    if (error || !campaigns) {
      return []
    }

    const stats: CampaignStats[] = []
    for (const campaign of campaigns) {
      const stat = await getCampaignStats(campaign.id)
      if (stat) stats.push(stat)
    }

    return stats
  } catch (err: any) {
    console.error('[CAMPAIGN-TRACKER] Error getting agent campaigns:', err.message)
    return []
  }
}

/**
 * 6. Create a new campaign
 */
export async function createCampaign(
  agentId: string,
  name: string,
  triggerMessage: string,
  adImageUrl?: string
): Promise<{ campaignId?: string; error?: string }> {
  try {
    const { data: campaign, error } = await supabase
      .from('meta_campaigns')
      .insert({
        agent_id: agentId,
        name,
        trigger_message: triggerMessage.toLowerCase().trim(),
        ad_image_url: adImageUrl || null,
        status: 'active',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[CAMPAIGN-TRACKER] Error creating campaign:', error)
      return { error: error.message }
    }

    console.log(`[CAMPAIGN-TRACKER] ✅ Campaign created: ${name} (${campaign.id})`)
    return { campaignId: campaign.id }
  } catch (err: any) {
    console.error('[CAMPAIGN-TRACKER] Error creating campaign:', err.message)
    return { error: err.message }
  }
}
