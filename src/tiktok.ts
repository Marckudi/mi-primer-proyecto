import { log } from "./logger.js";

const BASE = "https://open.tiktokapis.com/v2";

interface TikTokInitResponse {
  data?: { publish_id: string; upload_url: string };
  error?: { code: string; message: string };
}

interface TikTokStatusResponse {
  data?: { status: string; publicaly_available_post_id?: string[] };
  error?: { code: string; message: string };
}

async function initUpload(
  token: string,
  caption: string,
  videoSize: number,
): Promise<{ publishId: string; uploadUrl: string }> {
  const res = await fetch(`${BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_stitch: false,
        disable_comment: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  });

  const json = (await res.json()) as TikTokInitResponse;
  if (json.error?.code && json.error.code !== "ok") {
    throw new Error(`TikTok init error: ${json.error.code} — ${json.error.message}`);
  }
  if (!json.data?.publish_id || !json.data?.upload_url) {
    throw new Error("TikTok no devolvió publish_id ni upload_url");
  }
  return { publishId: json.data.publish_id, uploadUrl: json.data.upload_url };
}

async function uploadChunk(uploadUrl: string, buffer: Buffer): Promise<void> {
  const size = buffer.length;
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Range": `bytes 0-${size - 1}/${size}`,
      "Content-Length": String(size),
      "Content-Type": "video/mp4",
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TikTok upload fallido (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function waitForPublish(token: string, publishId: string): Promise<string> {
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 10_000)); // 10s entre intentos
    const res = await fetch(`${BASE}/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const json = (await res.json()) as TikTokStatusResponse;
    const status = json.data?.status ?? "UNKNOWN";
    log.info(`  TikTok publish status: ${status} (${i + 1}/${maxAttempts})`);
    if (status === "PUBLISH_COMPLETE") {
      return json.data?.publicaly_available_post_id?.[0] ?? publishId;
    }
    if (status === "FAILED") throw new Error("TikTok rechazó el video");
  }
  throw new Error("TikTok publish timeout después de 200s");
}

export async function publishToTikTok(
  videoUrl: string,
  caption: string,
  hashtags: string[],
): Promise<void> {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) {
    log.warn("TIKTOK_ACCESS_TOKEN no configurado — saltando TikTok");
    return;
  }

  log.info("Subiendo video a TikTok...");

  // Descarga el video desde Supabase para subirlo a TikTok
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`No se pudo descargar el video: ${videoRes.status}`);
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

  const fullCaption = `${caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`.trim().slice(0, 2200);

  const { publishId, uploadUrl } = await initUpload(token, fullCaption, videoBuffer.length);
  log.info(`  TikTok publish_id: ${publishId}`);

  await uploadChunk(uploadUrl, videoBuffer);
  log.info("  Video subido, esperando procesamiento...");

  const postId = await waitForPublish(token, publishId);
  log.ok(`✅ Publicado en TikTok: ID ${postId}`);
}
