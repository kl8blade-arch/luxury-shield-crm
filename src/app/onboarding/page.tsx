'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
]

const INSURANCE_TYPES = [
  { id: 'aca', label: 'Seguros de Salud (ACA)' },
  { id: 'dvh', label: 'Dental / Visión / Audición (DVH)' },
  { id: 'medicare', label: 'Medicare' },
  { id: 'vida', label: 'Vida / IUL' },
  { id: 'accidentes', label: 'Accidentes' },
  { id: 'otro', label: 'Otro' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1
  const [name, setName] = useState('')
  const [company_name, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [logo_url, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)

  // Step 2
  const [insurance_types, setInsuranceTypes] = useState<string[]>([])
  const [business_description, setBusinessDescription] = useState('')
  const [licensed_states, setLicensedStates] = useState<string[]>([])
  const [statesOpen, setStatesOpen] = useState(false)

  // Step 3
  const [sophia_tone, setSophiaTone] = useState('amigable')
  const [sophia_language, setSophiaLanguage] = useState('es')
  const [welcome_message, setWelcomeMessage] = useState('')

  // Step 4
  const [whatsapp_phone, setWhatsappPhone] = useState('')
  const [ownNumber, setOwnNumber] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setCompanyName(user.company_name || '')
      setPhone(user.phone || '')
      setWhatsappPhone(user.phone || '')
    }
  }, [user])

  async function saveStep(currentStep: number, data: any) {
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: user?.id,
          step: currentStep,
          data,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      return result
    } catch (err: any) {
      alert('Error: ' + err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleNext() {
    if (step === 1) {
      const saved = await saveStep(1, { name, company_name, phone, logo_url })
      if (saved) setStep(2)
    } else if (step === 2) {
      const saved = await saveStep(2, { insurance_types, business_description, licensed_states })
      if (saved) setStep(3)
    } else if (step === 3) {
      const saved = await saveStep(3, { sophia_tone, sophia_language, welcome_message })
      if (saved) setStep(4)
    } else if (step === 4) {
      const saved = await saveStep(4, { phone: whatsapp_phone })
      if (saved) {
        const completed = await fetch('/api/onboarding/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: user?.id, step: 'complete', data: {} }),
        }).then(r => r.json())

        if (completed.success) {
          // Actualizar localStorage
          const userData = { ...user, onboarding_complete: true }
          localStorage.setItem('ls_auth', JSON.stringify(userData))
          router.push('/dashboard')
        }
      }
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (evt) => {
      setLogoUrl(evt.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#050507',
    padding: '40px 20px',
    fontFamily: '"Outfit", sans-serif',
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: 600,
    margin: '0 auto',
    background: 'rgba(255,255,255,0.015)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 40,
  }

  const progressStyle: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    marginBottom: 40,
    justifyContent: 'space-between',
  }

  const progressBarStyle = (isActive: boolean, isComplete: boolean): React.CSSProperties => ({
    flex: 1,
    height: 4,
    borderRadius: 2,
    background: isComplete ? '#C9A84C' : isActive ? '#C9A84C' : 'rgba(255,255,255,0.1)',
    transition: 'all 0.3s',
  })

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#F0ECE3',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    marginBottom: 16,
    boxSizing: 'border-box',
  }

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #C9A84C, #8B6E2E)',
    color: '#050507',
    border: 'none',
    fontSize: 15,
    fontWeight: 700,
    cursor: loading ? 'wait' : 'pointer',
    fontFamily: 'inherit',
    marginTop: 20,
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Progress bar */}
        <div style={progressStyle}>
          {[1, 2, 3, 4].map(s => (
            <div key={s} style={progressBarStyle(step === s, s < step)} />
          ))}
        </div>

        <h1 style={{ color: '#F0ECE3', fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>
          {step === 1 && 'Tu Negocio'}
          {step === 2 && 'Tus Servicios'}
          {step === 3 && 'Configura a Sophia'}
          {step === 4 && 'Tu WhatsApp'}
        </h1>
        <p style={{ color: 'rgba(240,236,227,0.4)', fontSize: 13, margin: '0 0 28px' }}>
          Paso {step} de 4
        </p>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase' }}>
              Nombre Completo *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tu nombre"
              style={inputStyle}
            />

            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase' }}>
              Nombre de la Agencia *
            </label>
            <input
              type="text"
              value={company_name}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Ej: SeguriSSimo Agency"
              style={inputStyle}
            />

            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase' }}>
              Teléfono *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 (786) 555-0000"
              style={inputStyle}
            />

            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase' }}>
              Logo (Opcional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              style={{
                ...inputStyle,
                padding: '8px 14px',
                color: 'rgba(240,236,227,0.5)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            />
            {logo_url && (
              <div style={{ marginBottom: 16, textAlign: 'center' }}>
                <img src={logo_url} alt="Logo" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8 }} />
              </div>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              ¿Qué productos/servicios ofreces? *
            </label>
            <div style={{ marginBottom: 20 }}>
              {INSURANCE_TYPES.map(type => (
                <label key={type.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={insurance_types.includes(type.id)}
                    onChange={e => {
                      if (e.target.checked) setInsuranceTypes([...insurance_types, type.id])
                      else setInsuranceTypes(insurance_types.filter(x => x !== type.id))
                    }}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ color: '#F0ECE3', fontSize: 14 }}>{type.label}</span>
                </label>
              ))}
            </div>

            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase' }}>
              Descripción del Negocio (máx 200 caracteres)
            </label>
            <textarea
              value={business_description}
              onChange={e => setBusinessDescription(e.target.value.slice(0, 200))}
              placeholder="Cuéntanos sobre tu negocio..."
              style={{
                ...inputStyle,
                minHeight: 80,
                resize: 'none',
                padding: '12px 14px',
              }}
            />
            <p style={{ fontSize: 12, color: 'rgba(240,236,227,0.2)', margin: '4px 0 16px' }}>
              {business_description.length}/200
            </p>

            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Estados donde operas
            </label>
            <div
              onClick={() => setStatesOpen(!statesOpen)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <span>{licensed_states.length === 0 ? 'Selecciona estados...' : `${licensed_states.length} estados`}</span>
              <span>{statesOpen ? '▼' : '▶'}</span>
            </div>
            {statesOpen && (
              <div
                style={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 16,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}
              >
                {US_STATES.map(state => (
                  <label key={state} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={licensed_states.includes(state)}
                      onChange={e => {
                        if (e.target.checked) setLicensedStates([...licensed_states, state])
                        else setLicensedStates(licensed_states.filter(x => x !== state))
                      }}
                    />
                    <span style={{ color: '#F0ECE3' }}>{state}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              ¿Cómo quieres que Sophia se presente?
            </label>
            <div
              style={{
                background: 'rgba(201,168,76,0.1)',
                border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: 8,
                padding: 14,
                marginBottom: 20,
                color: '#C9A84C',
                fontSize: 14,
              }}
            >
              Hola, soy Sophia de {company_name || 'tu agencia'} 👋
            </div>

            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Tono de Sophia *
            </label>
            <div style={{ marginBottom: 20 }}>
              {[
                { id: 'profesional', label: 'Profesional y formal' },
                { id: 'amigable', label: 'Amigable y cercano' },
                { id: 'energico', label: 'Energético y motivador' },
              ].map(tone => (
                <label key={tone.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: `2px solid ${sophia_tone === tone.id ? '#C9A84C' : 'rgba(255,255,255,0.2)'}`,
                      background: sophia_tone === tone.id ? '#C9A84C' : 'transparent',
                    }}
                  />
                  <span style={{ color: '#F0ECE3', fontSize: 14 }}>{tone.label}</span>
                </label>
              ))}
            </div>

            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Idioma principal *
            </label>
            <select
              value={sophia_language}
              onChange={e => setSophiaLanguage(e.target.value)}
              style={{
                ...inputStyle,
                marginBottom: 20,
                appearance: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="bilingue">Bilingüe</option>
            </select>

            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Mensaje de Bienvenida
            </label>
            <textarea
              value={welcome_message}
              onChange={e => setWelcomeMessage(e.target.value)}
              placeholder="Ej: 'Hola, soy Sophia. Estoy aquí para ayudarte a encontrar el seguro perfecto para ti.'"
              style={{
                ...inputStyle,
                minHeight: 80,
                resize: 'none',
                padding: '12px 14px',
              }}
            />
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div>
            <label style={{ fontSize: 11, color: 'rgba(240,236,227,0.35)', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Número de WhatsApp para notificaciones *
            </label>
            <input
              type="tel"
              value={whatsapp_phone}
              onChange={e => setWhatsappPhone(e.target.value)}
              placeholder="+1 (786) 555-0000"
              style={inputStyle}
            />

            <div
              style={{
                background: 'rgba(201,168,76,0.1)',
                border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: 8,
                padding: 14,
                marginTop: 20,
              }}
            >
              <label style={{ fontSize: 13, color: '#F0ECE3', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ownNumber}
                  onChange={e => setOwnNumber(e.target.checked)}
                />
                <span>¿Quieres un número propio para tus leads? <strong style={{ color: '#C9A84C' }}>$20/mes</strong></span>
              </label>
              <p style={{ fontSize: 12, color: 'rgba(240,236,227,0.3)', margin: '10px 0 0 30px' }}>
                Si no, usaremos un número compartido gratis
              </p>
            </div>

            <button
              onClick={async () => {
                alert('Enviando mensaje de prueba a ' + whatsapp_phone)
              }}
              style={{
                ...buttonStyle,
                background: 'rgba(52,211,153,0.2)',
                color: '#34d399',
                marginTop: 16,
              }}
            >
              📱 Enviarme un mensaje de prueba
            </button>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 12,
              background: step === 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
              color: step === 1 ? 'rgba(240,236,227,0.3)' : '#F0ECE3',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              cursor: step === 1 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Anterior
          </button>
          <button onClick={handleNext} disabled={loading} style={buttonStyle}>
            {loading ? 'Guardando...' : step === 4 ? '¡Completar!' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}
