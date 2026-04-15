// src/app/api/cron/morning-briefing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Anthropic } from '@anthropic-ai/sdk'
import twilio from 'twilio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function GET(request: NextRequest) {
  // Verify cron authorization
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-vercel-cron')

  if (process.env.NODE_ENV !== 'development') {
    if (!cronHeader) {
      return NextResponse.json(
        { error: 'Missing cron header' },
        { status: 401 }
      )
    }

    const expectedToken = process.env.CRON_SECRET
    const headerToken = authHeader?.replace('Bearer ', '')

    if (!expectedToken || headerToken !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  try {
    // Fetch active paid agents
    const { data: agents, error: agentsErr } = await supabase
      .from('agents')
      .select('id, name, phone, company_name')
      .eq('status', 'active')
      .eq('plan_status', 'active')
      .not('phone', 'is', null)

    if (agentsErr) {
      console.error('Failed to fetch agents:', agentsErr)
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: 500 }
      )
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active agents to send briefing',
      })
    }

    const results: { agentId: string; sent: boolean; error?: string }[] = []

    // Process each agent
    for (const agent of agents) {
      try {
        // Fetch agent's briefing data
        const now = new Date()
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        ).toISOString()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
        const startOfMonth = new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        ).toISOString()

        const [leadsRes, convRes, commRes, eventsRes] = await Promise.all([
          supabase
            .from('leads')
            .select('id, name, stage, score, ready_to_buy')
            .eq('agent_id', agent.id)
            .order('score', { ascending: false })
            .limit(50),

          supabase
            .from('conversations')
            .select('id, lead_name, message, sentiment')
            .eq('agent_id', agent.id)
            .gte('created_at', yesterday)
            .limit(10),

          supabase
            .from('commissions')
            .select('commission_amount, status, carrier, product')
            .eq('agent_id', agent.id)
            .gte('created_at', startOfMonth),

          supabase
            .from('calendar_events')
            .select('id, title, start_time')
            .eq('agent_id', agent.id)
            .gte('start_time', startOfToday)
            .limit(5),
        ])

        const leads = leadsRes.data || []
        const conversations = convRes.data || []
        const commissions = commRes.data || []
        const events = eventsRes.data || []

        // Calculate metrics
        const topLeads = leads.slice(0, 10)
        const readyToBuy = leads.filter(l => l.ready_to_buy).length
        const totalCommission = commissions.reduce(
          (sum, c) => sum + Number(c.commission_amount || 0),
          0
        )

        // Generate briefing with Claude
        const briefingPrompt = `Generate a short, motivational morning briefing for an insurance sales agent named ${agent.name} at ${agent.company_name || 'Luxury Shield'}.

Keep it under 150 words in Spanish. Include:
1. Top 3 leads by score: ${topLeads.map(l => `${l.name} (score: ${l.score})`).join(', ') || 'No leads'}
2. Ready to buy: ${readyToBuy} leads waiting
3. Yesterday's conversations: ${conversations.length} exchanges
4. This month's commission: $${Math.round(totalCommission)}
5. Today's calendar: ${events.length} events

End with a motivational phrase. Keep it personal and engaging.`

        const message = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: briefingPrompt,
            },
          ],
        })

        const briefing =
          message.content[0].type === 'text' ? message.content[0].text : ''

        // Send via Twilio WhatsApp
        const phoneNumber = agent.phone.replace(/\D/g, '')
        const whatsappNumber = phoneNumber.startsWith('+')
          ? `whatsapp:${phoneNumber}`
          : `whatsapp:+${phoneNumber}`

        await twilioClient.messages.create({
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
          to: whatsappNumber,
          body: briefing,
        })

        results.push({ agentId: agent.id, sent: true })
      } catch (error) {
        console.error(`Failed to send briefing to agent ${agent.id}:`, error)
        results.push({
          agentId: agent.id,
          sent: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter(r => r.sent).length
    const failureCount = results.filter(r => !r.sent).length

    return NextResponse.json({
      success: true,
      totalAgents: agents.length,
      sent: successCount,
      failed: failureCount,
      results,
    })
  } catch (error) {
    console.error('Morning briefing cron error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
