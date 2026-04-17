// src/app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiError, errorHandler } from '@/lib/errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const limit   = parseInt(searchParams.get('limit') ?? '200')
    if (!agentId) throw new ApiError(400, 'Missing agentId')

    // Get agent's account_id to show all conversations in the account
    const { data: agent } = await supabase
      .from('agents')
      .select('account_id')
      .eq('id', agentId)
      .single()

    const accountId = agent?.account_id

    // Incluir cuentas vinculadas (linked_accounts)
    const { data: linkedAccounts } = await supabase
      .from('linked_accounts')
      .select('linked_account_id')
      .eq('owner_account_id', accountId)
      .eq('status', 'active')

    const allAccountIds = [
      accountId,
      ...(linkedAccounts ?? []).map(la => la.linked_account_id)
    ]

    // Query by account_id (shows all agents in account) OR agent_id as fallback
    let query = supabase
      .from('conversations')
      .select('id, lead_id, lead_name, lead_phone, direction, message, channel, sentiment, created_at, agent_id')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (accountId) {
      query = query.in('account_id', allAccountIds)
    } else {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query
    if (error) throw new ApiError(500, error.message)

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (error) {
    return errorHandler(error)
  }
}
