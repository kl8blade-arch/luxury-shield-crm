import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiError, errorHandler } from '@/lib/errors'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    if (!agentId) throw new ApiError(400, 'Missing agentId')

    const { data: agent } = await supabase.from('agents').select('account_id').eq('id', agentId).single()
    if (!agent?.account_id) throw new ApiError(404, 'Agent not found')

    const [allCarriers, activeConfig] = await Promise.all([
      supabase.from('insurance_carriers').select('id, name, short_name, lines, states_available, phone_agents, contracting_url, notes').eq('active', true).order('name'),
      supabase.from('account_carrier_config').select('carrier_id, active, agent_code, contract_level').eq('account_id', agent.account_id),
    ])

    const activeIds = new Set((activeConfig.data ?? []).filter(c => c.active).map(c => c.carrier_id))
    const configMap = Object.fromEntries((activeConfig.data ?? []).map(c => [c.carrier_id, c]))

    const carriers = (allCarriers.data ?? []).map(c => ({
      ...c, isActive: activeIds.has(c.id), config: configMap[c.id] ?? null,
    }))

    return NextResponse.json({ success: true, data: carriers, accountId: agent.account_id })
  } catch (error) { return errorHandler(error) }
}

export async function PATCH(request: NextRequest) {
  try {
    const { agentId, carrierId, active, agentCode, contractLevel } = await request.json()
    if (!agentId || !carrierId) throw new ApiError(400, 'Missing params')

    const { data: agent } = await supabase.from('agents').select('account_id').eq('id', agentId).single()
    if (!agent?.account_id) throw new ApiError(404, 'Not found')

    await supabase.from('account_carrier_config').upsert({
      account_id: agent.account_id, carrier_id: carrierId,
      active, agent_code: agentCode, contract_level: contractLevel,
      created_at: new Date().toISOString(),
    }, { onConflict: 'account_id,carrier_id' })

    return NextResponse.json({ success: true })
  } catch (error) { return errorHandler(error) }
}
