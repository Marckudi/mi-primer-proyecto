import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0";
import OpenAI from "https://esm.sh/openai@4.28.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

// Shared system prompt — cached across all content generation calls
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

const DAY_NAMES: Record<number, string> = {
  0: "domingo",
  1: "lunes",
  2: "martes",
  3: "miercoles",
  4: "jueves",
  5: "viernes",
  6: "sabado",
};

serve(async (_req) => {
  try {
    console.log("[instagram-auto-publish] Iniciando...");

    const today = new Date();
    const dayOfWeek = DAY_NAMES[today.getDay()];
    console.log(`[Día: ${dayOfWeek}]`);

    const { data: calendarConfig } = await supabase
      .from("instagram_config")
      .select("value")
      .eq("key", "content_calendar")
      .single();

    const todaySchedule: Record<string, string> =
      (calendarConfig?.value as Record<string, Record<string, string>>)?.[
        dayOfWeek
      ] ?? {};

    console.log("[Calendario hoy]", todaySchedule);

    for (const [hora, tipo] of Object.entries(todaySchedule)) {
      console.log(`[Generando contenido: ${tipo} para ${hora}]`);

      const content = await generateContent(tipo);

      if (content.needsImages && content.imagePrompts.length > 0) {
        content.media_urls = await generateImages(content.imagePrompts);
      }

      const scheduledTime = new Date(today);
      const [hours, minutes] = hora.split(":");
      scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      await supabase.from("instagram_content").insert({
        tipo: content.tipo,
        caption: content.caption,
        hashtags: content.hashtags,
        media_urls: content.media_urls ?? [],
        scheduled_for: scheduledTime.toISOString(),
        status: "pending",
      });

      console.log(`[✅ ${tipo} programado para ${hora}]`);
    }

    await publishPendingContent();

    return new Response(
      JSON.stringify({ success: true, message: "Contenido generado y publicado" }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ERROR]", message);
    return new Response(
      JSON.stringify({ error: true, message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

interface ContentResult {
  tipo: string;
  caption: string;
  hashtags: string[];
  imagePrompts: string[];
  needsImages: boolean;
  media_urls: string[];
}

async function generateContent(tipo: string): Promise<ContentResult> {
  const { data: promptsConfig } = await supabase
    .from("instagram_config")
    .select("value")
    .eq("key", "prompts_virales")
    .single();

  const prompts = promptsConfig?.value as Record<string, string> ?? {};

  const templates: Record<
    string,
    { prompt: string; tipo: string; needsImages: boolean }
  > = {
    setup_del_dia: {
      tipo: "post",
      needsImages: true,
      prompt: `${prompts.copywriter ?? ""}

Genera contenido para un post de Instagram sobre un setup MRA detectado hoy en EUR/USD con Score 8/10.
Audiencia: traders españoles.

Responde con JSON:
{
  "caption": "caption completa con emojis, máximo 2200 caracteres",
  "hashtags": ["array", "de", "20", "hashtags", "sin", "el", "símbolo", "#"],
  "imagePrompts": ["descripción para imagen 1", "descripción para imagen 2"]
}`,
    },

    reel_setup: {
      tipo: "reel",
      needsImages: true,
      prompt: `${prompts.formato ?? ""}

Genera contenido para un REEL de Instagram mostrando un setup MRA en vivo.
Objetivo: engagement + autoridad.

Responde con JSON:
{
  "caption": "caption con hook viral, máximo 2200 caracteres",
  "hashtags": ["array", "de", "20", "hashtags", "sin", "#"],
  "imagePrompts": ["descripción frame 1 (0-3s)", "descripción frame 2 (3-6s)", "descripción frame 3 (6-9s)", "descripción frame 4 (9-12s)", "descripción frame 5 (12-15s)"]
}`,
    },

    carrusel_top3: {
      tipo: "carrusel",
      needsImages: true,
      prompt: `${prompts.retencion ?? ""}

Genera contenido para un carrusel de 10 slides: Top 3 setups de la semana con resultados reales.
Transparencia radical. Sin promesas de ganancias garantizadas.

Responde con JSON:
{
  "caption": "caption optimizada, máximo 2200 caracteres",
  "hashtags": ["array", "de", "20", "hashtags", "sin", "#"],
  "imagePrompts": ["texto slide 1", "texto slide 2", "texto slide 3", "texto slide 4", "texto slide 5", "texto slide 6", "texto slide 7", "texto slide 8", "texto slide 9", "texto slide 10"]
}`,
    },

    reel_preview: {
      tipo: "reel",
      needsImages: true,
      prompt: `${prompts.estratega ?? ""}

Genera contenido para un REEL de preview de la semana siguiente.
Incluye eventos macro importantes (BCE, PIB, NFP) si es domingo.

Responde con JSON:
{
  "caption": "caption con los eventos macro de la semana, máximo 2200 caracteres",
  "hashtags": ["array", "de", "20", "hashtags", "sin", "#"],
  "imagePrompts": ["descripción frame 1", "descripción frame 2", "descripción frame 3", "descripción frame 4", "descripción frame 5"]
}`,
    },

    analisis: {
      tipo: "carrusel",
      needsImages: true,
      prompt: `${prompts.copywriter ?? ""}

Genera un carrusel de análisis post-sesión MRA del día.
Muestra resultado real (ganancia o pérdida), sin manipulación.

Responde con JSON:
{
  "caption": "análisis transparente del día, máximo 2200 caracteres",
  "hashtags": ["array", "de", "15", "hashtags", "sin", "#"],
  "imagePrompts": ["slide resultado", "slide análisis técnico", "slide lecciones"]
}`,
    },
  };

  const template = templates[tipo] ?? templates["setup_del_dia"];

  // Use adaptive thinking for creative content generation — complex task
  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: template.prompt }],
  });

  // Extract the text block from the response (thinking blocks come first)
  const textBlock = message.content.find((b) => b.type === "text");
  const responseText = textBlock?.type === "text" ? textBlock.text : "";

  try {
    // Claude may wrap the JSON in markdown code fences — strip them
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ??
      [null, responseText];
    const parsed = JSON.parse(jsonMatch[1] ?? responseText);

    return {
      tipo: template.tipo,
      caption: String(parsed.caption ?? ""),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      imagePrompts: Array.isArray(parsed.imagePrompts)
        ? parsed.imagePrompts
        : [],
      needsImages: template.needsImages,
      media_urls: [],
    };
  } catch {
    // Fallback: store raw text and generate no images
    console.warn("[generateContent] No se pudo parsear JSON, usando texto raw");
    return {
      tipo: template.tipo,
      caption: responseText,
      hashtags: extractHashtags(responseText),
      imagePrompts: [],
      needsImages: false,
      media_urls: [],
    };
  }
}

async function generateImages(prompts: string[]): Promise<string[]> {
  const imageUrls: string[] = [];

  for (const prompt of prompts.slice(0, 5)) {
    // Max 5 images per post to control cost
    console.log(`[Generando imagen: ${prompt.substring(0, 60)}...]`);

    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt:
          `Professional Instagram post for AlphaVision AI trading platform. ${prompt}. ` +
          `Style: modern, clean, black and gold (#000000 / #FFD700), professional typography, Montserrat Bold.`,
        size: "1024x1024",
        quality: "hd",
        n: 1,
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) continue;

      // Download and upload to Supabase Storage
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();

      const filename = `instagram/${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.png`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("instagram-media")
        .upload(filename, imageBlob, {
          contentType: "image/png",
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("[Error subiendo imagen]", uploadError.message);
        continue;
      }

      if (uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from("instagram-media")
          .getPublicUrl(filename);

        imageUrls.push(publicUrlData.publicUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[Error generando imagen]", message);
    }
  }

  return imageUrls;
}

async function publishPendingContent(): Promise<void> {
  console.log("[Publicando contenido pendiente]");

  const now = new Date();

  const { data: pendingContent, error } = await supabase
    .from("instagram_content")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true });

  if (error) {
    console.error("[Error consultando pendientes]", error.message);
    return;
  }

  if (!pendingContent || pendingContent.length === 0) {
    console.log("[No hay contenido pendiente]");
    return;
  }

  for (const content of pendingContent) {
    try {
      console.log(`[Publicando: ${content.tipo} - ${content.id}]`);

      const postId = await publishToInstagram(content);

      await supabase
        .from("instagram_content")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          instagram_post_id: postId,
        })
        .eq("id", content.id);

      console.log(`[✅ Publicado: ${content.id}]`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Error publicando ${content.id}]`, message);

      await supabase
        .from("instagram_content")
        .update({ status: "failed" })
        .eq("id", content.id);
    }
  }
}

async function publishToInstagram(
  content: Record<string, unknown>,
): Promise<string> {
  const accessToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  const accountId = Deno.env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID");

  if (!accessToken || !accountId) {
    // Instagram Graph API not configured yet — log and return a placeholder
    console.log("[Instagram Graph API no configurada aún]");
    console.log("[Contenido a publicar]", {
      tipo: content.tipo,
      caption: String(content.caption ?? "").substring(0, 100) + "...",
      media_count: Array.isArray(content.media_urls)
        ? content.media_urls.length
        : 0,
    });
    return `ig_placeholder_${Date.now()}`;
  }

  // Instagram Graph API integration
  // See: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
  const mediaUrls = Array.isArray(content.media_urls) ? content.media_urls : [];
  const caption = String(content.caption ?? "");
  const hashtags = Array.isArray(content.hashtags)
    ? (content.hashtags as string[]).map((h) => `#${h}`).join(" ")
    : "";
  const fullCaption = `${caption}\n\n${hashtags}`.trim();

  if (mediaUrls.length === 0) {
    throw new Error("No hay imágenes para publicar");
  }

  if (content.tipo === "carrusel" && mediaUrls.length > 1) {
    // Step 1: create a media object for each image
    const mediaIds: string[] = [];
    for (const url of mediaUrls) {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${accountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: url,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        },
      );
      const data = await res.json() as { id?: string };
      if (data.id) mediaIds.push(data.id);
    }

    // Step 2: create the carousel container
    const carouselRes = await fetch(
      `https://graph.facebook.com/v18.0/${accountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: mediaIds,
          caption: fullCaption,
          access_token: accessToken,
        }),
      },
    );
    const carouselData = await carouselRes.json() as { id?: string };

    // Step 3: publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v18.0/${accountId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: accessToken,
        }),
      },
    );
    const publishData = await publishRes.json() as { id?: string };
    return publishData.id ?? `ig_post_${Date.now()}`;
  }

  // Single image post
  const mediaRes = await fetch(
    `https://graph.facebook.com/v18.0/${accountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: mediaUrls[0],
        caption: fullCaption,
        access_token: accessToken,
      }),
    },
  );
  const mediaData = await mediaRes.json() as { id?: string };

  const publishRes = await fetch(
    `https://graph.facebook.com/v18.0/${accountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: mediaData.id,
        access_token: accessToken,
      }),
    },
  );
  const publishData = await publishRes.json() as { id?: string };
  return publishData.id ?? `ig_post_${Date.now()}`;
}

function extractHashtags(text: string): string[] {
  return (text.match(/#(\w+)/g) ?? []).map((h) => h.slice(1));
}
