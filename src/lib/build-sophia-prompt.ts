import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function buildDynamicPromptLayers(productHint?: string): Promise<string> {
  const [{ data: memories }, { data: skills }, { data: knowledge }] = await Promise.all([
    supabase.from('sophia_memory').select('value, category').eq('active', true).order('importance', { ascending: false }).limit(20),
    supabase.from('sophia_skills').select('name, prompt_injection').eq('active', true),
    supabase.from('sophia_knowledge').select('title, content, embedding_summary, tags').eq('active', true).order('created_at', { ascending: false }).limit(15),
  ])

  let layers = ''

  if (memories?.length) {
    layers += '\n═══ MEMORIA DEL MAESTRO ═══\n' + memories.map(m => `• ${m.value}`).join('\n')
  }

  if (skills?.length) {
    // If we have a product hint, prioritize those skills first
    let sortedSkills = skills
    if (productHint) {
      const hint = productHint.toLowerCase()
      sortedSkills = [
        ...skills.filter(s => s.name.toLowerCase().includes(hint)),
        ...skills.filter(s => !s.name.toLowerCase().includes(hint)),
      ]
    }
    layers += '\n═══ SKILLS ACTIVOS ═══\n' + sortedSkills.map(s => s.prompt_injection).join('\n')
  }

  if (knowledge?.length) {
    // If product hint, prioritize relevant knowledge
    let sortedKnowledge = knowledge
    if (productHint) {
      const hint = productHint.toLowerCase()
      sortedKnowledge = [
        ...knowledge.filter((k: any) => k.title?.toLowerCase().includes(hint) || k.tags?.some((t: string) => t.toLowerCase().includes(hint))),
        ...knowledge.filter((k: any) => !k.title?.toLowerCase().includes(hint) && !k.tags?.some((t: string) => t.toLowerCase().includes(hint))),
      ]
    }

    layers += '\n═══ CONOCIMIENTO DE PRODUCTOS ═══\n' + sortedKnowledge.map((k: any) => {
      const text = k.content || k.embedding_summary || ''
      if (text.startsWith('```') || text.startsWith('{')) return `[${k.title}]: ${k.embedding_summary || ''}`
      // More generous truncation for product-specific knowledge
      const maxLen = (productHint && (k.title?.toLowerCase().includes(productHint.toLowerCase()) || k.tags?.some((t: string) => t.toLowerCase().includes(productHint.toLowerCase())))) ? 1500 : 600
      return `[${k.title}]: ${text.substring(0, maxLen)}`
    }).join('\n\n')
  }

  return layers
}
