import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Minimo 8 caracteres'
  if (!/[A-Z]/.test(pw)) return 'Debe incluir una mayuscula'
  if (!/[a-z]/.test(pw)) return 'Debe incluir una minuscula'
  if (!/[0-9]/.test(pw)) return 'Debe incluir un numero'
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return 'Debe incluir un caracter especial'
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone } = await req.json()

    if (!name || !email || !password) return NextResponse.json({ error: 'Nombre, email y contrasena requeridos' }, { status: 400 })
    if (!phone?.trim()) return NextResponse.json({ error: 'Telefono obligatorio' }, { status: 400 })

    const pwError = validatePassword(password)
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

    // Check email unique
    const { data: existing } = await supabase.from('agents').select('id').eq('email', email.toLowerCase().trim()).limit(1)
    if (existing && existing.length > 0) return NextResponse.json({ error: 'Este email ya esta registrado' }, { status: 409 })

    // Trial abuse check
    try {
      const { checkTrialEligibility } = await import('@/lib/trial-guard')
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      const elig = await checkTrialEligibility(email.toLowerCase(), phone.trim(), ip)
      if (!elig.eligible) return NextResponse.json({ error: elig.message }, { status: 403 })
    } catch {}

    // Create account (status = pending_payment — not active until Stripe confirms)
    const { data, error } = await supabase.rpc('register_agent', {
      p_name: name.trim(),
      p_email: email.toLowerCase().trim(),
      p_password: password,
      p_phone: phone.trim(),
    })

    if (error) {
      if (error.message.includes('already registered')) return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 })
      return NextResponse.json({ error: 'Error al crear cuenta' }, { status: 500 })
    }

    const agentId = data

    // Mark as pending payment (NOT active, NOT accessible)
    await supabase.from('agents').update({ status: 'pending_payment', trial_ends_at: null }).eq('id', agentId)

    // Record for trial abuse prevention
    try {
      const { recordTrialSignup } = await import('@/lib/trial-guard')
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      await recordTrialSignup(agentId, email.toLowerCase(), phone.trim(), ip)
    } catch {}

    return NextResponse.json({ agentId })
  } catch (err: any) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
