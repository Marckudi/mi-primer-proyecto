import "dotenv/config";
import { getTodaySchedule, getDateKey } from "./calendar.js";
import { generateContent } from "./generate.js";
import { generateAndUploadImages, generateAndUploadReelVideo } from "./images.js";
import { publishToInstagram } from "./instagram.js";
import { log } from "./logger.js";
import type { ContentType } from "./types.js";

const SLOT_WINDOW_MINUTES = 90;
const FORCE_ALL = process.env.FORCE_ALL_SLOTS === "true";
const CONTENT_TYPE_OVERRIDE = process.env.CONTENT_TYPE_OVERRIDE as ContentType | undefined;

function getActiveSlots(schedule: Record<string, ContentType>, now: Date): [string, ContentType][] {
  if (FORCE_ALL) {
    log.info("Modo forzado: procesando todos los slots del día");
    return Object.entries(schedule);
  }
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return Object.entries(schedule).filter(([hora]) => {
    const [h, m] = hora.split(":").map(Number);
    return Math.abs(h * 60 + m - nowMinutes) <= SLOT_WINDOW_MINUTES;
  });
}

async function processSlot(contentType: ContentType): Promise<string> {
  const { generated, tipo, needsImages } = await generateContent(contentType);

  let mediaUrls: string[] = [];
  if (needsImages && generated.imagePrompts.length > 0) {
    mediaUrls = tipo === "reel"
      ? await generateAndUploadReelVideo(generated.imagePrompts)
      : await generateAndUploadImages(generated.imagePrompts);
  }

  if (mediaUrls.length === 0) throw new Error("Sin media para publicar");

  return publishToInstagram(tipo, generated.caption, generated.hashtags, mediaUrls);
}

async function main(): Promise<void> {
  log.info("══════════════════════════════════════════════");
  log.info("  AlphaVision AI — Instagram Auto-Publish");
  log.info("══════════════════════════════════════════════");

  if (CONTENT_TYPE_OVERRIDE) {
    log.info(`Modo override: ejecutando directamente → ${CONTENT_TYPE_OVERRIDE}`);
    const postId = await processSlot(CONTENT_TYPE_OVERRIDE);
    log.ok(`✅ Publicado: ${CONTENT_TYPE_OVERRIDE} → ID ${postId}`);
    return;
  }

  const now = new Date();
  const today = getDateKey(now);
  const schedule = getTodaySchedule(now);
  const activeSlots = getActiveSlots(schedule, now);

  if (activeSlots.length === 0) {
    log.info(`No hay slots activos ahora (${now.toUTCString()})`);
    log.info(`Slots de hoy: ${JSON.stringify(schedule)}`);
    log.info("Para forzar todos los slots usa: Run workflow → force_all = true");
    return;
  }

  log.info(`Fecha: ${today} | Slots activos: ${activeSlots.map(([h, t]) => `${h}→${t}`).join(", ")}`);

  for (const [hora, contentType] of activeSlots) {
    log.info(`Procesando slot ${hora} (${contentType})...`);
    try {
      const postId = await processSlot(contentType);
      log.ok(`✅ Publicado: ${hora} → ID ${postId}`);
    } catch (err) {
      log.error(`Error en slot ${hora}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log.info("══════════════════════════════════════════════");
  log.info("  Ciclo completado");
  log.info("══════════════════════════════════════════════");
}

main().catch((err) => { console.error("[FATAL]", err); process.exit(1); });
