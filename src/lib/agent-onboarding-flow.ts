// SophiaOS — Agent Onboarding Flow via WhatsApp
// Cuando un agente nuevo se registra, Sophia lo guía por 7 preguntas
// y configura su cuenta completa sin que toque una computadora

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type OnboardingStep =
  | 'nombre_agencia'
  | 'industria'
  | 'producto_principal'
  | 'mercado'
  | 'tono'
  | 'modo'
  | 'completado'

interface OnboardingData {
  nombre_agencia?: string
  industria?: string
  producto_principal?: string
  mercado?: string
  tono?: string
  modo?: string
}

async function sendWA(to: string, message: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const auth = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, To: `whatsapp:${cleanTo}`, Body: message }).toString(),
  })
}

const STEP_QUESTIONS: Record<OnboardingStep, string | ((data: OnboardingData) => string)> = {
  nombre_agencia: `¡Bienvenido a SophiaOS! 🎉

Soy Sophia, tu nueva empleada de IA. Voy a configurar tu agencia en los próximos 5 minutos.

*Pregunta 1 de 6:*
*¿Cómo se llama tu agencia?*
(Ejemplo: "Segurissimo", "Lopez Insurance Group", "Premier Realty")`,

  industria: (data: OnboardingData) => `Perfecto, *${data.nombre_agencia}* — me encanta 💪

*Pregunta 2 de 6:*
*¿En qué industria trabajas?*

1️⃣ Seguros (dental, vida, ACA, Medicare)
2️⃣ Bienes raíces / Real estate
3️⃣ Hipotecas / Mortgage
4️⃣ Automóviles
5️⃣ Otro (dime cuál)

Responde con el número o escribe tu industria.`,

  producto_principal: (data: OnboardingData) => `Excelente. *Pregunta 3 de 6:*

*¿Cuál es tu producto o servicio principal?*
(Ejemplo: "Seguro dental Cigna DVH Plus", "Casas residenciales en Miami", "Refinanciamiento de hipotecas")`,

  mercado: (data: OnboardingData) => `*Pregunta 4 de 6:*

*¿A quién le vendes? Descríbeme tu cliente ideal.*
(Ejemplo: "Familias latinas sin seguro dental en Florida", "Compradores de primera vivienda en Texas", "Trabajadores independientes sin cobertura médica")`,

  tono: (data: OnboardingData) => `*Pregunta 5 de 6:*

*¿Cómo quieres que suene Sophia cuando hable con tus clientes?*

1️⃣ *Amigable* — cálida, cercana, como una amiga de confianza
2️⃣ *Profesional* — formal, experta, informativa
3️⃣ *Enérgica* — motivadora, entusiasta, positiva

Responde con el número.`,

  modo: (data: OnboardingData) => `*Pregunta 6 de 6 — la más importante:*

*¿Cuánto control quieres tener sobre Sophia?*

1️⃣ *Autopilot* — Sophia actúa sola: aprende, crea sub-agentes, actualiza su conocimiento sin pedirte permiso. Tú solo ves los resultados.

2️⃣ *Confirmación* — Sophia te propone cada cambio importante y espera tu aprobación antes de ejecutar.

3️⃣ *Híbrido* — Sophia actúa sola en cosas pequeñas (aprender, responder) y te pide permiso para cosas grandes (crear agentes, cambiar flujos).

Responde con el número.`,

  completado: '',
}

function getQuestion(step: OnboardingStep, data: OnboardingData): string {
  const q = STEP_QUESTIONS[step]
  if (typeof q === 'function') return (q as any)(data)
  return q
}

const TONO_MAP: Record<string, string> = { '1': 'amigable', '2': 'profesional', '3': 'energico' }
const MODO_MAP: Record<string, string> = { '1': 'autopilot', '2': 'confirmacion', '3': 'hibrido' }
const INDUSTRIA_MAP: Record<string, string> = {
  '1': 'seguros', '2': 'real_estate', '3': 'mortgage', '4': 'automoviles',
}

export async function handleAgentOnboardingFlow(
  phone: string,
  message: string,
  agentId: string
): Promise<boolean> {
  const msg = message.trim()

  // Buscar sesión activa
  const { data: session } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()

  // Si no hay sesión activa y el agente no ha hecho onboarding → iniciar
  if (!session) {
    const { data: agent } = await supabase
      .from('agents')
      .select('onboarding_complete, wa_onboarding_step')
      .eq('id', agentId)
      .single()

    if (agent?.onboarding_complete) return false // ya completó, flujo normal

    // Crear sesión nueva
    await supabase.from('onboarding_sessions').insert({
      phone,
      step: 'nombre_agencia',
      data: {},
    })

    await supabase.from('agents').update({ wa_onboarding_step: 'nombre_agencia' }).eq('id', agentId)
    await sendWA(phone, getQuestion('nombre_agencia', {}))
    return true
  }

  if (session.completed) return false

  const step = session.step as OnboardingStep
  const data: OnboardingData = session.data || {}

  // Procesar respuesta según el paso actual
  let nextStep: OnboardingStep | null = null

  switch (step) {
    case 'nombre_agencia':
      if (msg.length < 2) {
        await sendWA(phone, '⚠️ Por favor escribe el nombre de tu agencia.')
        return true
      }
      data.nombre_agencia = msg
      nextStep = 'industria'
      break

    case 'industria':
      data.industria = INDUSTRIA_MAP[msg] || msg.toLowerCase()
      nextStep = 'producto_principal'
      break

    case 'producto_principal':
      data.producto_principal = msg
      nextStep = 'mercado'
      break

    case 'mercado':
      data.mercado = msg
      nextStep = 'tono'
      break

    case 'tono':
      data.tono = TONO_MAP[msg] || 'amigable'
      nextStep = 'modo'
      break

    case 'modo':
      data.modo = MODO_MAP[msg] || 'confirmacion'
      nextStep = 'completado'
      break
  }

  if (!nextStep) return false

  // Actualizar sesión
  await supabase.from('onboarding_sessions').update({
    step: nextStep,
    data,
    updated_at: new Date().toISOString(),
    completed: nextStep === 'completado',
  }).eq('phone', phone)

  if (nextStep === 'completado') {
    // Aplicar configuración al agente
    await supabase.from('agents').update({
      company_name: data.nombre_agencia,
      industry: data.industria,
      sophia_mode: data.modo as any,
      onboarding_complete: true,
      wa_onboarding_step: 'completado',
      updated_at: new Date().toISOString(),
    }).eq('id', agentId)

    // Actualizar agent_configs con el tono
    await supabase.from('agent_configs').upsert({
      agent_id: agentId,
      main_industry: data.industria,
      custom_prompt: `Tono: ${data.tono}. Producto principal: ${data.producto_principal}. Mercado objetivo: ${data.mercado}.`,
    }, { onConflict: 'agent_id' })

    const modoDesc = {
      autopilot: 'trabajará de forma autónoma 🤖',
      confirmacion: 'te pedirá confirmación antes de cada cambio importante ✋',
      hibrido: 'actuará sola en lo pequeño y te consultará en lo grande ⚡',
    }[data.modo || 'confirmacion']

    await sendWA(phone,
      `✅ *¡${data.nombre_agencia} está lista para operar!*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `🏢 Agencia: *${data.nombre_agencia}*\n` +
      `🏭 Industria: ${data.industria}\n` +
      `🎯 Producto: ${data.producto_principal}\n` +
      `👥 Mercado: ${data.mercado}\n` +
      `🎭 Tono: ${data.tono}\n` +
      `🤖 Modo: ${data.modo} — Sophia ${modoDesc}\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `Sophia ya está entrenada para tu nicho y lista para recibir leads.\n\n` +
      `*Comandos útiles:*\n` +
      `• \`MIS LEADS\` — ver leads activos\n` +
      `• \`MI REPORTE\` — métricas de la semana\n` +
      `• \`MI TONO [amigable/profesional/energico]\` — cambiar tono\n` +
      `• \`MODO [autopilot/confirmacion/hibrido]\` — cambiar modo\n` +
      `• \`MIS AGENTES\` — ver sub-agentes activos\n\n` +
      `¡Bienvenido a SophiaOS! 🚀`
    )
    return true
  }

  // Enviar siguiente pregunta
  await sendWA(phone, getQuestion(nextStep, data))
  return true
}
