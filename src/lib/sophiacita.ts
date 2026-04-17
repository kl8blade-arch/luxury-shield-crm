// src/lib/sophiacita.ts — v2
// SophiaCita — búsqueda completa de médicos con seguro + booking
// NPI Registry + CMS FHIR (in-network) + Google Places + Acuity/Google Booking

import { detectCarrier, searchInNetworkDoctors } from '@/lib/sophiacita-insurance'
import { determineBestBookingMethod, formatBookingInstructions } from '@/lib/sophiacita-booking'

const NPI_API = 'https://npiregistry.cms.hhs.gov/api'
const GOOGLE_PLACES_API = 'https://maps.googleapis.com/maps/api/place'

// ── Specialty map ──────────────────────────────────────────────────────────────
const SPECIALTY_MAP: Record<string, { taxonomy: string; label: string }> = {
  'dentista':       { taxonomy: '122300000X', label: 'Dentist' },
  'dental':         { taxonomy: '122300000X', label: 'Dentist' },
  'dentist':        { taxonomy: '122300000X', label: 'Dentist' },
  'ortodoncista':   { taxonomy: '1223E0200X', label: 'Orthodontist' },
  'médico':         { taxonomy: '208D00000X', label: 'General Practice' },
  'medico':         { taxonomy: '208D00000X', label: 'General Practice' },
  'doctor':         { taxonomy: '208D00000X', label: 'General Practice' },
  'familiar':       { taxonomy: '207Q00000X', label: 'Family Medicine' },
  'family':         { taxonomy: '207Q00000X', label: 'Family Medicine' },
  'primario':       { taxonomy: '207Q00000X', label: 'Family Medicine' },
  'primary':        { taxonomy: '207Q00000X', label: 'Family Medicine' },
  'cardiólogo':     { taxonomy: '207RC0000X', label: 'Cardiologist' },
  'cardiologo':     { taxonomy: '207RC0000X', label: 'Cardiologist' },
  'corazón':        { taxonomy: '207RC0000X', label: 'Cardiologist' },
  'dermatólogo':    { taxonomy: '207N00000X', label: 'Dermatologist' },
  'dermatologo':    { taxonomy: '207N00000X', label: 'Dermatologist' },
  'oftalmólogo':    { taxonomy: '207W00000X', label: 'Ophthalmologist' },
  'ojos':           { taxonomy: '207W00000X', label: 'Ophthalmologist' },
  'vista':          { taxonomy: '207W00000X', label: 'Ophthalmologist' },
  'optometrista':   { taxonomy: '152W00000X', label: 'Optometrist' },
  'ortopedista':    { taxonomy: '207X00000X', label: 'Orthopedic' },
  'gynecologist':   { taxonomy: '207V00000X', label: 'Gynecologist' },
  'ginecólogo':     { taxonomy: '207V00000X', label: 'Gynecologist' },
  'ginecologo':     { taxonomy: '207V00000X', label: 'Gynecologist' },
  'pediatra':       { taxonomy: '208000000X', label: 'Pediatrician' },
  'niños':          { taxonomy: '208000000X', label: 'Pediatrician' },
  'psicólogo':      { taxonomy: '103T00000X', label: 'Psychologist' },
  'psicologo':      { taxonomy: '103T00000X', label: 'Psychologist' },
  'psiquiatra':     { taxonomy: '2084P0800X', label: 'Psychiatrist' },
  'nutricionista':  { taxonomy: '133V00000X', label: 'Dietitian' },
  'endocrinólogo':  { taxonomy: '207RE0101X', label: 'Endocrinologist' },
  'diabetes':       { taxonomy: '207RE0101X', label: 'Endocrinologist' },
  'urólogo':        { taxonomy: '208800000X', label: 'Urologist' },
  'gastro':         { taxonomy: '207RG0100X', label: 'Gastroenterologist' },
}

export function detectSpecialty(message: string) {
  const lower = message.toLowerCase()
  for (const [keyword, spec] of Object.entries(SPECIALTY_MAP)) {
    if (lower.includes(keyword)) return { ...spec, keyword }
  }
  return null
}

export function isMedicalAppointmentRequest(message: string): boolean {
  const triggers = [
    // Explicit appointment request phrases
    'cita médica','cita con el médico','cita con doctor',
    'agendar cita','hacer una cita','conseguir cita','sacar una cita',
    'quiero una cita','necesito cita','pedir cita',
    'busco médico','busco doctor',
    'necesito un médico','necesito un doctor',
    'doctor appointment','medical appointment',
    'ver un doctor','ver al doctor','ir al médico','ir al doctor',
    'sofia cita','sophiacita',
    'me puedes ayudar con una cita','ayuda con cita',
  ]
  const lower = message.toLowerCase()
  return triggers.some(t => lower.includes(t))
}

// ── NPI Registry search ────────────────────────────────────────────────────────
async function searchDoctorsNPI(params: {
  specialty?: string; city?: string; state?: string; limit?: number
}) {
  try {
    const query = new URLSearchParams({
      version: '2.1', limit: String(params.limit ?? 10), skip: '0',
    })
    if (params.specialty) query.set('taxonomy_description', params.specialty)
    if (params.state)     query.set('state', params.state)
    if (params.city)      query.set('city', params.city)

    const res = await fetch(`${NPI_API}/?${query}`, {
      headers: { 'Accept': 'application/json' },
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.results ?? []).map((r: any) => ({
      npi:      r.number,
      name:     r.basic.organization_name || `${r.basic.first_name ?? ''} ${r.basic.last_name ?? ''}`.trim(),
      specialty: r.taxonomies?.find((t: { primary: boolean }) => t.primary)?.desc ?? '',
      address:  r.addresses?.find((a: { address_purpose: string }) => a.address_purpose === 'LOCATION') ?? r.addresses?.[0] ?? {},
      phone:    r.addresses?.find((a: { address_purpose: string }) => a.address_purpose === 'LOCATION')?.telephone_number ?? '',
      website:  null,
      placeId:  null,
      source:   'npi',
      inNetwork: false,
    })).filter((d: { name: string }) => d.name.length > 2)
  } catch (e) {
    console.error('[SophiaCita] NPI error:', e)
    return []
  }
}

// ── Google Places enrichment ───────────────────────────────────────────────────
async function enrichWithGooglePlaces(doctorName: string, city: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null
  try {
    const query = encodeURIComponent(`${doctorName} doctor ${city}`)
    const res   = await fetch(
      `${GOOGLE_PLACES_API}/findplacefromtext/json?input=${query}&inputtype=textquery&fields=name,rating,user_ratings_total,opening_hours,website,reservations_url,place_id&key=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data  = await res.json()
    const place = data.candidates?.[0]
    if (!place)  return null
    return {
      rating:       place.rating,
      totalRatings: place.user_ratings_total,
      isOpen:       place.opening_hours?.open_now,
      website:      place.website ?? null,
      bookingUrl:   place.reservations_url ?? null,
      placeId:      place.place_id ?? null,
    }
  } catch { return null }
}

// ── Format doctor card for WhatsApp ───────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDoctorCard(doctor: any, googleData: any, bookingMethod: { type: string; url?: string; phone?: string } | null, index: number): string {
  const lines: string[] = []
  const addr = doctor.address

  lines.push(`${index}️⃣ *${doctor.name}*`)
  if (doctor.specialty)   lines.push(`   🩺 ${doctor.specialty}`)
  if (doctor.inNetwork)   lines.push(`   ✅ In-network (acepta tu seguro)`)
  if (addr?.address_1)    lines.push(`   📍 ${addr.address_1}, ${addr.city ?? ''}, ${addr.state ?? ''}`)

  const phone = doctor.phone || addr?.telephone_number
  if (phone) lines.push(`   📞 ${phone}`)

  if (googleData?.rating) {
    lines.push(`   ${'⭐'.repeat(Math.round(googleData.rating))} ${googleData.rating}/5 (${googleData.totalRatings ?? '?'} reseñas)`)
  }
  if (googleData?.isOpen === true)  lines.push(`   🟢 Abierto ahora`)
  if (googleData?.isOpen === false) lines.push(`   🔴 Cerrado ahora`)

  if (bookingMethod) {
    if (bookingMethod.type === 'google' || bookingMethod.type === 'acuity') {
      lines.push(`   📅 Cita online: ${bookingMethod.url}`)
    } else if (bookingMethod.type === 'phone') {
      lines.push(`   📞 Llama para agendar: ${bookingMethod.phone}`)
    }
  }

  return lines.join('\n')
}

// ── Main flow ──────────────────────────────────────────────────────────────────
export async function handleSophiaCitaIntent(params: {
  message:       string
  leadName:      string
  leadPhone:     string
  insuranceType: string | null
  city:          string | null
  state:         string | null
  zipCode:       string | null
}): Promise<{ handled: boolean; response: string; specialty: string | null; doctors: unknown[] }> {

  const specialty = detectSpecialty(params.message)
  const location  = params.city ?? params.state ?? 'Florida'

  // Sin especialidad detectada — pedir aclaración
  if (!specialty) {
    return {
      handled: true, specialty: null, doctors: [],
      response: `Claro ${params.leadName}, con gusto te ayudo a encontrar un médico 😊\n\n¿Qué tipo de médico necesitas?\n\n🦷 Dentista\n❤️ Cardiólogo\n👁️ Oftalmólogo\n🩺 Médico general\n🧴 Dermatólogo\n👶 Pediatra\n\nEscríbeme el especialista que necesitas y busco los que aceptan tu seguro cerca de ti.`,
    }
  }

  // Detectar si tiene carrier con FHIR disponible
  const carrierId = detectCarrier(params.insuranceType)
  let doctors: unknown[] = []
  let source = 'npi'

  // 1. Buscar in-network via FHIR si tenemos el carrier
  if (carrierId) {
    console.log(`[SophiaCita] Buscando in-network via FHIR para ${carrierId}`)
    const fhirDoctors = await searchInNetworkDoctors({
      carrierId,
      specialty: specialty.label,
      state:     params.state ?? 'FL',
      city:      params.city ?? undefined,
      limit:     8,
    })
    if (fhirDoctors.length > 0) {
      doctors = fhirDoctors
      source  = 'fhir'
      console.log(`[SophiaCita] ${fhirDoctors.length} médicos in-network encontrados`)
    }
  }

  // 2. Fallback: NPI Registry si FHIR no devolvió resultados
  if (doctors.length === 0) {
    console.log(`[SophiaCita] Fallback a NPI Registry`)
    doctors = await searchDoctorsNPI({
      specialty: specialty.label,
      state:     params.state ?? 'FL',
      city:      params.city ?? undefined,
      limit:     8,
    })
  }

  if (doctors.length === 0) {
    return {
      handled: true, specialty: specialty.label, doctors: [],
      response: `Busqué ${specialty.label} en ${location} pero no encontré resultados en este momento.\n\nTe recomiendo llamar al número del reverso de tu tarjeta${params.insuranceType ? ` de ${params.insuranceType}` : ''} para la lista de médicos in-network 📞`,
    }
  }

  // 3. Enriquecer los primeros 3 con Google Places + booking (parallel)
  const top3 = (doctors as { name: string; phone: string; website: string | null; placeId: string | null; npi: string }[]).slice(0, 3)

  const [googleResults, bookingMethods] = await Promise.all([
    Promise.all(top3.map(d => enrichWithGooglePlaces(d.name, location))),
    Promise.all(top3.map(d => determineBestBookingMethod({
      name:    d.name,
      phone:   d.phone,
      website: d.website,
      placeId: d.placeId,
      npi:     d.npi,
    }).catch(() => null))),
  ])

  // Actualizar placeId y website desde Google
  top3.forEach((d, i) => {
    if (googleResults[i]?.placeId) d.placeId = googleResults[i]!.placeId
    if (googleResults[i]?.website) d.website = googleResults[i]!.website
  })

  // 4. Construir respuesta
  const isInNetwork = source === 'fhir'
  const lines: string[] = [
    isInNetwork
      ? `✅ Encontré *${specialty.label}s in-network* para tu seguro ${params.insuranceType} en ${location}:\n`
      : `🔍 Encontré *${specialty.label}s* cerca de ${location}:\n`,
  ]

  top3.forEach((doc, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lines.push(formatDoctorCard(doc, googleResults[i], bookingMethods[i] as any, i + 1))
    lines.push('')
  })

  lines.push(`Escríbeme el número del médico (1, 2 o 3) para ayudarte a agendar tu cita 📅`)

  return {
    handled:   true,
    specialty: specialty.label,
    doctors:   top3,
    response:  lines.join('\n'),
  }
}
