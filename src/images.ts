import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { log } from "./logger.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos");
  return createClient(url, key);
}

export async function generateAndUploadImages(prompts: string[]): Promise<string[]> {
  const urls: string[] = [];
  const supabase = getSupabase();

  for (const prompt of prompts.slice(0, 5)) { // max 5 por post para controlar coste
    log.info(`Generando imagen: ${prompt.substring(0, 70)}...`);

    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt:
          `Professional Instagram post for AlphaVision AI trading platform. ${prompt}. ` +
          `Style: modern, clean, black (#000000) background, gold (#FFD700) accents, ` +
          `Montserrat Bold typography, no text unless specified.`,
        size: "1024x1024",
        quality: "hd",
        response_format: "b64_json",
        n: 1,
      });

      const b64 = response.data?.[0]?.b64_json;
      if (!b64) {
        log.warn("DALL-E no devolvió imagen");
        continue;
      }

      const imageBuffer = Buffer.from(b64, "base64");
      const filename = `instagram/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.png`;

      const { data: uploadData, error } = await supabase.storage
        .from("instagram-media")
        .upload(filename, imageBuffer, { contentType: "image/png", cacheControl: "3600" });

      if (error) {
        log.error(`Error subiendo imagen a Supabase: ${error.message}`);
        continue;
      }

      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from("instagram-media")
          .getPublicUrl(filename);
        urls.push(urlData.publicUrl);
        log.ok(`Imagen lista: ${urlData.publicUrl}`);
      }
    } catch (err) {
      log.error(`Error en imagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return urls;
}
