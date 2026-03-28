export interface ProductOpportunity {
  product: string
  signal: string
  potential_monthly: number
}

export function detectProductOpportunities(lead: any, conversationText: string): ProductOpportunity[] {
  const text = (conversationText || '').toLowerCase()
  const opportunities: ProductOpportunity[] = []

  // Always dental (current product)
  opportunities.push({
    product: 'Dental DVH',
    signal: 'Conversación actual',
    potential_monthly: lead.quiz_coverage_type?.includes('Familia') ? 120 : 40,
  })

  // ACA / Obamacare signals
  if (
    text.match(/no tengo seguro médico|sin seguro medico|without insurance|no health insurance/) ||
    text.match(/self.?employed|por mi cuenta|independiente|freelance|cuenta propia/) ||
    text.match(/perdí.? (mi |el )?trabajo|lost.? (my )?job|cambié de trabajo/) ||
    (lead.age && lead.age < 65 && text.match(/hijos|kids|children|menores/))
  ) {
    opportunities.push({ product: 'ACA / Obamacare', signal: 'Sin seguro médico / trabajo independiente', potential_monthly: 200 })
  }

  // Vida / IUL signals
  if (
    text.match(/hijos|familia|children|kids|esposa|wife|husband|esposo/) ||
    text.match(/futuro|future|proteger|protect|herencia|legacy/) ||
    (lead.age && lead.age >= 30 && lead.age <= 55)
  ) {
    opportunities.push({ product: 'Vida / IUL', signal: 'Familia con hijos / edad 30-55', potential_monthly: 80 })
  }

  // Medicare signals
  if (
    (lead.age && lead.age >= 64) ||
    text.match(/jubil|retire|medicare|65 años|padres mayores|parents/)
  ) {
    opportunities.push({ product: 'Medicare', signal: 'Edad 64+ o mención jubilación', potential_monthly: 150 })
  }

  // Supplemental (accident/hospital)
  if (
    text.match(/construcci[oó]n|construction|físico|physical|manufactur|warehouse|almacén/) ||
    text.match(/accidente|accident|hospital|emergencia|emergency/) ||
    text.match(/quiero más cobertura|want more coverage|complementar/)
  ) {
    opportunities.push({ product: 'Suplementario (Accidente/Hospital)', signal: 'Trabajo físico / quiere más cobertura', potential_monthly: 45 })
  }

  return opportunities
}

export function formatOpportunitiesForAgent(opportunities: ProductOpportunity[]): string {
  if (opportunities.length <= 1) return ''

  const lines = opportunities.map(o =>
    `- ${o.product}: ~$${o.potential_monthly}/mes (señal: ${o.signal})`
  )
  const total = opportunities.reduce((s, o) => s + o.potential_monthly, 0)

  return `\n💰 *OPORTUNIDAD TOTAL:*\n${lines.join('\n')}\n━━━━━━━━━━━━━━━\nValor potencial: *$${total}/mes*`
}
