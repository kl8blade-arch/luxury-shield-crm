// src/app/api/leads/[id]/stage/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiError, errorHandler } from '@/lib/errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_STAGES = [
  'nuevo','calificando','presentando','objecion','agendado',
  'listo_comprar','closed_won','closed_lost','no_califica',
  'new','contact','contacted','interested','proposal',
  'negotiation','unqualified','seguimiento','seguimiento_agente',
]

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { stage, agentId } = body

    if (!stage) throw new ApiError(400, 'Missing stage')
    if (!agentId) throw new ApiError(400, 'Missing agentId')
    if (!VALID_STAGES.includes(stage)) throw new ApiError(400, `Invalid stage: ${stage}`)

    const { data: lead, error: fetchErr } = await supabase
      .from('leads').select('id, agent_id, stage')
      .eq('id', id).eq('agent_id', agentId).single()

    if (fetchErr || !lead) throw new ApiError(404, 'Lead not found or access denied')

    const { data: updated, error: updateErr } = await supabase
      .from('leads')
      .update({ stage, updated_at: new Date().toISOString(), last_contact: new Date().toISOString() })
      .eq('id', id).eq('agent_id', agentId)
      .select('id, stage, name').single()

    if (updateErr) throw new ApiError(500, updateErr.message)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return errorHandler(error)
  }
}
