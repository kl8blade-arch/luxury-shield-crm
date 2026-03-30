---
name: luxury-shield-dev
description: Complete development context for Luxury Shield Insurance CRM — the SeguriSSimo agency platform with Sophia AI agent. MUST use this skill whenever the user mentions ANY of these: Sophia, leads, pipeline, WhatsApp webhook, Twilio, modo manual, coaching IA, calendar/agenda, analytics dashboard, SophiaOS, master system, Carlos, Lina, audio/Whisper transcription, Cigna DVH Plus, dental insurance, training data, SophiaModel, battle card, drag & drop, LeadDetailPanel, conversation_mode, sophia_processing, deploy to Vercel, Supabase tables, or any bug/feature in this CRM. Also trigger when the user asks to fix webhook issues, deploy changes, run SQL on Supabase, modify the system prompt, handle leads, or work on any Next.js/Supabase/Twilio integration in this specific project (kl8blade-arch/luxury-shield-crm). Contains deploy commands, database schemas, known bugs with fixes, webhook processing order, phone numbers, API keys location, and all critical code patterns. Do NOT trigger for generic Next.js, Supabase, or webhook questions unrelated to Luxury Shield.
---

# Luxury Shield Insurance CRM — Developer Skill

## Project Overview

**Product**: CRM with AI agent (Sophia) for selling Cigna DVH Plus dental insurance to the Latino market in USA.
**Agency**: SeguriSSimo | **Owner**: Carlos Silva — Admin/Elite

## Stack

| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) | Frontend + API routes |
| Supabase | Postgres + Realtime + Storage |
| Twilio | WhatsApp + SMS |
| Claude API (Anthropic) | Sophia AI agent |
| OpenAI Whisper | Audio transcription |
| Vercel | Hosting + Cron jobs |

## Repository & URLs

- **GitHub**: `kl8blade-arch/luxury-shield-crm`
- **Production branch**: `master` (NOT main)
- **CRM URL**: https://luxury-shield-crm.vercel.app
- **Vercel Project ID**: `prj_7BzX8ENbQctWC8KAkAqa3BPUWRpi`

## Deploy Command (ALWAYS use this exact command)

```bash
npx vercel --prod --token=$VERCEL_TOKEN --yes
```

After every commit, push to BOTH branches:
```bash
git push origin master && git push origin master:main
```

View logs:
```bash
npx vercel logs luxury-shield-crm.vercel.app --token=$VERCEL_TOKEN
```

## Key Phone Numbers

| Who | Number | Role |
|---|---|---|
| WhatsApp Business | +17722772510 | Sophia's number |
| Carlos Silva (Master) | +17869435656 | Admin, trains Sophia |
| Lina Rodríguez | +17722771333 | Agent |

## AI Models

- **Sophia (leads)**: `claude-haiku-4-5-20251001`
- **Master/agents**: `claude-opus-4-6`
- **Audio transcription**: OpenAI `whisper-1`

## Supabase

- **Project ID**: `phdfmwzannemcdaotzlu`
- **URL**: https://phdfmwzannemcdaotzlu.supabase.co
- **Realtime**: Enabled on `conversations` and `leads` tables
- **Use Supabase MCP** for SQL execution with project_id above

## Critical File Map

```
src/app/api/
  whatsapp/route.ts      ← Main webhook (Twilio → Sophia)
  coaching/route.ts      ← Real-time coaching (4 parallel AI agents)
  coach-chat/route.ts    ← Direct chat with coach IA
  agent-send/route.ts    ← Agent sends message from CRM
  save-lead/route.ts     ← Landing form → create lead
  ai-contact/route.ts    ← First message to new lead
  calendar-notifications/route.ts
  generate-training-data/route.ts
  export-training/route.ts
  cleanup-locks/route.ts
  stage-change/route.ts
  business-health/route.ts

src/app/
  calendar/page.tsx      ← Calendar with monthly view + bottom sheet
  pipeline/page.tsx      ← Kanban with pointer events drag & drop
  leads/page.tsx         ← Lead list with query param filtering
  analytics/page.tsx     ← Dashboard with clickable KPIs
  sophia-os/page.tsx     ← Memory/Skills/Knowledge/Agents admin
  training/page.tsx      ← SophiaModel training data dashboard

src/components/
  LeadDetailPanel.tsx    ← Main interaction panel (chat, coaching, modes)
  EventModal.tsx         ← Create/edit calendar events
  AppShell.tsx           ← Responsive layout with collapsible sidebar
  Sidebar.tsx            ← Navigation

src/lib/
  master-handler.ts      ← Master system (Carlos trains Sophia)
  build-sophia-prompt.ts ← Dynamic prompt from memory+skills+knowledge
  training-pipeline.ts   ← Extract training data from conversations
  stage-context.ts       ← Different Sophia behavior per pipeline stage
  product-radar.ts       ← Cross-sell opportunity detection
  sophia-learning.ts     ← Learn from closed deals
  knowledge-base.ts      ← Cigna DVH Plus complete data
  voice-response.ts      ← OpenAI TTS for voice messages
  lead-distribution.ts   ← Weighted round-robin by agent plan
  design.ts              ← Design system constants (C.gold, C.surface, etc.)
```

## Webhook Processing Order (CRITICAL)

The `/api/whatsapp` POST handler MUST process in this exact order:

1. **Parse formData** (From, Body, MediaUrl0, NumMedia, MediaContentType0)
2. **Master detection** — if from +17869435656 → handleMasterMessage() → return
3. **Audio transcription** — if NumMedia > 0 and audio type → Whisper → set body
4. **Agent detection** — if from agent phone → handleAgentMessage() → return
5. **Find lead** — search ALL phone format variants, select one with most conversations
6. **Fresh mode check** — query DB for conversation_mode, NOT use stale lead object
7. **Manual/coaching block** — if mode != 'sophia' → save message, don't respond
8. **Processing lock** — if sophia_processing = true → skip
9. **Rate limit** — if last outbound < 3s ago → skip
10. **History fetch** — conversations by lead_id, fallback by phone
11. **Generate AI response** — Claude with full system prompt + dynamic layers
12. **Closing signal detection** — force [LISTO_PARA_COMPRAR] if explicit signals
13. **Stage update** — detect stage from message content
14. **Save + send response** — with typing delay (3-9s)
15. **Voice response** — non-blocking TTS if voice_enabled
16. **Battle card** — if LISTO_PARA_COMPRAR → generate analysis → notify agent
17. **Release lock** — always in finally block

## Database Tables

### Core
- **leads**: id, name, phone, stage, conversation_mode, sophia_processing, score, color_favorito, state, quiz_coverage_type, quiz_dentist_last_visit, quiz_has_insurance, preferred_language, product_opportunities, manual_ended_at
- **conversations**: id, lead_id, lead_phone, direction (inbound/outbound), message, sender, channel, ai_summary, created_at
- **agents**: id, name, email, whatsapp_number, role, plan, available, voice_enabled, credits

### Calendar
- **calendar_events**: id, agent_id, title, event_type, start_time, end_time, location, lead_id, lead_phone, lead_color, notify_whatsapp, notify_sms, notification_sent, status

### Sophia OS
- **sophia_memory**: category, key, value, importance, active, source
- **sophia_skills**: name, prompt_injection, active (ventas_dental, coaching_agente, agendar, bilingue)
- **sophia_knowledge**: title, content, source_type, embedding_summary, tags, active
- **sophia_agents**: name, purpose, system_prompt, active
- **sophia_training_data**: source, quality_score, approved, lead_profile, conversation, outcome, training_prompt, training_completion

## Known Bugs & Fixes

| Bug | Root Cause | Fix |
|---|---|---|
| Sophia responds in manual mode | Stale lead object has mode=sophia | Fresh DB query for conversation_mode before check |
| Duplicate leads | save-lead creates new instead of updating | Check existing by phone variants before INSERT |
| sophia_processing stuck | Error before finally block | /api/cleanup-locks cron every 10min |
| Audio not transcribing | Twilio 307 redirect drops auth | Two-step: get redirect URL, then fetch without auth |
| $NaN in packages | Division by zero | Guard: lead_count > 0 check |
| Drag & drop fails on iOS | HTML5 DnD not supported | Use Pointer Events API with ghost element |
| Manual mode updates wrong lead | Multiple leads with same phone | Update ALL leads matching phone, not just by ID |

## Product: Cigna DVH Plus

- Dental: NO waiting period, day 1 coverage
- Year 1: 60% basic, 20% major | Year 4+: up to 90%
- Deductible: $0, $50, or $100 | Max annual: $1,000-$5,000
- Vision: $200 every 2 years (6 month wait)
- Hearing: $500/year (12 month wait)
- Guaranteed issue: 18-89 years, no health questions
- PPO Careington: 85,000+ providers
- Prices FL: Individual $35-45/mo | Couple $65-80/mo | Family 5 $120-150/mo
- ALWAYS say "plan de protección" NEVER "seguro"

## Master Commands (via WhatsApp from +17869435656)

| Command | Action |
|---|---|
| `aprende esto: [info]` | Add to sophia_knowledge |
| `recuerda que [instruction]` | Add to sophia_memory |
| `olvida [topic]` | Deactivate knowledge/memory |
| `activa skill [name]` | Enable skill |
| `desactiva skill [name]` | Disable skill |
| `muéstrame tu memoria` | List active memories |
| `qué skills tienes?` | List skills with status |
| `simula [scenario]` | Test Sophia with scenario |
| `crea un agente para [purpose]` | Create new AI agent |
| Send PDF | Extract knowledge with Claude |
| Send audio | Transcribe + process as command |

## Pipeline Stages & Sophia Behavior

| Stage | Sophia's Approach |
|---|---|
| nuevo | Connect emotionally, DON'T mention prices |
| contactado | New angle to spark interest |
| interesado | Present full plan + urgency |
| propuesta | Handle objections, push to close |
| negociacion | Close TODAY, include [LISTO_PARA_COMPRAR] |
| cerrado | Welcome messages + referrals only |
| perdido | Rescue sequence, different angle |

## Closing Signals (force [LISTO_PARA_COMPRAR])

"ya mismo", "ahora mismo", "quiero que me llamen", "consígueme", "quiero empezar", "dónde firmo", "cómo activo", "sí quiero", phone number (10+ digits)

## Strategic Vision

- **Current**: Luxury Shield Insurance in Florida
- **Next**: SophiaOS — SaaS platform for external agencies ($297-997/mo)
- **Dataset**: sophia_training_data — target 500-1000 conversations
- **Fine-tuning**: SophiaModel v1 when dataset is ready
