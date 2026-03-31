import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as OTPAuth from 'otpauth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { agentId, action } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'Agent ID requerido' }, { status: 400 })

    const { data: agent } = await supabase.from('agents').select('id, email, totp_secret, totp_enabled').eq('id', agentId).single()
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })

    if (action === 'disable') {
      await supabase.from('agents').update({ totp_enabled: false, totp_secret: null }).eq('id', agentId)
      return NextResponse.json({ success: true })
    }

    // Generate new TOTP secret
    const totp = new OTPAuth.TOTP({
      issuer: 'Luxury Shield CRM',
      label: agent.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    })

    // Save secret (not yet enabled — user must verify first)
    await supabase.from('agents').update({ totp_secret: totp.secret.base32 }).eq('id', agentId)

    return NextResponse.json({
      secret: totp.secret.base32,
      uri: totp.toString(),
    })
  } catch (err: any) {
    console.error('TOTP setup error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
