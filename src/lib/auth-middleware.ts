import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Validates that the agentId in query params matches an authorized agent.
 * Returns the validated agentId or throws error.
 */
export async function validateAgentAuth(request: NextRequest): Promise<string> {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')

  if (!agentId) {
    throw new Error('Missing agentId')
  }

  // Validate agent exists and is active
  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, status, role')
    .eq('id', agentId)
    .single()

  if (error || !agent) {
    throw new Error('Agent not found')
  }

  if (agent.status !== 'active' && agent.status !== 'verified' && agent.role !== 'admin') {
    throw new Error('Agent not authorized')
  }

  return agent.id
}

/**
 * Error handler for auth middleware
 */
export function authError(message: string, statusCode: number = 401) {
  console.error('[AUTH]', message)
  return NextResponse.json(
    { error: message },
    { status: statusCode }
  )
}
