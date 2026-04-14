import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/campaigns/export-pdf
 * Generate HTML report for campaign analysis (can be printed as PDF)
 * Body: { campaignId, analysis, allCampaigns }
 */
export async function POST(req: NextRequest) {
  try {
    const { campaignId, analysis, allCampaigns } = await req.json()

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }

    // Get campaign info
    const { data: campaign, error } = await supabase
      .from('meta_campaigns')
      .select('id, name, trigger_message, leads_count, conversions_count, conversion_value, created_at, export_pdf_enabled')
      .eq('id', campaignId)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!campaign.export_pdf_enabled) {
      return NextResponse.json({
        success: false,
        message: 'PDF export disabled for this campaign',
      })
    }

    // Calculate conversion rate
    const conversionRate = campaign.leads_count > 0 ? (campaign.conversions_count / campaign.leads_count) * 100 : 0

    // Build comparison stats
    const otherCampaigns = allCampaigns.filter((c: any) => c.id !== campaignId)
    const avgConversionRate =
      otherCampaigns.length > 0
        ? otherCampaigns.reduce((sum: number, c: any) => {
            const rate = (c.conversions_count && c.leads_count) ? (c.conversions_count / c.leads_count) * 100 : 0
            return sum + rate
          }, 0) / otherCampaigns.length
        : 0

    const timestamp = new Date().toLocaleString('es-ES')

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Campaña: ${campaign.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #050507 0%, #1a1a1f 100%); color: #C9A84C; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header p { font-size: 14px; color: #aaa; }
    .section { background: white; padding: 25px; margin-bottom: 20px; border-radius: 8px; border-left: 4px solid #C9A84C; }
    .section h2 { color: #C9A84C; font-size: 18px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .metric { background: #f9f9f9; padding: 15px; border-radius: 6px; text-align: center; }
    .metric-label { font-size: 12px; color: #999; uppercase; margin-bottom: 8px; }
    .metric-value { font-size: 28px; font-weight: bold; color: #C9A84C; }
    .analysis-box { background: #fafafa; padding: 15px; border-radius: 6px; margin: 10px 0; }
    .wow-factor { background: linear-gradient(135deg, rgba(201,168,76,0.1) 0%, rgba(201,168,76,0.05) 100%); border-left: 4px solid #C9A84C; padding: 15px; border-radius: 6px; }
    .strength-bar, .weakness-bar { height: 8px; border-radius: 4px; margin: 8px 0; }
    .strength-bar { background: #4ade80; }
    .weakness-bar { background: #f87171; }
    .recommendation { background: white; padding: 10px; margin: 8px 0; border-left: 3px solid #3b82f6; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    .page-break { page-break-after: always; }
    @media print {
      body { background: white; }
      .container { padding: 0; background: white; }
      .footer { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>📊 ${campaign.name}</h1>
      <p>Generado: ${timestamp}</p>
      <p>Palabra clave: ${campaign.trigger_message}</p>
    </div>

    <!-- Métricas principales -->
    <div class="section">
      <h2>📈 Métricas Principales</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Leads Capturados</div>
          <div class="metric-value">${campaign.leads_count || 0}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Conversiones</div>
          <div class="metric-value">${campaign.conversions_count || 0}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Tasa Conv.</div>
          <div class="metric-value">${conversionRate.toFixed(1)}%</div>
        </div>
      </div>
    </div>

    ${analysis ? `
    <!-- Análisis IA -->
    <div class="section">
      <h2>🤖 Análisis con IA</h2>

      <div class="wow-factor">
        <strong>🎯 Factor WOW</strong>
        <p style="margin-top: 8px; font-size: 14px;">${analysis.wowFactor}</p>
      </div>

      <h3 style="color: #333; margin-top: 20px; margin-bottom: 10px; font-size: 14px;">Fortaleza: ${analysis.strengthScore}%</h3>
      <div class="strength-bar" style="width: ${analysis.strengthScore}%"></div>

      <h3 style="color: #333; margin-top: 15px; margin-bottom: 10px; font-size: 14px;">Debilidad: ${analysis.weaknessScore}%</h3>
      <div class="weakness-bar" style="width: ${analysis.weaknessScore}%"></div>

      <div class="analysis-box" style="margin-top: 20px;">
        <strong style="color: #16a34a;">✓ Mejor métrica:</strong> ${analysis.comparison.bestMetric}
      </div>
      <div class="analysis-box">
        <strong style="color: #dc2626;">✗ Peor métrica:</strong> ${analysis.comparison.worstMetric}
      </div>
      <div class="analysis-box">
        <strong style="color: #2563eb;">📈 Tendencia:</strong> ${analysis.comparison.trend}
      </div>
    </div>

    <!-- Recomendaciones -->
    <div class="section">
      <h2>💡 Recomendaciones</h2>
      ${analysis.recommendations.map((rec: string, i: number) => `
        <div class="recommendation">
          <strong style="color: #2563eb;">Recomendación ${i + 1}</strong>
          <p style="margin-top: 6px; font-size: 14px;">${rec}</p>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Comparativa -->
    ${allCampaigns && allCampaigns.length > 1 ? `
    <div class="section">
      <h2>📊 Comparativa con Otras Campañas</h2>
      <p style="margin-bottom: 15px; color: #666; font-size: 14px;">
        Tasa de conversión promedio (otras campañas): <strong>${avgConversionRate.toFixed(2)}%</strong>
      </p>
      ${conversionRate > avgConversionRate ? `
        <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 12px; border-radius: 4px; color: #047857;">
          ✅ <strong>Por encima del promedio</strong> - Esta campaña está superando el desempeño promedio
        </div>
      ` : `
        <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px; color: #991b1b;">
          ⚠️ <strong>Por debajo del promedio</strong> - Hay oportunidad de mejora
        </div>
      `}
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p>Luxury Shield CRM • Reporte generado automáticamente</p>
      <p>www.luxury-shield-crm.vercel.app</p>
    </div>
  </div>

  <script>
    // Auto-print dialog on load (user can choose to print or save as PDF)
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 500)
    })
  </script>
</body>
</html>
    `

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="campaign-${campaign.name.replace(/\s+/g, '-')}.html"`,
      },
    })
  } catch (err: any) {
    console.error('[EXPORT-PDF] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
