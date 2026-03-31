import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM

async function sendWhatsApp(to: string, body: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return false
  try {
    const phone = to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`
    const params = new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${TWILIO_FROM}`, Body: body })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    return res.ok
  } catch { return false }
}

export async function POST(req: NextRequest) {
  try {
    const { contact, agentId } = await req.json()

    // Step 1: If agentId provided, generate and send code for that specific account
    if (agentId) {
      const { data: token, error } = await supabase.rpc('create_reset_token', { p_agent_id: agentId })
      if (error || !token) {
        return NextResponse.json({ error: 'Error al generar codigo' }, { status: 500 })
      }

      // Get agent info to send code
      const { data: agent } = await supabase.from('agents').select('email, phone, name').eq('id', agentId).single()
      if (!agent) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

      // Send code via WhatsApp (instant)
      const wasSent = agent.phone ? await sendWhatsApp(
        agent.phone,
        `🔐 *Luxury Shield CRM*\n\nHola ${agent.name?.split(' ')[0] || ''},\n\nTu codigo de recuperacion es:\n\n*${token}*\n\nExpira en 15 minutos. Si no solicitaste esto, ignora este mensaje.`
      ) : false

      return NextResponse.json({
        sent: true,
        method: wasSent ? 'whatsapp' : 'display',
        // If WhatsApp failed, return code directly (for demo/dev)
        ...(wasSent ? {} : { code: token }),
        email_hint: agent.email ? agent.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null,
        phone_hint: agent.phone ? agent.phone.replace(/(.{4})(.*)(.{2})/, '$1****$3') : null,
      })
    }

    // Step 2: Look up accounts by email or phone
    if (!contact) {
      return NextResponse.json({ error: 'Ingresa tu email o telefono' }, { status: 400 })
    }

    const { data: accounts, error } = await supabase.rpc('find_accounts_by_contact', {
      p_contact: contact.trim(),
    })

    if (error || !accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'No encontramos una cuenta con ese email o telefono' }, { status: 404 })
    }

    // If single account, auto-select it
    if (accounts.length === 1) {
      // Generate token immediately
      const { data: token } = await supabase.rpc('create_reset_token', { p_agent_id: accounts[0].id })

      const wasSent = accounts[0].phone ? await sendWhatsApp(
        accounts[0].phone,
        `🔐 *Luxury Shield CRM*\n\nHola ${accounts[0].name?.split(' ')[0] || ''},\n\nTu codigo de recuperacion es:\n\n*${token}*\n\nExpira en 15 minutos.`
      ) : false

      return NextResponse.json({
        accounts: accounts.map((a: any) => ({ id: a.id, name: a.name, email_hint: a.email?.replace(/(.{2})(.*)(@.*)/, '$1***$3'), plan: a.plan })),
        single: true,
        sent: true,
        method: wasSent ? 'whatsapp' : 'display',
        ...(wasSent ? {} : { code: token }),
        selectedId: accounts[0].id,
      })
    }

    // Multiple accounts — let user choose
    return NextResponse.json({
      accounts: accounts.map((a: any) => ({
        id: a.id,
        name: a.name,
        email_hint: a.email?.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        plan: a.plan,
      })),
      single: false,
    })
  } catch (err: any) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
