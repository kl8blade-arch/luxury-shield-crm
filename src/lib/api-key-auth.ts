import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export interface ApiKeyData {
  keyId: string
  accountId: string | null
  agentId: string | null
  scopes: string[]
  rateLimit: number
}

/**
 * Validate API key from Authorization header or x-api-key header.
 * Returns key data or null.
 */
export async function validateApiKey(req: NextRequest): Promise<ApiKeyData | null> {
  const authHeader = req.headers.get('authorization') || ''
  const apiKeyHeader = req.headers.get('x-api-key') || ''
  const key = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : apiKeyHeader

  if (!key) return null

  const { data } = await supabase.from('api_keys')
    .select('id, account_id, agent_id, scopes, rate_limit, requests_today, active')
    .eq('key', key).eq('active', true).single()

  if (!data) return null

  // Rate limiting
  if ((data.requests_today || 0) >= (data.rate_limit || 1000)) return null

  // Increment request count
  await supabase.from('api_keys').update({
    requests_today: (data.requests_today || 0) + 1,
    last_used: new Date().toISOString(),
  }).eq('id', data.id)

  return {
    keyId: data.id,
    accountId: data.account_id,
    agentId: data.agent_id,
    scopes: data.scopes || [],
    rateLimit: data.rate_limit || 1000,
  }
}

export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ error: message, status }, { status })
}

export function hasScope(key: ApiKeyData, scope: string): boolean {
  return key.scopes.includes(scope) || key.scopes.includes('*')
}

/**
 * Generate a new API key for an account
 */
export async function generateApiKey(accountId: string, agentId: string, label: string): Promise<string> {
  const key = `lscrm_${Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')}`

  await supabase.from('api_keys').insert({
    key, account_id: accountId, agent_id: agentId, label,
    active: true, rate_limit: 1000, requests_today: 0,
    scopes: ['leads.read', 'leads.write', 'conversations.read', 'webhooks'],
  })

  return key
}
