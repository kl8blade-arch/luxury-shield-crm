import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, apiError, hasScope } from '@/lib/api-key-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * GET /api/v1/conversations?lead_id=xxx&limit=50
 */
export async function GET(req: NextRequest) {
  const key = await validateApiKey(req)
  if (!key) return apiError('API key invalida', 401)
  if (!hasScope(key, 'conversations.read')) return apiError('Scope conversations.read requerido', 403)

  const { searchParams } = req.nextUrl
  const leadId = searchParams.get('lead_id')
  const leadPhone = searchParams.get('phone')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  let query = supabase.from('conversations').select('id, lead_id, lead_name, lead_phone, direction, message, channel, created_at')

  if (leadId) query = query.eq('lead_id', leadId)
  else if (leadPhone) query = query.ilike('lead_phone', `%${leadPhone.replace(/\D/g, '').slice(-7)}%`)
  else return apiError('lead_id o phone requerido')

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
  if (error) return apiError(error.message, 500)

  return NextResponse.json({ conversations: data })
}
