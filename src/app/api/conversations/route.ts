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
    const limit   = parseInt(searchParams.get('limit') ?? '100')
    if (!agentId) throw new ApiError(400, 'Missing agentId')

    const { data, error } = await supabase
      .from('conversations')
      .select('id, lead_id, lead_name, lead_phone, direction, message, channel, sentiment, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new ApiError(500, error.message)

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (error) {
    return errorHandler(error)
  }
}
