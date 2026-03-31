import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { agentId, anthropicKey, openaiKey, useOwnKeys } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'agentId requerido' }, { status: 400 })

    const update: any = { uses_own_ai_keys: useOwnKeys }

    if (useOwnKeys) {
      // Encrypt keys server-side
      try {
        const { encryptApiKey } = await import('@/lib/encryption')

        if (anthropicKey && !anthropicKey.includes('•')) {
          const enc = encryptApiKey(anthropicKey)
          update.anthropic_key_encrypted = enc.encrypted
          update.anthropic_key_iv = enc.iv
          update.anthropic_key_tag = enc.tag
          update.anthropic_api_key = anthropicKey.slice(0, 10) + '•••' // Keep hint for display
        }

        if (openaiKey && !openaiKey.includes('•')) {
          const enc = encryptApiKey(openaiKey)
          update.openai_key_encrypted = enc.encrypted
          update.openai_key_iv = enc.iv
          update.openai_key_tag = enc.tag
          update.openai_api_key = openaiKey.slice(0, 8) + '•••'
        }
      } catch (encErr: any) {
        console.error('[ENCRYPT] Error:', encErr.message)
        // Fallback: save plain (if encryption not configured yet)
        if (anthropicKey && !anthropicKey.includes('•')) update.anthropic_api_key = anthropicKey
        if (openaiKey && !openaiKey.includes('•')) update.openai_api_key = openaiKey
      }
    } else {
      update.anthropic_key_encrypted = null
      update.anthropic_key_iv = null
      update.anthropic_key_tag = null
      update.openai_key_encrypted = null
      update.openai_key_iv = null
      update.openai_key_tag = null
    }

    await supabase.from('agents').update(update).eq('id', agentId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
