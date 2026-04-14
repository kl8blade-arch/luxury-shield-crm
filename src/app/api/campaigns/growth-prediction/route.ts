import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

interface GrowthPrediction {
  currentTrend: string
  predictedLeadsNext7Days: number
  predictedLeadsNext30Days: number
  growthRate: number
  confidence: number
  recommendations: string[]
}

/**
 * POST /api/campaigns/growth-prediction
 * Predict campaign growth based on historical data
 * Body: { campaignId }
 */
export async function POST(req: NextRequest) {
  try {
    const { campaignId } = await req.json()

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }

    // Get campaign info
    const { data: campaign, error: campaignError } = await supabase
      .from('meta_campaigns')
      .select('id, name, leads_count, created_at, growth_prediction_enabled')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!campaign.growth_prediction_enabled) {
      return NextResponse.json({
        success: false,
        message: 'Growth prediction disabled for this campaign',
      })
    }

    // Get daily lead counts for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('created_at')
      .eq('campaign_id', campaignId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at')

    if (leadsError) {
      console.error('[GROWTH-PREDICTION] Error fetching leads:', leadsError)
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    // Calculate daily lead distribution
    const dailyCounts: Record<string, number> = {}
    const today = new Date()

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      dailyCounts[dateStr] = 0
    }

    ;(leads || []).forEach((lead: any) => {
      const dateStr = new Date(lead.created_at).toISOString().split('T')[0]
      if (dailyCounts[dateStr] !== undefined) {
        dailyCounts[dateStr]++
      }
    })

    const counts = Object.values(dailyCounts)
    const totalLeads = counts.reduce((a, b) => a + b, 0)
    const avgDailyLeads = totalLeads / 30
    const lastWeekLeads = counts.slice(-7).reduce((a, b) => a + b, 0)
    const previousWeekLeads = counts.slice(-14, -7).reduce((a, b) => a + b, 0)

    // Calculate growth rate
    let growthRate = 0
    if (previousWeekLeads > 0) {
      growthRate = ((lastWeekLeads - previousWeekLeads) / previousWeekLeads) * 100
    }

    // Calculate confidence (more data = more confidence)
    const dataQuality = Math.min(100, (totalLeads / 10) * 100)
    const confidence = Math.round(Math.max(30, Math.min(95, dataQuality)))

    // Predictions
    const predictedLeadsNext7Days = Math.round(lastWeekLeads * (1 + growthRate / 100))
    const predictedLeadsNext30Days = Math.round(avgDailyLeads * 30 * (1 + growthRate / 100))

    // Determine trend
    let currentTrend = 'estable'
    if (growthRate > 10) currentTrend = '📈 Crecimiento fuerte'
    else if (growthRate > 0) currentTrend = '📈 Crecimiento moderado'
    else if (growthRate < -10) currentTrend = '📉 Decline moderado'
    else if (growthRate < -25) currentTrend = '📉 Decline crítico'

    // Generate recommendations
    const recommendations: string[] = []

    if (growthRate > 20) {
      recommendations.push('🎯 Alto crecimiento detectado. Considera escalar budget en Meta Ads para maximizar ROI')
      recommendations.push('💰 Mantén la estrategia actual, está funcionando muy bien')
      recommendations.push('📊 Analiza qué elemento (creativo, audiencia, oferta) está funcionando mejor')
    } else if (growthRate > 0 && growthRate <= 20) {
      recommendations.push('✅ Crecimiento estable. Optimiza los creativos para acelerar')
      recommendations.push('🎨 Prueba variantes de imágenes o copy en el formulario')
      recommendations.push('🎯 Refina la audiencia objetivo para mayor relevancia')
    } else if (growthRate >= -10 && growthRate <= 0) {
      recommendations.push('⚠️ Crecimiento estancado. Es momento de hacer cambios')
      recommendations.push('🔄 Rota creativos, cambia la audiencia o ajusta la oferta')
      recommendations.push('📝 Revisa el factor WOW en el dashboard para identificar debilidades')
    } else {
      recommendations.push('🚨 Decline detectado. Acción inmediata recomendada')
      recommendations.push('💡 A/B test nuevos creativos y mensajes')
      recommendations.push('📍 Verifica que la audiencia esté correctamente segmentada')
    }

    const prediction: GrowthPrediction = {
      currentTrend,
      predictedLeadsNext7Days,
      predictedLeadsNext30Days,
      growthRate: Math.round(growthRate * 100) / 100,
      confidence,
      recommendations,
    }

    console.log('[GROWTH-PREDICTION] ✅ Prediction calculated for campaign:', campaign.name)

    return NextResponse.json({
      success: true,
      prediction,
      dataPoints: {
        totalLeadsLast30Days: totalLeads,
        avgDailyLeads: Math.round(avgDailyLeads * 100) / 100,
        lastWeekLeads,
        previousWeekLeads,
      },
    })
  } catch (err: any) {
    console.error('[GROWTH-PREDICTION] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
