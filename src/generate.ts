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
Formato de respuesta: JSON válido con los campos solicitados.

FORMATO ESPECIAL PARA imagePrompts:
Cada elemento del array imagePrompts debe ser un JSON string con exactamente esta estructura:
{"headline":"TITULAR IMPACTANTE EN MAYÚSCULAS (máx 55 chars)","subtitle":"subtítulo descriptivo en minúsculas con estilo monoespaciado","stats":[{"label":"NOMBRE DEL DATO","value":"valor numérico"},{"label":"NOMBRE DEL DATO 2","value":"valor2"}]}
Incluye siempre 2 stats con datos reales del contexto (precios, porcentajes, scores MRA, pips, etc.).
Ejemplo: {"headline":"EUR/USD SCORE MRA 9/10 — SETUP VALIDADO","subtitle":"ventana operativa: 08:12 CET · stop: 1.0842","stats":[{"label":"SCORE MRA","value":"9/10"},{"label":"PAR","value":"EUR/USD"}]}`;

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
  "imagePrompts": ["JSON string con headline/subtitle/stats del setup"]
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
  "imagePrompts": ["JSON frame 1", "JSON frame 2", "JSON frame 3", "JSON frame 4", "JSON frame 5"]
}`,
  },

  reel_viral: {
    tipo: "reel",
    needsImages: true,
    prompt: `Actúa como el mejor estratega de contenido viral de Instagram para finanzas. Tu objetivo es crear un reel que explote en el algoritmo en las primeras 24h.

Crea un REEL VIRAL de alto impacto para AlphaVision AI sobre un evento de mercado real y urgente (puede ser: Fed, BCE, NFP, CPI, movimiento brusco de oro o divisa, noticia macro relevante). 
Formato: breaking news financiero — urgente, datos reales, sin palabrería.
Audiencia: traders españoles 25-45 años, esceptícos pero curiosos.

Reglas del hook (primeros 3 segundos):
- Empieza con un dato concreto que sorprenda (“el mercado acaba de...”, “+120 pips en...”)
- Nunca empieces con “Hola” ni con pregunta
- Usa tensión: algo pasó, tiene consecuencias, tú debes saberlo

Estructura del reel (5 frames de imagen):
1. Breaking: el evento (titular impactante + dato clave)
2. Contexto: por qué importa ahora mismo
3. Reacción del mercado: qué está pasando con el precio
4. Setup MRA: cómo se posiciona AlphaVision AI ante esto
5. Cierre: resultado o próximo movimiento esperado

Responde ÚNICAMENTE con JSON:
{
  "caption": "caption ultra-viral con hook en primera línea, emojis estratégicos, CTA al final, máximo 2200 caracteres",
  "hashtags": ["25 hashtags sin # mezclando nicho, trending y marca"],
  "imagePrompts": ["JSON frame 1 breaking", "JSON frame 2 contexto", "JSON frame 3 mercado", "JSON frame 4 setup MRA", "JSON frame 5 cierre"]
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
  "imagePrompts": ["JSON slide 1", "JSON slide 2", "JSON slide 3", "JSON slide 4", "JSON slide 5", "JSON slide 6", "JSON slide 7", "JSON slide 8", "JSON slide 9", "JSON slide 10"]
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
  "imagePrompts": ["JSON frame 1", "JSON frame 2", "JSON frame 3", "JSON frame 4", "JSON frame 5"]
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
  "imagePrompts": ["JSON slide resultado", "JSON slide análisis técnico", "JSON slide lecciones"]
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
  "imagePrompts": ["JSON con headline del análisis y stats de niveles clave"]
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
  "imagePrompts": ["JSON intro", "JSON qué es Score MRA", "JSON escala 0-10", "JSON ejemplo score 8", "JSON ventana horaria", "JSON reglas de entrada", "JSON resumen"]
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
  "imagePrompts": ["JSON portada gestión riesgo", "JSON regla 1%", "JSON stop loss MRA", "JSON ratio R:P", "JSON tamaño posición", "JSON errores comunes", "JSON caso real", "JSON conclusión"]
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
  "imagePrompts": ["JSON portada recap", "JSON estadísticas semana", "JSON mejor setup", "JSON peor setup", "JSON lección 1", "JSON lección 2", "JSON próxima semana", "JSON CTA"]
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
  "imagePrompts": ["JSON setup XAU/USD con score 9/10", "JSON niveles objetivo y stop loss"]
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
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: template.prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";

  if (!raw) {
    log.warn("Respuesta de texto vacía de la API — usando fallback");
    return {
      tipo: template.tipo,
      needsImages: false,
      generated: { caption: "", hashtags: [], imagePrompts: [] },
    };
  }

  try {
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
