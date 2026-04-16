// src/app/api/dashboard/products/route.ts
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
    if (!agentId) throw new ApiError(400, 'Missing agentId')

    // Get agent's account_id
    const { data: agent } = await supabase
      .from('agents')
      .select('account_id')
      .eq('id', agentId)
      .single()

    if (!agent?.account_id) throw new ApiError(404, 'Agent not found')

    const { data: products, error } = await supabase
      .from('account_products')
      .select('*')
      .eq('account_id', agent.account_id)
      .eq('active', true)
      .order('commission_rate', { ascending: false })

    if (error) throw new ApiError(500, error.message)

    return NextResponse.json({ success: true, data: products ?? [] })
  } catch (error) {
    return errorHandler(error)
  }
}
