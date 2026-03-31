import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nombre, email y contrasena son requeridos' }, { status: 400 })
    }

    if (!phone?.trim()) {
      return NextResponse.json({ error: 'El telefono es obligatorio' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 })
    }

    // Register via the DB function
    const { data, error } = await supabase.rpc('register_agent', {
      p_name: name.trim(),
      p_email: email.toLowerCase().trim(),
      p_password: password,
      p_phone: phone.trim(),
    })

    if (error) {
      if (error.message.includes('already registered')) {
        return NextResponse.json({ error: 'Este email ya esta registrado. Intenta iniciar sesion.' }, { status: 409 })
      }
      console.error('Register error:', error)
      return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
    }

    const agentId = data

    // Fetch the created agent
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, email, role, status, plan, account_id, trial_ends_at, paid, onboarding_complete')
      .eq('id', agentId)
      .single()

    // Trigger WhatsApp onboarding (non-blocking)
    try {
      const { startAgentOnboarding } = await import('@/lib/agent-onboarding')
      startAgentOnboarding(agentId).catch(e => console.error('Onboarding trigger error:', e))
    } catch (e) { console.error('Onboarding import error:', e) }

    return NextResponse.json({
      user: {
        id: agent?.id || agentId,
        name: agent?.name || name,
        email: agent?.email || email,
        role: agent?.role || 'agent',
        plan: agent?.plan || 'free',
        account_id: agent?.account_id,
        trial_ends_at: agent?.trial_ends_at,
        paid: agent?.paid || false,
        onboarding_complete: agent?.onboarding_complete || false,
      }
    })
  } catch (err: any) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
