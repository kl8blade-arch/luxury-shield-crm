import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ConversationMessage {
  direction: 'inbound' | 'outbound'
  message: string
  created_at: string
}

interface SophiaContext {
  conversations: ConversationMessage[]
  contextSummary?: string
  family?: any
  insights?: any
}

/**
 * Load full Sophia context for a lead
 * Includes: conversation history + family info + extracted insights
 */
export async function loadSophiaContext(
  leadId: string,
  agentId: string | null,
  limit: number = 20
): Promise<SophiaContext | null> {
  try {
    // Load conversation history
    const { data: conversations, error: convErr } = await supabase
      .from('conversations')
      .select('direction, message, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (convErr) {
      console.error('[sophia-context] Error loading conversations:', convErr)
      return null
    }

    // Load lead info for context summary
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name, phone, insurance_type, stage, score, family_relationships, extracted_insights')
      .eq('id', leadId)
      .single()

    let contextSummary = ''
    if (lead) {
      contextSummary = `
Lead: ${lead.name}
Phone: ${lead.phone}
Stage: ${lead.stage}
Score: ${lead.score}
Insurance Type: ${lead.insurance_type}
`
      if (lead.extracted_insights) {
        contextSummary += `Insights: ${lead.extracted_insights}`
      }
    }

    return {
      conversations: conversations || [],
      contextSummary: contextSummary.trim(),
      family: lead?.family_relationships,
      insights: lead?.extracted_insights,
    }
  } catch (e) {
    console.error('[sophia-context] Error in loadSophiaContext:', e)
    return null
  }
}

/**
 * Build Claude message array from conversation history
 * Merges consecutive messages from same direction
 */
export function buildClaudeMessages(
  conversations: ConversationMessage[],
  newMessage: string
): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = []

  // Convert history to Claude format
  for (const conv of conversations) {
    const role = conv.direction === 'inbound' ? 'user' : 'assistant'
    const lastMsg = messages[messages.length - 1]

    if (lastMsg && lastMsg.role === role) {
      // Merge consecutive messages from same sender
      lastMsg.content += `\n${conv.message}`
    } else {
      messages.push({ role, content: conv.message })
    }
  }

  // Add new incoming message
  const lastMsg = messages[messages.length - 1]
  if (lastMsg && lastMsg.role === 'user') {
    lastMsg.content += `\n${newMessage}`
  } else {
    messages.push({ role: 'user', content: newMessage })
  }

  return messages
}
