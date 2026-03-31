import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, apiError, hasScope } from '@/lib/api-key-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * GET /api/v1/leads — List leads
 * Query params: ?stage=new&limit=50&offset=0&search=juan
 */
export async function GET(req: NextRequest) {
  const key = await validateApiKey(req)
  if (!key) return apiError('API key invalida o rate limit excedido', 401)
  if (!hasScope(key, 'leads.read')) return apiError('Scope leads.read requerido', 403)

  const { searchParams } = req.nextUrl
  const stage = searchParams.get('stage')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  const search = searchParams.get('search')

  let query = supabase.from('leads').select('id, name, phone, email, state, insurance_type, stage, score, source, purchased_products, created_at, updated_at', { count: 'exact' })

  // Scope by account
  if (key.accountId) query = query.eq('account_id', key.accountId)
  if (key.agentId) query = query.eq('agent_id', key.agentId)
  if (stage) query = query.eq('stage', stage)
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  if (error) return apiError(error.message, 500)

  return NextResponse.json({ leads: data, total: count, limit, offset })
}

/**
 * POST /api/v1/leads — Create a new lead
 * Body: { name, phone, email?, state?, insurance_type?, source?, notes?, purchased_products?[] }
 */
export async function POST(req: NextRequest) {
  const key = await validateApiKey(req)
  if (!key) return apiError('API key invalida', 401)
  if (!hasScope(key, 'leads.write')) return apiError('Scope leads.write requerido', 403)

  const body = await req.json()
  if (!body.name && !body.phone) return apiError('name o phone requerido')

  const { data, error } = await supabase.from('leads').insert({
    name: body.name || 'Sin nombre',
    phone: body.phone || '',
    email: body.email || '',
    state: body.state || '',
    insurance_type: body.insurance_type || body.product || '',
    stage: body.stage || 'new',
    score: body.score || 30,
    source: body.source || 'api',
    notes: body.notes || '',
    purchased_products: body.purchased_products || [],
    agent_id: key.agentId,
    account_id: key.accountId,
    utm_source: body.utm_source || 'api',
    utm_campaign: body.utm_campaign || '',
  }).select().single()

  if (error) return apiError(error.message, 500)

  // Fire webhook if subscribed
  fireWebhooks(key.accountId, 'lead.created', data)

  return NextResponse.json({ lead: data }, { status: 201 })
}

async function fireWebhooks(accountId: string | null, event: string, payload: any) {
  if (!accountId) return
  const { data: subs } = await supabase.from('webhook_subscriptions')
    .select('id, url, secret, events').eq('account_id', accountId).eq('active', true)

  for (const sub of subs || []) {
    if (!sub.events?.includes(event)) continue
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sub.secret) headers['x-webhook-secret'] = sub.secret
      await fetch(sub.url, {
        method: 'POST', headers,
        body: JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() }),
      })
      await supabase.from('webhook_subscriptions').update({ last_triggered: new Date().toISOString(), failure_count: 0 }).eq('id', sub.id)
    } catch {
      await supabase.from('webhook_subscriptions').update({ failure_count: (sub as any).failure_count + 1 }).eq('id', sub.id)
    }
  }
}
