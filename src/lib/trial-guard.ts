import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export interface TrialEligibility {
  eligible: boolean
  reason?: 'email_used' | 'phone_used' | 'ip_limit'
  message?: string
}

export async function checkTrialEligibility(email: string, phone: string, ip: string): Promise<TrialEligibility> {
  // 1. Email already used
  const { data: emailExists } = await supabase.from('agents').select('id').eq('email', email.toLowerCase()).limit(1)
  if (emailExists && emailExists.length > 0) {
    return { eligible: false, reason: 'email_used', message: 'Este email ya fue usado para un periodo de prueba.' }
  }

  // 2. Phone already used for trial
  const cleanPhone = phone.replace(/\D/g, '').slice(-10)
  if (cleanPhone.length >= 7) {
    const { data: phoneExists } = await supabase.from('trial_ip_log').select('id').ilike('phone', `%${cleanPhone}%`).limit(1)
    if (phoneExists && phoneExists.length > 0) {
      return { eligible: false, reason: 'phone_used', message: 'Este numero ya fue usado para un periodo de prueba.' }
    }
  }

  // 3. IP limit (max 3 in 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase.from('trial_ip_log').select('id', { count: 'exact', head: true }).eq('ip_address', ip).gte('created_at', thirtyDaysAgo)
  if ((count || 0) >= 3) {
    return { eligible: false, reason: 'ip_limit', message: 'Limite de cuentas de prueba desde esta direccion alcanzado.' }
  }

  return { eligible: true }
}

export async function recordTrialSignup(agentId: string, email: string, phone: string, ip: string) {
  await supabase.from('trial_ip_log').insert({ ip_address: ip, email, phone, agent_id: agentId })
  await supabase.from('agents').update({ signup_ip: ip, trial_phone: phone }).eq('id', agentId)
}
