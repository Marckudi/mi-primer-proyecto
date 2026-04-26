-- Instagram automation tables

CREATE TABLE IF NOT EXISTS instagram_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT NOT NULL CHECK (tipo IN ('reel', 'carrusel', 'post', 'story')),
  caption TEXT NOT NULL,
  hashtags TEXT[],
  media_urls TEXT[],
  scheduled_for TIMESTAMP NOT NULL,
  published_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  instagram_post_id TEXT,
  metrics JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instagram_content_scheduled ON instagram_content(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_instagram_content_status ON instagram_content(status);

CREATE TABLE IF NOT EXISTS instagram_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Calendar: when and what type of content to post each day
INSERT INTO instagram_config (key, value) VALUES
('content_calendar', '{
  "lunes":    {"10:00": "setup_del_dia",  "18:00": "analisis"},
  "martes":   {"10:00": "reel_setup",     "18:00": "chart_analysis"},
  "miercoles":{"10:00": "setup_mra",      "18:00": "educacion"},
  "jueves":   {"10:00": "reel_setup",     "18:00": "carrusel_educativo"},
  "viernes":  {"10:00": "setup_del_dia",  "18:00": "recap_semanal"},
  "sabado":   {"12:00": "carrusel_top3"},
  "domingo":  {"18:00": "reel_preview"}
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Viral content system prompts (injected into Claude requests)
INSERT INTO instagram_config (key, value) VALUES
('prompts_virales', '{
  "estratega": "Actúa como estratega senior de Instagram especializado en trading forex. Detecta qué está saturado en el nicho y crea ideas frescas que rompan patrón sin perder alcance.",
  "copywriter": "Actúa como copywriter viral especializado en finanzas y trading. Genera hooks que frenen el scroll usando curiosidad, autoridad y datos reales.",
  "formato":    "Transforma esta idea en formato faceless para Instagram: carrusel de texto, reel con subtítulos o post estático.",
  "retencion":  "Reescribe este contenido para maximizar guardados y compartidos. Haz que cada línea obligue a ver la siguiente."
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- NOTE: Instagram credentials and API tokens must be set via
-- Supabase Edge Function Secrets (Project Settings → Edge Function Secrets),
-- NOT stored in this table. Required secrets:
--   ANTHROPIC_API_KEY
--   OPENAI_API_KEY
--   INSTAGRAM_ACCESS_TOKEN
--   INSTAGRAM_BUSINESS_ACCOUNT_ID
