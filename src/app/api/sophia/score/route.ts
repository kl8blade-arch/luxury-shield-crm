import { NextRequest, NextResponse } from 'next/server'
import { calculateSophiaScore } from '@/lib/sophia-score'

export async function POST(request: NextRequest) {
  try {
    const { leadId } = await request.json()

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    }

    // Calculate score (non-blocking from caller's perspective)
    const score = await calculateSophiaScore(leadId)

    return NextResponse.json({ success: true, score })
  } catch (e) {
    console.error('[Sophia Score API] Error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
