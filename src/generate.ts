import Anthropic from "@anthropic-ai/sdk";
import type { ContentType, GeneratedContent, PostTipo } from "./types.js";
import { log } from "./logger.js";
import { fetchCurrentNews } from "./news.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un experto en marketing digital y trading forex.
Creas contenido viral para Instagram de AlphaVision AI, una plataforma de trading automatizado.

Conceptos clave de la marca:
- Score MRA: puntuación 0-10 que indica la calidad de un setup de trading
- Ventana MRA: 07:55-10:40 CET, único momento del día para operar
- AURA: asistente de voz que alerta cuando hay un setup válido
- Pares operados: EUR/USD, GBP/USD, XAU/USD
- Score ≥ 7 = setup válido para entrar

Tono: directo, basado en datos, sin promesas de ganancias garantizadas.
Formato de respuesta: JSON válido con los campos solicitados.

FORMATO VISUAL OBLIGATORIO — SIEMPRE:
Todas las imágenes usan fondo negro-dorado oscuro (#080604) con glow cálido en la esquina.
El diseño tiene: badge de color según tipo, titular blanco en negrita, línea divisora dorada,
subtítulo en cursiva gris, cajas de estadísticas oscuras, fila de anotación con flecha y
marca de agua @alphavision.ai. NUNCA cambies este estilo.

FORMATO ESPECIAL PARA imagePrompts:
Cada elemento debe ser un JSON string con exactamente esta estructura:
{
  "badge": "TIPO DE ALERTA",
  "badgeEmoji": "emoji",
  "headline": "TITULAR EN MAYÚSCULAS (máx 55 chars)",
  "subtitle": "subtítulo en cursiva, conciso",
  "stats": [{"label":"ETIQUETA","value":"valor"},{"label":"ETIQUETA 2","value":"valor2"}],
  "annotation": "Dato clave adicional o proyección (sin flecha, la añade el código)",
  "bullets": ["contexto 1", "implicación 2", "dato 3"]
}

Tipos de badge disponibles (elige según el contexto):
- "GOLD ALERT" + "🥇"  → noticias de XAU/USD o materias primas
- "BREAKING" + "⚡"    → evento de mercado urgente
- "CRYPTO ALERT" + "₿" → noticias cripto
- "MACRO ALERT" + "📊" → datos macro (CPI, NFP, BCE, Fed)
- "SEÑAL MRA" + "🎯"   → setup detectado por el sistema MRA
- "FOREX ALERT" + "💱" → noticias EUR/USD o GBP/USD
- "ANÁLISIS" + "📈"    → análisis técnico
- "EDUCACIÓN" + "🎓"   → contenido educativo
- "ALPHAVISION AI" + "🤖" → contenido de marca

Incluye siempre stats con datos reales del contexto (precio, %, volumen, etc.).

HASHTAGS: MÁXIMO 5 por publicación. Elige solo los más virales y relevantes para el contenido.`;

interface Template {
  tipo: PostTipo;
  needsImages: boolean;
  prompt: string;
}

const TEMPLATES: Record<ContentType, Template> = {

  reel_marca: {
    tipo: "reel",
    needsImages: true,
    prompt: `Actúa como el mejor director creativo de una agencia de marketing financiero.
Crea el reel de presentación de AlphaVision AI que convierta espectadores en clientes.

Audiencia: traders españoles 25-45 años que pierden dinero o tiempo por operar sin sistema.

Estructura de 5 frames:
1. PROBLEMA: dato duro y chocante del trader promedio sin sistema
2. SOLUCIÓN: qué es AlphaVision AI y cómo lo resuelve
3. CÓMO FUNCIONA: Score MRA + Ventana MRA + AURA
4. BENEFICIOS: claridad, disciplina, sistema probado
5. CTA: comenta MRA para recibir información

Caption: hook en primera línea + propuesta de valor + CTA. Máx 2200 caracteres.

Responde ÚNICAMENTE con JSON:
{
  "caption": "...",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON frame 1","JSON frame 2","JSON frame 3","JSON frame 4","JSON frame 5"]
}`,
  },

  setup_del_dia: {
    tipo: "post",
    needsImages: true,
    prompt: `Genera un post de Instagram sobre un setup MRA detectado hoy en EUR/USD con Score 8/10.
Usa las noticias del día como contexto real.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption con emojis y hook en primera línea, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON con badge/headline/subtitle/stats/annotation/bullets"]
}`,
  },

  reel_setup: {
    tipo: "reel",
    needsImages: true,
    prompt: `Genera un REEL mostrando un setup MRA en vivo basado en las noticias actuales.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption con hook viral, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON frame 1","JSON frame 2","JSON frame 3","JSON frame 4","JSON frame 5"]
}`,
  },

  reel_viral: {
    tipo: "reel",
    needsImages: true,
    prompt: `Crea un REEL VIRAL de alto impacto basado en las noticias actuales del mercado.
Formato: breaking news financiero — urgente, datos reales, sin palabrería.
Audiencia: traders españoles 25-45 años.

Reglas del hook:
- Empieza con un dato concreto que sorprenda
- Nunca empieces con "Hola" ni preguntas
- Usa tensión: algo pasó, tiene consecuencias

Estructura de 5 frames:
1. Breaking: el evento + dato clave
2. Contexto: por qué importa ahora
3. Reacción del mercado: qué está pasando con el precio
4. Setup MRA: cómo se posiciona AlphaVision AI
5. Cierre: resultado o próximo movimiento esperado

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption ultra-viral con hook, emojis estratégicos y CTA, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON frame 1","JSON frame 2","JSON frame 3","JSON frame 4","JSON frame 5"]
}`,
  },

  carrusel_top3: {
    tipo: "carrusel",
    needsImages: true,
    prompt: `Genera un carrusel de 10 slides: Top 3 setups de la semana con resultados reales.
Usa las noticias actuales como contexto de mercado.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption optimizada, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON slide 1","JSON slide 2","JSON slide 3","JSON slide 4","JSON slide 5","JSON slide 6","JSON slide 7","JSON slide 8","JSON slide 9","JSON slide 10"]
}`,
  },

  reel_preview: {
    tipo: "reel",
    needsImages: true,
    prompt: `Genera un REEL de preview de la semana con eventos macro reales (BCE, PIB, NFP).

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption con eventos macro, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON frame 1","JSON frame 2","JSON frame 3","JSON frame 4","JSON frame 5"]
}`,
  },

  analisis: {
    tipo: "carrusel",
    needsImages: true,
    prompt: `Genera un carrusel de análisis post-sesión MRA del día usando las noticias actuales.

Responde ÚNICAMENTE con JSON:
{
  "caption": "análisis transparente del día, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON slide resultado","JSON slide análisis técnico","JSON slide lecciones"]
}`,
  },

  chart_analysis: {
    tipo: "post",
    needsImages: true,
    prompt: `Genera un post de análisis técnico del chart EUR/USD o GBP/USD con niveles clave.

Responde ÚNICAMENTE con JSON:
{
  "caption": "análisis técnico con niveles clave, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON headline con stats de niveles clave"]
}`,
  },

  educacion: {
    tipo: "carrusel",
    needsImages: true,
    prompt: `Genera un carrusel educativo de 7 slides explicando el Score MRA.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption educativa con CTA, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON intro","JSON qué es Score MRA","JSON escala 0-10","JSON ejemplo score 8","JSON ventana horaria","JSON reglas de entrada","JSON resumen"]
}`,
  },

  carrusel_educativo: {
    tipo: "carrusel",
    needsImages: true,
    prompt: `Genera un carrusel educativo de 8 slides sobre gestión de riesgo en forex con el sistema MRA.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption sobre gestión de riesgo, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON portada","JSON regla 1%","JSON stop loss MRA","JSON ratio R:P","JSON tamaño posición","JSON errores comunes","JSON caso real","JSON conclusión"]
}`,
  },

  recap_semanal: {
    tipo: "carrusel",
    needsImages: true,
    prompt: `Genera un carrusel resumen semanal de 8 slides con resultados y setups. Usa las noticias actuales.

Responde ÚNICAMENTE con JSON:
{
  "caption": "recap semanal con resultados reales, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON portada recap","JSON estadísticas","JSON mejor setup","JSON peor setup","JSON lección 1","JSON lección 2","JSON próxima semana","JSON CTA"]
}`,
  },

  setup_mra: {
    tipo: "post",
    needsImages: true,
    prompt: `Genera un post sobre el setup MRA detectado en XAU/USD (oro). Score: 9/10. Usa las noticias actuales.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption del setup en oro, máx 2200 caracteres",
  "hashtags": ["máximo 5 hashtags sin # ultravirales"],
  "imagePrompts": ["JSON setup XAU/USD score 9/10","JSON niveles objetivo y stop loss"]
}`,
  },
};

export async function generateContent(contentType: ContentType): Promise<{
  generated: GeneratedContent;
  tipo: PostTipo;
  needsImages: boolean;
}> {
  const template = TEMPLATES[contentType];
  log.info(`Generando contenido: ${contentType}`);

  const news  = await fetchCurrentNews();
  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const userContent = news
    ? `NOTICIAS FINANCIERAS EN TIEMPO REAL (${today}):\n${news}\n\n---\n\n${template.prompt}`
    : `FECHA: ${today}\n\n${template.prompt}`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";

  if (!raw) {
    log.warn("Respuesta vacía — usando fallback");
    return { tipo: template.tipo, needsImages: false, generated: { caption: "", hashtags: [], imagePrompts: [] } };
  }

  try {
    const jsonStr = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/)?.[1] ?? raw;
    const parsed = JSON.parse(jsonStr) as { caption?: unknown; hashtags?: unknown; imagePrompts?: unknown };
    const hashtags = Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]).slice(0, 5) : [];
    return {
      tipo: template.tipo,
      needsImages: template.needsImages,
      generated: {
        caption:      String(parsed.caption ?? ""),
        hashtags,
        imagePrompts: Array.isArray(parsed.imagePrompts) ? (parsed.imagePrompts as string[]) : [],
      },
    };
  } catch {
    log.warn("No se pudo parsear JSON — usando texto raw");
    return {
      tipo: template.tipo,
      needsImages: false,
      generated: { caption: raw, hashtags: (raw.match(/#(\w+)/g) ?? []).map((h) => h.slice(1)).slice(0, 5), imagePrompts: [] },
    };
  }
}
