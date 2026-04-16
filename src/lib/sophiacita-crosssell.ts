// src/lib/sophiacita-crosssell.ts
// Cross-sell lógico después de una solicitud de cita médica
// Sophia ayuda con la cita Y mantiene el pipeline de venta activo

interface LeadContext {
  name:          string
  insuranceType: string | null
  existingCarrier?: string | null
  purchasedProducts?: string[]
  stage?:        string
}

// Determinar qué tipo de cross-sell aplicar después de dar la cita
export function buildCrossellHook(lead: LeadContext): string | null {

  const hasACA    = lead.insuranceType?.toLowerCase().includes('aca') ||
                    lead.existingCarrier?.toLowerCase().includes('marketplace') ||
                    lead.purchasedProducts?.some(p => p.toLowerCase().includes('aca'))

  const hasDental = lead.insuranceType?.toLowerCase().includes('dental') ||
                    lead.purchasedProducts?.some(p => p.toLowerCase().includes('dental'))

  const inDentalPipeline = lead.insuranceType?.toLowerCase().includes('dental')

  const firstName = lead.name.split(' ')[0].replace(/[^\w]/g, '').trim() || lead.name

  // Caso 1: Está en pipeline dental pero no tiene dental aún
  if (inDentalPipeline && !hasDental) {
    return `\n\n---\n💙 Por cierto ${firstName}, ¿ese médico también te revisa los dientes o tienes cobertura dental aparte? Te pregunto porque muchos de nuestros clientes se sorprenden de lo accesible que es el plan dental de Cigna — desde las limpiezas y rayos X desde el primer día, sin período de espera.`
  }

  // Caso 2: Tiene ACA pero no dental (lo más común)
  if (hasACA && !hasDental) {
    return `\n\n---\n💙 Una cosita ${firstName} — ¿tu plan de ACA actual te cubre odontología? La mayoría de los planes del marketplace no incluyen dental. Tenemos Cigna DVH Plus que complementa perfecto lo que ya tienes, con limpieza y rayos X desde $0 el primer día.`
  }

  // Caso 3: Solo tiene dental, pide médico general → oportunidad ACA
  if (hasDental && !hasACA) {
    return `\n\n---\n💙 ${firstName}, mientras buscas médico — ¿tienes también cobertura médica completa o solo dental? Te pregunto porque a veces hay opciones disponibles con los subsidios del gobierno que mucha gente no conoce.`
  }

  // Caso 4: No tiene nada detectado → pregunta abierta
  return `\n\n---\n💙 ${firstName}, mientras coordinamos tu cita — ¿estás cubierto/a en todo o hay algo que sientas que te falta en tu cobertura actual?`
}

// Construir respuesta final de SophiaCita con cross-sell integrado
export function appendCrossSellToResponse(
  citaResponse: string,
  lead: LeadContext
): string {
  const hook = buildCrossellHook(lead)
  if (!hook) return citaResponse

  // Solo agregar si la respuesta de cita fue exitosa (encontró médicos)
  const foundDoctors = citaResponse.includes('1️⃣') || citaResponse.includes('Encontré')
  if (!foundDoctors) return citaResponse

  return citaResponse + hook
}
