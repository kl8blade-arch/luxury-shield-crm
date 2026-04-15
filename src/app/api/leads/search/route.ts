// src/app/api/leads/search/route.ts
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
    const q       = searchParams.get('q')
    const agentId = searchParams.get('agentId')

    if (!agentId) throw new ApiError(400, 'Missing agentId')
    if (!q || q.length < 2) return NextResponse.json({ success: true, data: [] })

    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone, stage, score, insurance_type')
      .eq('agent_id', agentId)
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      .not('stage', 'in', '("closed_lost","unqualified","no_califica")')
      .order('score', { ascending: false })
      .limit(8)

    if (error) throw new ApiError(500, error.message)

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (error) {
    return errorHandler(error)
  }
}
