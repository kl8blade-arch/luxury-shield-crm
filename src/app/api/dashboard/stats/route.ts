// app/api/dashboard/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiError, errorHandler } from '@/lib/errors'
import { validateAgentAuth, authError } from '@/lib/auth-middleware'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CLOSED_WON  = ['closed_won', 'listo_comprar']
const LOST_STAGES = ['closed_lost', 'unqualified', 'no_califica']

const STAGE_LABELS: Record<string, string> = {
  new: 'Nuevos', nuevo: 'Nuevos',
  contact: 'Contactados', contacted: 'Contactados',
  calificando: 'Calificando',
  interested: 'Interesados', presentando: 'Presentando',
  objecion: 'Objeción', proposal: 'Propuesta',
  negotiation: 'Negociando', agendado: 'Agendados',
  seguimiento: 'Seguimiento', seguimiento_agente: 'En Seguimiento',
  listo_comprar: 'Listos p/ Comprar', closed_won: 'Cerrados',
}

const STAGE_ORDER = [
  'nuevo','new','contact','contacted','calificando','interested',
  'presentando','objecion','proposal','negotiation','agendado',
  'seguimiento_agente','seguimiento','listo_comprar','closed_won',
]

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export async function GET(request: NextRequest) {
  try {
    // Validate agent is authorized
    const agentId = await validateAgentAuth(request)

    const now          = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const last7Days    = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const [
      allLeadsRes, leadsMonthRes, leads7dRes,
      convTodayRes, commAllRes, commMonthRes,
      calendarRes, doctorApptsRes,
    ] = await Promise.all([
      supabase.from('leads')
        .select('id, stage, created_at, insurance_type, score')
        .eq('agent_id', agentId),

      supabase.from('leads')
        .select('id, stage, created_at', { count: 'exact' })
        .eq('agent_id', agentId)
        .gte('created_at', startOfMonth),

      supabase.from('leads')
        .select('created_at, stage')
        .eq('agent_id', agentId)
        .gte('created_at', last7Days)
        .order('created_at', { ascending: true }),

      supabase.from('conversations')
        .select('id, lead_id, lead_name, lead_phone, created_at, sentiment, message')
        .eq('agent_id', agentId)
        .gte('created_at', startOfToday)
        .order('created_at', { ascending: false })
        .limit(8),

      supabase.from('commissions')
        .select('commission_amount, status, carrier, product, created_at')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false }),

      supabase.from('commissions')
        .select('commission_amount, status, carrier, product')
        .eq('agent_id', agentId)
        .gte('created_at', startOfMonth),

      supabase.from('calendar_events')
        .select('id, title, start_time, event_type, lead_name, status, location')
        .eq('agent_id', agentId)
        .gte('start_time', startOfToday)
        .lte('start_time', endOfMonth)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true })
        .limit(5),

      supabase.from('doctor_appointments')
        .select('id, doctor_name, specialty, scheduled_at, status, lead_name, in_network', { count: 'exact' })
        .eq('agent_id', agentId)
        .gte('scheduled_at', startOfToday)
        .order('scheduled_at', { ascending: true })
        .limit(5),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allLeads  = (allLeadsRes.data  ?? []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leads7d   = (leads7dRes.data   ?? []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convToday = (convTodayRes.data ?? []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commAll   = (commAllRes.data   ?? []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commMonth = (commMonthRes.data ?? []) as any[]

    // Pipeline
    const stageCount: Record<string, number> = {}
    allLeads.forEach(l => {
      const s = l.stage ?? 'new'
      if (!LOST_STAGES.includes(s)) stageCount[s] = (stageCount[s] ?? 0) + 1
    })
    const pipeline = STAGE_ORDER
      .filter(s => (stageCount[s] ?? 0) > 0)
      .map(s => ({ stage: STAGE_LABELS[s] ?? s, count: stageCount[s], key: s }))

    // Sparkline
    const sparkline = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(now.getDate() - (6 - i))
      const dayStr = d.toISOString().split('T')[0]
      return {
        dia:   d.toLocaleDateString('es-US', { weekday: 'short' }),
        leads: leads7d.filter(l => l.created_at.startsWith(dayStr)).length,
      }
    })

    // Commission trend 6m
    const commByMonth: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      commByMonth[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`] = 0
    }
    commAll.forEach(c => {
      const key = c.created_at.substring(0, 7)
      if (commByMonth[key] !== undefined) commByMonth[key] += Number(c.commission_amount ?? 0)
    })
    const commissionTrend = Object.entries(commByMonth).map(([key, amount]) => ({
      mes:        MONTH_NAMES[parseInt(key.split('-')[1]) - 1],
      comisiones: Math.round(amount),
    }))

    // KPIs
    const activeLeads    = allLeads.filter(l => !LOST_STAGES.includes(l.stage)).length
    const closedWonTotal = allLeads.filter(l => CLOSED_WON.includes(l.stage)).length
    const closedWonMonth = (leadsMonthRes.data ?? []).filter(l => CLOSED_WON.includes(l.stage as string)).length
    const convRate       = allLeads.length > 0 ? Math.round((closedWonTotal / allLeads.length) * 100) : 0
    const mrrReal        = commMonth.reduce((s, c) => s + Number(c.commission_amount ?? 0), 0)
    const mrrTotal       = commAll.reduce((s, c)   => s + Number(c.commission_amount ?? 0), 0)
    const avgScore       = allLeads.length > 0
      ? Math.round(allLeads.reduce((s, l) => s + (l.score ?? 0), 0) / allLeads.length) : 0

    return NextResponse.json({
      success: true,
      data: {
        // KPIs
        activeLeads, leadsThisMonth: leadsMonthRes.count ?? 0,
        closedWonMonth, closedWonTotal, conversionRate: convRate, avgLeadScore: avgScore,
        // Comisiones reales
        mrrReal: Math.round(mrrReal), mrrTotal: Math.round(mrrTotal),
        commissionsMonth: commMonth.length, commissionsTotal: commAll.length,
        // Gráficos
        pipeline, sparkline, commissionTrend,
        // Sophia live
        sophiaConversationsToday: convToday.length,
        sophiaLive: convToday.slice(0, 5),
        // Calendario
        upcomingEvents:  calendarRes.data  ?? [],
        // SophiaCita
        doctorAppointments: doctorApptsRes.data ?? [],
        doctorApptsCount:   doctorApptsRes.count ?? 0,
        // Meta
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    // Auth errors
    if (error instanceof Error) {
      if (error.message === 'Missing agentId') return authError('Missing agentId', 400)
      if (error.message === 'Agent not found') return authError('Agent not found', 404)
      if (error.message === 'Agent not authorized') return authError('Agent not authorized', 403)
    }
    return errorHandler(error)
  }
}
