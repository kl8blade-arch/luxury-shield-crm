import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM

// Password strength: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Minimo 8 caracteres'
  if (!/[A-Z]/.test(pw)) return 'Debe incluir al menos una letra mayuscula'
  if (!/[a-z]/.test(pw)) return 'Debe incluir al menos una letra minuscula'
  if (!/[0-9]/.test(pw)) return 'Debe incluir al menos un numero'
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return 'Debe incluir al menos un caracter especial (!@#$%&*)'
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone, action, code, agentId } = await req.json()

    // ═══ STEP 2: Verify phone code ═══
    if (action === 'verify_phone') {
      if (!agentId || !code) return NextResponse.json({ error: 'Codigo requerido' }, { status: 400 })

      const { data: token } = await supabase.from('password_reset_tokens')
        .select('agent_id').eq('token', code.trim()).eq('used', false).gt('expires_at', new Date().toISOString()).single()

      if (!token || token.agent_id !== agentId) {
        return NextResponse.json({ error: 'Codigo incorrecto o expirado' }, { status: 401 })
      }

      // Mark token as used and activate account
      await supabase.from('password_reset_tokens').update({ used: true }).eq('token', code.trim())
      await supabase.from('agents').update({ status: 'verified' }).eq('id', agentId)

      const { data: agent } = await supabase.from('agents')
        .select('id, name, email, role, plan, account_id, trial_ends_at, paid, onboarding_complete, status')
        .eq('id', agentId).single()

      return NextResponse.json({
        verified: true,
        user: {
          id: agent?.id, name: agent?.name, email: agent?.email, role: agent?.role,
          plan: agent?.plan, account_id: agent?.account_id,
          trial_ends_at: agent?.trial_ends_at, paid: agent?.paid || false,
          onboarding_complete: agent?.onboarding_complete || false,
        }
      })
    }

    // ═══ STEP 1: Create account (pending verification) ═══
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nombre, email y contrasena requeridos' }, { status: 400 })
    }
    if (!phone?.trim()) {
      return NextResponse.json({ error: 'Telefono obligatorio' }, { status: 400 })
    }

    // Validate password strength
    const pwError = validatePassword(password)
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

    // Register agent (status = pending, NOT active — trial NOT started yet)
    const { data, error } = await supabase.rpc('register_agent', {
      p_name: name.trim(),
      p_email: email.toLowerCase().trim(),
      p_password: password,
      p_phone: phone.trim(),
    })

    if (error) {
      if (error.message.includes('already registered')) {
        return NextResponse.json({ error: 'Este email ya esta registrado' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
    }

    const newAgentId = data

    // Set status to pending (not active until phone verified)
    await supabase.from('agents').update({ status: 'pending', trial_ends_at: null }).eq('id', newAgentId)

    // Generate 6-digit verification code
    const verifyCode = String(Math.floor(100000 + Math.random() * 900000))
    await supabase.from('password_reset_tokens').insert({
      agent_id: newAgentId, token: verifyCode,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
    })

    // Send code via WhatsApp
    const cleanPhone = phone.trim().startsWith('+') ? phone.trim() : `+1${phone.trim().replace(/\D/g, '')}`
    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      const auth = `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanPhone}`,
          Body: `🔐 *Luxury Shield CRM*\n\nTu codigo de verificacion es:\n\n*${verifyCode}*\n\nExpira en 10 minutos. Si no solicitaste esto, ignora este mensaje.`,
        }).toString(),
      })
    }

    return NextResponse.json({
      pending_verification: true,
      agentId: newAgentId,
      phone_hint: cleanPhone.replace(/(.{4})(.*)(.{2})/, '$1****$3'),
    })
  } catch (err: any) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
