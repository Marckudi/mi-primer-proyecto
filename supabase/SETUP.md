# Setup instrucciones — Backend Instagram Automation

## 1. Ejecutar migración SQL

En Supabase Dashboard → SQL Editor, ejecuta el contenido de:
`migrations/001_instagram_tables.sql`

O si tienes Supabase CLI:
```bash
supabase db push
```

## 2. Crear bucket de Storage

En Supabase Dashboard → Storage → New Bucket:
- Nombre: `instagram-media`
- Public: ✅ (para que las URLs sean accesibles por la Instagram API)

## 3. Configurar secrets de la Edge Function

En Supabase Dashboard → Project Settings → Edge Function Secrets:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
INSTAGRAM_ACCESS_TOKEN=...        (cuando tengas Graph API configurada)
INSTAGRAM_BUSINESS_ACCOUNT_ID=... (ID de tu cuenta de negocio de Instagram)
```

## 4. Desplegar la Edge Function

```bash
supabase functions deploy instagram-auto-publish
```

## 5. Configurar Cron Job

En Supabase Dashboard → Edge Functions → instagram-auto-publish → Schedules:
- Schedule: `0 7 * * *`  (07:00 UTC = 08:00-09:00 CET según horario)
- Ajusta la hora según tu zona horaria

O en Dashboard → Cron Jobs → New Cron Job:
- Name: Instagram Daily Content
- Schedule: `0 7 * * *`
- HTTP Method: POST
- URL: `https://<project-ref>.supabase.co/functions/v1/instagram-auto-publish`

## 6. Configurar Instagram Graph API

1. Ve a developers.facebook.com
2. Crea una app de tipo "Business"
3. Añade el producto "Instagram Graph API"
4. Genera un Access Token con permisos:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
5. Guarda el token en los secrets de la Edge Function

## Consultas útiles

```sql
-- Ver contenido generado hoy
SELECT * FROM instagram_content
ORDER BY created_at DESC LIMIT 10;

-- Ver próximas publicaciones
SELECT tipo, caption, scheduled_for, status
FROM instagram_content
WHERE status = 'pending' AND scheduled_for > NOW()
ORDER BY scheduled_for ASC;

-- Métricas por tipo
SELECT
  tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'published') as publicados,
  AVG((metrics->>'likes')::int) as avg_likes
FROM instagram_content
GROUP BY tipo;
```
