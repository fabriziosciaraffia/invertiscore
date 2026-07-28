// ─────────────────────────────────────────────────────────────────────────
// PDF Rendering — helper compartido
//
// Factoriza lo genérico de la generación de PDF (browser launch, viewport,
// espera determinística, opciones de PDF y armado de la respuesta) para los tres
// routes de PDF (LTR / STR / comparativa).
//
// Las tres modalidades migraron a su vista `/documento` dedicada, así que el
// helper quedó con UN solo camino. Se retiraron los parámetros del flujo viejo,
// ya sin consumidores: `forceLightTheme` (hack de localStorage — el documento es
// claro por construcción), `chrome: "legacy"` (header/footer con disclaimer),
// `headerDate` (solo lo usaba ese header) y la espera `networkidle0 + 1500ms`
// (era para Recharts en cliente; el documento es server-rendered con sentinel).
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";
import { DOC_CHROME_FONT_FACES } from "./doc-chrome-fonts";
import { DOC_WORDMARK_LIGHT_DATA_URI } from "./doc-wordmark";

export function getOrigin(request: Request): string {
  const url = new URL(request.url);
  // En Vercel, el proxy preserva el host original en headers.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return `${url.protocol}//${url.host}`;
}

async function launchBrowser(): Promise<Browser> {
  // Detección local vs Vercel. En local, CHROME_EXECUTABLE_PATH apunta al
  // chrome del sistema (ej. /Applications/Google Chrome.app/Contents/MacOS/...
  // o C:\Program Files\Google\Chrome\Application\chrome.exe).
  const localExec = process.env.CHROME_EXECUTABLE_PATH;
  if (localExec) {
    return puppeteer.launch({
      executablePath: localExec,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function renderPdf(opts: {
  request: Request;
  path: string;          // ruta de la vista documento, ej "/analisis/abc/documento"
  filename: string;
  headerLabel: string;   // direccionLabel para el headerTemplate
  /** Sentinel de la vista documento. Default: el que emiten los tres documentos. */
  readySelector?: string;
}): Promise<NextResponse> {
  const {
    request, path, filename, headerLabel,
    readySelector = "[data-doc-ready]",
  } = opts;

  const origin = getOrigin(request);
  const targetUrl = `${origin}${path}`;

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1400, deviceScaleFactor: 2 });

    // Espera DETERMINÍSTICA (documento server-rendered, sin Recharts ni IA en
    // cliente): carga de recursos + sentinel presente en el HTML inicial +
    // fuentes pintadas. Sin sleeps arbitrarios.
    await page.goto(targetUrl, { waitUntil: "load", timeout: 45000 });
    // 10s de techo: el sentinel vive en el HTML server-rendered → resuelve casi
    // instantáneo; el margen cubre un cold-start de compilación lento.
    await page.waitForSelector(readySelector, { timeout: 10000 });
    // document.fonts.ready: garantiza que Source Serif / IBM Plex / JetBrains
    // Mono estén pintadas antes del snapshot, sin delay fijo.
    await page.evaluate(() => (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready);

    // Header / Footer del chrome DOCUMENTO (HTML simple para Puppeteer), alineado
    // al contrato: header wordmark + dirección; footer tagline vigente en
    // JetBrains Mono + "página N de M". Padding 12mm = margen lateral del @page.
    // Fuentes de marca incrustadas (base64): los templates de Puppeteer no cargan
    // las webfonts de la página. Chromium solo incrusta las faces que cada
    // template USA (header: serif+sans; footer: mono) → sin streams duplicados.
    const docFontStyle = `<style>${DOC_CHROME_FONT_FACES}</style>`;
    const headerTemplate = `${docFontStyle}
      <div style="font-family: 'IBM Plex Sans', sans-serif; font-size: 9px; color: #6b6b72;
                   width: 100%; padding: 0 12mm; display: flex; align-items: center;
                   justify-content: space-between;">
        <img src="${DOC_WORDMARK_LIGHT_DATA_URI}" alt="refranco.ai" style="height: 11px; display: block;" />
        <span>${escapeHtml(headerLabel)}</span>
      </div>
    `;

    const footerTemplate = `${docFontStyle}
      <div style="font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 8px; letter-spacing: 0.06em;
                   text-transform: uppercase; color: #6b6b72; width: 100%; padding: 0 12mm; display: flex;
                   align-items: center; justify-content: space-between;">
        <span>REAL ESTATE EN SU ESTADO MÁS FRANCO</span>
        <span>página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>
    `;

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: { top: "18mm", right: "12mm", bottom: "18mm", left: "12mm" },
    });

    // Puppeteer page.pdf() devuelve Uint8Array; NextResponse acepta BodyInit
    // que sí incluye Uint8Array (pero no Buffer en TS strict mode).
    const body = new Uint8Array(pdfBuffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignored
      }
    }
  }
}
