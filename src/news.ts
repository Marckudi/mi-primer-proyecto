import { log } from "./logger.js";

const RSS_FEEDS = [
  "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
  "https://finance.yahoo.com/news/rssindex",
  "https://feeds.content.dowjones.io/public/rss/mw_topstories",
];

function extractTitles(xml: string): string[] {
  return [...xml.matchAll(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)]
    .map((m) =>
      m[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim(),
    )
    .filter((t) => t.length > 15 && t.length < 250)
    .slice(1, 7); // skip feed title, take up to 6 headlines
}

export async function fetchCurrentNews(): Promise<string> {
  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "AlphaVisionBot/1.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const titles = extractTitles(xml);
      if (titles.length >= 2) {
        log.info(`Noticias obtenidas: ${titles.length} titulares`);
        return titles.map((t, i) => `${i + 1}. ${t}`).join("\n");
      }
    } catch (err) {
      log.warn(`RSS fallido (${feed.split("/")[2]}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  log.warn("Sin noticias en tiempo real — Claude usará conocimiento propio");
  return "";
}
