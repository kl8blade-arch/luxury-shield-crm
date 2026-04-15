// app/api/reactivation/start/route.ts
// Inicia una secuencia de reactivación para un lead.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startReactivationSequence, type ReactivationProduct } from '@/lib/reactivation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lead_id, account_id, product, triggered_by } = body

    if (!lead_id || !account_id) {
      return NextResponse.json(
        { success: false, error: 'lead_id and account_id are required' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: lead, error } = await supabase
      .from('leads')
      .select('id, name, reactivation_opt_out')
      .eq('id', lead_id)
      .eq('account_id', account_id)
      .single()

    if (error || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    if (lead.reactivation_opt_out) {
      return NextResponse.json({ ok: false, reason: 'opted_out' })
    }

    const result = await startReactivationSequence(
      supabase,
      lead_id,
      account_id,
      (product ?? 'general') as ReactivationProduct
    )

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    console.log(`[reactivation:start] ${result.sequenceId} — lead ${lead_id} — ${triggered_by ?? 'unknown'}`)
    return NextResponse.json({ ok: true, sequence_id: result.sequenceId })

  } catch (error) {
    console.error('[reactivation:start] error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
