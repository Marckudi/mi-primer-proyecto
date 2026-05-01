import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";
import { log } from "./logger.js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos");
  return createClient(url, key);
}

interface ImageData {
  badge?: string;
  badgeEmoji?: string;
  headline: string;
  subtitle?: string;
  stats?: Array<{ label: string; value: string }>;
  annotation?: string;
  bullets?: string[];
}

const BADGE_ACCENT: Record<string, string> = {
  "GOLD":    "#C8972A",
  "BREAKING": "#E8553E",
  "CRYPTO":  "#00B4D8",
  "MACRO":   "#8B5CF6",
  "SEÑAL":   "#10B981",
  "MRA":     "#10B981",
  "FOREX":   "#F59E0B",
  "ANÁLISIS": "#3B82F6",
  "EDUCACI": "#3B82F6",
  "ALPHA":   "#C8972A",
};

function accentFor(badge?: string): string {
  if (!badge) return "#E8553E";
  const up = badge.toUpperCase();
  for (const [key, color] of Object.entries(BADGE_ACCENT)) {
    if (up.includes(key)) return color;
  }
  return "#C8972A";
}

function parseImagePrompt(prompt: string): ImageData {
  try {
    const data = JSON.parse(prompt) as ImageData;
    return {
      badge:       data.badge       ? String(data.badge)       : undefined,
      badgeEmoji:  data.badgeEmoji  ? String(data.badgeEmoji)  : undefined,
      headline:    String(data.headline ?? prompt),
      subtitle:    data.subtitle    ? String(data.subtitle)    : undefined,
      stats:       Array.isArray(data.stats)   ? data.stats             : undefined,
      annotation:  data.annotation  ? String(data.annotation)  : undefined,
      bullets:     Array.isArray(data.bullets) ? data.bullets.slice(0, 4) : undefined,
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
    if (test.length <= maxChars) { current = test; }
    else { if (current) lines.push(current); current = word; }
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

function spanishDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  return `${day} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function buildSVG(data: ImageData, W = 1080, H = 1080): string {
  const isReel  = H === 1920;
  const padTop  = isReel ? 300 : 0;
  const accent  = accentFor(data.badge);
  const accentDim = accent + "22"; // ~13% opacity fill for badge
  const dateStr = spanishDate();

  // ── Headline ──────────────────────────────────────────────────────────────
  const hlLines   = wrapText(data.headline, 22);
  const hlSize    = hlLines.length <= 2 ? 86 : hlLines.length === 3 ? 74 : hlLines.length === 4 ? 64 : 56;
  const hlLineH   = hlSize * 1.15;

  // ── Layout: cascade Y positions ──────────────────────────────────────────
  let y = 72 + padTop;

  const topBarTextY = y + 10;          y += 52;
  const sepY        = y;               y += 26;
  const badgeRY     = y;    const bH = 50;  y += bH + 44;
  const hlY         = y + hlSize;      y += hlLines.length * hlLineH + 38;
  const divY        = y;               y += 30;

  const subLines  = data.subtitle ? wrapText(data.subtitle, 46) : [];
  const subY      = y;  const subLH = 44;  y += subLines.length * subLH + 44;

  const stats     = (data.stats ?? []).slice(0, 2);
  const stY       = y;  const stH = 132;
  if (stats.length) y += stH + 20;

  const annY      = y;  const annH = 62;
  if (data.annotation) y += annH + 18;

  const bullY     = y;

  // ── Badge text ────────────────────────────────────────────────────────────
  const badgeLabel = `${data.badgeEmoji ?? ""} ${data.badge ?? "BREAKING"}`.trim();
  const bTextW     = Math.max(badgeLabel.length * 13 + 48, 120);

  // ── Headline SVG ─────────────────────────────────────────────────────────
  const hlSvg = hlLines.map((ln, i) =>
    `<text x="60" y="${hlY + i * hlLineH}" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="${hlSize}" font-weight="900" fill="white">${escapeXml(ln)}</text>`
  ).join("\n  ");

  // ── Subtitle SVG ─────────────────────────────────────────────────────────
  const subSvg = subLines.map((ln, i) =>
    `<text x="60" y="${subY + i * subLH}" font-family="Liberation Sans,Arial,sans-serif" font-size="29" font-style="italic" fill="#888888">${escapeXml(ln)}</text>`
  ).join("\n  ");

  // ── Stats boxes ──────────────────────────────────────────────────────────
  const boxW = stats.length === 2 ? 488 : 960;
  const statsSvg = stats.map((s, i) => {
    const x  = 60 + i * (boxW + 24);
    const vSize = s.value.length > 7 ? 46 : s.value.length > 5 ? 54 : 62;
    return `
  <rect x="${x}" y="${stY}" width="${boxW}" height="${stH}" rx="6" fill="#111111"/>
  <text x="${x + 22}" y="${stY + 32}" font-family="Liberation Sans,Arial,sans-serif" font-size="17" font-weight="600" fill="#555555" letter-spacing="1">${escapeXml(s.label.toUpperCase())}</text>
  <text x="${x + 22}" y="${stY + stH - 18}" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="${vSize}" font-weight="900" fill="white">${escapeXml(s.value)}</text>`;
  }).join("");

  // ── Annotation row ───────────────────────────────────────────────────────
  const annSvg = data.annotation ? `
  <rect x="60" y="${annY}" width="${W - 120}" height="${annH}" rx="6" fill="#111111"/>
  <text x="86" y="${annY + 40}" font-family="Liberation Sans,Arial,sans-serif" font-size="25" font-weight="600" fill="${accent}">→ ${escapeXml(data.annotation)}</text>` : "";

  // ── Bullets ──────────────────────────────────────────────────────────────
  const bullSvg = (data.bullets ?? []).map((b, i) => {
    const txt = b.length > 56 ? b.slice(0, 54) + "…" : b;
    return `<text x="60" y="${bullY + i * 40 + 30}" font-family="Liberation Sans,Arial,sans-serif" font-size="23" fill="#666666">${escapeXml(txt)}</text>`;
  }).join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bgGlow" cx="86%" cy="6%" r="58%">
      <stop offset="0%"   stop-color="#1c0f04"/>
      <stop offset="100%" stop-color="#080604"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#080604"/>
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  <!-- top bar -->
  <text x="60" y="${topBarTextY}" font-family="Liberation Sans,Arial Black,sans-serif" font-size="23" font-weight="900" fill="#C8972A" letter-spacing="3">ALPHAVISION.AI</text>
  <text x="${W - 192}" y="${topBarTextY}" font-family="Liberation Sans,Arial,sans-serif" font-size="20" fill="#505050">${escapeXml(dateStr)}</text>
  <circle cx="${W - 52}" cy="${topBarTextY - 7}" r="15" fill="none" stroke="${accent}" stroke-width="2"/>
  <circle cx="${W - 52}" cy="${topBarTextY - 7}" r="6" fill="${accent}"/>
  <!-- top separator -->
  <rect x="60" y="${sepY}" width="${W - 120}" height="1" fill="#1e1810"/>
  <!-- badge -->
  <rect x="60" y="${badgeRY}" width="${bTextW}" height="${bH}" rx="${bH / 2}" fill="${accentDim}" stroke="${accent}" stroke-width="1.5"/>
  <text x="${60 + bTextW / 2}" y="${badgeRY + 33}" text-anchor="middle" font-family="Liberation Sans,Arial Black,sans-serif" font-size="20" font-weight="900" fill="${accent}">${escapeXml(badgeLabel)}</text>
  <!-- headline -->
  ${hlSvg}
  <!-- divider -->
  <rect x="60" y="${divY}" width="210" height="2" rx="1" fill="${accent}"/>
  <!-- subtitle -->
  ${subSvg}
  <!-- stats -->
  ${statsSvg}
  <!-- annotation -->
  ${annSvg}
  <!-- bullets -->
  ${bullSvg}
  <!-- watermark -->
  <text x="${W - 56}" y="${H - 34}" text-anchor="end" font-family="Liberation Sans,Arial,sans-serif" font-size="21" fill="#2e2820">@alphavision.ai</text>
</svg>`;
}

async function uploadToSupabase(buffer: Buffer, filename: string, contentType: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("instagram-media")
    .upload(filename, buffer, { contentType, cacheControl: "3600" });
  if (error) { log.error(`Error subiendo a Supabase: ${error.message}`); return null; }
  if (data) {
    const { data: urlData } = supabase.storage.from("instagram-media").getPublicUrl(filename);
    return urlData.publicUrl;
  }
  return null;
}

export async function generateAndUploadImages(prompts: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const prompt of prompts.slice(0, 5)) {
    log.info(`Generando imagen: ${prompt.substring(0, 70)}...`);
    try {
      const data = parseImagePrompt(prompt);
      const svg  = buildSVG(data, 1080, 1080);
      const buf  = await sharp(Buffer.from(svg)).png().toBuffer();
      const filename = `instagram/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.png`;
      const url  = await uploadToSupabase(buf, filename, "image/png");
      if (url) { urls.push(url); log.ok(`Imagen lista: ${url}`); }
    } catch (err) {
      log.error(`Error en imagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return urls;
}

export async function generateAndUploadReelVideo(prompts: string[]): Promise<string[]> {
  const tmpDir = join(tmpdir(), `reel-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    const framePrompts = prompts.slice(0, 5);
    if (framePrompts.length === 0) return [];

    const framePaths: string[] = [];
    for (let i = 0; i < framePrompts.length; i++) {
      const data = parseImagePrompt(framePrompts[i]);
      const svg  = buildSVG(data, 1080, 1920);
      const buf  = await sharp(Buffer.from(svg)).png().toBuffer();
      const framePath = join(tmpDir, `frame${i}.png`);
      writeFileSync(framePath, buf);
      log.info(`Frame ${i + 1}/${framePrompts.length} generado`);
      framePaths.push(framePath);
    }

    const concatLines = framePaths.flatMap((p) => [`file '${p}'`, "duration 3"]);
    concatLines.push(`file '${framePaths[framePaths.length - 1]}'`);
    const concatPath = join(tmpDir, "concat.txt");
    writeFileSync(concatPath, concatLines.join("\n"));

    const videoPath = join(tmpDir, "reel.mp4");
    execSync(
      `ffmpeg -f concat -safe 0 -i "${concatPath}" ` +
      `-f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" ` +
      `-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -r 30 ` +
      `-c:a aac -b:a 128k -map 0:v -map 1:a -shortest ` +
      `-y "${videoPath}"`,
      { stdio: "pipe", timeout: 120_000 },
    );
    log.info("Video MP4 generado");

    const videoBuffer = readFileSync(videoPath);
    const filename = `instagram/reels/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.mp4`;
    const url = await uploadToSupabase(videoBuffer, filename, "video/mp4");
    if (url) { log.ok(`Video reel listo: ${url}`); return [url]; }
    return [];
  } catch (err) {
    log.error(`Error generando video: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
