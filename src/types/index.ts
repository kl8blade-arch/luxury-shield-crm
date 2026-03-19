export type LeadStage = 'new'|'contact'|'contacted'|'interested'|'proposal'|'negotiation'|'closed_won'|'closed_lost'|'unqualified'
export type InsuranceType = 'Dental'|'Vision'|'ACA'|'IUL'|'Vida'|'Medicare'|'Gastos Finales'|'Accidentes'|'Hospitalización'|'Cáncer'|'Corazón'
export type AgentStatus = 'active'|'inactive'|'pending'|'suspended'
export type AgentPlan = 'basic'|'builder'|'elite'|'free'
export type AgentRole = 'admin'|'agent'

export interface Lead {
  id: string; created_at: string; updated_at: string
  name: string; phone: string; email: string|null
  state: string|null; age: number|null
  has_insurance: boolean; message: string|null; favorite_color: string|null
  insurance_type: InsuranceType; stage: LeadStage; source: string
  assigned_to: string|null; agent_id: string|null
  score: number; score_recommendation: string|null
  ia_active: boolean; ready_to_buy: boolean
  contact_attempts: number; last_contact: string|null
  next_action: string|null; next_action_date: string|null; notes: string|null
  for_crossselling: boolean; crossselling_products: string|null
  sold_product: string|null; sale_date: string|null; crossselling_notes: string|null
  utm_source: string|null; utm_campaign: string|null; url_origin: string|null
}

export interface Reminder {
  id: string; created_at: string
  lead_id: string; lead_name: string; lead_phone: string; agent_id: string|null
  type: 'call'|'whatsapp'|'email'|'meeting'|'followup'
  scheduled_at: string; notes: string|null; ai_context: string|null
  status: 'pending'|'completed'|'cancelled'|'overdue'; notified: boolean
}

export interface Template {
  id: string; created_at: string; name: string; industry: string
  insurance_type: string|null; channel: 'whatsapp'|'sms'|'email'|'call'
  stage: 'first_contact'|'followup'|'objection'|'closing'|'post_sale'
  message: string; variables: string[]; use_count: number; active: boolean
}
