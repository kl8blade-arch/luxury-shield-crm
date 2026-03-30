import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function validateApiKey(req: NextRequest): Promise<{ valid: boolean; accountId?: string }> {
  const key = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (!key) return { valid: false }
  const { data } = await supabase.from('api_keys').select('account_id, active, rate_limit, requests_today').eq('key_hash', key).eq('active', true).single()
  if (!data) return { valid: false }
  if (data.requests_today >= data.rate_limit) return { valid: false }
  await supabase.from('api_keys').update({ requests_today: data.requests_today + 1, last_used: new Date().toISOString() }).eq('key_hash', key)
  return { valid: true, accountId: data.account_id }
}

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return NextResponse.json({ error: 'Invalid or rate-limited API key' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const stage = searchParams.get('stage')

  let query = supabase.from('leads').select('id, name, phone, email, state, stage, score, insurance_type, created_at').order('created_at', { ascending: false }).limit(limit)
  if (stage) query = query.eq('stage', stage)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count: data?.length || 0 })
}

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const body = await req.json()
  const { name, phone, email, state, insurance_type } = body
  if (!name || !phone) return NextResponse.json({ error: 'name and phone required' }, { status: 400 })

  const { data, error } = await supabase.from('leads').insert({
    name, phone: phone.replace(/\D/g, ''), email, state, insurance_type: insurance_type || 'Dental',
    stage: 'new', source: 'api', score: 50, account_id: auth.accountId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, message: 'Lead created' }, { status: 201 })
}
