# Luxury Shield CRM — Codebase Backup
**Generado:** 2026-04-17  
**Versión:** Sophia v3 + Mobile Optimization  

---

## 📋 Índice de Archivos

1. **package.json** — Dependencias del proyecto
2. **src/app/api/whatsapp/route.ts** — Webhook principal (21 pasos, CRÍTICO)
3. **src/app/api/stripe/webhook/route.ts** — Procesamiento de pagos
4. **src/lib/errors.ts** — Manejo de errores
5. **src/lib/supabase.ts** — Cliente Supabase
6. **src/lib/master-handler.ts** — Comandos de administrador (Carlos)
7. **src/lib/sophia-context.ts** — Cargar contexto de conversaciones
8. **src/lib/token-tracker.ts** — Gestión de tokens y llamadas a Claude
9. **src/lib/twilio-provisioner.ts** — Provisión de números Twilio
10. **src/lib/sophia-knowledge.ts** — RAG para conocimiento de productos
11. **src/components/Sidebar.tsx** — Sidebar principal (con mobile hamburger)
12. **src/app/dashboard/layout.tsx** — Layout del dashboard (con mobile)
13. **src/app/dashboard/page.tsx** — Dashboard con KPIs

---

## 1. package.json

```json
{
  "name": "luxury-shield-crm",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.89.0",
    "@supabase/ssr": "^0.9.0",
    "@supabase/supabase-js": "^2.99.2",
    "autoprefixer": "^10.4.27",
    "date-fns": "^4.1.0",
    "docx": "^9.6.1",
    "dotenv": "^17.3.1",
    "lucide-react": "^0.577.0",
    "next": "16.2.0",
    "openai": "^6.33.0",
    "otpauth": "^9.5.0",
    "pdfkit": "^0.18.0",
    "postcss": "^8.5.8",
    "qrcode": "^1.5.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "recharts": "^3.8.1",
    "stripe": "^21.0.1",
    "twilio": "^5.13.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.0",
    "tailwindcss": "^4.2.2",
    "typescript": "^5"
  }
}
```

---

## 2. src/lib/errors.ts

```typescript
import { NextResponse } from 'next/server'

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export function errorHandler(error: unknown) {
  console.error('[API Error]', error)

  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    )
  }

  const message = error instanceof Error ? error.message : 'Unknown error'
  return NextResponse.json(
    { error: message },
    { status: 500 }
  )
}
```

---

## 3. src/lib/supabase.ts

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

## 4. src/app/api/stripe/webhook/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[STRIPE] Webhook signature failed:', err)
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 })
  }

  let parsedBody: any
  try { parsedBody = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  console.log(`[STRIPE] Event: ${event.type}`)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const metadata = session.metadata || {}

    // Check if this is a SophiaOS plan (new pricing model)
    const isSophiaOSPlan = metadata.planName && ['starter', 'pro', 'agency'].includes(metadata.planName)

    if (isSophiaOSPlan) {
      // Handle SophiaOS subscription
      const { agentId, planName, isAnnual } = metadata

      await supabase.from('agents').update({
        plan: planName.toLowerCase(),
        plan_status: 'active',
        plan_is_annual: isAnnual === 'true',
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan_activated_at: new Date().toISOString(),
        paid: true,
        status: 'active',
      }).eq('id', agentId)

      console.log(`[STRIPE] SophiaOS plan ${planName} activated for agent ${agentId}`)
    } else {
      // Handle legacy lead orders (old pricing model)
      const { packageId, packageName, leadCount, agentId } = metadata

      const realAgentId = agentId || metadata.agentId
      console.log(`[STRIPE] Payment: ${packageName}, agent: ${realAgentId}`)

      // Save order
      await supabase.from('lead_orders').insert({
        agent_id: realAgentId || null,
        package_name: packageName || 'Plan',
        lead_count: parseInt(leadCount || '0'),
        amount: (session?.amount_total || 0) / 100,
        status: 'completed',
        stripe_session_id: session?.id,
      })

      if (realAgentId) {
        const { data: agent } = await supabase.from('agents').select('credits, tokens_extra').eq('id', realAgentId).single()

        // Token purchase
        if (packageId?.startsWith('tokens_')) {
          const tokenCount = parseInt(leadCount || '0')
          await supabase.from('agents').update({ tokens_extra: (agent?.tokens_extra || 0) + tokenCount }).eq('id', realAgentId)
          await supabase.from('token_purchases').insert({ agent_id: realAgentId, package_name: packageName, token_count: tokenCount, amount_usd: (session?.amount_total || 0) / 100, stripe_session_id: session?.id })
        } else {
          // Plan purchase — activate account
          const planMap: Record<string, string> = { starter: 'starter', professional: 'professional', agency: 'agency', enterprise: 'enterprise' }
          const tokenLimits: Record<string, number> = { starter: 300, professional: 1000, agency: 3000, enterprise: 10000 }
          const subPlan = planMap[packageId || ''] || 'starter'

          // GAP 2 fix: guardar stripe_customer_id
          const stripeCustomerId = session?.customer || null

          await supabase.from('agents').update({
            credits: (agent?.credits || 0) + parseInt(leadCount || '0'),
            paid: true, status: 'active',
            subscription_plan: subPlan,
            tokens_limit: tokenLimits[subPlan] || 300,
            tokens_used: 0, tokens_reset_at: new Date().toISOString(),
            refund_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
          }).eq('id', realAgentId)

          console.log(`[STRIPE] Agent ${realAgentId} activated: plan=${subPlan}, customer=${stripeCustomerId}`)

          // Trigger Sophia onboarding after payment
          try {
            const { startAgentOnboarding } = await import('@/lib/agent-onboarding')
            startAgentOnboarding(realAgentId).catch(() => {})
          } catch {}
        }
      }
    }
  }

  // GAP 1 fix: reactivar cuenta al pagar (ej: usuario con trial_expired que re-paga)
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data?.object
    const customerId = invoice?.customer
    if (customerId) {
      const { data: agent } = await supabase.from('agents').select('id, status').eq('stripe_customer_id', customerId).single()
      if (agent && agent.status === 'trial_expired') {
        await supabase.from('agents').update({ status: 'active', paid: true }).eq('id', agent.id)
        console.log(`[STRIPE] Agent ${agent.id} reactivated via invoice.payment_succeeded`)
      }
    }
  }

  // Subscription events
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = sub.customer
    if (customerId) {
      const { data: agent } = await supabase.from('agents').select('id').eq('stripe_customer_id', customerId as string).single()
      if (agent) {
        await supabase.from('agents').update({
          paid: false,
          subscription_plan: 'free',
          plan: 'free',
          plan_status: 'cancelled',
          plan_activated_at: null,
        }).eq('id', agent.id)
        console.log(`[STRIPE] Subscription cancelled for agent ${agent.id}`)
      }
    }
  }

  return NextResponse.json({ received: true })
}
```

---

## 5. src/lib/sophia-context.ts

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ConversationMessage {
  direction: 'inbound' | 'outbound'
  message: string
  created_at: string
}

interface SophiaContext {
  conversations: ConversationMessage[]
  contextSummary?: string
  family?: any
  insights?: any
}

/**
 * Load full Sophia context for a lead
 * Includes: conversation history + family info + extracted insights
 */
export async function loadSophiaContext(
  leadId: string,
  agentId: string | null,
  limit: number = 20
): Promise<SophiaContext | null> {
  try {
    // Load conversation history
    const { data: conversations, error: convErr } = await supabase
      .from('conversations')
      .select('direction, message, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (convErr) {
      console.error('[sophia-context] Error loading conversations:', convErr)
      return null
    }

    // Load lead info for context summary
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name, phone, insurance_type, stage, score, family_relationships, extracted_insights')
      .eq('id', leadId)
      .single()

    let contextSummary = ''
    if (lead) {
      contextSummary = \`
Lead: \${lead.name}
Phone: \${lead.phone}
Stage: \${lead.stage}
Score: \${lead.score}
Insurance Type: \${lead.insurance_type}
\`
      if (lead.extracted_insights) {
        contextSummary += \`Insights: \${lead.extracted_insights}\`
      }
    }

    return {
      conversations: conversations || [],
      contextSummary: contextSummary.trim(),
      family: lead?.family_relationships,
      insights: lead?.extracted_insights,
    }
  } catch (e) {
    console.error('[sophia-context] Error in loadSophiaContext:', e)
    return null
  }
}

/**
 * Build Claude message array from conversation history
 * Merges consecutive messages from same direction
 */
export function buildClaudeMessages(
  conversations: ConversationMessage[],
  newMessage: string
): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = []

  // Convert history to Claude format
  for (const conv of conversations) {
    const role = conv.direction === 'inbound' ? 'user' : 'assistant'
    const lastMsg = messages[messages.length - 1]

    if (lastMsg && lastMsg.role === role) {
      // Merge consecutive messages from same sender
      lastMsg.content += \`\n\${conv.message}\`
    } else {
      messages.push({ role, content: conv.message })
    }
  }

  // Add new incoming message
  const lastMsg = messages[messages.length - 1]
  if (lastMsg && lastMsg.role === 'user') {
    lastMsg.content += \`\n\${newMessage}\`
  } else {
    messages.push({ role: 'user', content: newMessage })
  }

  return messages
}
```

---

## 6. src/lib/token-tracker.ts (Resumen)

**Función Principal:** `callAI(options)`

- Valida si el agente tiene bloqueado el AI
- Ejecuta rate limiting + chequeo de tokens
- Selecciona API key (agent's own o platform managed)
- Llama a Claude API
- Registra uso y decrementa tokens

```typescript
type TokenFeature = 'sophia_whatsapp' | 'coach_realtime' | 'training_generation' | 'audio_transcription' | 'master_command' | 'landing_builder' | 'social_content' | 'other'

interface AICallOptions {
  agentId?: string | null
  accountId?: string | null
  feature: TokenFeature
  model: string
  messages: { role: string; content: string }[]
  system?: string
  maxTokens?: number
  leadId?: string | null
}

interface AIResponse {
  text: string
  inputTokens: number
  outputTokens: number
  cost: number
}

export async function callAI(options: AICallOptions): Promise<AIResponse>
```

---

## 7. src/lib/twilio-provisioner.ts (Resumen)

**Funciones Principales:**
- `provisionTwilioNumber(agentId, agentName, areaCode)` — Crear sub-cuenta + provisionar número
- `verifyOwnNumber(agentId, provider, accountSid, authToken, phoneNumber)` — Verificar número BYOC

---

## 8. src/lib/sophia-knowledge.ts

```typescript
export async function getRelevantKnowledge(
  message: string,
  accountId: string
): Promise<string> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://luxury-shield-crm.vercel.app'
    const r = await fetch(\`\${appUrl}/api/sophia/knowledge\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, accountId }),
    })
    if (!r.ok) return ''
    const { knowledge } = await r.json()
    return knowledge ?? ''
  } catch {
    return ''
  }
}
```

---

## 9. src/lib/master-handler.ts (Resumen)

**Funciones Principales:**
- `isMaster(phone)` — Detectar si es Carlos (+17869435656)
- `handleMasterMessage(from, body, mediaUrl, mediaType)` — Procesar comandos

**Comandos:**
- **PDF upload** → Procesa PDF y extrae conocimiento
- **RESET** → Borra leads + webhook log por número
- **URLs** → Analiza URLs
- etc.

---

## 10. src/app/api/whatsapp/route.ts

**⚠️ CRÍTICO — 21 pasos del webhook:**

### Resumen de la lógica:

```
POST /api/whatsapp
├─ 1. Validar firma de Twilio
├─ 2. Obtener lead o crear si no existe
├─ 3. Extraer datos automáticamente (nombre, estado, color, etc.)
├─ 4. Detectar si es master (Carlos) → handleMasterMessage()
├─ 5. Detectar solicitud de cita médica → handleSophiaCitaIntent()
├─ 6. Detectar respuesta post-cita → isPostCitaResponse()
├─ 7. Cargar contexto de conversación
├─ 8. Construir mensajes para Claude
├─ 9. Inyectar conocimiento de productos (RAG)
├─ 10. Validar coverage status (nunca asumir que tiene seguro activo)
├─ 11. Determinar etapa del lead
├─ 12. Detectar si está listo para comprar → [LISTO_PARA_COMPRAR]
├─ 13. Construir system prompt (multi-language, tono, etc.)
├─ 14. Llamar a Claude para obtener respuesta
├─ 15. Analizar respuesta por palabras clave (IUL, vida, dental, etc.)
├─ 16. Actualizar lead (stage, score, nota automática)
├─ 17. Guardar conversación en DB
├─ 18. Detectar crosssell (familia, etc.) → appendCrossSellToResponse()
├─ 19. Enviar respuesta por Twilio WhatsApp
├─ 20. Si está listo para comprar → notificar agente
└─ 21. Retornar 200 OK
```

### Características principales:

- **Coverage Guard:** NUNCA asume que el lead tiene cobertura activa a menos que `lead.sold_product` lo confirme
- **Custom Prompt Injection:** Si `agent_config.custom_prompt` existe, ese tiene PRIORIDAD ABSOLUTA
- **5-PASO Philosophy:** ESCUCHAR → IDENTIFICAR → CALIFICAR → PRESENTAR → CIERRE (flexible, NO forzado)
- **Multi-Language:** Detecta idioma del cliente y responde en ese idioma
- **Speed Detection:** Ajusta tono según qué tan rápido responde el lead
- **Dynamic Layers:** 
  - Stage context
  - Learnings (Sophia OS)
  - Product knowledge (RAG)
  - Expert routing (Orchestrator)
  - Campaign-specific prompts

---

## 11. src/components/Sidebar.tsx (con Mobile)

**Cambios Mobile:**
- Estado: `isMobileOpen` para controlar visibilidad del sidebar
- Hamburger button (☰/✕) visible solo en móvil (< 768px)
- Dark overlay cuando el sidebar está abierto
- ESC key handler para cerrar
- Navigation items cierran el sidebar automáticamente
- CSS media query con `transform: translateX()` para slide-in animation

---

## 12. src/app/dashboard/layout.tsx (con Mobile)

**Cambios Mobile:**
- Hamburger button + overlay (igual que Sidebar.tsx)
- Sidebar con `position: fixed` en móvil
- Navigation items cierran el sidebar
- Media query: `transform: translateX(${isMobileOpen ? '0' : '-100%'})`

---

## 13. src/app/dashboard/page.tsx (Responsive)

**Cambios:**
- KPI grid: `gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'` (era `repeat(4, 1fr)`)
- Added `overflowX: 'auto'` para horizontal scrolling
- Body padding responsive

---

## 🎯 Variables de Entorno Críticas

```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# Twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_WHATSAPP_FROM=+17722772510
ADMIN_WHATSAPP=+17869435656

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# OpenAI (para audio transcription)
OPENAI_API_KEY=sk-xxxx

# App
NEXT_PUBLIC_APP_URL=https://luxury-shield-crm.vercel.app
```

---

## 🔐 Seguridad — Key Protections

1. **Coverage Guard** (línea 350 de whatsapp/route.ts):
   ```
   NUNCA asumas que el lead tiene una póliza activa a menos que 
   lead.sold_product o lead.purchased_products lo confirme explícitamente.
   ```

2. **Custom Prompt Priority** (línea 415-416):
   ```
   Si hay un custom_prompt del agente, ese tiene PRIORIDAD ABSOLUTA 
   sobre estas instrucciones generales.
   ```

3. **Fallback para notificar agente** (línea ~1758-1775):
   ```
   agents.phone → agent_configs.notification_phone → 
   agent_configs.whatsapp_number → ADMIN_PHONE
   ```

---

## 📊 Tablas Supabase Clave

- **agents** — Agentes de seguros
- **leads** — Leads/Clientes
- **conversations** — Historial de mensajes
- **agent_configs** — Config de cada agente (custom_prompt, idioma, etc.)
- **sophia_knowledge** — Base de datos de productos (RAG)
- **sophia_learning** — Learnings por región
- **token_usage** — Tracking de tokens por agente
- **lead_orders** — Órdenes de leads
- **token_purchases** — Compras de tokens

---

## 🚀 Deployment

**Vercel CLI:**
```bash
vercel --prod --force
```

**Git:**
```bash
git add -A
git commit -m "feat: mobile responsive + fix"
git push origin master
```

---

**Última actualización:** 2026-04-17 — Mobile optimization completada ✅
