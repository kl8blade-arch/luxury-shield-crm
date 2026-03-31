---
name: luxury-shield-dev
description: Complete development context for Luxury Shield Insurance CRM — SophiaOS multi-tenant SaaS platform with AI agents across 7 industries. Trigger on ANY mention of: Sophia, leads, pipeline, WhatsApp, Twilio, CRM, tokens, sub-accounts, agents, skills, knowledge, training, packages, Stripe, social intelligence, import, vault, marketplace, settings, or any bug/feature in this project.
---

# Luxury Shield CRM — SophiaOS Developer Skill

## Project Overview

**Product**: Multi-tenant AI-powered CRM (SaaS) that sells via WhatsApp with AI agents per industry.
**Agency**: SeguriSSimo / Implement IA | **Owner**: Carlos Silva — Admin/Elite
**Industries**: Seguros, Realtor, Dropshipping, Infoproductos, Inversiones, Autos, Multinivel

## Stack

| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) | Frontend + API routes |
| Supabase (PostgreSQL) | Database + Realtime |
| Twilio | WhatsApp + SMS + Voice |
| Anthropic Claude (Haiku 4.5) | Sophia AI + coaching + orchestrator |
| OpenAI Whisper | Audio transcription |
| Stripe | Subscriptions + token purchases |
| Vercel | Hosting + Serverless |

## Repository & URLs

- **GitHub**: `kl8blade-arch/luxury-shield-crm`
- **Branch**: `master`
- **Production**: https://luxury-shield-crm.vercel.app
- **Supabase ID**: `phdfmwzannemcdaotzlu`

## Deploy

```bash
npx next build && git add [files] && git commit -m "msg" && git push origin master && npx vercel --prod --yes
```

## Key Numbers

| Who | Number |
|---|---|
| Sophia WhatsApp | +17722772510 |
| Carlos (Master) | +17869435656 |
| Stripe Account | Implement IA (US) |

## Architecture

### Auth System (Custom — NOT Supabase Auth)
- Login: `/api/auth/login` — validates via `verify_agent_login()` pgcrypto function
- Register: `/api/auth/register` — creates pending account → phone verification → Stripe checkout → activate
- Google OAuth: `/api/auth/google` — via `upsert_google_agent()` function
- 2FA: TOTP via `/api/auth/setup-totp` and `/api/auth/verify-totp`
- Session: localStorage `ls_auth` + server validation via `/api/auth/validate`
- Password: min 8 chars, uppercase, lowercase, number, special character
- Phone verification: 6-digit code via WhatsApp before account creation

### Account & Multi-Tenancy
- `accounts` table: parent account (luxury-shield) + sub-accounts
- `agents` table: users with role (admin/agent), plan, tokens, API keys
- Account switcher: `activeAccount` in AuthContext, stored in sessionStorage
- Data scoping: `scopeQuery()` in `src/lib/use-scoped-query.ts` filters by agent_id or account_id
- Sub-accounts: full CRM isolation, own agents/skills/knowledge/memory
- Industries: seguros, realtor, dropshipping, infoproductos, inversiones, autos, multinivel

### Token System
- `tokens_used`, `tokens_limit`, `tokens_extra` on agents table
- 1 token = 1 Sophia auto-response to a lead
- Plan limits: Starter=300, Professional=1000, Agency=3000, Admin=unlimited
- Token gate in WhatsApp webhook: blocks AI response when exhausted
- Token packages: 100/$15, 500/$59, 1000/$99, 3000/$249
- Monthly reset (first of month)
- Token usage logged in `token_usage` table with cost tracking

### Stripe Integration
- Live key configured, webhook at `/api/stripe/webhook`
- Subscription mode with 7-day trial (card collected upfront)
- Events: checkout.session.completed, subscription.created/updated/deleted
- Token purchases handled via same webhook (packageId starts with 'tokens_')
- Plans: Starter $47, Professional $97, Agency $197, Enterprise custom

## File Map

```
src/app/api/
  whatsapp/route.ts          ← Main webhook (~1400 lines, critical order)
  auth/login/route.ts        ← Email/password login
  auth/register/route.ts     ← Registration with phone verification
  auth/google/route.ts       ← Google OAuth
  auth/validate/route.ts     ← Server-side session validation
  auth/forgot-password/      ← Password reset flow
  auth/reset-password/       ← Code verification + new password
  auth/setup-totp/           ← 2FA setup
  auth/verify-totp/          ← 2FA verification
  stripe/checkout/route.ts   ← Creates Stripe sessions (payment + subscription)
  stripe/webhook/route.ts    ← Handles payment confirmation
  coaching/route.ts          ← 4 parallel coaching agents
  social/connect/route.ts    ← OAuth for social platforms
  social/callback/route.ts   ← OAuth callback handler
  v1/leads/route.ts          ← Public API: list/create leads
  v1/conversations/route.ts  ← Public API: conversation history
  v1/webhooks/inbound/       ← Universal webhook (FB, Google, GHL, etc.)
  landing-builder/route.ts   ← AI landing page generator

src/app/
  login/page.tsx             ← Login with Google + 2FA
  register/page.tsx          ← Plan selection → form → phone verify → Stripe
  setup/page.tsx             ← Onboarding wizard (logo, products, language)
  forgot-password/page.tsx   ← Password recovery via WhatsApp
  dashboard/page.tsx         ← KPIs, recent leads, token balance
  leads/page.tsx             ← Lead list with filters
  pipeline/page.tsx          ← Kanban drag-and-drop
  analytics/page.tsx         ← Business intelligence dashboard
  calendar/page.tsx          ← Calendar with events
  reminders/page.tsx         ← Reminder system
  campaigns/page.tsx         ← Marketing campaigns
  social/page.tsx            ← Social intelligence center
  social/connect/page.tsx    ← OAuth connections for 6 platforms
  marketplace/page.tsx       ← Landing page builder
  import/page.tsx            ← CSV/Excel contact import
  vault/page.tsx             ← Archived leads from deleted sub-accounts
  tools/page.tsx             ← 7-tab tools center
  packages/page.tsx          ← Plans + pricing (decoy effect)
  training/page.tsx          ← SophiaModel training data
  accounts/page.tsx          ← Sub-account management
  sophia-os/page.tsx         ← AI agents/skills/knowledge admin
  settings/page.tsx          ← 8-tab settings (profile, security, licenses, socials, pipeline, sub-accounts, AI, APIs)

src/components/
  Sidebar.tsx                ← Navigation + account switcher
  AppShell.tsx               ← Layout + trial banner + auth gate
  FileUpload.tsx             ← Universal file picker (ref-based, works on iOS)
  LeadDetailPanel.tsx        ← Chat + coaching + manual mode

src/contexts/
  AuthContext.tsx             ← Auth state + activeAccount + trial + route protection

src/lib/
  master-handler.ts          ← Carlos trains Sophia via WhatsApp (12 actions + conversation history)
  build-sophia-prompt.ts     ← Dynamic prompt: skills + knowledge + memory (capped at 6K+4K chars)
  sophia-orchestrator.ts     ← Routes to expert agent by keywords + account_id
  agent-onboarding.ts        ← WhatsApp onboarding flow (logo → color → welcome)
  token-guard.ts             ← Token checking + consumption + monthly reset
  api-auth.ts                ← Request authentication helper
  api-key-auth.ts            ← Public API key validation + rate limiting
  use-scoped-query.ts        ← Data isolation: scopeQuery() and scopeByAccount()
  supabase.ts                ← Supabase client (anon key)
  design.ts                  ← Design system constants
```

## WhatsApp Webhook Order (CRITICAL — DO NOT REORDER)

1. Parse formData
2. Validate Twilio AccountSid
3. Slash commands ("/" menu)
4. Master detection (+17869435656) → master-handler with conversation history
5. Agent onboarding detection → agent-onboarding flow
6. Audio transcription → Whisper
7. Agent detection → handleAgentMessage
8. Find lead (6 phone variants)
9. Fresh mode check (query ALL leads with that phone)
10. Manual/coaching block
11. Processing lock (sophia_processing)
12. Rate limit (<3s)
13. **TOKEN CHECK** — block if agent exhausted
14. History fetch
15. Generate AI response (Claude + dynamic layers + expert routing)
16. Token consumption logging
17. Closing signal detection
18. Stage update
19. Save + send with typing delay
20. Voice response (non-blocking)
21. Battle card (if ready to buy)
22. Release lock (finally)

## AI Agents (40 templates across 7 industries)

| Industry | Count | Agents |
|----------|-------|--------|
| Seguros | 6 | DentalExpert, VidaIULExpert, ACAExpert, MedicareExpert, ObjecionesYCierre, SocialSeller |
| Realtor | 6 | PropertyExpert, MortgageAdvisor, InvestmentProperty, LeadNurturer, OpenHouseManager, SocialRealtor |
| Dropshipping | 8 | SupplierScout, AdsCopywriter, AdsManager, StoreBuilder, FulfillmentManager, CustomerService, InventoryManager, ScalingStrategist |
| Infoproductos | 5 | CourseExpert, CommunityManager, WebinarCloser, ContentStrategist, LaunchManager |
| Inversiones | 5 | CryptoAdvisor, StockAdvisor, RealEstateInvestor, PortfolioBuilder, EducationCreator |
| Autos | 5 | CarSalesExpert, FinanceManager, TradeInSpecialist, ServiceReminder, SocialAutos |
| Multinivel | 5 | TeamBuilder, ProductTrainer, RetentionCoach, EventOrganizer, SocialRecruiter |

Global agents (master account): SocialScanner, CuriosityCreator, GroupEngager, ContentScheduler, CommunityManager, AnalyticsReporter, DMCloser

## Database Tables

### Core
- **agents**: id, name, email, phone, password_hash, role, plan, status, account_id, tokens_used, tokens_limit, tokens_extra, paid, trial_ends_at, onboarding_complete, subscription_plan, anthropic_api_key, openai_api_key, uses_own_ai_keys, social_*, bio, company_name, agency_url, products, licensed_states, wa_onboarding_step, totp_secret, totp_enabled, google_id
- **accounts**: id, name, slug, parent_account_id, account_type, plan, industry, features, max_leads, max_agents, logo_url, brand_color, welcome_message, cross_sell_enabled
- **leads**: id, name, phone, email, state, stage, score, agent_id, account_id, insurance_type, purchased_products, import_batch, import_source, conversation_mode, sophia_processing
- **conversations**: id, lead_id, lead_phone, direction, message, channel, created_at

### Sophia OS
- **sophia_agents**: id, name, purpose, system_prompt, trigger_keywords, active, account_id, knowledge_sources
- **sophia_skills**: id, name, description, prompt_injection, active, account_id
- **sophia_knowledge**: id, title, content, source_type, tags, active, account_id
- **sophia_memory**: id, category, key, value, importance, active, account_id
- **sophia_training_data**: id, product_family, conversation, outcome, quality_score, source, approved, metadata

### Tokens & Billing
- **token_usage**: id, agent_id, account_id, lead_id, tokens_input, tokens_output, cost_usd
- **token_purchases**: id, agent_id, package_name, token_count, amount_usd
- **lead_orders**: id, agent_id, package_name, amount, stripe_session_id
- **api_keys**: id, key, account_id, agent_id, scopes, rate_limit, active

### Social & Content
- **social_connections**: id, platform, access_token, platform_username, status
- **social_content**: id, platform, content_type, content, hashtags, status
- **social_groups**: id, platform, group_name, relevance_score, topics

### Other
- **calendar_events**, **reminders**, **campaigns**, **landing_builds**, **landing_templates**
- **lead_vault**: archived leads from deleted sub-accounts with tags
- **webhook_subscriptions**: outbound webhooks when CRM events fire
- **password_reset_tokens**: phone verification + password reset codes
- **industry_agent_templates**: 40 pre-built agent templates per industry

## Security Measures

- Twilio AccountSid validation on webhook
- Server-side session validation (prevents localStorage spoofing)
- Token gate blocks AI without balance
- Password: 8+ chars, upper, lower, number, special
- Phone verification via WhatsApp (6-digit code)
- Stripe required before CRM access
- Account data isolation via scopeQuery()
- API key authentication for public endpoints
- Rate limiting on API keys (1000 req/day)

## Slash Commands (WhatsApp)

Type "/" to see menu: /cita, /recordatorio, /buscar, /pipeline, /leads, /skills, /memoria, /activar, /desactivar, /test, /aprender, /recuerda, /olvida, /resumen, /salud, /comisiones

## Master Handler Actions (12)

schedule, reminder, find_lead, pipeline_status, daily_summary, commissions, learn, remember, forget, set_skill, show_memory, show_skills, test_sophia, chat (with full conversation history)
