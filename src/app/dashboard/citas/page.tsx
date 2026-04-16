'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { ChevronDown, MapPin, Phone, MessageCircle, Eye, EyeOff } from 'lucide-react'

interface Appointment {
  id: string
  doctor_name: string
  specialty?: string
  scheduled_at: string
  status: string
  lead_name: string
  lead_phone: string
  in_network?: boolean
  insurance_carrier?: string
  doctor_address?: string
  doctor_phone?: string
  booking_source?: string
  appointment_followups?: {
    id: string
    status: string
    reminder_24h_at?: string
    reminder_2h_at?: string
    checkin_at?: string
    checkin_responded: boolean
    checkin_sentiment?: string
    referral_at?: string
    referral_converted?: boolean
    thankyou_at?: string
  }
}

const StatusConfig: Record<string, { label: string; color: string }> = {
  requested:   { label: 'Solicitada', color: 'bg-blue-100 text-blue-800' },
  confirmed:   { label: 'Confirmada', color: 'bg-green-100 text-green-800' },
  reminded:    { label: 'Recordada', color: 'bg-yellow-100 text-yellow-800' },
  completed:   { label: 'Completada', color: 'bg-purple-100 text-purple-800' },
  cancelled:   { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  no_show:     { label: 'No se presentó', color: 'bg-gray-100 text-gray-800' },
  rescheduled: { label: 'Reprogramada', color: 'bg-orange-100 text-orange-800' },
}

const SentimentConfig: Record<string, { label: string; icon: string }> = {
  positive: { label: 'Positivo', icon: '😊' },
  neutral:  { label: 'Neutral', icon: '😐' },
  negative: { label: 'Negativo', icon: '😞' },
}

function TouchpointTimeline({ followup }: { followup?: Appointment['appointment_followups'] }) {
  const touchpoints = [
    { key: 'reminder_24h_at', label: 'T-24h', icon: '📅' },
    { key: 'reminder_2h_at',  label: 'T-2h', icon: '⏰' },
    { key: 'checkin_at',      label: 'Checkin', icon: '❓' },
    { key: 'referral_at',     label: 'Referral', icon: '🔗' },
    { key: 'thankyou_at',     label: 'Thank you', icon: '💙' },
  ]

  return (
    <div className="flex gap-2 text-sm">
      {touchpoints.map(t => (
        <div
          key={t.key}
          className={`px-2 py-1 rounded text-xs ${
            followup && followup[t.key as keyof typeof followup] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {t.icon}
        </div>
      ))}
    </div>
  )
}

export default function CitasPage() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    fetchAppointments()
  }, [user?.id])

  async function fetchAppointments() {
    setLoading(true)
    try {
      if (!user?.id) return
      const res = await fetch(`/api/dashboard/citas?agentId=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        setAppointments(data.appointments || [])
      }
    } catch (e) {
      console.error('Error fetching citas:', e)
    } finally {
      setLoading(false)
    }
  }

  function getFilteredAppointments() {
    const now = new Date()
    return appointments.filter(a => {
      const apptTime = new Date(a.scheduled_at)
      switch (filter) {
        case 'upcoming':
          return apptTime > now && a.status !== 'cancelled'
        case 'active':
          return a.status === 'confirmed' || a.status === 'reminded'
        case 'completed':
          return a.status === 'completed'
        default:
          return true
      }
    })
  }

  async function updateStatus(appointmentId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/dashboard/citas/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setAppointments(prev =>
          prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a)
        )
      }
    } catch (e) {
      console.error('Error updating status:', e)
    }
  }

  const filtered = getFilteredAppointments()

  if (loading) return <div className="p-4">Cargando...</div>

  return (
    <div className="flex gap-6 p-6">
      {/* Main list */}
      <div className="flex-1">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-4">Mis Citas</h1>
          <div className="flex gap-2">
            {['all', 'upcoming', 'active', 'completed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded ${
                  filter === f
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {f === 'all' ? 'Todas' : f === 'upcoming' ? 'Próximas' : f === 'active' ? 'Activas' : 'Completadas'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map(appt => (
            <div
              key={appt.id}
              className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg">{appt.doctor_name}</h3>
                  <p className="text-sm text-gray-600">{appt.lead_name} • {appt.specialty}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${StatusConfig[appt.status]?.color}`}>
                  {StatusConfig[appt.status]?.label}
                </span>
              </div>

              <div className="text-sm text-gray-600 mb-3">
                📅 {new Date(appt.scheduled_at).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>

              <TouchpointTimeline followup={appt.appointment_followups} />

              <button
                onClick={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
                className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Detalles <ChevronDown size={16} className={expandedId === appt.id ? 'rotate-180' : ''} />
              </button>

              {expandedId === appt.id && (
                <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                  {appt.doctor_address && <p>📍 {appt.doctor_address}</p>}
                  {appt.doctor_phone && <p>📞 {appt.doctor_phone}</p>}
                  {appt.in_network && <p>✅ In-network ({appt.insurance_carrier})</p>}
                  {appt.booking_source && <p>Fuente: {appt.booking_source}</p>}

                  {appt.appointment_followups?.checkin_sentiment && (
                    <p>
                      Sentimiento: {SentimentConfig[appt.appointment_followups.checkin_sentiment]?.icon}{' '}
                      {SentimentConfig[appt.appointment_followups.checkin_sentiment]?.label}
                    </p>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => updateStatus(appt.id, 'completed')}
                      className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                    >
                      Completar
                    </button>
                    <button
                      onClick={() => setShowSidebar(showSidebar === appt.id ? null : appt.id)}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    >
                      Panel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Side panel */}
      {showSidebar && (
        <div className="w-80 bg-white border rounded-lg p-4 h-fit sticky top-6">
          {(() => {
            const appt = appointments.find(a => a.id === showSidebar)
            return appt ? (
              <div>
                <h3 className="font-bold mb-4">{appt.lead_name}</h3>

                {appt.doctor_address && (
                  <Link
                    href={`https://maps.google.com/?q=${encodeURIComponent(appt.doctor_address)}`}
                    target="_blank"
                    className="flex items-center gap-2 p-2 mb-2 bg-blue-50 rounded hover:bg-blue-100"
                  >
                    <MapPin size={16} /> Google Maps
                  </Link>
                )}

                {appt.lead_phone && (
                  <Link
                    href={`https://wa.me/${appt.lead_phone.replace(/\D/g, '')}`}
                    target="_blank"
                    className="flex items-center gap-2 p-2 mb-2 bg-green-50 rounded hover:bg-green-100"
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </Link>
                )}

                <div className="mt-4 text-sm">
                  <p><strong>Teléfono:</strong> {appt.lead_phone}</p>
                  <p><strong>Seguro:</strong> {appt.insurance_carrier || 'N/A'}</p>
                  <p><strong>Fuente:</strong> {appt.booking_source || 'N/A'}</p>
                </div>
              </div>
            ) : null
          })()}
        </div>
      )}
    </div>
  )
}
