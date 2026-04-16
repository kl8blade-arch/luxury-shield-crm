// app/api/reactivation/process/route.ts
// Sophia v3 — Cron de reactivación: 5 toques / 14 días
// ⚠️  NUNCA Opus. Requiere Authorization: Bearer $CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// ⚠️  Twilio disabled at compile time — requires server-side initialization
import {
  buildReactivationMessage,
  calcNextSendAt,
  completeReactivationSequence,
  type ReactivationSequence,
  type ReactivationLead,
} from '@/lib/reactivation'

const MAX_PER_RUN    = 50
const MAX_AGE_HOURS  = 4
const COOLDOWN_HOURS = 24

export async function GET(request: NextRequest) {
  const runId = `run_${Date.now()}`
  console.log(`[reactivation:${runId}] START`)

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn(`[reactivation:${runId}] Unauthorized`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // ⚠️  Twilio client disabled — needs dynamic initialization at runtime
  const twilioClient: any = null // twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

  const stats = { processed: 0, sent: 0, skipped: 0, errors: 0, completed: 0 }

  try {
    const now    = new Date()
    const cutoff = new Date(now.getTime() - MAX_AGE_HOURS * 3_600_000)

    const { data: sequences, error: fetchErr } = await supabase
      .from('reactivation_sequences')
      .select(`
        *,
        lead:leads(
          id, name, phone, account_id,
          conversation_mode,
          reactivation_product,
          reactivation_opt_out,
          stage
        )
      `)
      .eq('status', 'active')
      .lte('next_send_at', now.toISOString())
      .gte('next_send_at', cutoff.toISOString())
      .order('next_send_at', { ascending: true })
      .limit(MAX_PER_RUN)

    if (fetchErr) {
      console.error(`[reactivation:${runId}] Fetch error:`, fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!sequences?.length) {
      console.log(`[reactivation:${runId}] No sequences due`)
      return NextResponse.json({ ok: true, stats, runId })
    }

    console.log(`[reactivation:${runId}] Processing ${sequences.length} sequences`)

    for (const seq of sequences as (ReactivationSequence & { lead: ReactivationLead })[]) {
      stats.processed++
      const { id: seqId, lead } = seq

      try {
        if (!lead?.phone || !lead?.name) {
          stats.skipped++; continue
        }

        if (lead.reactivation_opt_out) {
          await supabase.from('reactivation_sequences').update({
            status: 'cancelled',
            cancelled_at: now.toISOString(),
            cancel_reason: 'opt_out',
          }).eq('id', seqId)
          stats.skipped++; continue
        }

        // ⚠️ usa conversation_mode, NO stage
        if (lead.conversation_mode === 'manual') {
          await supabase.from('reactivation_sequences')
            .update({ status: 'paused' }).eq('id', seqId)
          console.log(`[reactivation:${runId}] ${seqId} — manual mode, paused`)
          stats.skipped++; continue
        }

        if (seq.last_response_at) {
          const hrs = (now.getTime() - new Date(seq.last_response_at).getTime()) / 3_600_000
          if (hrs < COOLDOWN_HOURS) {
            stats.skipped++; continue
          }
        }

        const sentKey = `touch_${seq.next_touch}_sent_at` as keyof ReactivationSequence
        if (seq[sentKey]) {
          const next = seq.next_touch + 1
          if (next > 5) {
            await completeReactivationSequence(supabase, seqId)
          } else {
            await supabase.from('reactivation_sequences').update({
              next_touch: next,
              next_send_at: calcNextSendAt(next, new Date(seq.started_at)).toISOString(),
            }).eq('id', seqId)
          }
          stats.skipped++; continue
        }

        const message = buildReactivationMessage(seq.next_touch, seq.product, lead.name)

        let twilioSid: string | undefined
        try {
          const msg = await twilioClient.messages.create({
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to:   `whatsapp:${lead.phone}`,
            body: message,
          })
          twilioSid = msg.sid
          console.log(`[reactivation:${runId}] ${seqId} T${seq.next_touch} → ${lead.phone} (${twilioSid})`)
        } catch (twilioErr) {
          console.error(`[reactivation:${runId}] ${seqId} Twilio error:`, twilioErr)
          await supabase.from('reactivation_logs').insert({
            sequence_id: seqId, account_id: seq.account_id,
            lead_id: seq.lead_id, touch_number: seq.next_touch,
            product: seq.product, message_sent: message,
            error: String(twilioErr),
          })
          stats.errors++; continue
        }

        await supabase.from('reactivation_logs').insert({
          sequence_id: seqId, account_id: seq.account_id,
          lead_id: seq.lead_id, touch_number: seq.next_touch,
          product: seq.product, message_sent: message,
          twilio_sid: twilioSid,
        })

        const sentKeyStr  = `touch_${seq.next_touch}_sent_at`
        const isLast      = seq.next_touch >= 5

        if (isLast) {
          await supabase.from('reactivation_sequences').update({
            current_touch: seq.next_touch,
            [sentKeyStr]: now.toISOString(),
            status: 'completed',
            completed_at: now.toISOString(),
          }).eq('id', seqId)
          stats.completed++
        } else {
          const nextNum    = seq.next_touch + 1
          const nextSendAt = calcNextSendAt(nextNum, new Date(seq.started_at))
          await supabase.from('reactivation_sequences').update({
            current_touch: seq.next_touch,
            next_touch: nextNum,
            next_send_at: nextSendAt.toISOString(),
            [sentKeyStr]: now.toISOString(),
          }).eq('id', seqId)
        }

        stats.sent++

      } catch (err) {
        console.error(`[reactivation:${runId}] ${seqId} unexpected:`, err)
        stats.errors++
      }
    }

    console.log(`[reactivation:${runId}] DONE`, stats)
    return NextResponse.json({ ok: true, stats, runId })

  } catch (fatal) {
    console.error(`[reactivation:${runId}] FATAL:`, fatal)
    return NextResponse.json({ ok: false, error: String(fatal), runId }, { status: 500 })
  }
}
