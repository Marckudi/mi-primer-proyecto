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
  "GOLD":     "#C8972A",
  "BREAKING": "#E8553E",
  "CRYPTO":   "#00B4D8",
  "MACRO":    "#8B5CF6",
  "SEÑAL":    "#10B981",
  "MRA":      "#10B981",
  "FOREX":    "#F59E0B",
  "ANÁLISIS": "#3B82F6",
  "EDUCACI":  "#3B82F6",
  "ALPHA":    "#C8972A",
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
      badge:      data.badge      ? String(data.badge)      : undefined,
      badgeEmoji: data.badgeEmoji ? String(data.badgeEmoji) : undefined,
      headline:   String(data.headline ?? prompt),
      subtitle:   data.subtitle   ? String(data.subtitle)   : undefined,
      stats:      Array.isArray(data.stats)   ? data.stats              : undefined,
      annotation: data.annotation ? String(data.annotation) : undefined,
      bullets:    Array.isArray(data.bullets) ? data.bullets.slice(0, 4) : undefined,
    };
  } catch {
    return { headline: prompt };
  }
}

// Strip emoji so they don't render as □ boxes in Liberation Sans
function stripEmoji(text: string): string {
  return text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, "").trim();
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

/**
 * Wraps text so each line fits within `maxChars` characters.
 */
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

/**
 * Iteratively find the best font size + line wrapping so the headline
 * never overflows the canvas. Uses a pixel-width estimate per character
 * (0.58 × fontSize for bold uppercase Liberation Sans).
 */
function fitHeadline(headline: string, availableWidth: number): {
  lines: string[];
  fontSize: number;
  lineH: number;
} {
  const candidates = [86, 74, 64, 56, 48, 40];
  for (const fontSize of candidates) {
    const avgCharPx = fontSize * 0.60;          // conservative estimate for bold caps
    const maxChars  = Math.floor(availableWidth / avgCharPx);
    const lines     = wrapText(headline, maxChars);
    // Accept if ≤5 lines and the longest line stays within bounds
    const longest   = Math.max(...lines.map((l) => l.length));
    if (longest * avgCharPx <= availableWidth && lines.length <= 5) {
      return { lines, fontSize, lineH: fontSize * 1.15 };
    }
  }
  // Ultimate fallback: truncate
  const fontSize = 40;
  const maxChars = Math.floor(availableWidth / (fontSize * 0.60));
  return {
    lines:    wrapText(headline.slice(0, maxChars * 4), maxChars),
    fontSize,
    lineH:    fontSize * 1.15,
  };
}

/**
 * Wraps annotation text to max 2 lines so it never overflows the row.
 */
function fitAnnotation(text: string, availableWidth: number): string[] {
  const avgCharPx = 25 * 0.60;   // font-size 25, normal weight
  const maxChars  = Math.floor(availableWidth / avgCharPx);
  const lines     = wrapText(text, maxChars);
  return lines.slice(0, 2);       // cap at 2 lines
}

function buildSVG(data: ImageData, W = 1080, H = 1080): string {
  const isReel   = H === 1920;
  const padTop   = isReel ? 300 : 0;
  const PAD      = 64;                       // horizontal padding both sides
  const contentW = W - PAD * 2;             // 952 px available
  const accent   = accentFor(data.badge);
  const dateStr  = spanishDate();

  // ── Headline ───────────────────────────────────────────────────────────
  const { lines: hlLines, fontSize: hlSize, lineH: hlLineH } =
    fitHeadline(data.headline, contentW);

  // ── Cascade Y layout ───────────────────────────────────────────────────────────
  let y = 72 + padTop;

  const topBarY  = y + 10;                y += 52;
  const sepY     = y;                     y += 24;
  const badgeRY  = y;  const bH = 50;    y += bH + 44;
  const hlY      = y + hlSize;           y += hlLines.length * hlLineH + 36;
  const divY     = y;                    y += 28;

  const subLines  = data.subtitle ? wrapText(data.subtitle, Math.floor(contentW / (29 * 0.52))) : [];
  const subY      = y;  const subLH = 44;  y += subLines.length * subLH + 44;

  const stats     = (data.stats ?? []).slice(0, 2);
  const stY       = y;  const stH = 132;
  if (stats.length) y += stH + 20;

  const annLines  = data.annotation ? fitAnnotation(data.annotation, contentW - 44) : [];
  const annY      = y;  const annLH = 40;  const annH = annLines.length > 1 ? 86 : 62;
  if (annLines.length) y += annH + 18;

  const bullY     = y;

  // ── Badge ───────────────────────────────────────────────────────────────
  const badgeLabel = stripEmoji(`${data.badgeEmoji ?? ""} ${data.badge ?? "BREAKING"}`);
  const bTextW     = Math.min(Math.max(badgeLabel.length * 14 + 52, 130), contentW);

  // ── SVG fragments ───────────────────────────────────────────────────────────
  const hlSvg = hlLines.map((ln, i) =>
    `<text x="${PAD}" y="${hlY + i * hlLineH}" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="${hlSize}" font-weight="900" fill="white">${escapeXml(ln)}</text>`
  ).join("\n  ");

  const subSvg = subLines.map((ln, i) =>
    `<text x="${PAD}" y="${subY + i * subLH}" font-family="Liberation Sans,Arial,sans-serif" font-size="29" font-style="italic" fill="#888888">${escapeXml(ln)}</text>`
  ).join("\n  ");

  const boxW = stats.length === 2 ? Math.floor((contentW - 20) / 2) : contentW;
  const statsSvg = stats.map((s, i) => {
    const x     = PAD + i * (boxW + 20);
    const vSize = s.value.length > 7 ? 46 : s.value.length > 5 ? 54 : 62;
    return `
  <rect x="${x}" y="${stY}" width="${boxW}" height="${stH}" rx="6" fill="#111111"/>
  <text x="${x + 22}" y="${stY + 32}" font-family="Liberation Sans,Arial,sans-serif" font-size="17" font-weight="600" fill="#555555" letter-spacing="1">${escapeXml(s.label.toUpperCase())}</text>
  <text x="${x + 22}" y="${stY + stH - 18}" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="${vSize}" font-weight="900" fill="white">${escapeXml(s.value)}</text>`;
  }).join("");

  const annSvg = annLines.length ? `
  <rect x="${PAD}" y="${annY}" width="${contentW}" height="${annH}" rx="6" fill="#111111"/>
  ${annLines.map((ln, i) =>
    `<text x="${PAD + 24}" y="${annY + 40 + i * annLH}" font-family="Liberation Sans,Arial,sans-serif" font-size="25" font-weight="600" fill="${accent}">${i === 0 ? "→ " : "  "}${escapeXml(ln)}</text>`
  ).join("\n  ")}` : "";

  const bullSvg = (data.bullets ?? []).map((b, i) => {
    const maxBullChars = Math.floor(contentW / (23 * 0.52));
    const txt = stripEmoji(b.length > maxBullChars ? b.slice(0, maxBullChars - 1) + "…" : b);
    return `<text x="${PAD}" y="${bullY + i * 42 + 30}" font-family="Liberation Sans,Arial,sans-serif" font-size="23" fill="#666666">${escapeXml(txt)}</text>`;
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
  <text x="${PAD}" y="${topBarY}" font-family="Liberation Sans,Arial Black,sans-serif" font-size="23" font-weight="900" fill="#C8972A" letter-spacing="3">ALPHAVISION.AI</text>
  <text x="${W - 196}" y="${topBarY}" font-family="Liberation Sans,Arial,sans-serif" font-size="20" fill="#505050">${escapeXml(dateStr)}</text>
  <circle cx="${W - 50}" cy="${topBarY - 7}" r="15" fill="none" stroke="${accent}" stroke-width="2"/>
  <circle cx="${W - 50}" cy="${topBarY - 7}" r="6" fill="${accent}"/>
  <!-- separator -->
  <rect x="${PAD}" y="${sepY}" width="${contentW}" height="1" fill="#1e1810"/>
  <!-- badge -->
  <rect x="${PAD}" y="${badgeRY}" width="${bTextW}" height="${bH}" rx="${bH / 2}" fill="${accent}" fill-opacity="0.15" stroke="${accent}" stroke-width="1.5"/>
  <text x="${PAD + bTextW / 2}" y="${badgeRY + 33}" text-anchor="middle" font-family="Liberation Sans,Arial Black,sans-serif" font-size="20" font-weight="900" fill="${accent}">${escapeXml(badgeLabel)}</text>
  <!-- headline -->
  ${hlSvg}
  <!-- gold divider -->
  <rect x="${PAD}" y="${divY}" width="220" height="2" rx="1" fill="${accent}"/>
  <!-- subtitle -->
  ${subSvg}
  <!-- stats -->
  ${statsSvg}
  <!-- annotation -->
  ${annSvg}
  <!-- bullets -->
  ${bullSvg}
  <!-- watermark -->
  <text x="${W - PAD + 8}" y="${H - 34}" text-anchor="end" font-family="Liberation Sans,Arial,sans-serif" font-size="21" fill="#2e2820">@alphavision.ai</text>
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
  for (const prompt of prompts.slice(0, 10)) {
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
