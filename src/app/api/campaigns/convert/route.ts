import { NextRequest, NextResponse } from 'next/server'
import { recordConversion } from '@/lib/campaign-tracker'

/**
 * POST /api/campaigns/convert
 * Records a lead conversion (lead became customer)
 * Body: { leadId: string, conversionValue?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { leadId, conversionValue } = await req.json()

    if (!leadId) {
      return NextResponse.json({ error: 'leadId required' }, { status: 400 })
    }

    const result = await recordConversion(leadId, conversionValue || 0)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Lead ${leadId} marked as converted. Value: $${conversionValue || 0}`,
    })
  } catch (err: any) {
    console.error('[CAMPAIGNS/CONVERT] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
