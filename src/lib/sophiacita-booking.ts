// src/lib/sophiacita-booking.ts
export type BookingMethod =
  | { type: 'google';  url:     string }
  | { type: 'acuity';  url:     string }
  | { type: 'phone';   phone:   string }
  | { type: 'request'; message: string }

export async function detectAcuityLink(website: string | null): Promise<string | null> {
  if (!website) return null
  try {
    const res  = await fetch(website, { signal: AbortSignal.timeout(5000) })
    const html = await res.text()
    const m    = html.match(/acuityscheduling\.com\/schedule\.php\?owner=(\d+)/i)
    if (m) return `https://acuityscheduling.com/schedule.php?owner=${m[1]}`
    return null
  } catch { return null }
}

export async function getGoogleBookingUrl(placeId: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey || !placeId) return null
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reservations_url&key=${apiKey}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    return data.result?.reservations_url ?? null
  } catch { return null }
}

export async function determineBestBookingMethod(doctor: { name: string; phone: string; website: string | null; placeId: string | null; npi: string }): Promise<BookingMethod> {
  if (doctor.placeId) {
    const url = await getGoogleBookingUrl(doctor.placeId)
    if (url) return { type: 'google', url }
  }
  if (doctor.website) {
    const url = await detectAcuityLink(doctor.website)
    if (url) return { type: 'acuity', url }
  }
  if (doctor.phone) return { type: 'phone', phone: doctor.phone }
  return { type: 'request', message: `Llama directamente a ${doctor.name} para agendar.` }
}

export function formatBookingInstructions(method: BookingMethod, doctorName: string): string {
  switch (method.type) {
    case 'google':  return `✅ Cita online: ${method.url}`
    case 'acuity':  return `✅ Cita online: ${method.url}`
    case 'phone':   return `📞 Llama a ${doctorName}: ${method.phone}`
    case 'request': return method.message
  }
}
