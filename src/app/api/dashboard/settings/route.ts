import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiError, errorHandler } from '@/lib/errors'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    if (!agentId) throw new ApiError(400, 'Missing agentId')
    const { data, error } = await supabase
      .from('agent_configs')
      .select('ai_agent_name, notification_phone, notif_whatsapp, notif_email, custom_prompt, main_language, plan, whatsapp_number, ia_active, tokens_available, tokens_monthly_limit')
      .eq('agent_id', agentId)
      .single()
    if (error) throw new ApiError(500, error.message)
    return NextResponse.json({ success: true, data })
  } catch (error) { return errorHandler(error) }
}

export async function PATCH(request: NextRequest) {
  try {
    const { agentId, ai_agent_name, notification_phone, notif_whatsapp, notif_email, custom_prompt, main_language } = await request.json()
    if (!agentId) throw new ApiError(400, 'Missing agentId')
    const { error } = await supabase
      .from('agent_configs')
      .update({ ai_agent_name, notification_phone, notif_whatsapp, notif_email, custom_prompt, main_language })
      .eq('agent_id', agentId)
    if (error) throw new ApiError(500, error.message)
    return NextResponse.json({ success: true })
  } catch (error) { return errorHandler(error) }
}
