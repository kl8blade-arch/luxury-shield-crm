import { NextRequest, NextResponse } from 'next/server'
import { createCampaign } from '@/lib/campaign-tracker'

/**
 * POST /api/campaigns/create
 * Creates a new Meta campaign
 * Body: { agentId: string, name: string, triggerMessage: string, adImageUrl?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { agentId, name, triggerMessage, adImageUrl } = await req.json()

    if (!agentId || !name || !triggerMessage) {
      return NextResponse.json({
        error: 'agentId, name, and triggerMessage are required',
      }, { status: 400 })
    }

    const result = await createCampaign(agentId, name, triggerMessage, adImageUrl)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      campaignId: result.campaignId,
      message: `Campaign "${name}" created successfully`,
    })
  } catch (err: any) {
    console.error('[CAMPAIGNS/CREATE] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
