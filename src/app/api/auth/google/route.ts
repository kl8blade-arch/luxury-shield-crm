import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { credential } = await req.json()
    if (!credential) {
      return NextResponse.json({ error: 'Token de Google requerido' }, { status: 400 })
    }

    // Decode the Google ID token (JWT) to get user info
    const parts = credential.split('.')
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 400 })
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    const { sub: googleId, email, name, picture } = payload

    if (!email || !googleId) {
      return NextResponse.json({ error: 'No se pudo obtener informacion de Google' }, { status: 400 })
    }

    // Upsert the agent (create if new, return existing if found)
    const { data, error } = await supabase.rpc('upsert_google_agent', {
      p_google_id: googleId,
      p_name: name || email.split('@')[0],
      p_email: email.toLowerCase(),
      p_photo: picture || null,
    })

    if (error) {
      console.error('Google auth error:', error)
      return NextResponse.json({ error: 'Error al autenticar con Google' }, { status: 500 })
    }

    const result = data?.[0]
    if (!result) {
      return NextResponse.json({ error: 'Error al crear cuenta' }, { status: 500 })
    }

    // Fetch full agent data
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, email, role, status, plan, account_id, totp_enabled, paid, onboarding_complete, trial_ends_at, profile_photo')
      .eq('id', result.agent_id)
      .single()

    if (!agent || agent.status !== 'active') {
      return NextResponse.json({ error: 'Cuenta desactivada' }, { status: 403 })
    }

    return NextResponse.json({
      user: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        plan: agent.plan,
        account_id: agent.account_id,
        totp_enabled: agent.totp_enabled,
        paid: agent.paid,
        onboarding_complete: agent.onboarding_complete,
        trial_ends_at: agent.trial_ends_at,
        profile_photo: agent.profile_photo,
      },
      isNew: result.is_new,
    })
  } catch (err: any) {
    console.error('Google auth error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
