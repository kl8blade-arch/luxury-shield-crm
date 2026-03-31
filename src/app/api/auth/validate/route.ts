import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { agentId } = await req.json()
    if (!agentId) return NextResponse.json({ valid: false }, { status: 401 })

    const { data: agent } = await supabase.from('agents')
      .select('id, name, email, role, plan, account_id, status, paid, trial_ends_at, onboarding_complete, tokens_used, tokens_limit, tokens_extra')
      .eq('id', agentId).single()

    if (!agent || (agent.status !== 'active' && agent.status !== 'verified' && agent.role !== 'admin')) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: agent.id, name: agent.name, email: agent.email, role: agent.role,
        plan: agent.plan, account_id: agent.account_id, paid: agent.paid,
        trial_ends_at: agent.trial_ends_at, onboarding_complete: agent.onboarding_complete,
        tokens_used: agent.tokens_used, tokens_limit: agent.tokens_limit, tokens_extra: agent.tokens_extra,
      }
    })
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
