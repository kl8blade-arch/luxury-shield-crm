// src/lib/sophia-winback.ts
// Detecta si alguien ya tiene seguro con otra compañía

export function detectsExistingInsurance(message: string): boolean {
  const signals = [
    'ya tengo seguro', 'ya soy cliente', 'ya estoy asegurado',
    'tengo cobertura', 'tengo un plan', 'ya tengo plan',
    'mi seguro', 'mi plan', 'mi compañía de seguro',
    'already have', 'already insured', 'i have insurance',
    'have coverage', 'have a plan',
    'florida blue', 'molina', 'ambetter', 'oscar', 'simply healthcare',
    'bright health', 'friday health', 'aetna', 'cigna', 'humana',
    'united', 'medicare advantage', 'medicaid', 'chip',
    'i have medicaid', 'tengo medicaid', 'tengo medicare',
    'soy cliente de', 'tengo con', 'mi plan es de',
  ]
  const lower = message.toLowerCase()
  return signals.some(s => lower.includes(s))
}

export function detectsCompetitorCarrier(message: string): string | null {
  const carriers: Record<string, string[]> = {
    'Florida Blue':      ['florida blue', 'blue cross', 'bcbs'],
    'Molina':            ['molina'],
    'Ambetter':          ['ambetter'],
    'Oscar Health':      ['oscar'],
    'Simply Healthcare': ['simply', 'simply healthcare'],
    'Bright Health':     ['bright health'],
    'Aetna':             ['aetna', 'cvs'],
    'Cigna':             ['cigna'],
    'Humana':            ['humana'],
    'UnitedHealthcare':  ['united', 'uhc'],
    'Medicaid':          ['medicaid'],
    'Medicare':          ['medicare'],
  }
  const lower = message.toLowerCase()
  for (const [carrier, keywords] of Object.entries(carriers)) {
    if (keywords.some(k => lower.includes(k))) return carrier
  }
  return null
}
