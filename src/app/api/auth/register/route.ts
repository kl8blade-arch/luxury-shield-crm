import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    // Register via the DB function
    const { data, error } = await supabase.rpc('register_agent', {
      p_name: name.trim(),
      p_email: email.toLowerCase().trim(),
      p_password: password,
      p_phone: phone?.trim() || null,
    })

    if (error) {
      if (error.message.includes('already registered')) {
        return NextResponse.json({ error: 'Este email ya esta registrado. Intenta iniciar sesion.' }, { status: 409 })
      }
      console.error('Register error:', error)
      return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
    }

    // Fetch the created agent
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, email, role, status, plan, account_id')
      .eq('id', data)
      .single()

    return NextResponse.json({
      user: {
        id: agent?.id || data,
        name: agent?.name || name,
        email: agent?.email || email,
        role: agent?.role || 'agent',
        plan: agent?.plan || 'free',
        account_id: agent?.account_id,
      }
    })
  } catch (err: any) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
