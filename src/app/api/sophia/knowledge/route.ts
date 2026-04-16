// src/app/api/sophia/knowledge/route.ts
// RAG semántico para Sophia — busca productos relevantes por intención del lead
// NO incluye precios — solo beneficios, oportunidades y limitaciones

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { errorHandler } from '@/lib/errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mapeo de intenciones del lead a líneas de producto
const INTENT_MAP: Record<string, string[]> = {
  // Dental
  'dental':       ['dental'],
  'diente':       ['dental'],
  'dentista':     ['dental'],
  'limpieza':     ['dental'],
  'caries':       ['dental'],
  'empaste':      ['dental'],
  'corona':       ['dental'],

  // Visión
  'vision':       ['vision'],
  'visión':       ['vision'],
  'vista':        ['vision'],
  'lente':        ['vision'],
  'contacto':     ['vision'],
  'optometrista': ['vision'],
  'ojo':          ['vision'],

  // ACA / Salud
  'médico':       ['aca'],
  'medico':       ['aca'],
  'salud':        ['aca'],
  'doctor':       ['aca'],
  'hospital':     ['aca', 'hospital_indemnity'],
  'seguro medico':['aca'],
  'aca':          ['aca'],
  'obamacare':    ['aca'],
  'marketplace':  ['aca'],
  'subsidio':     ['aca'],

  // IUL / Vida
  'vida':         ['iul', 'term_life'],
  'seguro vida':  ['iul', 'term_life'],
  'retiro':       ['iul'],
  'ahorro':       ['iul'],
  'acumular':     ['iul'],
  'invertir':     ['iul'],
  'iul':          ['iul'],
  'familia':      ['term_life', 'iul', 'final_expense'],

  // Final Expense
  'funeral':      ['final_expense'],
  'gastos final': ['final_expense'],
  'entierro':     ['final_expense'],
  'muerte':       ['final_expense', 'term_life'],

  // Accident
  'accidente':    ['accident'],
  'fractura':     ['accident'],
  'golpe':        ['accident'],
  'lesión':       ['accident'],
  'trabajo':      ['accident', 'hospital_indemnity'],

  // Cancer
  'cáncer':       ['cancer'],
  'cancer':       ['cancer'],
  'quimio':       ['cancer'],
  'tumor':        ['cancer'],

  // Hospital
  'hospitalización': ['hospital_indemnity'],
  'internado':       ['hospital_indemnity'],
  'deductible':      ['hospital_indemnity'],

  // Medicare
  'medicare':     ['medicare_advantage'],
  'adulto mayor': ['medicare_advantage', 'final_expense'],
  '65':           ['medicare_advantage'],
}

function detectIntents(message: string): string[] {
  const lower   = message.toLowerCase()
  const lines   = new Set<string>()
  for (const [keyword, productLines] of Object.entries(INTENT_MAP)) {
    if (lower.includes(keyword)) productLines.forEach(l => lines.add(l))
  }
  return Array.from(lines)
}

export async function POST(request: NextRequest) {
  try {
    const { message, accountId, agentId } = await request.json()
    if (!message || (!accountId && !agentId)) {
      return NextResponse.json({ success: true, knowledge: '', products: [] })
    }

    // Resolver account_id si solo tenemos agentId
    let resolvedAccountId = accountId
    if (!resolvedAccountId && agentId) {
      const { data: agent } = await supabase
        .from('agents').select('account_id').eq('id', agentId).single()
      resolvedAccountId = agent?.account_id
    }

    // Detectar intenciones del mensaje
    const intents = detectIntents(message)
    if (intents.length === 0) {
      return NextResponse.json({ success: true, knowledge: '', products: [] })
    }

    // Buscar carriers activos de la cuenta
    const { data: activeCarriers } = await supabase
      .from('account_carrier_config')
      .select('carrier_id')
      .eq('account_id', resolvedAccountId)
      .eq('active', true)

    const carrierIds = (activeCarriers ?? []).map(c => c.carrier_id)
    if (carrierIds.length === 0) {
      return NextResponse.json({ success: true, knowledge: '', products: [] })
    }

    // Buscar productos relevantes por línea de producto y carrier activo
    const { data: products } = await supabase
      .from('carrier_products')
      .select(`
        product_name, product_line, knowledge_text,
        sophia_pitch, target_profile, cross_sell_with,
        guaranteed_issue, waiting_period_days, age_min, age_max,
        commission_first_year,
        insurance_carriers!inner(name, short_name)
      `)
      .in('carrier_id', carrierIds)
      .in('product_line', intents)
      .eq('active', true)
      .limit(3)  // máx 3 productos por búsqueda para no saturar el prompt

    if (!products?.length) {
      return NextResponse.json({ success: true, knowledge: '', products: [] })
    }

    // Construir el bloque de conocimiento para el system prompt de Sophia
    // Solo beneficios, oportunidades y limitaciones — SIN precios
    const knowledgeBlocks = products.map(p => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const carrier = (p as any).insurance_carriers
      const lines: string[] = [
        `═══ ${p.product_name} (${carrier?.name ?? 'Carrier'}) ═══`,
        p.knowledge_text ?? '',
      ]

      if (p.sophia_pitch) {
        lines.push(`\nCÓMO PRESENTARLO: ${p.sophia_pitch}`)
      }
      if (p.target_profile) {
        lines.push(`PERFIL IDEAL: ${p.target_profile}`)
      }
      if (p.guaranteed_issue) {
        lines.push('EMISIÓN: Garantizada — sin preguntas médicas')
      }
      if (p.waiting_period_days && p.waiting_period_days > 0) {
        lines.push(`PERÍODO DE ESPERA: ${p.waiting_period_days} días para cobertura completa`)
      }
      if (p.age_min || p.age_max) {
        lines.push(`ELEGIBILIDAD: ${p.age_min ?? 18}-${p.age_max ?? 99} años`)
      }
      if (p.cross_sell_with?.length) {
        lines.push(`CROSS-SELL: Combina bien con ${p.cross_sell_with.join(', ')}`)
      }

      lines.push('IMPORTANTE: No menciones precios ni primas. Siempre conecta con el especialista para cotización.')

      return lines.join('\n')
    })

    const knowledge = knowledgeBlocks.join('\n\n')

    return NextResponse.json({
      success:  true,
      knowledge,
      products: products.map(p => ({
        name:       p.product_name,
        line:       p.product_line,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        carrier:    (p as any).insurance_carriers?.name,
        pitch:      p.sophia_pitch,
      })),
      intentsDetected: intents,
    })

  } catch (error) {
    return errorHandler(error)
  }
}
