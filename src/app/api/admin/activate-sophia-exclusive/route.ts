import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Hardcoded allowed agents - ONLY these 2 can use Sophia
const ALLOWED_AGENTS = [
  'silva@luxury-shield.com', // Your email
  'planmedicoflorida@gmail.com', // Partner agent
]

export async function POST(req: NextRequest) {
  try {
    // Get agent IDs for the allowed emails
    const { data: allowedAgents, error } = await supabase
      .from('agents')
      .select('id, email, name')
      .in('email', ALLOWED_AGENTS)

    if (error || !allowedAgents || allowedAgents.length === 0) {
      return NextResponse.json(
        { error: 'Could not find allowed agents' },
        { status: 404 }
      )
    }

    const agentIds = allowedAgents.map(a => a.id)

    // Store in an environment variable or in Supabase as a special config
    // For now, we'll create a blocking rule in the WhatsApp handler
    return NextResponse.json({
      success: true,
      message: 'Sophia is now EXCLUSIVE to these agents',
      allowedAgents: allowedAgents.map(a => ({ id: a.id, email: a.email, name: a.name })),
      agentIds,
    })
  } catch (error: any) {
    console.error('[SOPHIA EXCLUSIVE] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
