# 🚀 Campaign Features - Manual de Uso

Tres features **activables/desactivables** manualmente para tus campañas Meta.

---

## 1️⃣ **NOTIFICACIONES WHATSAPP** 📲

Recibe un mensaje WhatsApp cada vez que alguien convierte desde una campaña.

### Activar/Desactivar
```bash
# Activar notificaciones
curl -X POST "https://.../api/campaigns/toggle-feature" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "UUID",
    "feature": "notifications",
    "enabled": true
  }'

# Desactivar
curl -X POST "https://.../api/campaigns/toggle-feature" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "UUID",
    "feature": "notifications",
    "enabled": false
  }'
```

### Registrar Conversión (Automáticamente enviará notificación si está activada)
```bash
curl -X POST "https://.../api/campaigns/notify-conversion" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "UUID",
    "leadName": "Juan Pérez",
    "leadPhone": "+5255555555",
    "conversionValue": 150
  }'
```

### Mensaje que recibirá
```
🎉 CONVERSIÓN REGISTRADA

Campaña: Segurissimo Dental - $60 consulta
Cliente: Juan Pérez
Teléfono: +5255555555
Valor: $150.00

¡Excelente venta! 🚀
```

---

## 2️⃣ **EXPORTAR ANÁLISIS A PDF** 📄

Descarga un reporte completo de tu campaña con todos los análisis IA en PDF.

### Activar/Desactivar
```bash
# Activar
curl -X POST "https://.../api/campaigns/toggle-feature" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "UUID",
    "feature": "pdf_export",
    "enabled": true
  }'

# Desactivar
curl -X POST "https://.../api/campaigns/toggle-feature" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "UUID",
    "feature": "pdf_export",
    "enabled": false
  }'
```

### Generar PDF
```bash
# El endpoint retorna HTML imprimible
# Se abrirá automáticamente el diálogo de imprenta
curl -X POST "https://.../api/campaigns/export-pdf" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "UUID",
    "analysis": { /* objeto de análisis IA */ },
    "allCampaigns": [ /* array de campañas */ ]
  }'
```

### Contenido del PDF
- 📊 Métricas principales (Leads, Conversiones, Tasa)
- 🤖 Análisis IA (Factor WOW, Fortaleza, Debilidad)
- 💡 Recomendaciones
- 📈 Comparativa con otras campañas
- 🎨 Diseño profesional, listo para imprimir

---

## 3️⃣ **PREDICCIÓN DE CRECIMIENTO** 📈

IA predice cuántos leads recibirás en los próximos 7 y 30 días basándose en tendencias.

### Activar/Desactivar
```bash
# Activar
curl -X POST "https://.../api/campaigns/toggle-feature" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "UUID",
    "feature": "growth_prediction",
    "enabled": true
  }'

# Desactivar
curl -X POST "https://.../api/campaigns/toggle-feature" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "UUID",
    "feature": "growth_prediction",
    "enabled": false
  }'
```

### Obtener Predicción
```bash
curl -X POST "https://.../api/campaigns/growth-prediction" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "UUID"
  }'
```

### Respuesta
```json
{
  "success": true,
  "prediction": {
    "currentTrend": "📈 Crecimiento fuerte",
    "predictedLeadsNext7Days": 45,
    "predictedLeadsNext30Days": 180,
    "growthRate": 23.5,
    "confidence": 87,
    "recommendations": [
      "🎯 Alto crecimiento detectado. Considera escalar budget...",
      "💰 Mantén la estrategia actual, está funcionando muy bien",
      "📊 Analiza qué elemento está funcionando mejor"
    ]
  },
  "dataPoints": {
    "totalLeadsLast30Days": 156,
    "avgDailyLeads": 5.2,
    "lastWeekLeads": 39,
    "previousWeekLeads": 31
  }
}
```

### Qué indica cada métrica
- **currentTrend**: 📈 Crecimiento, 📉 Decline, estable
- **predictedLeadsNext7Days**: Leads esperados en próxima semana
- **predictedLeadsNext30Days**: Leads esperados en próximo mes
- **growthRate**: % de cambio semana a semana (+ o -)
- **confidence**: Qué tan confiable es la predicción (0-100%)
- **recommendations**: Acciones específicas sugeridas por IA

---

## 📱 DESDE EL DASHBOARD

Pronto podrás:
1. Hacer click en campaña
2. Ver toggles para las 3 features
3. Activar/desactivar con un click
4. Ver predicciones en tiempo real
5. Descargar PDF con un botón
6. Recibir notificaciones automáticas

---

## 🔑 CONFIGURACIÓN REQUERIDA

### Para notificaciones WhatsApp
Asegúrate que:
- `TWILIO_ACCOUNT_SID` configurado en Vercel
- `TWILIO_AUTH_TOKEN` configurado en Vercel
- `TWILIO_WHATSAPP_FROM` configurado en Vercel
- Agente tiene un `phone` configurado en la BD

### Para predicción de crecimiento
- Necesita al menos **7 días de datos** para precisión
- Mínimo **10 leads** en el período
- Funciona mejor con campañas de **30+ días** de antigüedad

---

## ⚡ CASOS DE USO

### 📲 Notificaciones
✅ Enterarte al instante de cada venta  
✅ Celebrar conversiones en tiempo real  
✅ Pasar a modo "manual" si hay venta importante  

### 📄 PDF Export
✅ Compartir análisis con el cliente  
✅ Archivar reportes mensuales  
✅ Presentar resultados a la junta  
✅ Imprimir para referencia física  

### 📈 Growth Prediction
✅ Planificar budget de anuncios  
✅ Proyectar ingresos mensuales  
✅ Detectar cuándo una campaña se estanca  
✅ Tomar decisiones de escala basadas en datos  

---

## 🎯 TIPS

**Para máximo ROI:**
1. Activa predicción en campaña nueva (mira tendencia)
2. Una vez estable, activa PDF para análisis profundo
3. Cuando convierte, notificación te avisa en vivo
4. Exporta PDF al final del mes para reportes

**Para múltiples campañas:**
- Notificaciones: Activa en las TOP campañas
- Predicción: Activa en todas para comparar
- PDF: Genera al final de cada semana

---

## ✅ Verificar Status

```bash
# Ver qué features tiene activadas una campaña
curl "https://.../api/campaigns/stats?agentId=UUID" | jq '.campaigns[] | {name, notify_on_conversion, export_pdf_enabled, growth_prediction_enabled}'
```
