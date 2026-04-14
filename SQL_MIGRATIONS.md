# SQL Migrations for Campaign Features

Ejecuta estos comandos en **Supabase SQL Editor** para habilitar las 3 nuevas features:

## 1. Agregar columnas de features a meta_campaigns

```sql
ALTER TABLE meta_campaigns
ADD COLUMN IF NOT EXISTS notify_on_conversion BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS export_pdf_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS growth_prediction_enabled BOOLEAN DEFAULT false;
```

## 2. Crear índices para mejor performance

```sql
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_features 
ON meta_campaigns(notify_on_conversion, export_pdf_enabled, growth_prediction_enabled);
```

## 3. Verificar que las columnas existan

```sql
SELECT 
  id, name, 
  notify_on_conversion, 
  export_pdf_enabled, 
  growth_prediction_enabled 
FROM meta_campaigns 
LIMIT 1;
```

---

## ✅ Después de ejecutar

Las 3 features estarán disponibles:
- 📲 **Notificaciones WhatsApp** - Avisa al agente cuando un lead convierte
- 📄 **Exportar a PDF** - Descarga análisis en formato imprimible
- 📈 **Predicción de Crecimiento** - IA predice leads para próximos días

Todos pueden ser **activados/desactivados desde el dashboard**.

## 4. Crear función RPC para incrementar leads

```sql
CREATE OR REPLACE FUNCTION increment_campaign_leads(campaign_id UUID)
RETURNS void AS $$
  UPDATE meta_campaigns 
  SET leads_count = leads_count + 1, updated_at = NOW()
  WHERE id = campaign_id;
$$ LANGUAGE sql;
```

Esta función se usa automáticamente cuando:
- Un lead viene de Meta y se vincula a campaña
- Se registra una conversión
- Se incrementa el contador de forma rápida

