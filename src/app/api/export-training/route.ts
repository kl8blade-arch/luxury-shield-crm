import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const minScore = parseInt(searchParams.get('min_score') || '60')
  const source = searchParams.get('source') || 'all'

  let query = supabase.from('sophia_training_data').select('*').eq('approved', true).gte('quality_score', minScore).order('quality_score', { ascending: false })
  if (source !== 'all') query = query.eq('source', source)

  const { data: records } = await query

  if (!records?.length) return NextResponse.json({ error: 'No hay datos suficientes', count: 0 })

  const jsonl = records.map(r => JSON.stringify({
    messages: [
      { role: 'system', content: 'Eres Sophia, asesora experta de Luxury Shield Insurance. Vendes el plan Cigna DVH Plus a familias latinas en USA. Eres cálida, directa y nunca repites preguntas ya respondidas. Usas "plan de protección" en vez de "seguro".' },
      ...(r.conversation as any[]).slice(0, -1).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'assistant', content: r.training_completion },
    ],
  })).join('\n')

  const stats = {
    total_records: records.length,
    real: records.filter(r => r.source === 'real').length,
    synthetic: records.filter(r => r.source === 'synthetic').length,
    avg_quality: Math.round(records.reduce((s, r) => s + r.quality_score, 0) / records.length),
    outcomes: records.reduce((acc: any, r) => { acc[r.outcome || 'unknown'] = (acc[r.outcome || 'unknown'] || 0) + 1; return acc }, {}),
    avg_turns: Math.round(records.reduce((s, r) => s + (r.turns_to_close || 0), 0) / records.length),
  }

  return new NextResponse(jsonl, {
    headers: {
      'Content-Type': 'application/jsonl',
      'Content-Disposition': `attachment; filename="sophia_training_${Date.now()}.jsonl"`,
      'X-Dataset-Stats': JSON.stringify(stats),
    },
  })
}
