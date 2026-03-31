import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as OTPAuth from 'otpauth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { agentId, code, action } = await req.json()
    if (!agentId || !code) return NextResponse.json({ error: 'Codigo requerido' }, { status: 400 })

    const { data: agent } = await supabase.from('agents')
      .select('id, name, email, role, plan, account_id, totp_secret, totp_enabled, paid, onboarding_complete, trial_ends_at')
      .eq('id', agentId).single()

    if (!agent || !agent.totp_secret) {
      return NextResponse.json({ error: '2FA no configurado' }, { status: 400 })
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'Luxury Shield CRM',
      label: agent.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(agent.totp_secret),
    })

    const delta = totp.validate({ token: code, window: 1 })
    if (delta === null) {
      return NextResponse.json({ error: 'Codigo incorrecto. Intenta de nuevo.' }, { status: 401 })
    }

    // If this is the setup verification (enabling 2FA for first time)
    if (action === 'enable') {
      await supabase.from('agents').update({ totp_enabled: true }).eq('id', agentId)
    }

    return NextResponse.json({
      verified: true,
      user: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        plan: agent.plan,
        account_id: agent.account_id,
        totp_enabled: true,
        paid: agent.paid,
        onboarding_complete: agent.onboarding_complete,
        trial_ends_at: agent.trial_ends_at,
      }
    })
  } catch (err: any) {
    console.error('TOTP verify error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
