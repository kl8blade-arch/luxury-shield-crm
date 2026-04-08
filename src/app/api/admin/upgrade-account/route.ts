import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    // Find agent by email
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, account_id, email, name')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
    }

    // Upgrade agent to agency plan with max resources
    const { error: updateAgentError } = await supabase
      .from('agents')
      .update({
        subscription_plan: 'agency',
        tokens_limit: 10000,
        tokens_used: 0,
        credits: 100,
        paid: true,
        status: 'active',
        onboarding_complete: true,
      })
      .eq('id', agent.id)

    if (updateAgentError) {
      return NextResponse.json({ error: 'Error al actualizar agente' }, { status: 500 })
    }

    // Upgrade account with max features
    if (agent.account_id) {
      const { error: updateAccountError } = await supabase
        .from('accounts')
        .update({
          max_agents: 25,
          max_leads: 100000,
          features: JSON.stringify({
            sophia_ai: true,
            pipeline: true,
            whatsapp: true,
            forms: true,
            api: true,
            landing_builder: true,
            coaching: true,
            voice: true,
          }),
        })
        .eq('id', agent.account_id)

      if (updateAccountError) {
        console.error('Account update error:', updateAccountError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cuenta ${agent.name} actualizada al plan Agency con todos los créditos y acceso completo`,
      agent: {
        name: agent.name,
        email: agent.email,
        plan: 'agency',
      },
    })
  } catch (error: any) {
    console.error('[UPGRADE] Error:', error)
    return NextResponse.json({ error: 'Error al procesar' }, { status: 500 })
  }
}
