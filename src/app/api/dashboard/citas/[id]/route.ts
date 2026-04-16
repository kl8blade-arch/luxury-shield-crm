import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAgentAuth, authError } from '@/lib/auth-middleware'
import { createFollowupForAppointment } from '@/lib/sophia-postcita'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_STATUSES = ['requested', 'confirmed', 'reminded', 'completed', 'cancelled', 'no_show', 'rescheduled']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agentId = await validateAgentAuth(request)
    const { status } = await request.json()
    const { id } = await params

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Verify appointment ownership
    const { data: appointment, error: fetchError } = await supabase
      .from('doctor_appointments')
      .select('id, agent_id')
      .eq('id', id)
      .single()

    if (fetchError || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (appointment.agent_id !== agentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update appointment status
    const { error: updateError } = await supabase
      .from('doctor_appointments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) throw updateError

    // If status becomes 'confirmed', auto-create followup
    if (status === 'confirmed') {
      await createFollowupForAppointment(id)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[Dashboard Citas Update] Error:', msg)
    if (msg.includes('Missing agentId') || msg.includes('Agent not found') || msg.includes('not authorized')) {
      return authError(msg, 401)
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
