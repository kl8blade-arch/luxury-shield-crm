import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { code, newPassword } = await req.json()

    if (!code || !newPassword) {
      return NextResponse.json({ error: 'Codigo y nueva contrasena requeridos' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const { data: agentId, error } = await supabase.rpc('reset_password_with_token', {
      p_token: code.trim(),
      p_new_password: newPassword,
    })

    if (error) {
      if (error.message.includes('Invalid or expired')) {
        return NextResponse.json({ error: 'Codigo invalido o expirado. Solicita uno nuevo.' }, { status: 400 })
      }
      console.error('Reset password error:', error)
      return NextResponse.json({ error: 'Error al cambiar contrasena' }, { status: 500 })
    }

    return NextResponse.json({ success: true, agentId })
  } catch (err: any) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
