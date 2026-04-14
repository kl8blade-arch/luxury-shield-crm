import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Detects if an incoming message comes from a Meta campaign
 * Matches trigger keywords in the message text
 * If agentId is null, searches across all agents' campaigns
 */
export async function detectCampaign(
  incomingMessage: string,
  agentId: string | null
): Promise<{ id: string; name: string; trigger_message: string; agent_id: string } | null> {
  try {
    let query = supabase
      .from('meta_campaigns')
      .select('id, name, trigger_message, agent_id')
      .eq('status', 'active')

    // If agentId specified, filter to that agent's campaigns
    // Otherwise, search all campaigns
    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data: campaigns, error } = await query

    if (error || !campaigns?.length) {
      console.log(`[CAMPAIGN-DETECTION] No active campaigns found${agentId ? ` for agent ${agentId}` : ' (global search)'}`)
      return null
    }

    const lower = incomingMessage.toLowerCase().trim()

    // First try exact or near-exact matches
    for (const campaign of campaigns) {
      const trigger = campaign.trigger_message.toLowerCase()
      if (lower.includes(trigger)) {
        console.log(`[CAMPAIGN-DETECTION] ✅ Campaign detected: "${campaign.name}" (trigger: "${trigger}") — Agent: ${campaign.agent_id}`)
        return { id: campaign.id, name: campaign.name, trigger_message: trigger, agent_id: campaign.agent_id }
      }
    }

    // Fallback: check for partial matches (first 3 chars)
    for (const campaign of campaigns) {
      const trigger = campaign.trigger_message.toLowerCase()
      if (trigger.length >= 3 && lower.includes(trigger.substring(0, 3))) {
        console.log(`[CAMPAIGN-DETECTION] ⚠️ Partial campaign match: "${campaign.name}" — Agent: ${campaign.agent_id}`)
        return { id: campaign.id, name: campaign.name, trigger_message: trigger, agent_id: campaign.agent_id }
      }
    }

    console.log(`[CAMPAIGN-DETECTION] No campaign match for message: "${incomingMessage.substring(0, 50)}"`)
    return null
  } catch (err: any) {
    console.error('[CAMPAIGN-DETECTION] Error detecting campaign:', err.message)
    return null
  }
}

/**
 * Increment the leads count for a campaign
 * Uses RPC function if available, falls back to direct update
 */
export async function incrementCampaignLeads(campaignId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment_campaign_leads', {
      campaign_id: campaignId,
    })

    if (error) {
      // Fallback to direct update
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
        console.log(`[CAMPAIGN-DETECTION] ✅ Campaign leads incremented (fallback)`)
        return true
      }
    } else {
      console.log(`[CAMPAIGN-DETECTION] ✅ Campaign leads incremented (RPC)`)
      return true
    }
  } catch (err: any) {
    console.error('[CAMPAIGN-DETECTION] Error incrementing leads:', err.message)
  }
  return false
}

/**
 * Link a lead to a campaign based on detection
 */
export async function linkLeadToCampaignByMessage(
  leadId: string,
  message: string,
  agentId: string | null
): Promise<{ success: boolean; campaignId?: string; campaignName?: string; agentId?: string }> {
  try {
    const campaign = await detectCampaign(message, agentId)

    if (!campaign) {
      return { success: false }
    }

    const { error } = await supabase
      .from('leads')
      .update({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
      })
      .eq('id', leadId)

    if (error) {
      console.error('[CAMPAIGN-DETECTION] Error linking lead:', error)
      return { success: false }
    }

    // Increment campaign leads count
    await incrementCampaignLeads(campaign.id)

    console.log(`[CAMPAIGN-DETECTION] ✅ Lead ${leadId} linked to campaign: ${campaign.name} (Agent: ${campaign.agent_id})`)
    return { success: true, campaignId: campaign.id, campaignName: campaign.name, agentId: campaign.agent_id }
  } catch (err: any) {
    console.error('[CAMPAIGN-DETECTION] Error in linkLeadToCampaignByMessage:', err.message)
    return { success: false }
  }
}

/**
 * Get campaign by ID with detailed info
 */
export async function getCampaignInfo(campaignId: string) {
  try {
    const { data: campaign, error } = await supabase
      .from('meta_campaigns')
      .select('id, name, trigger_message, leads_count, platform, status')
      .eq('id', campaignId)
      .single()

    if (error || !campaign) {
      return null
    }

    return campaign
  } catch (err: any) {
    console.error('[CAMPAIGN-DETECTION] Error getting campaign info:', err.message)
    return null
  }
}
