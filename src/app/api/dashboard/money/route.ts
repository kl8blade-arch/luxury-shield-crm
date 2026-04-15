// src/app/api/dashboard/money/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiError, errorHandler } from '@/lib/errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    if (!agentId) throw new ApiError(400, 'Missing agentId')

    const now        = new Date()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const start6m    = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

    const { data: commissions, error } = await supabase
      .from('commissions')
      .select('id, carrier, product, premium, commission_rate, commission_amount, status, paid_date, effective_date, created_at, lead_id, policy_number')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    if (error) throw new ApiError(500, error.message)

    const all = commissions ?? []

    // Métricas
    const mrrReal    = all.filter(c => c.status === 'paid'       && c.created_at >= startMonth).reduce((s,c) => s + Number(c.commission_amount ?? 0), 0)
    const mrrTotal   = all.reduce((s, c) => s + Number(c.commission_amount ?? 0), 0)
    const pending    = all.filter(c => c.status === 'pending').reduce((s,c) => s + Number(c.commission_amount ?? 0), 0)
    const paid       = all.filter(c => c.status === 'paid').reduce((s,c) => s + Number(c.commission_amount ?? 0), 0)
    const chargebacks = all.filter(c => c.status === 'chargeback').length

    // Por carrier
    const byCarrier: Record<string, number> = {}
    all.forEach(c => {
      if (c.carrier) byCarrier[c.carrier] = (byCarrier[c.carrier] ?? 0) + Number(c.commission_amount ?? 0)
    })

    // Por producto
    const byProduct: Record<string, number> = {}
    all.forEach(c => {
      if (c.product) byProduct[c.product] = (byProduct[c.product] ?? 0) + Number(c.commission_amount ?? 0)
    })

    // Trend 6 meses
    const trendMap: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      trendMap[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`] = 0
    }
    all.filter(c => c.created_at >= start6m).forEach(c => {
      const key = c.created_at.substring(0, 7)
      if (trendMap[key] !== undefined) trendMap[key] += Number(c.commission_amount ?? 0)
    })
    const trend = Object.entries(trendMap).map(([key, amount]) => ({
      mes:    MONTH_NAMES[parseInt(key.split('-')[1]) - 1],
      amount: Math.round(amount),
    }))

    // Proyección del mes basada en ritmo actual
    const diasMes       = now.getDate()
    const totalDiasMes  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const commThisMonth = all.filter(c => c.created_at >= startMonth).reduce((s,c) => s + Number(c.commission_amount ?? 0), 0)
    const projectedMonth = diasMes > 0 ? Math.round((commThisMonth / diasMes) * totalDiasMes) : 0

    return NextResponse.json({
      success: true,
      data: {
        commissions: all,
        mrrReal:    Math.round(mrrReal),
        mrrTotal:   Math.round(mrrTotal),
        pending:    Math.round(pending),
        paid:       Math.round(paid),
        chargebacks,
        byCarrier,
        byProduct,
        trend,
        projectedMonth,
      }
    })
  } catch (error) {
    return errorHandler(error)
  }
}
