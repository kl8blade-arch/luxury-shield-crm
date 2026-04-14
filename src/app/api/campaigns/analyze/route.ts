import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/token-tracker'

/**
 * POST /api/campaigns/analyze
 * AI-powered campaign analysis using Claude
 * Body: { campaign, allCampaigns }
 */
export async function POST(req: NextRequest) {
  try {
    const { campaign, allCampaigns } = await req.json()

    if (!campaign) {
      return NextResponse.json({ error: 'campaign required' }, { status: 400 })
    }

    // Build comparison context
    const otherCampaigns = allCampaigns.filter((c: any) => c.id !== campaign.id)
    const avgConversionRate =
      otherCampaigns.length > 0
        ? otherCampaigns.reduce((sum: number, c: any) => sum + (c.conversion_rate || 0), 0) / otherCampaigns.length
        : 0
    const avgCostPerLead =
      otherCampaigns.length > 0
        ? otherCampaigns.reduce((sum: number, c: any) => sum + (c.cost_per_lead || 0), 0) / otherCampaigns.length
        : 0

    const prompt = `Analiza esta campaña de marketing y proporciona insights accionables.

**Campaña Actual:**
- Nombre: ${campaign.name}
- Trigger/Palabra clave: ${campaign.trigger_message}
- Leads capturados: ${campaign.leads_count}
- Conversiones: ${campaign.conversions_count || 0}
- Tasa de conversión: ${campaign.conversion_rate?.toFixed(2) || 0}%
- Costo por lead: $${campaign.cost_per_lead?.toFixed(2) || 0}
- Total invertido: $${campaign.total_spent?.toFixed(2) || 0}

**Comparación con otras campañas:**
- Tasa de conversión promedio: ${avgConversionRate.toFixed(2)}%
- Costo por lead promedio: $${avgCostPerLead.toFixed(2)}

**Requerimientos del análisis:**

1. **Factor WOW**: Identifica en 1 frase el elemento más diferenciador y exitoso de esta campaña que la hace únicamente efectiva. Qué es lo que la hace especial comparada con otras. Sé específico y accionable.

2. **Scores (0-100)**:
   - Fortaleza: ¿Qué tan bien está funcionando esta campaña?
   - Debilidad: ¿Cuál es su principal limitación?

3. **Comparación**:
   - Mejor métrica: ¿En qué está ganando?
   - Peor métrica: ¿En qué está perdiendo?
   - Tendencia: ¿Está creciendo, decayendo o estable?

4. **3 Recomendaciones accionables**:
   - Cómo replicar el "factor WOW" en otras campañas
   - Qué cambiar para mejorar debilidades
   - Oportunidades de escala

Responde en formato JSON:
{
  "wowFactor": "...",
  "strengthScore": 75,
  "weaknessScore": 25,
  "comparison": {
    "bestMetric": "Tasa de conversión (35%)",
    "worstMetric": "Cantidad de leads (50)",
    "trend": "Crecimiento mensual del 15%"
  },
  "recommendations": ["...", "...", "..."]
}`

    const aiResponse = await callAI({
      agentId: campaign.agent_id,
      feature: 'other',
      model: 'claude-opus-4-6',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      maxTokens: 1024,
    })

    // Extract JSON from response
    const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/)
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null

    if (!analysis) {
      throw new Error('Failed to parse analysis')
    }

    return NextResponse.json({
      success: true,
      analysis,
    })
  } catch (err: any) {
    console.error('[CAMPAIGNS/ANALYZE] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
