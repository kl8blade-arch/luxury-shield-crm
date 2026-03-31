import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contrasena requeridos' }, { status: 400 })
    }

    const { data: agents, error } = await supabase.rpc('verify_agent_login', {
      p_email: email.toLowerCase().trim(),
      p_password: password,
    })

    if (error || !agents || agents.length === 0) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const agent = agents[0]

    if (agent.status !== 'active') {
      return NextResponse.json({ error: 'Cuenta desactivada. Contacta al administrador.' }, { status: 403 })
    }

    // If 2FA is enabled, don't return full user yet — require TOTP verification
    if (agent.totp_enabled) {
      return NextResponse.json({
        requires_2fa: true,
        agent_id: agent.id,
        name: agent.name,
      })
    }

    return NextResponse.json({
      user: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        plan: agent.plan,
        account_id: agent.account_id,
        totp_enabled: agent.totp_enabled || false,
        paid: agent.paid || false,
        onboarding_complete: agent.onboarding_complete || false,
        trial_ends_at: agent.trial_ends_at,
      }
    })
  } catch (err: any) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
