import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * Validate incoming API request. Returns agent data or null.
 * Checks: x-agent-id header OR internal API secret.
 */
export async function authenticateRequest(req: NextRequest): Promise<{ id: string; role: string; account_id: string | null; paid: boolean } | null> {
  // Internal API secret (for cron jobs, webhooks)
  const apiSecret = req.headers.get('x-api-secret')
  if (apiSecret && apiSecret === process.env.INTERNAL_API_SECRET) {
    return { id: 'internal', role: 'admin', account_id: null, paid: true }
  }

  // Agent ID from header
  const agentId = req.headers.get('x-agent-id')
  if (!agentId || agentId === 'undefined' || agentId === 'null') return null

  const { data } = await supabase.from('agents')
    .select('id, role, account_id, status, paid')
    .eq('id', agentId).single()

  if (!data || (data.status !== 'active' && data.status !== 'verified')) return null
  return { id: data.id, role: data.role, account_id: data.account_id, paid: data.paid }
}

export function unauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}

/**
 * Validate Twilio webhook signature (basic check)
 */
export function validateTwilioRequest(req: NextRequest, formData: FormData): boolean {
  const accountSid = formData.get('AccountSid') as string
  return accountSid === process.env.TWILIO_ACCOUNT_SID
}
