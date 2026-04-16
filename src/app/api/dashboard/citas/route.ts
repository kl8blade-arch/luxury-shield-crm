import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAgentAuth, authError } from '@/lib/auth-middleware'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const agentId = await validateAgentAuth(request)

    // Fetch all appointments for this agent with followup data
    const { data: appointments, error } = await supabase
      .from('doctor_appointments')
      .select(`
        id,
        doctor_name,
        specialty,
        scheduled_at,
        status,
        lead_name,
        lead_phone,
        in_network,
        insurance_carrier,
        doctor_address,
        doctor_phone,
        booking_source,
        appointment_followups!inner(
          id,
          status,
          reminder_24h_at,
          reminder_2h_at,
          checkin_at,
          checkin_responded,
          checkin_sentiment,
          referral_at,
          referral_converted,
          thankyou_at
        )
      `)
      .eq('agent_id', agentId)
      .order('scheduled_at', { ascending: false })
      .limit(50)

    if (error) throw error

    // Flatten followup data (1 followup per appointment max)
    const formatted = appointments.map(a => ({
      ...a,
      appointment_followups: (a.appointment_followups as any[])?.[0] || undefined
    }))

    return NextResponse.json({ appointments: formatted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[Dashboard Citas] Error:', msg)
    if (msg.includes('Missing agentId') || msg.includes('Agent not found') || msg.includes('not authorized')) {
      return authError(msg, 401)
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
