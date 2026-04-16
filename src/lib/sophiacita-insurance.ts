// src/lib/sophiacita-insurance.ts
const CARRIER_FHIR: Record<string, { endpoint: string; name: string; plans: string[] }> = {
  cigna:    { endpoint: 'https://fhir.cigna.com/r4',                    name: 'Cigna',         plans: ['cigna','cigna dental','cigna dvh','dvh plus'] },
  humana:   { endpoint: 'https://api.humana.com/public/fhir/v1',        name: 'Humana',        plans: ['humana','humana dental'] },
  aetna:    { endpoint: 'https://member.aetna.com/apihub/fhir/v1',     name: 'Aetna',         plans: ['aetna','aetna cvs','cvs'] },
  united:   { endpoint: 'https://api.uhc.com/fhir/r4',                  name: 'UnitedHealth',  plans: ['united','uhc','united health'] },
  molina:   { endpoint: 'https://api.molinahealthcare.com/r4',          name: 'Molina',        plans: ['molina'] },
  oscar:    { endpoint: 'https://api.hioscar.com/v1/fhir/r4',           name: 'Oscar Health',  plans: ['oscar'] },
  medicare: { endpoint: 'https://sandbox.bluebutton.cms.gov/v2/fhir',   name: 'Medicare',      plans: ['medicare'] },
}

export function detectCarrier(insuranceType: string | null): string | null {
  if (!insuranceType) return null
  const lower = insuranceType.toLowerCase()
  for (const [id, info] of Object.entries(CARRIER_FHIR)) {
    if (info.plans.some(p => lower.includes(p))) return id
  }
  return null
}

export async function searchInNetworkDoctors(params: { carrierId: string; specialty?: string; state?: string; city?: string; limit?: number }) {
  const carrier = CARRIER_FHIR[params.carrierId]
  if (!carrier) return []
  try {
    const q = new URLSearchParams({ _count: String(params.limit ?? 10) })
    if (params.specialty) q.set('specialty', params.specialty)
    if (params.state)     q.set('address-state', params.state)
    if (params.city)      q.set('address-city', params.city)
    const res = await fetch(`${carrier.endpoint}/Practitioner?${q}`, { headers: { 'Accept': 'application/fhir+json' }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const bundle = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (bundle.entry ?? []).slice(0, params.limit ?? 5).map((e: any) => {
      const r = e.resource
      const name = r.name?.[0]
      const addr = r.address?.[0]
      return { name: name?.text ?? `${name?.given?.join(' ') ?? ''} ${name?.family ?? ''}`.trim(), phone: r.telecom?.find((t: { system: string }) => t.system === 'phone')?.value ?? '', specialty: r.qualification?.[0]?.code?.text ?? '', address: { address_1: addr?.line?.join(', ') ?? '', city: addr?.city ?? '', state: addr?.state ?? '' }, inNetwork: true, carrier: carrier.name, source: 'fhir', website: null, placeId: null, npi: '' }
    }).filter((d: { name: string }) => d.name.length > 2)
  } catch { return [] }
}
