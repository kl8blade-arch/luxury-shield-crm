import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { agentId, addons } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'agentId requerido' }, { status: 400 })

    const { data: agent } = await supabase.from('agents').select('id, name, account_id, tokens_limit, status').eq('id', agentId).single()
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })

    // Activate account if not already active
    if (agent.status !== 'active') {
      await supabase.from('agents').update({ status: 'active' }).eq('id', agentId)
    }

    if (!addons || Object.keys(addons).length === 0) {
      return NextResponse.json({ success: true })
    }

    // Own API keys
    if (addons.own_keys && addons.anthropic_key) {
      try {
        const { encryptApiKey } = await import('@/lib/encryption')
        const enc = encryptApiKey(addons.anthropic_key, agentId)
        const update: any = {
          uses_own_ai_keys: true,
          anthropic_key_encrypted: enc.encrypted,
          anthropic_key_iv: enc.iv,
          anthropic_key_tag: enc.tag,
          anthropic_api_key: addons.anthropic_key.slice(0, 10) + '•••',
        }
        if (addons.openai_key) {
          const encOai = encryptApiKey(addons.openai_key, agentId)
          update.openai_key_encrypted = encOai.encrypted
          update.openai_key_iv = encOai.iv
          update.openai_key_tag = encOai.tag
          update.openai_api_key = addons.openai_key.slice(0, 8) + '•••'
        }
        await supabase.from('agents').update(update).eq('id', agentId)
      } catch (e: any) {
        // Fallback: save plain
        await supabase.from('agents').update({
          uses_own_ai_keys: true,
          anthropic_api_key: addons.anthropic_key,
          openai_api_key: addons.openai_key || null,
        }).eq('id', agentId)
      }
      return NextResponse.json({ success: true })
    }

    // Managed AI package
    if (addons.ai_package) {
      await supabase.from('agents').update({
        uses_own_ai_keys: false,
        tokens_limit: Math.max(agent.tokens_limit || 0, 300),
      }).eq('id', agentId)
    }

    // Provision WhatsApp number
    if (addons.whatsapp_number && addons.whatsapp_mode === 'provision_new') {
      try {
        const { provisionTwilioNumber } = await import('@/lib/twilio-provisioner')
        const result = await provisionTwilioNumber(agentId, agent.name || 'Agencia')
        if (result.success) {
          return NextResponse.json({ success: true, whatsappNumber: result.phoneNumber })
        }
        // If provisioning fails, still succeed (agent can configure later)
        return NextResponse.json({ success: true, whatsapp_pending: true })
      } catch {
        return NextResponse.json({ success: true, whatsapp_pending: true })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
