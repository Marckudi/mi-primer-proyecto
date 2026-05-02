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

interface Candle { o: number; h: number; l: number; c: number; }

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

// Candle colors are always fixed regardless of badge accent
const CANDLE_BULL = "#C8972A"; // gold — alcista
const CANDLE_BEAR = "#ffffff"; // white — bajista

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

function fitHeadline(headline: string, availableWidth: number): { lines: string[]; fontSize: number; lineH: number } {
  const FACTOR = 0.75;
  for (const fontSize of [86, 74, 64, 56, 48, 40]) {
    const maxChars  = Math.floor(availableWidth / (fontSize * FACTOR));
    const lines     = wrapText(headline, maxChars);
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

/**
 * Generates a realistic bullish-breakout OHLC sequence.
 * Phase 1: Asian ranging. Phase 2: Pre-London support. Phase 3: London breakout.
 */
function generateCandles(entry: number, stop: number, target: number, N = 15): Candle[] {
  const range  = Math.abs(target - entry) + Math.abs(entry - stop);
  const tick   = range / 120;
  const candles: Candle[] = [];

  let price = stop + (entry - stop) * 0.4;
  for (let i = 0; i < 5; i++) {
    const drift = (Math.random() - 0.52) * tick * 3;
    const o = price;
    const c = o + drift;
    const h = Math.max(o, c) + tick * (0.5 + Math.random());
    const l = Math.min(o, c) - tick * (0.5 + Math.random());
    candles.push({ o: +o.toFixed(5), h: +h.toFixed(5), l: +Math.max(l, stop - tick).toFixed(5), c: +c.toFixed(5) });
    price = c;
  }

  price = stop + (entry - stop) * 0.15;
  for (let i = 0; i < 3; i++) {
    const o = price;
    const c = o + tick * (0.5 + Math.random() * 1.5);
    const h = Math.max(o, c) + tick * 0.8;
    const l = Math.min(o, c) - tick * (0.3 + Math.random() * 0.5);
    candles.push({ o: +o.toFixed(5), h: +h.toFixed(5), l: +Math.max(l, stop - tick * 0.5).toFixed(5), c: +c.toFixed(5) });
    price = c;
  }

  price = entry - tick;
  const remaining = N - 8;
  for (let i = 0; i < remaining; i++) {
    const progress   = i / remaining;
    const bullBias   = tick * (3 + progress * 4);
    const o = price;
    const c = o + bullBias * (0.7 + Math.random() * 0.6);
    const h = Math.max(o, c) + tick * (0.5 + Math.random());
    const l = Math.min(o, c) - tick * (0.2 + Math.random() * 0.4);
    const isBearPullback = i > 0 && i % 3 === 2;
    const finalC = isBearPullback ? o - tick * (0.8 + Math.random()) : c;
    candles.push({
      o: +o.toFixed(5),
      h: +(isBearPullback ? Math.max(o, c) + tick * 0.3 : h).toFixed(5),
      l: +(isBearPullback ? Math.min(o, finalC) - tick * 0.5 : l).toFixed(5),
      c: +Math.min(finalC, target + tick * 2).toFixed(5),
    });
    price = finalC;
  }

  return candles;
}

/** Renders OHLC candles + price level lines as SVG. */
function buildCandleChart(
  candles: Candle[],
  chartX: number, chartY: number,
  chartW: number, chartH: number,
  levelEntry?: number,
  levelStop?: number,
  levelTarget?: number,
): string {
  const prices = candles.flatMap((c) => [c.h, c.l]);
  const pMin   = Math.min(...prices) - (Math.max(...prices) - Math.min(...prices)) * 0.05;
  const pMax   = Math.max(...prices) + (Math.max(...prices) - Math.min(...prices)) * 0.05;
  const toY    = (p: number) => chartY + chartH - ((p - pMin) / (pMax - pMin)) * chartH;

  const N    = candles.length;
  const slot = chartW / N;
  const bw   = Math.max(Math.floor(slot * 0.55), 4);
  const parts: string[] = [];

  // Candles — bullish=gold, bearish=white
  candles.forEach((c, i) => {
    const cx     = chartX + i * slot + slot / 2;
    const isBull = c.c >= c.o;
    const color  = isBull ? CANDLE_BULL : CANDLE_BEAR;
    const bTop   = toY(Math.max(c.o, c.c));
    const bBot   = toY(Math.min(c.o, c.c));
    const bH     = Math.max(bBot - bTop, 1.5);
    const bodyOp = isBull ? "0.72" : "0.45";
    const wickOp = (parseFloat(bodyOp) * 0.5).toFixed(2);
    parts.push(
      `<line x1="${cx.toFixed(1)}" y1="${toY(c.h).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${toY(c.l).toFixed(1)}" stroke="${color}" stroke-width="1.5" opacity="${wickOp}"/>`,
      `<rect x="${(cx - bw / 2).toFixed(1)}" y="${bTop.toFixed(1)}" width="${bw}" height="${bH.toFixed(1)}" fill="${color}" opacity="${bodyOp}" rx="1"/>`,
    );
  });

  // Price level lines
  const inBounds = (p: number) => p >= pMin && p <= pMax;
  if (levelStop   !== undefined && inBounds(levelStop)) {
    const y = toY(levelStop).toFixed(1);
    parts.push(
      `<line x1="${chartX}" y1="${y}" x2="${chartX + chartW}" y2="${y}" stroke="#E8553E" stroke-width="1.5" stroke-dasharray="8,4" opacity="0.55"/>`,
      `<text x="${chartX + chartW - 6}" y="${(parseFloat(y) - 5).toFixed(0)}" text-anchor="end" font-family="Arial,sans-serif" font-size="19" fill="#E8553E" opacity="0.65">SL</text>`,
    );
  }
  if (levelEntry  !== undefined && inBounds(levelEntry)) {
    const y = toY(levelEntry).toFixed(1);
    parts.push(
      `<line x1="${chartX}" y1="${y}" x2="${chartX + chartW}" y2="${y}" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="8,4" opacity="0.50"/>`,
      `<text x="${chartX + chartW - 6}" y="${(parseFloat(y) - 5).toFixed(0)}" text-anchor="end" font-family="Arial,sans-serif" font-size="19" fill="#ffffff" opacity="0.55">ENTRADA</text>`,
    );
  }
  if (levelTarget !== undefined && inBounds(levelTarget)) {
    const y = toY(levelTarget).toFixed(1);
    parts.push(
      `<line x1="${chartX}" y1="${y}" x2="${chartX + chartW}" y2="${y}" stroke="#C8972A" stroke-width="1.5" stroke-dasharray="8,4" opacity="0.65"/>`,
      `<text x="${chartX + chartW - 6}" y="${(parseFloat(y) - 5).toFixed(0)}" text-anchor="end" font-family="Arial,sans-serif" font-size="19" fill="#C8972A" opacity="0.70">TP</text>`,
    );
  }

  return parts.join("\n  ");
}

function parsePrice(v: string): number | null {
  const m = v.replace(/[$,€£]/g, "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function buildSVG(data: ImageData, W = 1080, H = 1080): string {
  const isReel   = H === 1920;
  const PAD      = 64;
  const contentW = W - PAD * 2;
  const accent   = accentFor(data.badge);
  const dateStr  = spanishDate();
  const padTop   = isReel ? 120 : 0;
  const scale    = isReel ? 1.35 : 1.0;

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
  const subY  = y;  const subLH = Math.round(44 * scale);  y += subLines.length * subLH + Math.round(44 * scale);

  const stats  = (data.stats ?? []).slice(0, 2);
  const stY    = y;  const stH = Math.round(132 * scale);
  if (stats.length) y += stH + Math.round(20 * scale);

  const annLines = data.annotation ? fitAnnotation(data.annotation, contentW - 44) : [];
  const annY     = y;  const annLH = Math.round(40 * scale);
  const annH     = annLines.length > 1 ? Math.round(86 * scale) : Math.round(62 * scale);
  if (annLines.length) y += annH + Math.round(18 * scale);

  const bullY = y;
  const bullLH = Math.round(42 * scale);

  // Extract price levels from stats + annotation for chart lines
  let levelEntry: number | undefined;
  let levelStop:  number | undefined;
  let levelTarget: number | undefined;
  if (stats.length >= 1) {
    const p = parsePrice(stats[0].value);
    if (p && p > 0.1) levelEntry = p;
  }
  const annText = data.annotation ?? "";
  const stopM   = annText.match(/[Ss]top[:\s]+([\d.]+)/);
  const tgtM    = annText.match(/[Tt]arget[:\s]+([\d.]+)/);
  if (stopM)  levelStop   = parseFloat(stopM[1]);
  if (tgtM)   levelTarget = parseFloat(tgtM[1]);
  // Fallback price levels
  const e = levelEntry ?? 1.0;
  if (!levelStop   && levelEntry) levelStop   = e * 0.98;
  if (!levelTarget && levelEntry) levelTarget = e * 1.03;

  // Chart background
  const chartTop  = isReel ? Math.round(H * 0.42) : Math.round(H * 0.36);
  const chartBot  = H - 80;
  const chartH_px = chartBot - chartTop;
  const candles   = generateCandles(levelEntry ?? e, levelStop ?? e * 0.98, levelTarget ?? e * 1.03, 15);
  const chartSvg  = buildCandleChart(candles, 0, chartTop, W, chartH_px, levelEntry, levelStop, levelTarget);

  const chartFadeId  = `cf_${W}x${H}`;
  const chartFadeDef = `
    <linearGradient id="${chartFadeId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#080604" stop-opacity="0.90"/>
      <stop offset="25%"  stop-color="#080604" stop-opacity="0.50"/>
      <stop offset="70%"  stop-color="#080604" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#080604" stop-opacity="0.60"/>
    </linearGradient>`;
  const chartOverlay = `<rect x="0" y="${chartTop}" width="${W}" height="${chartH_px}" fill="url(#${chartFadeId})"/>`;

  // Badge
  const badgeLabel = stripEmoji(`${data.badgeEmoji ?? ""} ${data.badge ?? "BREAKING"}`);
  const bTextW     = Math.min(Math.max(badgeLabel.length * 14 + 52, 130), contentW);

  // SVG fragments
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
  <rect x="${x}" y="${stY}" width="${boxW}" height="${stH}" rx="6" fill="#080604" fill-opacity="0.82"/>
  <rect x="${x}" y="${stY}" width="${boxW}" height="${stH}" rx="6" fill="#111111" fill-opacity="0.70"/>
  <text x="${x + 22}" y="${stY + 32}" font-family="Liberation Sans,Arial,sans-serif" font-size="17" font-weight="600" fill="#555555" letter-spacing="1">${escapeXml(s.label.toUpperCase())}</text>
  <text x="${x + 22}" y="${stY + stH - 22}" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="${vSize}" font-weight="900" fill="white">${escapeXml(s.value)}</text>`;
  }).join("");

  const annSvg = annLines.length ? `
  <rect x="${PAD}" y="${annY}" width="${contentW}" height="${annH}" rx="6" fill="#080604" fill-opacity="0.82"/>
  <rect x="${PAD}" y="${annY}" width="${contentW}" height="${annH}" rx="6" fill="#111111" fill-opacity="0.70"/>
  ${annLines.map((ln, i) =>
    `<text x="${PAD + 24}" y="${annY + 40 + i * annLH}" font-family="Liberation Sans,Arial,sans-serif" font-size="25" font-weight="600" fill="${accent}">${i === 0 ? "→ " : "  "}${escapeXml(ln)}</text>`
  ).join("\n  ")}` : "";

  const bullSvg = (data.bullets ?? []).map((b, i) => {
    const maxBullChars = Math.floor(contentW / (23 * 0.55));
    const txt = stripEmoji(b.length > maxBullChars ? b.slice(0, maxBullChars - 1) + "…" : b);
    return `<text x="${PAD}" y="${bullY + i * bullLH + 30}" font-family="Liberation Sans,Arial,sans-serif" font-size="23" fill="#666666">${escapeXml(txt)}</text>`;
  }).join("\n  ");

  // Depth design elements
  const motionStripe = `
  <polygon points="0,${H * 0.72} ${W * 0.28},${H} 0,${H}" fill="${accent}" fill-opacity="0.03"/>
  <polygon points="0,${H * 0.78} ${W * 0.18},${H} 0,${H}" fill="${accent}" fill-opacity="0.02"/>`;
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
    </radialGradient>${chartFadeDef}
  </defs>
  <rect width="${W}" height="${H}" fill="#080604"/>
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  ${chartSvg}
  ${chartOverlay}
  ${motionStripe}${scanLine}${leftEdge}
  <text x="${PAD}" y="${topBarY}" font-family="Liberation Sans,Arial Black,sans-serif" font-size="23" font-weight="900" fill="#C8972A" letter-spacing="3">ALPHAVISION.AI</text>
  <text x="${W - 196}" y="${topBarY}" font-family="Liberation Sans,Arial,sans-serif" font-size="20" fill="#505050">${escapeXml(dateStr)}</text>
  <circle cx="${W - 50}" cy="${topBarY - 7}" r="15" fill="none" stroke="${accent}" stroke-width="2"/>
  <circle cx="${W - 50}" cy="${topBarY - 7}" r="6" fill="${accent}"/>
  <rect x="${PAD}" y="${sepY}" width="${contentW}" height="1" fill="#1e1810"/>
  <rect x="${PAD}" y="${badgeRY}" width="${bTextW}" height="${bH}" rx="${bH / 2}" fill="${accent}" fill-opacity="0.15" stroke="${accent}" stroke-width="1.5"/>
  <text x="${PAD + bTextW / 2}" y="${badgeRY + 33}" text-anchor="middle" font-family="Liberation Sans,Arial Black,sans-serif" font-size="20" font-weight="900" fill="${accent}">${escapeXml(badgeLabel)}</text>
  ${hlSvg}
  <rect x="${PAD}" y="${divY}" width="220" height="2" rx="1" fill="${accent}"/>
  ${subSvg}
  ${statsSvg}
  ${annSvg}
  ${bullSvg}
  ${brackets}
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

    const inputArgs = framePaths.map((p) => `-loop 1 -t ${FRAME_DURATION} -i "${p}"`).join(" ");

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
