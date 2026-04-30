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

function generateBreakingNewsSVG(data: ImageData, width = 1080, height = 1080): string {
  const W = width;
  const H = height;
  const padTop = height === 1920 ? 320 : 0; // extra top padding for vertical format

  const headlineLines = wrapText(data.headline, 18);
  const fontSize =
    headlineLines.length <= 2 ? 96 :
    headlineLines.length === 3 ? 82 :
    headlineLines.length === 4 ? 68 : 58;
  const lineHeight = fontSize * 1.12;
  const headlineY = 215 + padTop;

  const headlineSvg = headlineLines
    .map((line, i) =>
      `<text x="60" y="${headlineY + i * lineHeight}" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="${fontSize}" font-weight="900" fill="white">${escapeXml(line)}</text>`
    )
    .join("\n  ");

  const subtitleY = headlineY + headlineLines.length * lineHeight + 52;
  const subtitleLines = data.subtitle ? wrapText(data.subtitle, 50) : [];
  const subtitleSvg = subtitleLines
    .map((line, i) =>
      `<text x="60" y="${subtitleY + i * 40}" font-family="Liberation Mono,Courier New,monospace" font-size="29" fill="#888888">${escapeXml(line)}</text>`
    )
    .join("\n  ");

  const statsY = H - 198;
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
  <text x="60" y="${88 + padTop}" font-family="Liberation Sans,Arial Black,Impact,sans-serif" font-size="28" font-weight="900" fill="#E8553E" letter-spacing="2">ALPHAVISION.AI</text>
  <rect x="808" y="${48 + padTop}" width="218" height="54" rx="27" fill="#1c1c1c"/>
  <circle cx="836" cy="${75 + padTop}" r="7" fill="#D44"/>
  <text x="852" y="${81 + padTop}" font-family="Liberation Sans,Arial Black,sans-serif" font-size="19" font-weight="900" fill="white">&#x26A1; BREAKING</text>
  ${headlineSvg}
  ${subtitleSvg}
  ${statsSvg}
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
      const svg = generateBreakingNewsSVG(data);
      const imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
      const filename = `instagram/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.png`;
      const url = await uploadToSupabase(imageBuffer, filename, "image/png");
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

    // Generate 1080x1920 PNG frames (vertical Reel format)
    const framePaths: string[] = [];
    for (let i = 0; i < framePrompts.length; i++) {
      const data = parseImagePrompt(framePrompts[i]);
      const svg = generateBreakingNewsSVG(data, 1080, 1920);
      const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
      const framePath = join(tmpDir, `frame${i}.png`);
      writeFileSync(framePath, pngBuffer);
      log.info(`Frame ${i + 1}/${framePrompts.length} generado`);
      framePaths.push(framePath);
    }

    // ffmpeg concat list (each frame shown 3 seconds)
    const concatLines = framePaths.flatMap((p) => [`file '${p}'`, "duration 3"]);
    concatLines.push(`file '${framePaths[framePaths.length - 1]}'`); // required by concat demuxer
    const concatPath = join(tmpDir, "concat.txt");
    writeFileSync(concatPath, concatLines.join("\n"));

    // Build MP4 with ffmpeg
    const videoPath = join(tmpDir, "reel.mp4");
    execSync(
      `ffmpeg -f concat -safe 0 -i "${concatPath}" ` +
      `-f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" ` +
      `-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -r 30 ` +
      `-c:a aac -b:a 128k -map 0:v -map 1:a -shortest ` +
      `-y "${videoPath}"`,
      { stdio: "pipe", timeout: 120_000 },
    );
    log.info("Video MP4 generado con ffmpeg");

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
