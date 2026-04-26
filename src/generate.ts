import Anthropic from "@anthropic-ai/sdk";
import type { ContentType, GeneratedContent, PostTipo } from "./types.js";
import { log } from "./logger.js";

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
Formato de respuesta: JSON válido con los campos solicitados.`;

interface Template {
  tipo: PostTipo;
  needsImages: boolean;
  prompt: string;
}

const TEMPLATES: Record<ContentType, Template> = {
  setup_del_dia: {
    tipo: "post",
    needsImages: true,
    prompt: `Actúa como copywriter viral especializado en finanzas y trading. Genera hooks que frenen el scroll usando curiosidad, autoridad y datos reales.

Genera contenido para un post de Instagram sobre un setup MRA detectado hoy en EUR/USD con Score 8/10.
Audiencia: traders españoles.

Responde ÚNICAMENTE con JSON (sin markdown):
{
  "caption": "caption completa con emojis, máximo 2200 caracteres",
  "hashtags": ["array", "de", "20", "hashtags", "sin", "el", "símbolo", "#"],
  "imagePrompts": ["descripción imagen 1", "descripción imagen 2"]
}`,
  },

  reel_setup: {
    tipo: "reel",
    needsImages: true,
    prompt: `Transforma esta idea en formato faceless para Instagram: reel con subtítulos.

Genera contenido para un REEL mostrando un setup MRA en vivo.
Objetivo: engagement + autoridad.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption con hook viral, máximo 2200 caracteres",
  "hashtags": ["20 hashtags sin #"],
  "imagePrompts": ["frame 1 (0-3s)", "frame 2 (3-6s)", "frame 3 (6-9s)", "frame 4 (9-12s)", "frame 5 (12-15s)"]
}`,
  },

  carrusel_top3: {
    tipo: "carrusel",
    needsImages: true,
    prompt: `Reescribe este contenido para maximizar guardados y compartidos. Haz que cada línea obligue a ver la siguiente.

Genera un carrusel de 10 slides: Top 3 setups de la semana con resultados reales.
Transparencia radical. Sin promesas de ganancias garantizadas.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption optimizada, máximo 2200 caracteres",
  "hashtags": ["20 hashtags sin #"],
  "imagePrompts": ["slide 1", "slide 2", "slide 3", "slide 4", "slide 5", "slide 6", "slide 7", "slide 8", "slide 9", "slide 10"]
}`,
  },

  reel_preview: {
    tipo: "reel",
    needsImages: true,
    prompt: `Actúa como estratega senior de Instagram especializado en trading forex.

Genera un REEL de preview de la semana siguiente. Incluye eventos macro (BCE, PIB, NFP).

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption con eventos macro de la semana, máximo 2200 caracteres",
  "hashtags": ["20 hashtags sin #"],
  "imagePrompts": ["frame 1", "frame 2", "frame 3", "frame 4", "frame 5"]
}`,
  },

  analisis: {
    tipo: "carrusel",
    needsImages: true,
    prompt: `Actúa como copywriter viral especializado en finanzas y trading.

Genera un carrusel de análisis post-sesión MRA del día.
Muestra resultado real (ganancia o pérdida), sin manipulación.

Responde ÚNICAMENTE con JSON:
{
  "caption": "análisis transparente del día, máximo 2200 caracteres",
  "hashtags": ["15 hashtags sin #"],
  "imagePrompts": ["slide resultado", "slide análisis técnico", "slide lecciones"]
}`,
  },

  chart_analysis: {
    tipo: "post",
    needsImages: true,
    prompt: `Actúa como copywriter viral especializado en finanzas y trading.

Genera un post de análisis técnico del chart EUR/USD o GBP/USD con niveles clave.

Responde ÚNICAMENTE con JSON:
{
  "caption": "análisis técnico con niveles clave, máximo 2200 caracteres",
  "hashtags": ["20 hashtags sin #"],
  "imagePrompts": ["chart EUR/USD con anotaciones y niveles clave"]
}`,
  },

  educacion: {
    tipo: "carrusel",
    needsImages: true,
    prompt: `Reescribe este contenido para maximizar guardados y compartidos.

Genera un carrusel educativo de 7 slides explicando el Score MRA y cómo identificar setups válidos.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption educativa con CTA a guardarlo, máximo 2200 caracteres",
  "hashtags": ["20 hashtags sin #"],
  "imagePrompts": ["intro", "qué es Score MRA", "escala 0-10", "ejemplo score 8", "ventana horaria", "reglas de entrada", "resumen"]
}`,
  },

  carrusel_educativo: {
    tipo: "carrusel",
    needsImages: true,
    prompt: `Reescribe este contenido para maximizar guardados y compartidos.

Genera un carrusel educativo de 8 slides sobre gestión de riesgo en forex con el sistema MRA.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption sobre gestión de riesgo, máximo 2200 caracteres",
  "hashtags": ["20 hashtags sin #"],
  "imagePrompts": ["portada gestión riesgo", "regla 1%", "stop loss MRA", "ratio R:P", "tamaño posición", "errores comunes", "caso real", "conclusión"]
}`,
  },

  recap_semanal: {
    tipo: "carrusel",
    needsImages: true,
    prompt: `Actúa como estratega senior de Instagram especializado en trading forex.

Genera un carrusel resumen semanal de 8 slides con resultados y setups de la semana. Transparencia total.

Responde ÚNICAMENTE con JSON:
{
  "caption": "recap semanal con resultados reales, máximo 2200 caracteres",
  "hashtags": ["20 hashtags sin #"],
  "imagePrompts": ["portada recap", "estadísticas semana", "mejor setup", "peor setup", "lección 1", "lección 2", "próxima semana", "CTA"]
}`,
  },

  setup_mra: {
    tipo: "post",
    needsImages: true,
    prompt: `Actúa como copywriter viral especializado en finanzas y trading. Genera hooks que frenen el scroll.

Genera un post sobre el setup MRA del miércoles detectado en XAU/USD (oro). Score: 9/10.

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption del setup en oro con anticipación, máximo 2200 caracteres",
  "hashtags": ["20 hashtags sin #"],
  "imagePrompts": ["chart XAU/USD con el setup MRA marcado", "niveles objetivo y stop loss"]
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

  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    // "adaptive" is a live API feature; cast until SDK types catch up
    thinking: { type: "adaptive" } as unknown as { type: "enabled"; budget_tokens: number },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: template.prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";

  try {
    // Strip markdown code fences if present
    const jsonStr = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/)?.[1] ?? raw;
    const parsed = JSON.parse(jsonStr) as {
      caption?: unknown;
      hashtags?: unknown;
      imagePrompts?: unknown;
    };

    return {
      tipo: template.tipo,
      needsImages: template.needsImages,
      generated: {
        caption: String(parsed.caption ?? ""),
        hashtags: Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]) : [],
        imagePrompts: Array.isArray(parsed.imagePrompts) ? (parsed.imagePrompts as string[]) : [],
      },
    };
  } catch {
    log.warn("No se pudo parsear JSON — usando texto raw como caption");
    return {
      tipo: template.tipo,
      needsImages: false,
      generated: {
        caption: raw,
        hashtags: (raw.match(/#(\w+)/g) ?? []).map((h) => h.slice(1)),
        imagePrompts: [],
      },
    };
  }
}
