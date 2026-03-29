# LUXURY SHIELD INSURANCE — CONTEXTO DEL PROYECTO

## Stack
- Next.js 16 + React 19 + Supabase + Twilio + Anthropic API + Vercel
- GitHub: kl8blade-arch/luxury-shield-crm
- Producción: https://luxury-shield-crm.vercel.app

## Producto Principal
- Cigna DVH Plus (Dental + Visión + Audición)
- Agente IA: Sophia (vende por WhatsApp)
- WhatsApp Business: +17722772510
- Admin Carlos: +17869435656
- Agente Lina: +17722771333

## Supabase
- URL: https://phdfmwzannemcdaotzlu.supabase.co
- Realtime activado en: conversations, leads

---

## SESIÓN 28 MAR 2026

### SISTEMAS IMPLEMENTADOS HOY:
- Fix crítico: modo manual bloquea a Sophia (freshLead fetch antes del check)
- Supabase Realtime activado en conversations y leads
- LeadDetailPanel con conversaciones en tiempo real
- Coach IA con chat directo integrado al panel
- Drag & drop en Pipeline con stage-context por etapa
- Sistema de coaching que se actualiza por polling
- Sidebar colapsable en móvil con hamburguesa dorado
- Analytics clickeable con navegación directa

### BUGS PENDIENTES DE VERIFICAR:
- Confirmar que modo manual bloquea Sophia correctamente
- Copiar mensaje sugerido del coach en móvil
- $NaN en paquetes (revisar leads_count en Supabase)

### VISIÓN DE PRODUCTO DISCUTIDA:
- SophiaOS: sistema operativo para agencias de seguros
- Fine-tuning propietario con dataset de conversaciones
- Inteligencia colectiva multi-agencia
- Pipeline de datos para SophiaModel v1
- Target: 500-1,000 conversaciones para primer fine-tuning

### PRÓXIMA SESIÓN:
1. Diseñar pipeline de datos para fine-tuning de SophiaModel
2. Estructura del dataset de entrenamiento
3. Go-to-market para primera agencia externa
4. Verificar todos los bugs pendientes
