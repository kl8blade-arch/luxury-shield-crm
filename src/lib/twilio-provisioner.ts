import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const MASTER_SID = process.env.TWILIO_ACCOUNT_SID!
const MASTER_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'

async function twilioRequest(path: string, method: string = 'GET', body?: Record<string, string>, accountSid?: string, authToken?: string) {
  const sid = accountSid || MASTER_SID
  const token = authToken || MASTER_TOKEN
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}${path}`
  const auth = `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`
  const opts: RequestInit = { method, headers: { 'Authorization': auth } }
  if (body) { opts.headers = { ...opts.headers as any, 'Content-Type': 'application/x-www-form-urlencoded' }; opts.body = new URLSearchParams(body).toString() }
  const res = await fetch(url, opts)
  return res.json()
}

export interface ProvisionResult {
  success: boolean
  subaccountSid?: string
  phoneNumber?: string
  error?: string
}

/**
 * Create a Twilio sub-account and provision a phone number for an agent.
 */
export async function provisionTwilioNumber(agentId: string, agentName: string, areaCode: string = '786'): Promise<ProvisionResult> {
  try {
    // 1. Create sub-account
    const subaccount = await twilioRequest('/Accounts.json', 'POST', {
      FriendlyName: `SophiaOS-${agentName}-${agentId.slice(0, 8)}`,
    })

    if (!subaccount.sid) throw new Error(subaccount.message || 'Failed to create sub-account')

    // 2. Search for available number
    const searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${subaccount.sid}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&SmsEnabled=true&Limit=3`
    const searchRes = await fetch(searchUrl, { headers: { 'Authorization': `Basic ${Buffer.from(`${subaccount.sid}:${subaccount.auth_token}`).toString('base64')}` } })
    let available = await searchRes.json()

    // Fallback: any US number
    if (!available.available_phone_numbers?.length) {
      const fallbackUrl = `https://api.twilio.com/2010-04-01/Accounts/${subaccount.sid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&Limit=3`
      const fbRes = await fetch(fallbackUrl, { headers: { 'Authorization': `Basic ${Buffer.from(`${subaccount.sid}:${subaccount.auth_token}`).toString('base64')}` } })
      available = await fbRes.json()
    }

    if (!available.available_phone_numbers?.length) throw new Error('No hay numeros disponibles')

    const phoneNumber = available.available_phone_numbers[0].phone_number

    // 3. Purchase the number
    const purchased = await twilioRequest('/IncomingPhoneNumbers.json', 'POST', {
      PhoneNumber: phoneNumber,
      SmsUrl: `${APP_URL}/api/whatsapp/${agentId}`,
      SmsMethod: 'POST',
    }, subaccount.sid, subaccount.auth_token)

    if (!purchased.sid) throw new Error(purchased.message || 'Failed to purchase number')

    // 4. Save encrypted config
    const { encryptApiKey } = await import('./encryption')
    const encToken = encryptApiKey(subaccount.auth_token, agentId)

    await supabase.from('agent_twilio_config').upsert({
      agent_id: agentId,
      mode: 'managed',
      twilio_subaccount_sid: subaccount.sid,
      twilio_subaccount_token: JSON.stringify(encToken),
      twilio_number: phoneNumber,
      twilio_number_sid: purchased.sid,
      whatsapp_enabled: false,
      provisioned_at: new Date().toISOString(),
    })

    // 5. Update agent phone
    await supabase.from('agents').update({ phone: phoneNumber }).eq('id', agentId)

    return { success: true, subaccountSid: subaccount.sid, phoneNumber }

  } catch (err: any) {
    console.error('[TWILIO-PROVISION]', err.message)
    await supabase.from('tenant_security_events').insert({
      agent_id: agentId, event_type: 'twilio_provisioning_failed', details: { error: err.message },
    })
    return { success: false, error: err.message }
  }
}

/**
 * Verify and connect a Bring-Your-Own number.
 */
export async function verifyOwnNumber(agentId: string, provider: string, accountSid: string, authToken: string, phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (provider === 'twilio') {
      // Verify credentials
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}&Limit=1`
      const res = await fetch(url, { headers: { 'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` } })
      const data = await res.json()

      if (!data.incoming_phone_numbers?.length) return { success: false, error: 'Numero no encontrado en esa cuenta Twilio' }

      // Update webhook to point to our system
      const numSid = data.incoming_phone_numbers[0].sid
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${numSid}.json`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ SmsUrl: `${APP_URL}/api/whatsapp/${agentId}`, SmsMethod: 'POST' }).toString(),
      })
    }

    // Save encrypted
    const { encryptApiKey } = await import('./encryption')
    const encSid = encryptApiKey(accountSid, agentId)
    const encToken = encryptApiKey(authToken, agentId)

    await supabase.from('agent_twilio_config').upsert({
      agent_id: agentId, mode: 'bring_your_own',
      byown_provider: provider,
      byown_account_sid: JSON.stringify(encSid),
      byown_auth_token: JSON.stringify(encToken),
      byown_phone_number: phoneNumber,
      byown_verified: true,
    })

    await supabase.from('agents').update({ phone: phoneNumber }).eq('id', agentId)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Deactivate a managed number when agent cancels.
 */
export async function deprovisionNumber(agentId: string) {
  const { data: config } = await supabase.from('agent_twilio_config').select('*').eq('agent_id', agentId).single()
  if (!config || config.mode !== 'managed') return

  try {
    await twilioRequest(`/Accounts/${config.twilio_subaccount_sid}.json`, 'POST', { Status: 'closed' })
    await supabase.from('agent_twilio_config').update({ mode: 'cancelled', whatsapp_enabled: false }).eq('agent_id', agentId)
  } catch (err: any) { console.error('[DEPROVISION]', err.message) }
}

/**
 * Get the correct Twilio credentials for sending messages from an agent's number.
 */
export async function getTwilioConfigForAgent(agentId: string): Promise<{ sid: string; token: string; fromNumber: string } | null> {
  const { data: config } = await supabase.from('agent_twilio_config').select('*').eq('agent_id', agentId).single()
  if (!config) return null

  const { decryptApiKey } = await import('./encryption')

  if (config.mode === 'managed' && config.twilio_subaccount_sid && config.twilio_subaccount_token) {
    const enc = JSON.parse(config.twilio_subaccount_token)
    const token = decryptApiKey(enc.encrypted, enc.iv, enc.tag, agentId)
    return { sid: config.twilio_subaccount_sid, token, fromNumber: config.twilio_number }
  }

  if (config.mode === 'bring_your_own' && config.byown_account_sid && config.byown_auth_token) {
    const encSid = JSON.parse(config.byown_account_sid)
    const encToken = JSON.parse(config.byown_auth_token)
    const sid = decryptApiKey(encSid.encrypted, encSid.iv, encSid.tag, agentId)
    const token = decryptApiKey(encToken.encrypted, encToken.iv, encToken.tag, agentId)
    return { sid, token, fromNumber: config.byown_phone_number }
  }

  return null
}
