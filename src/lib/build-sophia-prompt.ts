import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function buildDynamicPromptLayers(productHint?: string): Promise<string> {
  const [{ data: memories }, { data: skills }, { data: knowledge }] = await Promise.all([
    supabase.from('sophia_memory').select('value, category').eq('active', true).order('importance', { ascending: false }).limit(10),
    supabase.from('sophia_skills').select('name, prompt_injection').eq('active', true),
    supabase.from('sophia_knowledge').select('title, content, embedding_summary, tags').eq('active', true).order('created_at', { ascending: false }).limit(8),
  ])

  let layers = ''

  if (memories?.length) {
    layers += '\n═══ MEMORIA DEL MAESTRO ═══\n' + memories.map(m => `• ${m.value}`).join('\n')
  }

  if (skills?.length) {
    // Smart skill selection: load product-specific + general, max ~6000 chars total
    let selectedSkills = skills
    if (productHint) {
      const hint = productHint.toLowerCase()
      const relevant = skills.filter(s => s.name.toLowerCase().includes(hint))
      const general = skills.filter(s => !s.name.toLowerCase().includes(hint) && !s.name.startsWith('iul_') && !s.name.startsWith('ventas_'))
      // Product skills first, then general (cross_selling, objection_master, etc)
      selectedSkills = [...relevant, ...general]
    }
    // Cap total skill injection to ~6000 chars to avoid context overflow
    let skillText = ''
    for (const s of selectedSkills) {
      if (skillText.length + s.prompt_injection.length > 6000) break
      skillText += s.prompt_injection + '\n'
    }
    if (skillText) layers += '\n═══ SKILLS ACTIVOS ═══\n' + skillText
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

    // Cap knowledge to ~4000 chars total
    let knowledgeText = ''
    for (const k of sortedKnowledge) {
      const text = (k as any).content || (k as any).embedding_summary || ''
      if (text.startsWith('```') || text.startsWith('{')) continue
      const isRelevant = productHint && ((k as any).title?.toLowerCase().includes(productHint.toLowerCase()) || (k as any).tags?.some((t: string) => t.toLowerCase().includes(productHint.toLowerCase())))
      const maxLen = isRelevant ? 800 : 300
      const entry = `[${(k as any).title}]: ${text.substring(0, maxLen)}\n\n`
      if (knowledgeText.length + entry.length > 4000) break
      knowledgeText += entry
    }
    if (knowledgeText) layers += '\n═══ CONOCIMIENTO ═══\n' + knowledgeText
  }

  return layers
}
