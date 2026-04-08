import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { agentId, step, data } = await req.json()

    if (!agentId || !step) {
      return NextResponse.json({ error: 'agentId y step requeridos' }, { status: 400 })
    }

    switch (step) {
      case 1: {
        // Step 1: Business info
        const { name, company_name, phone, logo_url } = data

        // Update agents table
        await supabase.from('agents').update({
          name: name || undefined,
          company_name: company_name || undefined,
          phone: phone || undefined,
        }).eq('id', agentId)

        // Update accounts table with logo
        if (logo_url) {
          const { data: agent } = await supabase
            .from('agents')
            .select('account_id')
            .eq('id', agentId)
            .single()

          if (agent?.account_id) {
            await supabase.from('accounts').update({ logo_url }).eq('id', agent.account_id)
          }
        }

        return NextResponse.json({ success: true, message: 'Paso 1 guardado' })
      }

      case 2: {
        // Step 2: Services
        const { insurance_types, business_description, licensed_states } = data

        // Upsert agent_configs
        const { data: existing } = await supabase
          .from('agent_configs')
          .select('id')
          .eq('agent_id', agentId)
          .single()

        if (existing) {
          await supabase.from('agent_configs').update({
            insurance_types: insurance_types || [],
            business_description: business_description || '',
          }).eq('agent_id', agentId)
        } else {
          await supabase.from('agent_configs').insert({
            agent_id: agentId,
            insurance_types: insurance_types || [],
            business_description: business_description || '',
          })
        }

        // Update agents with licensed_states
        if (licensed_states) {
          await supabase.from('agents').update({
            licensed_states: licensed_states,
          }).eq('id', agentId)
        }

        return NextResponse.json({ success: true, message: 'Paso 2 guardado' })
      }

      case 3: {
        // Step 3: Sophia config
        const { sophia_tone, sophia_language, welcome_message } = data

        const { data: existing } = await supabase
          .from('agent_configs')
          .select('id')
          .eq('agent_id', agentId)
          .single()

        if (existing) {
          await supabase.from('agent_configs').update({
            sophia_tone: sophia_tone || 'amigable',
            sophia_language: sophia_language || 'es',
            welcome_message: welcome_message || '',
          }).eq('agent_id', agentId)
        } else {
          await supabase.from('agent_configs').insert({
            agent_id: agentId,
            sophia_tone: sophia_tone || 'amigable',
            sophia_language: sophia_language || 'es',
            welcome_message: welcome_message || '',
          })
        }

        return NextResponse.json({ success: true, message: 'Paso 3 guardado' })
      }

      case 4: {
        // Step 4: WhatsApp
        const { phone } = data

        if (phone) {
          await supabase.from('agents').update({
            phone: phone,
          }).eq('id', agentId)
        }

        return NextResponse.json({ success: true, message: 'Paso 4 guardado' })
      }

      case 'complete': {
        // Mark onboarding as complete
        await supabase.from('agents').update({
          onboarding_complete: true,
        }).eq('id', agentId)

        return NextResponse.json({ success: true, message: 'Onboarding completado', onboarding_complete: true })
      }

      default:
        return NextResponse.json({ error: 'Paso inválido' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[ONBOARDING SAVE] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
