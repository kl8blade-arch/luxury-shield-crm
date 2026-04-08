import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('id, email, status, subscription_plan')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
    }

    // Activate account
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        status: 'active',
        paid: true,
        tokens_limit: 300,
        tokens_used: 0,
        tokens_reset_at: new Date().toISOString(),
        refund_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', agent.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Cuenta ${email} activada`,
      agent: {
        id: agent.id,
        email: agent.email,
        status: 'active',
        plan: agent.subscription_plan,
      },
    })
  } catch (error: any) {
    console.error('[ACTIVATE] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
