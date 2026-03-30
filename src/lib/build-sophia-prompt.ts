import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function buildDynamicPromptLayers(): Promise<string> {
  const [{ data: memories }, { data: skills }, { data: knowledge }] = await Promise.all([
    supabase.from('sophia_memory').select('value').eq('active', true).order('importance', { ascending: false }).limit(15),
    supabase.from('sophia_skills').select('prompt_injection').eq('active', true),
    supabase.from('sophia_knowledge').select('title, embedding_summary').eq('active', true).order('created_at', { ascending: false }).limit(5),
  ])

  let layers = ''

  if (memories?.length) {
    layers += '\n═══ MEMORIA DEL MAESTRO ═══\n' + memories.map(m => `• ${m.value}`).join('\n')
  }

  if (skills?.length) {
    layers += '\n═══ SKILLS ACTIVOS ═══\n' + skills.map(s => s.prompt_injection).join('\n')
  }

  if (knowledge?.length) {
    layers += '\n═══ CONOCIMIENTO ADICIONAL ═══\n' + knowledge.map(k => `[${k.title}]: ${k.embedding_summary}`).join('\n')
  }

  return layers
}
