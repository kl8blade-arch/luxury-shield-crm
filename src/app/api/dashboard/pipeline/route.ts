// src/app/api/dashboard/pipeline/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiError, errorHandler } from '@/lib/errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const PIPELINE_STAGES = [
  { key: 'nuevo',         label: 'Nuevos',           color: '#2980B9', emoji: '🆕' },
  { key: 'calificando',   label: 'Calificando',      color: '#8E44AD', emoji: '🔍' },
  { key: 'presentando',   label: 'Presentando',      color: '#E67E22', emoji: '📊' },
  { key: 'objecion',      label: 'Objeción',         color: '#E74C3C', emoji: '💬' },
  { key: 'agendado',      label: 'Agendados',        color: '#16A085', emoji: '📅' },
  { key: 'listo_comprar', label: 'Listos p/Comprar', color: '#F5A623', emoji: '⚡' },
  { key: 'closed_won',    label: 'Cerrados ✅',      color: '#27AE60', emoji: '🏆' },
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    if (!agentId) throw new ApiError(400, 'Missing agentId')

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, name, phone, stage, score, insurance_type, created_at, last_contact, source, city, state, ready_to_buy, ia_active, notes')
      .eq('agent_id', agentId)
      .not('stage', 'in', '("closed_lost","unqualified","no_califica")')
      .order('score', { ascending: false })

    if (error) throw new ApiError(500, error.message)

    const grouped: Record<string, typeof leads> = {}
    PIPELINE_STAGES.forEach(s => { grouped[s.key] = [] })

    leads?.forEach(lead => {
      const stage = lead.stage ?? 'nuevo'
      if (grouped[stage]) grouped[stage].push(lead)
      else if (!['closed_lost','unqualified','no_califica'].includes(stage)) {
        grouped['nuevo'].push({ ...lead, stage: 'nuevo' })
      }
    })

    return NextResponse.json({ success: true, data: { stages: PIPELINE_STAGES, leads: grouped, total: leads?.length ?? 0 } })
  } catch (error) {
    return errorHandler(error)
  }
}
