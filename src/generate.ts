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

const TEMPLATES: Record<Exclude<ContentType, "setup_manual">, Template> = {

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

/** Genera contenido directamente desde env vars — no llama a Claude para los imagePrompts */
async function generateSetupManual(): Promise<{ generated: GeneratedContent; tipo: PostTipo; needsImages: boolean }> {
  const pair      = process.env.SETUP_PAIR      || "EUR/USD";
  const direction = process.env.SETUP_DIRECTION || "COMPRA";
  const entry     = process.env.SETUP_ENTRY     || "1.0842";
  const stop      = process.env.SETUP_STOP      || "1.0808";
  const target    = process.env.SETUP_TARGET    || "1.0930";
  const score     = process.env.SETUP_SCORE     || "8";
  const session   = process.env.SETUP_SESSION   || "Londres";
  const format    = process.env.SETUP_FORMAT    || "reel";
  const tipo: PostTipo = format === "reel" ? "reel" : "post";

  // Calcular R:R
  const entryN = parseFloat(entry);
  const stopN  = parseFloat(stop);
  const tgtN   = parseFloat(target);
  const rr     = Math.abs(tgtN - entryN) > 0 && Math.abs(entryN - stopN) > 0
    ? (Math.abs(tgtN - entryN) / Math.abs(entryN - stopN)).toFixed(1)
    : "?";

  const badge = pair.includes("XAU") || pair.includes("GOLD") ? "GOLD ALERT" : "SEÑAL MRA";

  const imagePrompt = JSON.stringify({
    badge,
    headline: `${direction.toUpperCase()} ${pair} SESION ${session.toUpperCase()}`,
    subtitle: `Score MRA: ${score}/10. Ventana activa.`,
    stats: [
      { label: "ENTRADA", value: entry },
      { label: "SCORE MRA", value: `${score} / 10` },
    ],
    annotation: `Stop: ${stop} — Target: ${target} — R:R ${rr}`,
    bullets: [
      `Sesion ${session} 07:55 - 10:40 CET`,
      `${pair} ${direction} — confluencia MRA confirmada`,
      `Stop: ${stop} | Target: ${target} | R:R ${rr}`,
      `AURA activa alerta de voz en entrada`,
    ],
  });

  // Usar Claude solo para el caption
  const news  = await fetchCurrentNews();
  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const context = news ? `NOTICIAS (${today}):\n${news}\n\n` : `FECHA: ${today}\n\n`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `${context}Genera SOLO el caption y hashtags (sin imagePrompts) para este setup MRA real:\n` +
        `Par: ${pair} | Dirección: ${direction} | Entrada: ${entry} | Stop: ${stop} | Target: ${target} | Score: ${score}/10 | Sesión: ${session}\n\n` +
        `Responde ÚNICAMENTE con JSON:\n{\n  "caption": "caption viral con los datos exactos, máx 2200 chars",\n  "hashtags": ["máximo 5 hashtags sin #"]\n}`,
    }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";

  let caption  = `${direction} ${pair} — Score MRA ${score}/10 — Stop: ${stop} | Target: ${target}`;
  let hashtags = ["trading", "forex", "tradingview", "forextrading", "alphavision"];

  try {
    const jsonStr = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/)?.[1] ?? raw;
    const parsed  = JSON.parse(jsonStr) as { caption?: unknown; hashtags?: unknown };
    if (parsed.caption)  caption  = String(parsed.caption);
    if (Array.isArray(parsed.hashtags)) hashtags = (parsed.hashtags as string[]).slice(0, 5);
  } catch {
    log.warn("No se pudo parsear JSON del caption — usando fallback");
  }

  // Reels: 5 frames (intro + 4 variaciones del mismo setup)
  const imagePrompts = tipo === "reel"
    ? [
        imagePrompt,
        JSON.stringify({ badge, headline: `ENTRADA CONFIRMADA ${pair}`, subtitle: `Sesion ${session}. Score ${score}/10.`, stats: [{ label: "ENTRADA", value: entry }, { label: "R:R", value: rr }], annotation: `Stop: ${stop} — Target: ${target}` }),
        JSON.stringify({ badge, headline: `STOP: ${stop}`, subtitle: "Nivel de invalidación del setup.", stats: [{ label: "RIESGO", value: `${Math.abs(entryN - stopN).toFixed(4)}` }, { label: "PIPS", value: `${Math.round(Math.abs(entryN - stopN) * 10000)}` }], annotation: `Gestión de riesgo: nunca más del 1% del capital` }),
        JSON.stringify({ badge, headline: `TARGET: ${target}`, subtitle: "Nivel de toma de beneficios.", stats: [{ label: "TARGET", value: target }, { label: "BENEFICIO", value: `${Math.abs(tgtN - entryN).toFixed(4)}` }], annotation: `R:R ${rr} — AlphaVision AI` }),
        JSON.stringify({ badge: "ALPHAVISION AI", headline: "SIGUE LOS SETUPS EN TIEMPO REAL", subtitle: "Activa las notificaciones para no perderte nada.", annotation: "Comenta MRA para recibir info por DM", bullets: ["Score MRA diario", "Ventana: 07:55 - 10:40 CET", "AURA alerta de voz en tiempo real"] }),
      ]
    : [imagePrompt];

  return { tipo, needsImages: true, generated: { caption, hashtags, imagePrompts } };
}

export async function generateContent(contentType: ContentType): Promise<{
  generated: GeneratedContent;
  tipo: PostTipo;
  needsImages: boolean;
}> {
  if (contentType === "setup_manual") {
    log.info("Generando contenido: setup_manual (desde env vars)");
    return generateSetupManual();
  }

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
