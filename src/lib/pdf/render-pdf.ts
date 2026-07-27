// ─────────────────────────────────────────────────────────────────────────
// PDF Rendering — helper compartido
//
// Factoriza lo genérico de la generación de PDF (browser launch, viewport,
// inyección de tema claro, navegación a la página print, opciones de PDF y
// armado de la respuesta) para reusarlo desde cualquier route de PDF
// (comparativa / LTR / STR). El comportamiento es idéntico al que vivía
// inline en api/share/comparativa/[token]/pdf/route.ts.
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

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
  path: string;          // ej "/analisis/abc/documento" o "/share/comparativa/abc?print=true"
  filename: string;
  headerLabel: string;   // direccionLabel para el headerTemplate
  headerDate: string;    // fecha corta para el headerTemplate (solo chrome legacy)
  // ── Parámetros por caller (el helper es compartido LTR/STR/comparativa) ──
  // La vista documento LTR es clara por construcción y server-rendered; STR y
  // comparativa siguen con el flujo viejo (localStorage light + networkidle +
  // chrome disclaimer). Defaults = comportamiento legacy INTACTO.
  forceLightTheme?: boolean;  // default true. LTR documento → false (no hace falta el hack).
  readySelector?: string;     // si viene, espera determinística de ese selector (sentinel) en vez de networkidle+1500ms.
  chrome?: "documento" | "legacy"; // header/footer style. default "legacy".
}): Promise<NextResponse> {
  const {
    request, path, filename, headerLabel, headerDate,
    forceLightTheme = true,
    readySelector,
    chrome = "legacy",
  } = opts;

  const origin = getOrigin(request);
  const targetUrl = `${origin}${path}`;

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1400, deviceScaleFactor: 2 });

    // Forzar tema CLARO en el documento headless (solo flujos legacy STR/comparativa).
    // El script inline de layout.tsx lee localStorage('franco-theme') y, si es 'light',
    // setea data-theme="light" → el <body> hereda --franco-bg claro. Sin esto, el
    // sobrante de la última página se ve como barra negra. La vista documento LTR es
    // clara por construcción (.franco-doc con fondo blanco propio) → no lo necesita.
    if (forceLightTheme) {
      await page.evaluateOnNewDocument(() => {
        try {
          localStorage.setItem("franco-theme", "light");
        } catch {
          // localStorage puede no estar disponible; el fallback es el default.
        }
      });
    }

    if (readySelector) {
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
    } else {
      // Legacy (STR/comparativa): networkidle + delay para que Recharts termine.
      await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 45000 });
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // Header / Footer templates (HTML simple para Puppeteer).
    // Documento (LTR): alineado al contrato — header wordmark + dirección; footer
    // tagline vigente en JetBrains Mono + "página N de M"; padding 12mm = margen
    // lateral del @page. Legacy (STR/comparativa): INTACTO (18mm, disclaimer).
    const isDoc = chrome === "documento";
    const headerTemplate = isDoc
      ? `
      <div style="font-family: 'IBM Plex Sans', sans-serif; font-size: 9px; color: #6b6b72;
                   width: 100%; padding: 0 12mm; display: flex; align-items: center;
                   justify-content: space-between;">
        <span><span style="font-family: 'Source Serif 4', serif; font-style: italic; opacity: 0.5;">re</span><span style="font-family: 'Source Serif 4', serif; font-weight: bold;">franco</span><span style="color: #C8323C; font-weight: 600;">.ai</span></span>
        <span>${escapeHtml(headerLabel)}</span>
      </div>
    `
      : `
      <div style="font-family: 'IBM Plex Sans', sans-serif; font-size: 9px; color: #71717A;
                   width: 100%; padding: 0 18mm; display: flex; align-items: center;
                   justify-content: space-between;">
        <span><span style="font-family: 'Source Serif 4', serif; font-style: italic; opacity: 0.5;">re</span><span style="font-family: 'Source Serif 4', serif; font-weight: bold;">franco</span><span style="color: #C8323C; font-weight: 600;">.ai</span></span>
        <span>${escapeHtml(headerLabel)} · ${escapeHtml(headerDate)}</span>
      </div>
    `;

    const footerTemplate = isDoc
      ? `
      <div style="font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 8px; letter-spacing: 0.06em;
                   text-transform: uppercase; color: #6b6b72; width: 100%; padding: 0 12mm; display: flex;
                   align-items: center; justify-content: space-between;">
        <span>REAL ESTATE EN SU ESTADO MÁS FRANCO</span>
        <span>página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>
    `
      : `
      <div style="font-family: 'IBM Plex Sans', sans-serif; font-size: 8px; color: #888780;
                   width: 100%; padding: 0 18mm; display: flex; align-items: center;
                   justify-content: space-between;">
        <span>refranco.ai · análisis no constituye recomendación financiera</span>
        <span class="pageNumber"></span> / <span class="totalPages"></span>
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
