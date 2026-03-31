import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM!

async function sendWA(to: string, msg: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const auth = `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`
  const body = new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanTo}`, Body: msg })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

async function sendMediaWA(to: string, msg: string, mediaUrl: string) {
  const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`
  const auth = `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`
  const body = new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${cleanTo}`, Body: msg, MediaUrl: mediaUrl })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

/**
 * Check if an incoming WhatsApp message is from an agent in onboarding
 * Returns true if handled (caller should stop processing)
 */
export async function handleAgentOnboarding(
  from: string,
  body: string,
  mediaUrl?: string,
  mediaType?: string,
): Promise<boolean> {
  const fromDigits = from.replace(/\D/g, '')
  const last10 = fromDigits.slice(-10)

  // Find agent by phone who is in onboarding
  const { data: agent } = await supabase.from('agents')
    .select('id, name, phone, wa_onboarding_step, account_id, company_name')
    .or(`phone.like.%${last10}%,phone.eq.${from},phone.eq.+1${last10}`)
    .not('wa_onboarding_step', 'is', null)
    .not('wa_onboarding_step', 'eq', 'done')
    .limit(1)
    .single()

  if (!agent) return false

  const step = agent.wa_onboarding_step
  const firstName = agent.name?.split(' ')[0] || 'agente'

  console.log(`[ONBOARDING] Agent ${agent.name} — step: ${step} — body: "${body}" — media: ${mediaUrl ? 'yes' : 'no'}`)

  // ══════════════════════════════
  // STEP: LOGO — waiting for logo image
  // ══════════════════════════════
  if (step === 'logo') {
    if (mediaUrl && mediaType && (mediaType.includes('image') || mediaType.includes('png') || mediaType.includes('jpeg') || mediaType.includes('jpg'))) {
      // Download image from Twilio
      const twilioAuth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
      const redirectRes = await fetch(mediaUrl, { headers: { 'Authorization': `Basic ${twilioAuth}` }, redirect: 'manual' })
      const finalUrl = redirectRes.status === 307 || redirectRes.status === 302 ? redirectRes.headers.get('location') || mediaUrl : mediaUrl

      // Download the image
      const imgRes = await fetch(finalUrl)
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
      const imgBase64 = imgBuffer.toString('base64')
      const imgDataUrl = `data:${mediaType};base64,${imgBase64}`

      // Save logo to account
      if (agent.account_id) {
        await supabase.from('accounts').update({ logo_url: imgDataUrl }).eq('id', agent.account_id)
      }
      // Also save to agent profile
      await supabase.from('agents').update({ profile_photo: imgDataUrl }).eq('id', agent.id)

      // Move to next step
      await supabase.from('agents').update({ wa_onboarding_step: 'color' }).eq('id', agent.id)

      await sendWA(from,
        `✅ *Logo recibido!*\n\nYa lo aplique a tu CRM, ${firstName}.\n\nAhora dime: cual es el color principal de tu marca? Puedes decirme:\n\n• Un nombre de color (ej: "azul", "rojo", "dorado")\n• Un codigo hex (ej: "#FF5733")\n\nO escribe *"saltar"* para usar el dorado por defecto.`
      )
      return true
    }

    // Not an image — ask again
    if (body.toLowerCase().includes('saltar') || body.toLowerCase().includes('skip') || body.toLowerCase().includes('no tengo')) {
      await supabase.from('agents').update({ wa_onboarding_step: 'color' }).eq('id', agent.id)
      await sendWA(from, `Sin problema! Puedes subir tu logo despues desde el CRM.\n\nAhora dime: cual es el *color principal* de tu marca?\n\nEj: "azul", "rojo", "#FF5733" o "saltar" para usar dorado.`)
      return true
    }

    await sendWA(from, `${firstName}, necesito que me envies tu *logo como imagen* (PNG o JPG).\n\nSi no tienes uno ahora, escribe *"saltar"* y lo subes despues.`)
    return true
  }

  // ══════════════════════════════
  // STEP: COLOR — waiting for brand color
  // ══════════════════════════════
  if (step === 'color') {
    let color = '#C9A84C' // default gold
    const text = body.toLowerCase().trim()

    const colorMap: Record<string, string> = {
      'azul': '#2563eb', 'azul marino': '#1e3a5f', 'rojo': '#dc2626', 'verde': '#059669',
      'dorado': '#C9A84C', 'oro': '#C9A84C', 'gold': '#C9A84C', 'morado': '#7c3aed',
      'violeta': '#8b5cf6', 'naranja': '#ea580c', 'negro': '#1a1a2e', 'blanco': '#f8fafc',
      'rosa': '#ec4899', 'amarillo': '#eab308', 'turquesa': '#06b6d4', 'gris': '#6b7280',
    }

    if (text.startsWith('#') && text.length >= 4) {
      color = text
    } else if (colorMap[text]) {
      color = colorMap[text]
    } else if (text === 'saltar' || text === 'skip') {
      color = '#C9A84C'
    }

    if (agent.account_id) {
      await supabase.from('accounts').update({ brand_color: color }).eq('id', agent.account_id)
    }

    await supabase.from('agents').update({ wa_onboarding_step: 'welcome' }).eq('id', agent.id)

    await sendWA(from,
      `🎨 Color configurado!\n\nUltimo paso: escribe un *mensaje de bienvenida* para tus clientes. Este es el primer mensaje que Sophia enviara cuando un lead te escriba.\n\nEjemplo: "Hola! Gracias por contactar a ${agent.company_name || 'nuestra agencia'}. Mi nombre es ${firstName}, como te puedo ayudar hoy?"\n\nO escribe *"usar default"* para uno automatico.`
    )
    return true
  }

  // ══════════════════════════════
  // STEP: WELCOME — waiting for welcome message
  // ══════════════════════════════
  if (step === 'welcome') {
    const text = body.trim()
    let welcomeMsg = text

    if (text.toLowerCase() === 'usar default' || text.toLowerCase() === 'default' || text.toLowerCase() === 'saltar') {
      welcomeMsg = `Hola! Gracias por contactarnos. Soy ${firstName} de ${agent.company_name || 'nuestra agencia'}. En que te puedo ayudar?`
    }

    if (agent.account_id) {
      await supabase.from('accounts').update({ welcome_message: welcomeMsg }).eq('id', agent.account_id)
    }

    // Mark onboarding complete
    await supabase.from('agents').update({ wa_onboarding_step: 'done', onboarding_complete: true }).eq('id', agent.id)

    await sendWA(from,
      `🎉 *Tu CRM esta listo, ${firstName}!*\n\n✅ Logo configurado\n✅ Color de marca aplicado\n✅ Mensaje de bienvenida guardado\n\nYa puedes acceder a tu panel:\n👉 https://luxury-shield-crm.vercel.app/login\n\nDesde ahi veras tu dashboard, pipeline, leads, y toda la plataforma.\n\nSi necesitas ayuda, escribeme aqui. Soy Sophia, tu asistente de IA. 🛡️`
    )
    return true
  }

  return false
}

/**
 * Trigger the onboarding flow for a newly registered agent via WhatsApp
 */
export async function startAgentOnboarding(agentId: string) {
  const { data: agent } = await supabase.from('agents')
    .select('id, name, phone, email, company_name')
    .eq('id', agentId)
    .single()

  if (!agent || !agent.phone) {
    console.log(`[ONBOARDING] Can't start — agent ${agentId} has no phone`)
    return
  }

  // Set onboarding step
  await supabase.from('agents').update({ wa_onboarding_step: 'logo' }).eq('id', agentId)

  const firstName = agent.name?.split(' ')[0] || 'agente'

  // Send initial onboarding message
  await sendWA(agent.phone,
    `👋 *Hola ${firstName}! Soy Sophia, tu asistente de IA en Luxury Shield CRM.*\n\nTu cuenta ya esta creada! Ahora necesito configurar tu CRM. Son solo 3 pasos rapidos:\n\n*Paso 1/3:* Envíame el *logo de tu agencia* como imagen (PNG o JPG).\n\nEste logo aparecera en tu CRM y en las comunicaciones con tus clientes.\n\nSi no tienes uno, escribe *"saltar"*.`
  )
}
