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
    const { name, email, password, phone, action, code, pendingCode, pendingData } = await req.json()

    // ═══ STEP 2: Verify code → CREATE account ═══
    if (action === 'verify') {
      if (!code || !pendingCode || !pendingData) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
      if (code.trim() !== pendingCode) return NextResponse.json({ error: 'Codigo incorrecto' }, { status: 401 })

      // NOW create account (only after verification)
      const { data, error } = await supabase.rpc('register_agent', {
        p_name: pendingData.name,
        p_email: pendingData.email,
        p_password: pendingData.password,
        p_phone: pendingData.phone,
      })

      if (error) {
        if (error.message.includes('already registered')) return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 })
        return NextResponse.json({ error: 'Error al crear cuenta' }, { status: 500 })
      }

      const agentId = data
      await supabase.from('agents').update({ status: 'verified', trial_ends_at: null }).eq('id', agentId)

      try {
        const { recordTrialSignup } = await import('@/lib/trial-guard')
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        await recordTrialSignup(agentId, pendingData.email, pendingData.phone, ip)
      } catch {}

      const { data: agent } = await supabase.from('agents')
        .select('id, name, email, role, plan, account_id, trial_ends_at, paid, onboarding_complete')
        .eq('id', agentId).single()

      return NextResponse.json({
        verified: true,
        user: { id: agent?.id || agentId, name: agent?.name, email: agent?.email, role: 'agent', plan: 'free', account_id: agent?.account_id, paid: false, onboarding_complete: false, trial_ends_at: null }
      })
    }

    // ═══ STEP 1: Validate → generate code (shown on screen) ═══
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

    // Generate 6-digit code — shown on screen (no SMS/WhatsApp needed for registration)
    const verifyCode = String(Math.floor(100000 + Math.random() * 900000))

    return NextResponse.json({
      pending_verification: true,
      phone_hint: phone.trim(),
      pending_code: verifyCode,
      pending_data: { name: name.trim(), email: email.toLowerCase().trim(), password, phone: phone.trim() },
    })
  } catch (err: any) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
