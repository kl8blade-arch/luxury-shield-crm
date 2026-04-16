import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Extract context (family, needs, pain points) from lead messages
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

    // Simple extraction logic - can be enhanced with Claude later
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

    // Update lead with extracted insights
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

      await supabase
        .from('leads')
        .update({ extracted_insights: allInsights })
        .eq('id', leadId)

      console.log(`[extract-context] Updated insights for ${leadId}: ${allInsights}`)
    }

    return NextResponse.json({ success: true, insights })
  } catch (e: any) {
    console.error('[extract-context] Error:', e.message)
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    )
  }
}
