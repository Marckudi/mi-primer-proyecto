import { createClient } from "@supabase/supabase-js";
import { TRIGGERS } from "./triggers.js";
import { log } from "./logger.js";

const BASE = "https://graph.facebook.com/v21.0";
const STATE_PATH = "automation/processed-comments.json";
const BUCKET = "instagram-media";
const LOOK_BACK_MS = 35 * 60 * 1000; // 35 min (workflow runs cada 30 min)

function getClients() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !accountId) throw new Error("Faltan credenciales de Instagram");
  if (!url || !key) throw new Error("Faltan credenciales de Supabase");
  return { token, accountId, supabase: createClient(url, key) };
}

// ---------- Supabase state ----------

async function loadProcessed(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  const { data, error } = await supabase.storage.from(BUCKET).download(STATE_PATH);
  if (error || !data) return new Set();
  try {
    const text = await data.text();
    return new Set(JSON.parse(text) as string[]);
  } catch {
    return new Set();
  }
}

async function saveProcessed(supabase: ReturnType<typeof createClient>, ids: Set<string>): Promise<void> {
  const arr = [...ids].slice(-2000); // keep last 2000 max
  const buf = Buffer.from(JSON.stringify(arr));
  await supabase.storage.from(BUCKET).upload(STATE_PATH, buf, {
    contentType: "application/json",
    upsert: true,
  });
}

// ---------- Instagram API helpers ----------

async function igGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}&access_token=${encodeURIComponent(token)}`);
  return res.json() as Promise<T>;
}

async function igPost(path: string, body: Record<string, unknown>, token: string): Promise<{ id?: string; error?: { message: string } }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  return res.json() as Promise<{ id?: string; error?: { message: string } }>;
}

// ---------- Core logic ----------

async function fetchRecentMedia(accountId: string, token: string): Promise<{ id: string; timestamp: string }[]> {
  const data = await igGet<{ data?: { id: string; timestamp: string }[] }>(
    `/${accountId}/media?fields=id,timestamp&limit=10`,
    token,
  );
  return data.data ?? [];
}

async function fetchComments(mediaId: string, token: string): Promise<{ id: string; text: string; username: string; from?: { id: string }; timestamp: string }[]> {
  const data = await igGet<{ data?: { id: string; text: string; username: string; from?: { id: string }; timestamp: string }[] }>(
    `/${mediaId}/comments?fields=id,text,username,from,timestamp`,
    token,
  );
  return data.data ?? [];
}

async function replyToComment(commentId: string, message: string, token: string): Promise<void> {
  const res = await igPost(`/${commentId}/replies`, { message }, token);
  if (res.error) log.warn(`  Reply fallida: ${res.error.message}`);
  else log.ok(`  Respuesta pública enviada (comment ${commentId})`);
}

async function sendDm(accountId: string, recipientId: string, text: string, token: string): Promise<void> {
  const res = await igPost(`/${accountId}/messages`, {
    recipient: { id: recipientId },
    message: { text },
  }, token);
  if (res.error) log.warn(`  DM fallido a ${recipientId}: ${res.error.message}`);
  else log.ok(`  DM enviado a ${recipientId}`);
}

async function fetchSourceContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1800);
  } catch {
    return "";
  }
}

function matchesKeyword(text: string, keyword: string): boolean {
  const clean = text.trim().replace(/[^\w\sáéíóúñüÀ-ɏ]/g, " ").toUpperCase();
  return clean.split(/\s+/).includes(keyword.toUpperCase());
}

// ---------- Main export ----------

export async function processComments(): Promise<void> {
  const { token, accountId, supabase } = getClients();
  const processed = await loadProcessed(supabase);
  const cutoff = new Date(Date.now() - LOOK_BACK_MS);
  let newProcessed = false;

  const media = await fetchRecentMedia(accountId, token);
  log.info(`Revisando ${media.length} publicaciones recientes...`);

  for (const post of media) {
    const comments = await fetchComments(post.id, token);
    const recent = comments.filter((c) => new Date(c.timestamp) >= cutoff);

    for (const comment of recent) {
      if (processed.has(comment.id)) continue;

      for (const trigger of TRIGGERS) {
        if (!matchesKeyword(comment.text, trigger.keyword)) continue;

        log.info(`Trigger "${trigger.keyword}" en comentario ${comment.id} (@${comment.username})`);

        // 1. Respuesta pública en el comentario
        await replyToComment(comment.id, trigger.publicReply, token);

        // 2. DM al usuario
        if (comment.from?.id) {
          const dmText = trigger.sourceUrl
            ? (await fetchSourceContent(trigger.sourceUrl)) || trigger.dmText
            : trigger.dmText;
          await sendDm(accountId, comment.from.id, dmText, token);
        } else {
          log.warn(`  No se pudo obtener el ID del usuario para enviar DM (@${comment.username})`);
        }

        processed.add(comment.id);
        newProcessed = true;
        break; // solo un trigger por comentario
      }
    }
  }

  if (newProcessed) await saveProcessed(supabase, processed);
  log.info(`Revisión de comentarios completada`);
}
