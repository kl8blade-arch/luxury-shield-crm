import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function buildDynamicPromptLayers(): Promise<string> {
  const [{ data: memories }, { data: skills }, { data: knowledge }] = await Promise.all([
    supabase.from('sophia_memory').select('value, category').eq('active', true).order('importance', { ascending: false }).limit(15),
    supabase.from('sophia_skills').select('prompt_injection').eq('active', true),
    supabase.from('sophia_knowledge').select('title, content, embedding_summary').eq('active', true).order('created_at', { ascending: false }).limit(5),
  ])

  let layers = ''

  if (memories?.length) {
    layers += '\n═══ MEMORIA DEL MAESTRO ═══\n' + memories.map(m => `• ${m.value}`).join('\n')
  }

  if (skills?.length) {
    layers += '\n═══ SKILLS ACTIVOS ═══\n' + skills.map(s => s.prompt_injection).join('\n')
  }

  if (knowledge?.length) {
    // Use full content (truncated to 800 chars each) not just summary
    layers += '\n═══ CONOCIMIENTO DE PRODUCTOS ═══\n' + knowledge.map(k => {
      const text = k.content || k.embedding_summary || ''
      // Skip entries that look like malformed JSON
      if (text.startsWith('```') || text.startsWith('{')) return `[${k.title}]: ${k.embedding_summary || ''}`
      return `[${k.title}]: ${text.substring(0, 800)}`
    }).join('\n\n')
  }

  return layers
}
