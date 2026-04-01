import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const batchDate = new Date().toISOString().split('T')[0]

  // Create batch log
  const { data: log } = await supabase.from('daily_batch_log').insert({ batch_date: batchDate, started_at: new Date().toISOString(), status: 'running' }).select().single()

  const stats = { found: 0, processed: 0, extracted: 0, skipped: 0, errors: 0, errorDetails: [] as string[] }

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    // Find eligible leads
    const { data: leads } = await supabase.from('leads')
      .select('id')
      .eq('training_processed', false)
      .eq('training_excluded', false)
      .or(`stage.in.(closed_won,closed_lost),updated_at.lt.${threeDaysAgo}`)
      .limit(100) // Cap per batch

    stats.found = leads?.length || 0

    const { processConversation } = await import('@/lib/federated-learning/pattern-extractor')

    // Process in batches of 5
    for (let i = 0; i < (leads?.length || 0); i += 5) {
      const batch = leads!.slice(i, i + 5)
      const results = await Promise.allSettled(batch.map(l => processConversation(l.id, batchDate)))

      results.forEach((r, idx) => {
        stats.processed++
        if (r.status === 'fulfilled') {
          if (r.value.extracted) stats.extracted++; else stats.skipped++
        } else {
          stats.errors++
          stats.errorDetails.push(`${batch[idx].id}: ${r.reason}`)
        }
      })

      if (i + 5 < (leads?.length || 0)) await new Promise(r => setTimeout(r, 2000))
    }

    // Update log
    await supabase.from('daily_batch_log').update({
      completed_at: new Date().toISOString(), status: 'completed',
      conversations_found: stats.found, conversations_processed: stats.processed,
      patterns_extracted: stats.extracted, patterns_skipped: stats.skipped,
      errors: stats.errors, error_details: stats.errorDetails,
    }).eq('id', log?.id)

    // Notify Carlos if significant patterns
    if (stats.extracted >= 5) {
      const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
      const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
      const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM
      if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:+17869435656`,
            Body: `🧠 *Aprendizaje diario completado*\n\n📅 ${batchDate}\n💬 Procesadas: ${stats.processed}\n✨ Patrones: ${stats.extracted}\n⏭️ Saltados: ${stats.skipped}\n❌ Errores: ${stats.errors}` }).toString(),
        })
      }
    }

    return NextResponse.json({ success: true, stats })
  } catch (err: any) {
    await supabase.from('daily_batch_log').update({ status: 'failed', error_details: [err.message] }).eq('id', log?.id)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
