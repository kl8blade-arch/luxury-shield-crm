import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { agentId, addons } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'agentId requerido' }, { status: 400 })

    const { data: agent } = await supabase.from('agents').select('id, name, account_id, tokens_limit').eq('id', agentId).single()
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })

    // Activate AI package
    if (addons?.ai_package) {
      await supabase.from('agents').update({
        uses_own_ai_keys: false,
        tokens_limit: Math.max(agent.tokens_limit || 0, 300), // Ensure minimum tokens
      }).eq('id', agentId)
    }

    // Provision WhatsApp number
    if (addons?.whatsapp_number && addons?.whatsapp_mode === 'provision_new') {
      const { provisionTwilioNumber } = await import('@/lib/twilio-provisioner')
      const result = await provisionTwilioNumber(agentId, agent.name || 'Agencia', addons.area_code || '786')

      if (result.success) {
        return NextResponse.json({ success: true, whatsappNumber: result.phoneNumber })
      } else {
        return NextResponse.json({ success: true, whatsapp_provisioning_pending: true, message: 'Tu numero sera configurado en los proximos 5 minutos' })
      }
    }

    // Bring Your Own number
    if (addons?.whatsapp_mode === 'bring_your_own' && addons?.own_number_data) {
      const { verifyOwnNumber } = await import('@/lib/twilio-provisioner')
      const result = await verifyOwnNumber(agentId, addons.own_number_data.provider || 'twilio', addons.own_number_data.accountSid, addons.own_number_data.authToken, addons.own_number_data.phoneNumber)

      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      return NextResponse.json({ success: true, whatsappNumber: addons.own_number_data.phoneNumber })
    }

    // Skip (no addons)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
