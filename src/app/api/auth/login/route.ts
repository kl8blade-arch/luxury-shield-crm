import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    }

    // Find agent by email and verify password using pgcrypto
    const { data: agents, error } = await supabase.rpc('verify_agent_login', {
      p_email: email.toLowerCase().trim(),
      p_password: password,
    })

    if (error) {
      // Fallback: query directly if RPC doesn't exist yet
      const { data: agent } = await supabase
        .from('agents')
        .select('id, name, email, role, status, plan, account_id')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (!agent) {
        return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
      }

      // Verify password via raw SQL
      const { data: check } = await supabase.rpc('check_password', {
        p_email: email.toLowerCase().trim(),
        p_password: password,
      })

      if (!check) {
        return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
      }

      if (agent.status !== 'active') {
        return NextResponse.json({ error: 'Cuenta desactivada. Contacta al administrador.' }, { status: 403 })
      }

      return NextResponse.json({
        user: {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          role: agent.role,
          plan: agent.plan,
          account_id: agent.account_id,
        }
      })
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const agent = agents[0]

    if (agent.status !== 'active') {
      return NextResponse.json({ error: 'Cuenta desactivada. Contacta al administrador.' }, { status: 403 })
    }

    return NextResponse.json({
      user: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        plan: agent.plan,
        account_id: agent.account_id,
      }
    })
  } catch (err: any) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
