/**
 * AlphaVision AI — Web Analyzer Agent
 * Analiza alphavisionai.es diariamente y crea un GitHub Issue con:
 *   - Errores críticos
 *   - Mejoras UX/SEO/conversión
 *   - Estado técnico
 *   - Sugerencias pequeñas
 *
 * NOTA (fix): alphavisionai.es es una SPA de React. Un fetch() plano solo
 * descarga el HTML "cáscara" (~10 palabras, solo <head>) antes de que React
 * pinte el contenido real. Por eso ahora renderizamos la página con un
 * navegador headless (Playwright) y analizamos el HTML ya renderizado.
 */

import Anthropic from "@anthropic-ai/sdk";
import { chromium } from "playwright";

const SITE        = "https://alphavisionai.es";
const GITHUB_API  = "https://api.github.com";
const REPO        = process.env.GITHUB_REPOSITORY ?? "marckudi/mi-primer-proyecto";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";

interface PageData {
  url: string;
  status: number;
  loadMs: number;
  title: string;
  metaDesc: string;
  langAttr: string;
  h1: string[];
  h2: string[];
  h3: string[];
  imgTotal: number;
  imgNoAlt: number;
  linksInternal: string[];
  linksExternal: string[];
  wordCount: number;
  hasCanonical: boolean;
  hasOgTitle: boolean;
  hasOgDesc: boolean;
  hasOgImage: boolean;
  hasTwitterCard: boolean;
  hasSchemaOrg: boolean;
  hasMobileMeta: boolean;
  hasCookieBanner: boolean;
  hasPrivacyLink: boolean;
  hasLegalLink: boolean;
  hasHttps: boolean;
  hasContactForm: boolean;
  hasCtaButton: boolean;
  contentSecurityPolicy: string;
  brokenLinks: string[];
  rawHtml: string;
}

function extractTextContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(url: string): Promise<PageData> {
  const t0 = Date.now();
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({
      userAgent: "AlphaVisionAI-WebAnalyzer/1.0",
      extraHTTPHeaders: { "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" },
    });
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    // Espera breve extra por si algún componente tarda en montar tras networkidle
    await page.waitForTimeout(800);

    const loadMs = Date.now() - t0;
    const csp    = res?.headers()["content-security-policy"] ?? "";
    const html   = await page.content(); // HTML YA renderizado por React, no la cáscara

    // Extraer metadatos
    const title    = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
    const metaDesc = (
      html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i)
    )?.[1]?.trim() ?? "";

    const langAttr = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] ?? "";

    const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
      .map(m => extractTextContent(m[1]).substring(0, 120)).filter(Boolean).slice(0, 5);
    const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
      .map(m => extractTextContent(m[1]).substring(0, 120)).filter(Boolean).slice(0, 12);
    const h3 = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)]
      .map(m => extractTextContent(m[1]).substring(0, 100)).filter(Boolean).slice(0, 12);

    // Imágenes
    const imgs    = [...html.matchAll(/<img[^>]*/gi)];
    const imgNoAlt = imgs.filter(m => !/alt=["'][^"']+["']/.test(m[0])).length;

    // Links
    const allLinks = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]);
    const linksInternal = allLinks
      .filter(l => l.startsWith("/") || l.includes("alphavisionai.es"))
      .slice(0, 20);
    const linksExternal = allLinks
      .filter(l => l.startsWith("http") && !l.includes("alphavisionai.es"))
      .slice(0, 20);

    // Palabras
    const text      = extractTextContent(html);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Checks booleanos
    const hasOgTitle      = /<meta[^>]+property=["']og:title["']/i.test(html);
    const hasOgDesc       = /<meta[^>]+property=["']og:description["']/i.test(html);
    const hasOgImage      = /<meta[^>]+property=["']og:image["']/i.test(html);
    const hasTwitterCard  = /<meta[^>]+name=["']twitter:card["']/i.test(html);
    const hasSchemaOrg    = html.includes("application/ld+json") || html.includes("schema.org");
    const hasMobileMeta   = /<meta[^>]+name=["']viewport["']/i.test(html);
    const hasCanonical    = /<link[^>]+rel=["']canonical["']/i.test(html);
    const hasCookieBanner = /cookie|cookies|gdpr|rgpd/i.test(html);
    const hasPrivacyLink  = /privacidad|privacy|pol.tica/i.test(html);
    const hasLegalLink    = /aviso.legal|legal.notice|t.rminos/i.test(html);
    const hasContactForm  = /<form/i.test(html);
    const hasCtaButton    = /<button|type=["']submit["']|class=["'][^"']*btn[^"']*["']/i.test(html);

    return {
      url, status: res?.status() ?? 0, loadMs, title, metaDesc, langAttr,
      h1, h2, h3, imgTotal: imgs.length, imgNoAlt,
      linksInternal, linksExternal, wordCount,
      hasCanonical, hasOgTitle, hasOgDesc, hasOgImage, hasTwitterCard,
      hasSchemaOrg, hasMobileMeta, hasCookieBanner, hasPrivacyLink, hasLegalLink,
      hasHttps: url.startsWith("https://"),
      hasContactForm, hasCtaButton,
      contentSecurityPolicy: csp.substring(0, 300),
      brokenLinks: [],
      rawHtml: html.substring(0, 14000),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      url, status: 0, loadMs: Date.now() - t0,
      title: "", metaDesc: "", langAttr: "",
      h1: [], h2: [], h3: [],
      imgTotal: 0, imgNoAlt: 0,
      linksInternal: [], linksExternal: [], wordCount: 0,
      hasCanonical: false, hasOgTitle: false, hasOgDesc: false, hasOgImage: false,
      hasTwitterCard: false, hasSchemaOrg: false, hasMobileMeta: false,
      hasCookieBanner: false, hasPrivacyLink: false, hasLegalLink: false,
      hasHttps: false, hasContactForm: false, hasCtaButton: false,
      contentSecurityPolicy: "",
      brokenLinks: [],
      rawHtml: `FETCH_ERROR: ${msg}`,
    };
  } finally {
    await browser.close();
  }
}

async function checkBrokenLinks(base: string, links: string[]): Promise<string[]> {
  const broken: string[] = [];
  const urls = links
    .map(l => l.startsWith("/") ? base + l : l)
    .filter(l => l.startsWith(base))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 12);

  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "AlphaVisionAI-WebAnalyzer/1.0" },
        });
        if (res.status >= 400) broken.push(`${url} (❌ ${res.status})`);
      } catch {
        broken.push(`${url} (❌ timeout)`);
      }
    }),
  );
  return broken;
}

function buildTechnicalSummary(p: PageData): string {
  const checks = [
    `- HTTP status: **${p.status === 200 ? "✅ 200 OK" : `❌ ${p.status}`}**`,
    `- Tiempo de carga: **${p.loadMs}ms** ${p.loadMs > 3000 ? "⚠️ LENTO" : p.loadMs > 1500 ? "⚠️ MEJORABLE" : "✅ OK"}`,
    `- HTTPS: ${p.hasHttps ? "✅" : "❌ NO HTTPS — CRÍTICO"}`,
    `- Viewport meta (mobile): ${p.hasMobileMeta ? "✅" : "❌ FALTA"}`,
    `- Tag \`lang\` en \`<html>\`: ${p.langAttr ? `✅ \`${p.langAttr}\`` : "❌ FALTA"}`,
    `- Canonical URL: ${p.hasCanonical ? "✅" : "⚠️ no encontrado"}`,
    `- Meta description: ${p.metaDesc ? `✅ "${p.metaDesc.substring(0, 80)}..."` : "❌ FALTA"}`,
    `- OG Title: ${p.hasOgTitle ? "✅" : "❌"}  OG Description: ${p.hasOgDesc ? "✅" : "❌"}  OG Image: ${p.hasOgImage ? "✅" : "❌"}`,
    `- Twitter Card: ${p.hasTwitterCard ? "✅" : "❌ no encontrado"}`,
    `- Schema.org / JSON-LD: ${p.hasSchemaOrg ? "✅" : "❌ no encontrado"}`,
    `- Imágenes: ${p.imgTotal} total, ${p.imgNoAlt > 0 ? `⚠️ **${p.imgNoAlt} sin atributo alt**` : "✅ todas con alt"}`,
    `- Texto visible: ~${p.wordCount} palabras`,
    `- Cookie/GDPR banner: ${p.hasCookieBanner ? "✅" : "❌ NO ENCONTRADO — obligatorio en UE"}`,
    `- Enlace Política de Privacidad: ${p.hasPrivacyLink ? "✅" : "❌ NO ENCONTRADO"}`,
    `- Aviso Legal: ${p.hasLegalLink ? "✅" : "❌ NO ENCONTRADO"}`,
    `- Formulario de contacto: ${p.hasContactForm ? "✅" : "ℹ️ no detectado"}`,
    `- Botones CTA: ${p.hasCtaButton ? "✅" : "⚠️ no detectados"}`,
  ];
  if (p.brokenLinks.length > 0) {
    checks.push(`- Links rotos: ❌\n${p.brokenLinks.map(l => `  - ${l}`).join("\n")}`);
  } else {
    checks.push(`- Links rotos: ✅ ninguno detectado`);
  }
  return checks.join("\n");
}

async function analyzeWithClaude(p: PageData): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const context = `
URL: ${p.url}
Título de página: "${p.title}"
Meta description: "${p.metaDesc}"
Atributo lang: "${p.langAttr}"
H1: ${p.h1.join(" | ") || "NINGUNO"}
H2 (primeros 8): ${p.h2.slice(0, 8).join(" | ") || "ninguno"}
H3 (primeros 8): ${p.h3.slice(0, 8).join(" | ") || "ninguno"}
Imágenes sin alt: ${p.imgNoAlt}/${p.imgTotal}
Links internos: ${p.linksInternal.join(", ")}
Links externos: ${p.linksExternal.slice(0, 10).join(", ")}
Palabras visibles: ~${p.wordCount}
Links rotos: ${p.brokenLinks.length > 0 ? p.brokenLinks.join(", ") : "ninguno"}
Tiempo de carga: ${p.loadMs}ms
HTTPS: ${p.hasHttps}
Cookie/GDPR: ${p.hasCookieBanner}
Privacidad: ${p.hasPrivacyLink}, Legal: ${p.hasLegalLink}
OG tags: title=${p.hasOgTitle} desc=${p.hasOgDesc} image=${p.hasOgImage}
Twitter Card: ${p.hasTwitterCard}, Schema.org: ${p.hasSchemaOrg}
CSP header: ${p.contentSecurityPolicy || "no configurado"}

HTML INICIAL DE LA PÁGINA (primeros 14.000 chars):
${p.rawHtml}
`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content:
        `Eres un experto senior en UX, SEO técnico, conversión y desarrollo web.

Analiza la web **alphavisionai.es** — plataforma de trading automatizado forex para traders españoles 25-45 años. El objetivo principal de la web es convertir visitantes en clientes/seguidores de Instagram y generar confianza.

DATOS TÉCNICOS RECOGIDOS HOY:
${context}

Genera un informe en español. Sé MUY específico: cita el texto exacto a cambiar, el elemento HTML afectado, o la URL con el problema. NO seas genérico. Cada punto debe tener una acción concreta y clara.

USA EXACTAMENTE este formato markdown:

### 🚨 CRÍTICOS — Corregir urgente
_(Errores que dañan la conversión, la legalidad o la experiencia. Si no hay ninguno, escribe: Ninguno detectado.)_

### ⚠️ IMPORTANTES — Corregir esta semana
_(Problemas significativos de SEO, UX, rendimiento o confianza)_

### 💡 MEJORAS DE CONVERSIÓN
_(Cambios que aumentarían leads, seguidores o tiempo en la página)_

### ✨ SUGERENCIAS PEQUEÑAS
_(Copy, accesibilidad, detalles de diseño, micro-interacciones)_

### 💬 TEXTO SUGERIDO
_(Para las mejoras más importantes: proporciona el texto exacto nuevo que podría reemplazar al actual)_`,
    }],
  });

  const block = message.content.find(b => b.type === "text");
  return block?.type === "text" ? block.text.trim() : "Error: Claude no devolvió respuesta.";
}

async function createGitHubIssue(title: string, body: string): Promise<string> {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN no configurado");

  // Crear label si no existe (falla silenciosamente si ya existe)
  await fetch(`${GITHUB_API}/repos/${REPO}/labels`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.github.v3+json",
    },
    body: JSON.stringify({ name: "web-analysis", color: "0075ca", description: "Análisis automático de la web" }),
  }).catch(() => null);

  const res = await fetch(`${GITHUB_API}/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title,
      body,
      labels: ["web-analysis"],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub Issues API error ${res.status}: ${err}`);
  }

  const issue = await res.json() as { html_url: string; number: number };
  return issue.html_url;
}

async function main(): Promise<void> {
  console.log("\ud83d� Iniciando análisis de alphavisionai.es...");

  // 1. Obtener datos de la página
  console.log("  → Descargando página principal...");
  const page = await fetchPage(SITE);
  console.log(`  → Status: ${page.status} | Carga: ${page.loadMs}ms | Palabras: ~${page.wordCount}`);

  // 2. Verificar links rotos
  console.log("  → Verificando links internos...");
  page.brokenLinks = await checkBrokenLinks(SITE, page.linksInternal);
  if (page.brokenLinks.length > 0) {
    console.log(`  ⚠️  Links rotos: ${page.brokenLinks.join(", ")}`);
  }

  // 3. Análisis con Claude
  console.log("  → Analizando con Claude Opus...");
  const aiAnalysis     = await analyzeWithClaude(page);
  const techSummary    = buildTechnicalSummary(page);

  // 4. Componer issue
  const today     = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const isoDate   = new Date().toISOString();
  const issueTitle = `[Web Analysis] ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })} — alphavisionai.es`;

  const issueBody = `## 🔍 Análisis Automático — alphavisionai.es
**Fecha:** ${today}  
**URL analizada:** ${SITE}  
**Ejecutado por:** AlphaVision AI Web Analyzer (Claude Opus)

---

${aiAnalysis}

---

## 📊 Estado Técnico Detallado

${techSummary}

---

<details>
<summary>🗂️ H1, H2, H3 detectados</summary>

**H1 (${page.h1.length}):**
${page.h1.map(h => `- ${h}`).join("\n") || "- Ninguno"}

**H2 (${page.h2.length}):**
${page.h2.map(h => `- ${h}`).join("\n") || "- Ninguno"}

**H3 (${page.h3.length}):**
${page.h3.map(h => `- ${h}`).join("\n") || "- Ninguno"}
</details>

---
*Análisis generado automáticamente el ${isoDate} — [Ver workflow](https://github.com/${REPO}/actions)*`;

  // 5. Crear GitHub Issue
  console.log("  → Creando GitHub Issue...");
  const issueUrl = await createGitHubIssue(issueTitle, issueBody);
  console.log(`\n✅ Issue creado: ${issueUrl}`);
}

main().catch((err) => {
  console.error("[FATAL]", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
