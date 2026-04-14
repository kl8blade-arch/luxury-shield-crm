# 🎯 Campaign Detection - Guía Técnica

## ¿Cómo funciona la detección automática de campañas?

### Flujo Automático

```
Usuario escribe mensaje en WhatsApp
   ↓
Sistema recibe el mensaje
   ↓
Busca en meta_campaigns por trigger_message
   ↓
¿Coincide con alguna palabra clave?
   ├─ SÍ → Vincula lead a campaña + incrementa contador
   └─ NO → Lead continúa sin campaña (se puede asignar después)
```

---

## 📋 Funciones Disponibles

### 1. `detectCampaign()` - Detectar campaña por mensaje
```typescript
import { detectCampaign } from '@/lib/campaign-detection'

const campaign = await detectCampaign(
  "Hola, quiero información sobre seguros dentales", // mensaje
  "agent-uuid" // agentId
)

// Retorna:
{
  id: "campaign-uuid",
  name: "Segurissimo Dental - $60 consulta",
  trigger_message: "dental"
}

// O null si no hay coincidencia
```

**Búsqueda:**
- 🔍 Busca coincidencia EXACTA del trigger_message
- ⚡ Luego intenta coincidencia PARCIAL (primeros 3 caracteres)
- 📍 Aplica `.toLowerCase()` para case-insensitive

---

### 2. `incrementCampaignLeads()` - Incrementar contador
```typescript
import { incrementCampaignLeads } from '@/lib/campaign-detection'

await incrementCampaignLeads("campaign-uuid")

// Incrementa automáticamente:
// - leads_count += 1
// - updated_at = NOW()
// Usa RPC para máxima velocidad
```

---

### 3. `linkLeadToCampaignByMessage()` - Vincular lead por mensaje
```typescript
import { linkLeadToCampaignByMessage } from '@/lib/campaign-detection'

const result = await linkLeadToCampaignByMessage(
  "lead-uuid",
  "Quiero seguros de vida",
  "agent-uuid"
)

// Retorna:
{
  success: true,
  campaignId: "campaign-uuid",
  campaignName: "Seguros de Vida"
}
```

---

## 🔧 Cómo se usa en el webhook

En `src/app/api/whatsapp/route.ts`:

```typescript
// 1. Detectar si el mensaje viene de una campaña Meta
const { detectCampaign, incrementCampaignLeads } = await import('@/lib/campaign-detection')
const campaign = await detectCampaign(body, lead.agent_id)

// 2. Si hay campaña, vincular
if (campaign) {
  await supabase
    .from('leads')
    .update({ campaign_id: campaign.id, campaign_name: campaign.name })
    .eq('id', lead.id)
  
  // 3. Incrementar contador automáticamente
  await incrementCampaignLeads(campaign.id)
}
```

---

## 📊 Ejemplos de uso

### Ejemplo 1: Lead de Seguros Dentales
```
Mensaje: "Hola, quiero cotizar un seguro dental"
↓
Busca en meta_campaigns por trigger_message
↓
Encuentra: trigger_message = "dental"
↓
Vincula a: "Segurissimo Dental - $60 consulta"
↓
leads_count incrementa de 0 → 1
```

### Ejemplo 2: Lead de Seguros de Vida
```
Mensaje: "Me interesa vida"
↓
Busca en meta_campaigns por trigger_message
↓
Encuentra: trigger_message = "vida"
↓
Vincula a: "Seguros de Vida - $100 comisión"
↓
leads_count incrementa automáticamente
```

### Ejemplo 3: Sin campaña (leads manuales)
```
Mensaje: "Hola soy un lead manual"
↓
Busca en meta_campaigns
↓
No hay coincidencia
↓
campaign_id = null
↓
Lead continúa sin vinculación
```

---

## 🎯 Configuración de Campañas

Para que la detección funcione, necesitas:

### Crear campaña en BD
```sql
INSERT INTO meta_campaigns (agent_id, name, trigger_message, platform, status)
VALUES (
  'agent-uuid',
  'Segurissimo Dental - $60 consulta',
  'dental',
  'whatsapp_ad',
  'active'
);
```

### Campos importantes:
- **name**: Nombre de la campaña (visible en dashboard)
- **trigger_message**: Palabra clave para detectar (lowercase)
- **status**: 'active' o 'inactive' (solo activas se detectan)
- **leads_count**: Se incrementa automáticamente

---

## ⚙️ Búsqueda - Cómo funciona

```typescript
// En detectCampaign():

1. const lower = incomingMessage.toLowerCase().trim()
   // "Hola, quiero seguros DENTALES" → "hola, quiero seguros dentales"

2. for (const campaign of campaigns) {
     const trigger = campaign.trigger_message.toLowerCase()
     // trigger = "dental"
     
     if (lower.includes(trigger)) {
       // "hola, quiero seguros dentales".includes("dental") = true ✅
       return campaign
     }
   }

3. // Fallback: buscar primeros 3 caracteres
   if (trigger.length >= 3 && lower.includes(trigger.substring(0, 3))) {
     // "den".includes("den") = true
     return campaign (partial match)
   }
```

---

## 📈 Casos de uso reales

### Caso 1: Meta Lead Ads → WhatsApp automático
```
1. Usuario completa formulario en Meta
2. Webhook Meta envía notificación
3. Sistema crea lead y detecta campaña
4. Sophia responde automáticamente por WhatsApp
5. Dashboard muestra: "Lead de Dental"
```

### Caso 2: Lead manual con palabra clave
```
1. Agente manda "seguros de vida" al chat
2. Sistema detecta "vida" → vincula a campaña
3. Analytics ve de dónde vino el lead
4. Cuando convierte, sabe qué campaña fue
```

### Caso 3: Dashboard muestra fuente
```
Lead: "Juan Pérez"
Campaign: "Segurissimo Dental - $60"
Conversión: $150
Costo por lead: $10

→ Sabe exactamente qué campaña lo generó
```

---

## 🔐 Validaciones

La detección verifica:
- ✅ Agent activo
- ✅ Campaña en estado 'active'
- ✅ trigger_message no vacío
- ✅ Coincidencia case-insensitive

---

## 💡 Tips

### Para mejor detección:
1. **Triggers únicos y cortos**: "dental" mejor que "seguro dental para dientes"
2. **Sin caracteres especiales**: "seguros" mejor que "seguros_vida"
3. **Palabras clave comunes**: "vida", "dental", "auto", "viaje"
4. **Evita solapamientos**: "seg" vs "vida" vs "auto" son distintos

### Para debugging:
```
Si un lead NO se vincula:
1. Verifica que la campaña esté en status = 'active'
2. Revisa el trigger_message exacto (lowercase)
3. Busca en logs: [CAMPAIGN-DETECTION]
4. Compara con el mensaje que envió el usuario
```

---

## 🚀 Performance

- **RPC function**: Incremento ultra-rápido (< 1ms)
- **In-memory search**: Búsqueda en memoria de campañas (< 5ms)
- **No blocking**: Si falla detección, lead continúa (no bloquea)
- **Índice DB**: Búsquedas optimizadas en meta_campaigns

---

## ✅ Checklist antes de producción

- [ ] Campañas creadas en meta_campaigns
- [ ] trigger_message en lowercase sin espacios
- [ ] Status = 'active' en todas
- [ ] Form IDs registrados en meta_form_mappings (para leads de Meta)
- [ ] Webhook Meta configurado
- [ ] Notificaciones activadas (opcional)
- [ ] Prueba con mensaje que contenga trigger_message
