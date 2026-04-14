import { NextRequest, NextResponse } from 'next/server'
import { getAgentCampaigns } from '@/lib/campaign-tracker'

/**
 * GET /api/campaigns/stats
 * Returns all campaigns for an agent with their statistics
 * Query: ?agentId={{AGENT_UUID}}
 */
export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json({ error: 'agentId query parameter required' }, { status: 400 })
    }

    const campaigns = await getAgentCampaigns(agentId)

    return NextResponse.json({
      success: true,
      campaigns,
      totalLeads: campaigns.reduce((sum, c) => sum + c.leadsCount, 0),
      totalConversions: campaigns.reduce((sum, c) => sum + c.conversionsCount, 0),
      totalRevenue: campaigns.reduce((sum, c) => sum + c.totalSpent, 0),
      avgConversionRate: campaigns.length > 0
        ? parseFloat((campaigns.reduce((sum, c) => sum + c.conversionRate, 0) / campaigns.length).toFixed(2))
        : 0,
    })
  } catch (err: any) {
    console.error('[CAMPAIGNS/STATS] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
