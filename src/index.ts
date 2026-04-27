import "dotenv/config";
import { randomUUID } from "crypto";
import { getTodaySchedule, getDateKey } from "./calendar.js";
import { generateContent } from "./generate.js";
import { generateAndUploadImages } from "./images.js";
import { publishToInstagram } from "./instagram.js";
import { hasBeenGenerated, getContentForDate, saveContent, updateStatus } from "./state.js";
import { log } from "./logger.js";
import type { ContentItem } from "./types.js";

async function main(): Promise<void> {
  log.info("══════════════════════════════════════════════");
  log.info("  AlphaVision AI — Instagram Auto-Publish");
  log.info("══════════════════════════════════════════════");

  const now = new Date();
  const today = getDateKey(now);
  const schedule = getTodaySchedule(now);
  const slots = Object.entries(schedule);

  if (slots.length === 0) {
    log.info("No hay publicaciones programadas para hoy");
    return;
  }

  log.info(`Fecha: ${today} | Slots: ${slots.map(([h, t]) => `${h}→${t}`).join(", ")}`);

  // ── Phase 1: Generate content for all slots not yet generated ──────────────
  for (const [hora, contentType] of slots) {
    if (hasBeenGenerated(today, hora)) {
      log.info(`Ya generado: ${hora} (${contentType})`);
      continue;
    }

    try {
      const { generated, tipo, needsImages } = await generateContent(contentType);

      let mediaUrls: string[] = [];
      if (needsImages && generated.imagePrompts.length > 0) {
        mediaUrls = await generateAndUploadImages(generated.imagePrompts);
      }

      const [hh, mm] = hora.split(":").map(Number);
      const scheduledFor = new Date(now);
      scheduledFor.setHours(hh, mm, 0, 0);

      const item: ContentItem = {
        id: randomUUID(),
        date: today,
        hora,
        contentType,
        tipo,
        caption: generated.caption,
        hashtags: generated.hashtags,
        imagePrompts: generated.imagePrompts,
        mediaUrls,
        scheduledFor: scheduledFor.toISOString(),
        status: "pending",
        createdAt: now.toISOString(),
      };

      saveContent(item);
      log.ok(`Guardado: ${hora} (${contentType}) — ${mediaUrls.length} imágenes`);
    } catch (err) {
      log.error(`Error generando ${hora}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Phase 2: Publish pending content whose scheduled time has passed ───────
  const dayContent = getContentForDate(today);

  for (const item of Object.values(dayContent)) {
    if (item.status !== "pending") continue;

    const scheduledAt = new Date(item.scheduledFor);
    const minsLeft = Math.round((scheduledAt.getTime() - now.getTime()) / 60_000);

    if (scheduledAt > now) {
      log.info(`Pendiente publicar: ${item.hora} (en ${minsLeft} min)`);
      continue;
    }

    try {
      log.info(`Publicando: ${item.hora} — ${item.tipo} (${item.contentType})`);

      const postId = await publishToInstagram(
        item.tipo,
        item.caption,
        item.hashtags,
        item.mediaUrls,
      );

      updateStatus(today, item.hora, "published", {
        instagramPostId: postId,
        publishedAt: new Date().toISOString(),
      });

      log.ok(`Publicado: ${item.hora} → ${postId}`);
    } catch (err) {
      log.error(`Error publicando ${item.hora}: ${err instanceof Error ? err.message : String(err)}`);
      updateStatus(today, item.hora, "failed");
    }
  }

  log.info("══════════════════════════════════════════════");
  log.info("  Ciclo completado");
  log.info("══════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
