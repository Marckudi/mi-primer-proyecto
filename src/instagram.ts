import { log } from "./logger.js";

const BASE = "https://graph.facebook.com/v21.0";

type ApiResponse = { id?: string; error?: { message: string; code?: number } };
type StatusResponse = { status_code?: string; id?: string };

async function apiPost(url: string, body: Record<string, unknown>): Promise<ApiResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as ApiResponse;
  if (data.error) throw new Error(`Instagram API error ${data.error.code ?? ""}: ${data.error.message}`);
  return data;
}

async function waitForContainer(containerId: string, token: string): Promise<void> {
  const maxAttempts = 12;
  const intervalMs = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(
      `${BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    const data = (await res.json()) as StatusResponse;
    log.info(`  Container ${containerId} status: ${data.status_code ?? "desconocido"} (intento ${i + 1}/${maxAttempts})`);
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") throw new Error("Instagram rechazó el contenedor de media");
  }

  throw new Error(`Container no listo después de ${maxAttempts * intervalMs / 1000}s`);
}

async function publishCarousel(
  accountId: string,
  token: string,
  mediaUrls: string[],
  caption: string,
): Promise<string> {
  const mediaIds: string[] = [];

  for (const url of mediaUrls) {
    const data = await apiPost(`${BASE}/${accountId}/media`, {
      image_url: url,
      is_carousel_item: true,
      access_token: token,
    });
    if (data.id) {
      await waitForContainer(data.id, token);
      mediaIds.push(data.id);
    }
  }

  const carousel = await apiPost(`${BASE}/${accountId}/media`, {
    media_type: "CAROUSEL",
    children: mediaIds,
    caption,
    access_token: token,
  });

  if (carousel.id) await waitForContainer(carousel.id, token);

  const published = await apiPost(`${BASE}/${accountId}/media_publish`, {
    creation_id: carousel.id,
    access_token: token,
  });

  return published.id ?? `ig_carousel_${Date.now()}`;
}

async function publishSingle(
  accountId: string,
  token: string,
  imageUrl: string,
  caption: string,
): Promise<string> {
  const media = await apiPost(`${BASE}/${accountId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: token,
  });

  if (media.id) await waitForContainer(media.id, token);

  const published = await apiPost(`${BASE}/${accountId}/media_publish`, {
    creation_id: media.id,
    access_token: token,
  });

  return published.id ?? `ig_post_${Date.now()}`;
}

export async function publishToInstagram(
  tipo: string,
  caption: string,
  hashtags: string[],
  mediaUrls: string[],
): Promise<string> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!token || !accountId) {
    log.warn("Instagram Graph API no configurada — simulando publicación");
    log.info(`  tipo: ${tipo} | imágenes: ${mediaUrls.length}`);
    log.info(`  caption: ${caption.substring(0, 120)}...`);
    return `ig_placeholder_${Date.now()}`;
  }

  if (mediaUrls.length === 0) {
    throw new Error("No hay imágenes para publicar en Instagram");
  }

  const fullCaption = `${caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`.trim();

  if (tipo === "carrusel" && mediaUrls.length > 1) {
    return publishCarousel(accountId, token, mediaUrls, fullCaption);
  }

  return publishSingle(accountId, token, mediaUrls[0], fullCaption);
}
