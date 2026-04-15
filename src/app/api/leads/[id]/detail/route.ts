// src/app/api/leads/[id]/detail/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiError, errorHandler } from '@/lib/errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    if (!agentId) throw new ApiError(400, 'Missing agentId')

    // Fetch lead + conversations in parallel
    const [leadRes, convsRes, remindersRes] = await Promise.all([
      supabase
        .from('leads')
        .select(`
          id, name, phone, email, stage, score, score_recommendation,
          insurance_type, source, city, state, age, gender,
          last_contact, next_action, next_action_date,
          notes, ready_to_buy, ia_active, conversation_mode,
          sold_product, sale_date, created_at, updated_at,
          pain_points, objections, interests, budget_range,
          occupation, income_range, preferred_language,
          contact_attempts, utm_source, utm_campaign, campaign_name
        `)
        .eq('id', id)
        .eq('agent_id', agentId)
        .single(),

      supabase
        .from('conversations')
        .select('id, message, direction, channel, created_at, sentiment, ai_summary')
        .eq('lead_id', id)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('reminders')
        .select('id, type, scheduled_at, notes, status')
        .eq('lead_id', id)
        .eq('agent_id', agentId)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true })
        .limit(5),
    ])

    if (leadRes.error || !leadRes.data) throw new ApiError(404, 'Lead not found')

    return NextResponse.json({
      success: true,
      data: {
        lead:      leadRes.data,
        convs:     convsRes.data  ?? [],
        reminders: remindersRes.data ?? [],
      }
    })
  } catch (error) {
    return errorHandler(error)
  }
}

// PATCH — update notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }      = await params
    const body        = await request.json()
    const { notes, agentId, next_action, next_action_date } = body
    if (!agentId) throw new ApiError(400, 'Missing agentId')

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (notes            !== undefined) updates.notes            = notes
    if (next_action      !== undefined) updates.next_action      = next_action
    if (next_action_date !== undefined) updates.next_action_date = next_action_date

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .eq('agent_id', agentId)
      .select('id, notes, next_action, next_action_date')
      .single()

    if (error) throw new ApiError(500, error.message)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return errorHandler(error)
  }
}
