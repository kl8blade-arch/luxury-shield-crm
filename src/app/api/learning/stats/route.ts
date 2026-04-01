import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { count: totalPatterns } = await supabase.from('collective_patterns').select('*', { count: 'exact', head: true })
  const { count: highQuality } = await supabase.from('collective_patterns').select('*', { count: 'exact', head: true }).gte('quality_score', 50)
  const { count: totalProcessed } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('training_processed', true)

  // Patterns by industry
  const { data: allPatterns } = await supabase.from('collective_patterns').select('industry')
  const industryCounts: Record<string, number> = {}
  for (const p of allPatterns || []) industryCounts[p.industry] = (industryCounts[p.industry] || 0) + 1
  const byIndustry = Object.entries(industryCounts).map(([industry, count]) => ({ industry, count })).sort((a, b) => b.count - a.count)

  const { data: activeModel } = await supabase.from('fine_tuning_jobs').select('*').eq('is_active', true).limit(1).single()
  const { data: jobs } = await supabase.from('fine_tuning_jobs').select('*').order('created_at', { ascending: false }).limit(5)
  const { data: lastBatch } = await supabase.from('daily_batch_log').select('*').order('batch_date', { ascending: false }).limit(1).single()

  return NextResponse.json({
    totalPatterns: totalPatterns || 0,
    highQualityPatterns: highQuality || 0,
    totalProcessed: totalProcessed || 0,
    byIndustry,
    activeModel: activeModel || null,
    jobs: jobs || [],
    lastBatch: lastBatch || null,
  })
}
