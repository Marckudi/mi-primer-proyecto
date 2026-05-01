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
 * Picks the largest font size where every line fits within availableWidth.
 * Factor 0.75 is conservative for bold uppercase Liberation Sans / Arial Black.
 */
function fitHeadline(headline: string, availableWidth: number): { lines: string[]; fontSize: number; lineH: number } {
  const FACTOR = 0.75;
  for (const fontSize of [86, 74, 64, 56, 48, 40]) {
    const maxChars = Math.floor(availableWidth / (fontSize * FACTOR));
    const lines    = wrapText(headline, maxChars);
    const longestPx = Math.max(...lines.map((l) => l.length)) * fontSize * FACTOR;
    if (longestPx <= availableWidth && lines.length <= 5) {
      return { lines, fontSize, lineH: fontSize * 1.15 };
    }
  }
  const fontSize = 40;
  return { lines: wrapText(headline, Math.floor(availableWidth / (fontSize * 0.75))), fontSize, lineH: fontSize * 1.15 };
}

function fitAnnotation(text: string, availableWidth: number): string[] {
  return wrapText(text, Math.floor(availableWidth / (25 * 0.60))).slice(0, 2);
}

function cornerBracket(x: number, y: number, size: number, color: string, flipX = false, flipY = false): string {
  const dx = flipX ? -size : size;
  const dy = flipY ? -size : size;
  return [
    `<line x1="${x}" y1="${y}" x2="${x + dx}" y2="${y}" stroke="${color}" stroke-width="2" opacity="0.45"/>`,
    `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + dy}" stroke="${color}" stroke-width="2" opacity="0.45"/>`,
  ].join("\n  ");
}

function buildSVG(data: ImageData, W = 1080, H = 1080): string {
  const isReel   = H === 1920;
  const PAD      = 64;
  const contentW = W - PAD * 2;
  const accent   = accentFor(data.badge);
  const dateStr  = spanishDate();

  // For reels the content block starts at ~8% from top (no big padTop)
  // so the design fills from top and the natural empty space is at the bottom
  // (covered by Instagram caption + controls in the actual app)
  const padTop = isReel ? 120 : 0;

  // Section spacing scales up for reels so content spreads over taller canvas
  const scale = isReel ? 1.35 : 1.0;

  const { lines: hlLines, fontSize: hlSize, lineH: hlLineH } = fitHeadline(data.headline, contentW);

  let y = 72 + padTop;
  const topBarY  = y + 10;                             y += Math.round(52  * scale);
  const sepY     = y;                                  y += Math.round(24  * scale);
  const badgeRY  = y;  const bH = 50;                 y += Math.round((bH + 44) * scale);
  const hlY      = y + hlSize;                         y += Math.round((hlLines.length * hlLineH + 36) * scale);
  const divY     = y;                                  y += Math.round(28  * scale);

  const subLines = data.subtitle
    ? wrapText(data.subtitle, Math.floor(contentW / (29 * 0.55)))
    : [];
  const subY    = y;  const subLH = Math.round(44 * scale);  y += subLines.length * subLH + Math.round(44 * scale);

  const stats   = (data.stats ?? []).slice(0, 2);
  const stY     = y;  const stH = Math.round(132 * scale);
  if (stats.length) y += stH + Math.round(20 * scale);

  const annLines = data.annotation ? fitAnnotation(data.annotation, contentW - 44) : [];
  const annY     = y;  const annLH = Math.round(40 * scale);
  const annH     = annLines.length > 1 ? Math.round(86 * scale) : Math.round(62 * scale);
  if (annLines.length) y += annH + Math.round(18 * scale);

  const bullY    = y;
  const bullLH   = Math.round(42 * scale);

  // Badge label (no emoji — Liberation Sans has no emoji glyphs)
  const badgeLabel = stripEmoji(`${data.badgeEmoji ?? ""} ${data.badge ?? "BREAKING"}`);
  const bTextW     = Math.min(Math.max(badgeLabel.length * 14 + 52, 130), contentW);

  // ─ SVG fragments ─────────────────────────────────────────────────────────
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
  <text x="${x + 22}" y="${stY + stH - 22}" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="${vSize}" font-weight="900" fill="white">${escapeXml(s.value)}</text>`;
  }).join("");

  const annSvg = annLines.length ? `
  <rect x="${PAD}" y="${annY}" width="${contentW}" height="${annH}" rx="6" fill="#111111"/>
  ${annLines.map((ln, i) =>
    `<text x="${PAD + 24}" y="${annY + 40 + i * annLH}" font-family="Liberation Sans,Arial,sans-serif" font-size="25" font-weight="600" fill="${accent}">${i === 0 ? "→ " : "  "}${escapeXml(ln)}</text>`
  ).join("\n  ")}` : "";

  const bullSvg = (data.bullets ?? []).map((b, i) => {
    const maxBullChars = Math.floor(contentW / (23 * 0.55));
    const txt = stripEmoji(b.length > maxBullChars ? b.slice(0, maxBullChars - 1) + "…" : b);
    return `<text x="${PAD}" y="${bullY + i * bullLH + 30}" font-family="Liberation Sans,Arial,sans-serif" font-size="23" fill="#666666">${escapeXml(txt)}</text>`;
  }).join("\n  ");

  // ─ Depth / 3D design elements ─────────────────────────────────────────
  const motionStripe = `
  <polygon points="0,${H * 0.72} ${W * 0.28},${H} 0,${H}" fill="${accent}" fill-opacity="0.04"/>
  <polygon points="0,${H * 0.78} ${W * 0.18},${H} 0,${H}" fill="${accent}" fill-opacity="0.03"/>`;
  const brackets = `
  ${cornerBracket(W - PAD, padTop + 40, 28, accent)}
  ${cornerBracket(PAD, H - 60, 28, accent, false, true)}`;
  const scanLine = `<rect x="0" y="${Math.round(H * 0.38)}" width="${W}" height="1" fill="${accent}" fill-opacity="0.05"/>`;
  const leftEdge = `<rect x="0" y="${padTop + 80}" width="3" height="${H - padTop - 120}" fill="${accent}" fill-opacity="0.25" rx="2"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bgGlow" cx="86%" cy="6%" r="58%">
      <stop offset="0%"   stop-color="#1c0f04"/>
      <stop offset="100%" stop-color="#080604"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#080604"/>
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  ${motionStripe}${scanLine}${leftEdge}
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
  <!-- corner brackets -->
  ${brackets}
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

// Transitions themed around AlphaVision AI:
//  zoomin      = zoom into the signal
//  squeezeh    = 3D horizontal flip (trade executing)
//  horzopen    = dashboard panel opening
//  circleclose = signal window closing
const REEL_TRANSITIONS = ["zoomin", "squeezeh", "horzopen", "circleclose"];

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
      const fp   = join(tmpDir, `frame${i}.png`);
      writeFileSync(fp, buf);
      framePaths.push(fp);
      log.info(`Frame ${i + 1}/${framePrompts.length} generado`);
    }

    const N                   = framePaths.length;
    const FRAME_DURATION      = 3.5;
    const TRANSITION_DURATION = 0.5;

    const inputArgs = framePaths
      .map((p) => `-loop 1 -t ${FRAME_DURATION} -i "${p}"`)
      .join(" ");

    const filterParts: string[] = [];
    for (let i = 0; i < N; i++) {
      filterParts.push(`[${i}:v]scale=1080:1920,fps=30,format=yuv420p[v${i}]`);
    }
    let prev = "v0";
    for (let i = 1; i < N; i++) {
      const transition = REEL_TRANSITIONS[(i - 1) % REEL_TRANSITIONS.length];
      const offset     = (i * (FRAME_DURATION - TRANSITION_DURATION)).toFixed(1);
      const next       = i === N - 1 ? "vout" : `xf${i}`;
      filterParts.push(`[${prev}][v${i}]xfade=transition=${transition}:duration=${TRANSITION_DURATION}:offset=${offset}[${next}]`);
      prev = next;
    }

    const videoPath = join(tmpDir, "reel.mp4");
    const cmd =
      `ffmpeg ${inputArgs} ` +
      `-f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" ` +
      `-filter_complex "${filterParts.join(";")}" ` +
      `-map "[vout]" -map "${N}:a" ` +
      `-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p ` +
      `-c:a aac -b:a 128k -shortest ` +
      `-y "${videoPath}"`;

    log.info("Ejecutando ffmpeg con transiciones 3D xfade...");
    execSync(cmd, { stdio: "pipe", timeout: 180_000 });
    log.info("Video MP4 con transiciones generado");

    const videoBuffer = readFileSync(videoPath);
    const filename    = `instagram/reels/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.mp4`;
    const url         = await uploadToSupabase(videoBuffer, filename, "video/mp4");
    if (url) { log.ok(`Video reel listo: ${url}`); return [url]; }
    return [];
  } catch (err) {
    log.error(`Error generando video: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
