import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Extract context (family, needs, pain points, existing insurance) from lead messages
 * Called non-blocking after each Sophia response
 */
export async function POST(req: NextRequest) {
  try {
    const { leadId, agentId, message } = await req.json()

    if (!leadId || !message) {
      return NextResponse.json(
        { error: 'Missing leadId or message' },
        { status: 400 }
      )
    }

    console.log(`[extract-context] Processing message for lead ${leadId}`)

    // Extract structured context
    interface ContextItem {
      type: string
      key: string
      value: string
      source: string
    }

    const context: ContextItem[] = []
    const insights: string[] = []

    // Detect family mentions
    if (/\bhij[oa]s?\b|\bpadres?\b|\bmadre\b|\bpadre\b|\bfamilia\b|\bfamiliar\b/i.test(message)) {
      insights.push('menciona familia')
    }

    // Detect pain points
    if (/\bdolor\b|\bduele\b|\benfermo\b|\benfermed/i.test(message)) {
      insights.push('menciona dolor/enfermedad')
    }

    // Detect financial concerns
    if (/\bcaro\b|\bprecio\b|\bdineRo\b|\beconom/i.test(message)) {
      insights.push('menciona precio/dinero')
    }

    // Detect urgency
    if (/\byaja?\b|\bpronto\b|\bah?ora\b|\burgen/i.test(message)) {
      insights.push('urgencia')
    }

    // ── EXISTENTE: Detectar seguros existentes ──
    const existingInsuranceSignals = [
      'ya tengo seguro', 'ya soy cliente', 'ya estoy asegurado',
      'tengo cobertura', 'tengo un plan', 'ya tengo plan',
      'mi seguro', 'mi plan', 'mi compañía de seguro',
      'already have', 'already insured', 'i have insurance',
      'have coverage', 'have a plan',
      'florida blue', 'molina', 'ambetter', 'oscar', 'simply healthcare',
      'bright health', 'friday health', 'aetna', 'cigna', 'humana',
      'united', 'medicare advantage', 'medicaid', 'chip',
      'i have medicaid', 'tengo medicaid', 'tengo medicare',
    ]

    const lower = message.toLowerCase()
    const hasExistingInsurance = existingInsuranceSignals.some(s => lower.includes(s))

    if (hasExistingInsurance) {
      // Detectar carrier específico
      const carriers: Record<string, string[]> = {
        'Florida Blue':      ['florida blue', 'blue cross', 'bcbs'],
        'Molina':            ['molina'],
        'Ambetter':          ['ambetter'],
        'Oscar Health':      ['oscar'],
        'Simply Healthcare': ['simply', 'simply healthcare'],
        'Bright Health':     ['bright health'],
        'Aetna':             ['aetna', 'cvs'],
        'Cigna':             ['cigna'],
        'Humana':            ['humana'],
        'UnitedHealthcare':  ['united', 'uhc'],
        'Medicaid':          ['medicaid'],
        'Medicare':          ['medicare'],
      }

      let detectedCarrier = ''
      for (const [carrier, keywords] of Object.entries(carriers)) {
        if (keywords.some(k => lower.includes(k))) {
          detectedCarrier = carrier
          break
        }
      }

      if (detectedCarrier) {
        context.push({
          type: 'existing_insurance',
          key: 'carrier_actual',
          value: detectedCarrier,
          source: message.substring(0, 100)
        })
        insights.push('cliente de competidor detectado')
      } else {
        context.push({
          type: 'existing_insurance',
          key: 'carrier_actual',
          value: 'Unknown',
          source: message.substring(0, 100)
        })
        insights.push('cliente existente con otro seguro')
      }
    }

    // ── COSTO: Detectar costo del plan actual ──
    const priceRegex = /\$?\d+(?:,\d{3})*(?:\.\d{2})?|(\d+)\s*(?:dólares?|pesos|euros|al mes|monthly|per month)/i
    const priceMatch = message.match(priceRegex)
    if (priceMatch) {
      context.push({
        type: 'financial',
        key: 'premium_actual',
        value: priceMatch[0],
        source: message.substring(Math.max(0, priceMatch.index! - 10), Math.min(message.length, priceMatch.index! + 40))
      })
      insights.push('menciona costo actual')
    }

    // ── GAP: Detectar coberturas faltantes ──
    const gapSignals = [
      'no cubre', 'no me cubre', 'no está cubierto',
      'doesn\'t cover', 'not covered', 'no coverage',
      'me falta cobertura', 'necesito más cobertura',
      'falta', 'no incluye', 'excluded',
    ]

    if (gapSignals.some(s => lower.includes(s))) {
      // Intentar extraer qué no cubre
      const afterSignal = message.substring(message.toLowerCase().search(gapSignals.join('|')))
      context.push({
        type: 'gap',
        key: 'cobertura_faltante',
        value: afterSignal.substring(0, 100),
        source: afterSignal.substring(0, 50)
      })
      insights.push('identifica gap en cobertura')
    }

    // Update lead with extracted context and insights
    if (context.length > 0 || insights.length > 0) {
      const updates: Record<string, any> = {}

      // Process context items
      context.forEach(c => {
        if (c.type === 'existing_insurance') {
          updates.existing_carrier = c.value
          updates.is_competitor_client = true
          if (!updates.winback_stage) updates.winback_stage = 'detected'
        }
        if (c.key === 'cobertura_faltante') {
          updates.winback_stage = 'gap_found'
        }
        if (c.type === 'financial' && c.key === 'premium_actual') {
          updates.current_premium = c.value
        }
      })

      // Update insights
      if (insights.length > 0) {
        const existingInsights = (await supabase
          .from('leads')
          .select('extracted_insights')
          .eq('id', leadId)
          .single()
          .then(r => r.data?.extracted_insights || '')
        ) as string

        const allInsights = [existingInsights, ...insights]
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i) // unique
          .join(' | ')

        updates.extracted_insights = allInsights
      }

      // Apply updates
      await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId)

      console.log(`[extract-context] Updated lead ${leadId}:`, updates)
    }

    return NextResponse.json({ success: true, context, insights })
  } catch (e: any) {
    console.error('[extract-context] Error:', e.message)
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    )
  }
}
