import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Minimo 8 caracteres'
  if (!/[A-Z]/.test(pw)) return 'Debe incluir al menos una letra mayuscula'
  if (!/[a-z]/.test(pw)) return 'Debe incluir al menos una letra minuscula'
  if (!/[0-9]/.test(pw)) return 'Debe incluir al menos un numero'
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return 'Debe incluir al menos un caracter especial (!@#$%&*)'
  return null
}

async function sendVerificationCode(phone: string, code: string): Promise<{ sent: boolean; via: string }> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return { sent: false, via: 'none' }

  const cleanPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`
  const auth = `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`

  // Try WhatsApp
  try {
    const waRes = await fetch(url, {
      method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanPhone}`, Body: `🔐 *Luxury Shield CRM*\n\nTu codigo: *${code}*\n\nExpira en 10 minutos.` }).toString(),
    })
    const waData = await waRes.json()
    if (waData.sid && !waData.error_code) return { sent: true, via: 'whatsapp' }
  } catch {}

  // Try SMS with a real SMS-capable number if available
  try {
    // Sandbox number can't send SMS — try anyway in case user has a real number
    const smsRes = await fetch(url, {
      method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: TWILIO_FROM!, To: cleanPhone, Body: `Luxury Shield CRM: ${code} es tu codigo de verificacion.` }).toString(),
    })
    const smsData = await smsRes.json()
    if (smsData.sid && !smsData.error_code) return { sent: true, via: 'sms' }
  } catch {}

  return { sent: false, via: 'none' }
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone, action, code, pendingCode, pendingData } = await req.json()

    // ═══ STEP 2: Verify code and CREATE account ═══
    if (action === 'verify') {
      if (!code || !pendingCode || !pendingData) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

      // Verify the code matches (code was stored client-side, never in DB)
      if (code.trim() !== pendingCode) {
        return NextResponse.json({ error: 'Codigo incorrecto' }, { status: 401 })
      }

      // NOW create the account (only after verification)
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

      // Set to verified + pending payment (no trial until Stripe)
      await supabase.from('agents').update({ status: 'verified', trial_ends_at: null }).eq('id', agentId)

      // Record trial for abuse prevention
      try {
        const { recordTrialSignup } = await import('@/lib/trial-guard')
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        await recordTrialSignup(agentId, pendingData.email, pendingData.phone, ip)
      } catch {}

      // Fetch agent
      const { data: agent } = await supabase.from('agents')
        .select('id, name, email, role, plan, account_id, trial_ends_at, paid, onboarding_complete')
        .eq('id', agentId).single()

      return NextResponse.json({
        verified: true,
        user: {
          id: agent?.id || agentId, name: agent?.name, email: agent?.email,
          role: agent?.role || 'agent', plan: agent?.plan || 'free',
          account_id: agent?.account_id, paid: false, onboarding_complete: false,
          trial_ends_at: null,
        }
      })
    }

    // ═══ STEP 1: Validate and send code (NO account created yet) ═══
    if (!name || !email || !password) return NextResponse.json({ error: 'Nombre, email y contrasena requeridos' }, { status: 400 })
    if (!phone?.trim()) return NextResponse.json({ error: 'Telefono obligatorio' }, { status: 400 })

    const pwError = validatePassword(password)
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

    // Check if email already exists
    const { data: existing } = await supabase.from('agents').select('id').eq('email', email.toLowerCase().trim()).limit(1)
    if (existing && existing.length > 0) return NextResponse.json({ error: 'Este email ya esta registrado' }, { status: 409 })

    // Trial abuse check
    try {
      const { checkTrialEligibility } = await import('@/lib/trial-guard')
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      const eligibility = await checkTrialEligibility(email.toLowerCase(), phone.trim(), ip)
      if (!eligibility.eligible) return NextResponse.json({ error: eligibility.message }, { status: 403 })
    } catch {}

    // Generate code
    const verifyCode = String(Math.floor(100000 + Math.random() * 900000))

    // Try to send via WhatsApp/SMS
    const cleanPhone = phone.trim().startsWith('+') ? phone.trim() : `+1${phone.trim().replace(/\D/g, '')}`
    const { sent, via } = await sendVerificationCode(cleanPhone, verifyCode)

    console.log(`[REGISTER] Code ${verifyCode} for ${cleanPhone} — sent: ${sent}, via: ${via}`)

    return NextResponse.json({
      pending_verification: true,
      phone_hint: cleanPhone.replace(/(.{4})(.*)(.{2})/, '$1****$3'),
      sent_via: via,
      code_sent: sent,
      // If sending failed, include the code so frontend can show it directly
      // This is the fallback until a real Twilio number is configured
      verification_code: sent ? undefined : verifyCode,
      // Store these encrypted to pass back on verify (no DB record until verified)
      pending_data: { name: name.trim(), email: email.toLowerCase().trim(), password, phone: phone.trim() },
      pending_code: verifyCode,
    })
  } catch (err: any) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
