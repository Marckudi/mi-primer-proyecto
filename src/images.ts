import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { log } from "./logger.js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos");
  return createClient(url, key);
}

interface ImageData {
  headline: string;
  subtitle?: string;
  stats?: Array<{ label: string; value: string }>;
}

function parseImagePrompt(prompt: string): ImageData {
  try {
    const data = JSON.parse(prompt) as ImageData;
    return {
      headline: String(data.headline ?? prompt),
      subtitle: data.subtitle ? String(data.subtitle) : undefined,
      stats: Array.isArray(data.stats) ? data.stats : undefined,
    };
  } catch {
    return { headline: prompt };
  }
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length <= maxChars) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateBreakingNewsSVG(data: ImageData): string {
  const W = 1080;
  const H = 1080;

  // Headline sizing
  const headlineLines = wrapText(data.headline, 18);
  const fontSize =
    headlineLines.length <= 2 ? 96 :
    headlineLines.length === 3 ? 82 :
    headlineLines.length === 4 ? 68 : 58;
  const lineHeight = fontSize * 1.12;
  const headlineY = 215;

  const headlineSvg = headlineLines
    .map((line, i) =>
      `<text x="60" y="${headlineY + i * lineHeight}" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="${fontSize}" font-weight="900" fill="white">${escapeXml(line)}</text>`
    )
    .join("\n  ");

  // Subtitle
  const subtitleY = headlineY + headlineLines.length * lineHeight + 52;
  const subtitleLines = data.subtitle ? wrapText(data.subtitle, 50) : [];
  const subtitleSvg = subtitleLines
    .map((line, i) =>
      `<text x="60" y="${subtitleY + i * 40}" font-family="Liberation Mono,Courier New,monospace" font-size="29" fill="#888888">${escapeXml(line)}</text>`
    )
    .join("\n  ");

  // Stats boxes pinned to bottom
  const statsY = 882;
  const stats = (data.stats ?? []).slice(0, 2);
  const statsSvg = stats
    .map((stat, i) => {
      const x = 60 + i * 490;
      return `
  <rect x="${x}" y="${statsY}" width="460" height="152" rx="4" fill="#141414"/>
  <rect x="${x}" y="${statsY}" width="4" height="152" rx="2" fill="#C0392B"/>
  <text x="${x + 22}" y="${statsY + 44}" font-family="Liberation Sans,Arial,sans-serif" font-size="19" font-weight="600" fill="#666666" letter-spacing="2">${escapeXml(stat.label.toUpperCase())}</text>
  <text x="${x + 22}" y="${statsY + 120}" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="62" font-weight="900" fill="white">${escapeXml(stat.value)}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="vignette" cx="82%" cy="4%" r="66%">
      <stop offset="0%" stop-color="#2e0a07"/>
      <stop offset="100%" stop-color="#060606"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#080808"/>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>

  <!-- Brand -->
  <text x="60" y="88" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="28" font-weight="900" fill="#E8553E" letter-spacing="2">ALPHAVISION.AI</text>

  <!-- Breaking badge -->
  <rect x="808" y="48" width="218" height="54" rx="27" fill="#1c1c1c"/>
  <circle cx="836" cy="75" r="7" fill="#D44"/>
  <text x="852" y="81" font-family="Liberation Sans,Arial Black,sans-serif" font-size="19" font-weight="900" fill="white">&#x26A1; BREAKING</text>

  <!-- Headline -->
  ${headlineSvg}

  <!-- Subtitle -->
  ${subtitleSvg}

  <!-- Stats -->
  ${statsSvg}
</svg>`;
}

export async function generateAndUploadImages(prompts: string[]): Promise<string[]> {
  const urls: string[] = [];
  const supabase = getSupabase();

  for (const prompt of prompts.slice(0, 5)) {
    log.info(`Generando imagen breaking news: ${prompt.substring(0, 70)}...`);

    try {
      const data = parseImagePrompt(prompt);
      const svg = generateBreakingNewsSVG(data);
      const imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

      const filename = `instagram/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.png`;

      const { data: uploadData, error } = await supabase.storage
        .from("instagram-media")
        .upload(filename, imageBuffer, { contentType: "image/png", cacheControl: "3600" });

      if (error) {
        log.error(`Error subiendo imagen a Supabase: ${error.message}`);
        continue;
      }

      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from("instagram-media")
          .getPublicUrl(filename);
        urls.push(urlData.publicUrl);
        log.ok(`Imagen lista: ${urlData.publicUrl}`);
      }
    } catch (err) {
      log.error(`Error en imagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return urls;
}
