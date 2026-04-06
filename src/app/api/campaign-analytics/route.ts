import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agent_id')
  const accountId = req.nextUrl.searchParams.get('account_id')
  const role = req.nextUrl.searchParams.get('role')

  // Get all leads with tracking data
  let query = supabase.from('leads')
    .select('id, name, phone, stage, score, source, utm_source, utm_medium, utm_campaign, utm_content, referrer, url_origin, insurance_type, ready_to_buy, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (role === 'admin' && accountId) {
    query = query.or(`account_id.eq.${accountId},account_id.is.null`)
  } else if (agentId) {
    query = query.eq('agent_id', agentId)
  }

  const { data: leads } = await query

  // Get pageview events
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events } = await supabase.from('campaign_events')
    .select('source, medium, campaign, created_at')
    .gte('created_at', thirtyDaysAgo)
    .limit(1000)

  // Aggregate by source
  const sourceMap: Record<string, { leads: number; hot: number; won: number; visits: number; campaigns: Set<string> }> = {}
  const campaignMap: Record<string, { leads: number; hot: number; won: number; visits: number; source: string; medium: string; avgScore: number; scores: number[] }> = {}

  for (const lead of leads || []) {
    const src = lead.utm_source || lead.source || 'direct'
    const camp = lead.utm_campaign || 'sin_campana'
    const medium = lead.utm_medium || ''

    if (!sourceMap[src]) sourceMap[src] = { leads: 0, hot: 0, won: 0, visits: 0, campaigns: new Set() }
    sourceMap[src].leads++
    if (lead.score >= 75) sourceMap[src].hot++
    if (lead.stage === 'closed_won') sourceMap[src].won++
    if (camp !== 'sin_campana') sourceMap[src].campaigns.add(camp)

    if (!campaignMap[camp]) campaignMap[camp] = { leads: 0, hot: 0, won: 0, visits: 0, source: src, medium, avgScore: 0, scores: [] }
    campaignMap[camp].leads++
    if (lead.score >= 75) campaignMap[camp].hot++
    if (lead.stage === 'closed_won') campaignMap[camp].won++
    campaignMap[camp].scores.push(lead.score || 0)
  }

  // Add visit data
  for (const ev of events || []) {
    const src = ev.source || 'direct'
    const camp = ev.campaign || 'sin_campana'
    if (sourceMap[src]) sourceMap[src].visits++
    if (campaignMap[camp]) campaignMap[camp].visits++
  }

  // Calculate averages
  for (const c of Object.values(campaignMap)) {
    c.avgScore = c.scores.length ? Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length) : 0
  }

  // Format sources
  const sources = Object.entries(sourceMap)
    .map(([name, d]) => ({
      name,
      leads: d.leads,
      hot: d.hot,
      won: d.won,
      visits: d.visits,
      conversionRate: d.visits > 0 ? Math.round((d.leads / d.visits) * 100) : 0,
      campaigns: d.campaigns.size,
    }))
    .sort((a, b) => b.leads - a.leads)

  // Format campaigns
  const campaigns = Object.entries(campaignMap)
    .filter(([name]) => name !== 'sin_campana')
    .map(([name, d]) => ({
      name,
      source: d.source,
      medium: d.medium,
      leads: d.leads,
      hot: d.hot,
      won: d.won,
      visits: d.visits,
      avgScore: d.avgScore,
      conversionRate: d.visits > 0 ? Math.round((d.leads / d.visits) * 100) : 0,
      hotRate: d.leads > 0 ? Math.round((d.hot / d.leads) * 100) : 0,
      closeRate: d.leads > 0 ? Math.round((d.won / d.leads) * 100) : 0,
    }))
    .sort((a, b) => b.leads - a.leads)

  // Medium breakdown (paid vs organic vs social vs direct)
  const mediumMap: Record<string, number> = {}
  for (const lead of leads || []) {
    const m = lead.utm_medium || 'unknown'
    mediumMap[m] = (mediumMap[m] || 0) + 1
  }

  return NextResponse.json({
    total_leads: leads?.length || 0,
    sources,
    campaigns,
    mediums: Object.entries(mediumMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  })
}
