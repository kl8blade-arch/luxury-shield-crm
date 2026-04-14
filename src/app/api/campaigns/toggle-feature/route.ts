import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/campaigns/toggle-feature
 * Toggle campaign features on/off
 * Body: { campaignId, feature: 'notifications' | 'pdf_export' | 'growth_prediction', enabled: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const { campaignId, feature, enabled } = await req.json()

    if (!campaignId || !feature) {
      return NextResponse.json({ error: 'campaignId and feature required' }, { status: 400 })
    }

    const featureMap: Record<string, string> = {
      notifications: 'notify_on_conversion',
      pdf_export: 'export_pdf_enabled',
      growth_prediction: 'growth_prediction_enabled',
    }

    const columnName = featureMap[feature]
    if (!columnName) {
      return NextResponse.json({ error: 'Unknown feature' }, { status: 400 })
    }

    const { error } = await supabase
      .from('meta_campaigns')
      .update({ [columnName]: enabled })
      .eq('id', campaignId)

    if (error) {
      console.error('[TOGGLE-FEATURE] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log(`[TOGGLE-FEATURE] Campaign ${campaignId} - ${feature} set to ${enabled}`)
    return NextResponse.json({
      success: true,
      message: `Feature "${feature}" ${enabled ? 'enabled' : 'disabled'}`,
    })
  } catch (err: any) {
    console.error('[TOGGLE-FEATURE] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
