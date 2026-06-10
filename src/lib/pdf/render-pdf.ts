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
  path: string;          // ej "/share/comparativa/abc?print=true"
  filename: string;
  headerLabel: string;   // direccionLabel para el headerTemplate
  headerDate: string;    // fecha corta para el headerTemplate
}): Promise<NextResponse> {
  const { request, path, filename, headerLabel, headerDate } = opts;

  const origin = getOrigin(request);
  const targetUrl = `${origin}${path}`;

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1400, deviceScaleFactor: 2 });

    // Forzar tema CLARO en el documento headless. El script inline de
    // layout.tsx (~L85) lee localStorage('franco-theme') y, si es 'light',
    // setea data-theme="light" en <html> → el <body> hereda --franco-bg claro.
    // Sin esto, <html>/<body> quedan en el default oscuro (#0F0F0F) y el
    // sobrante de la última página del PDF se ve como una barra negra.
    // (El div interno ya fuerza light, pero solo cubre su propio box.)
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem("franco-theme", "light");
      } catch {
        // localStorage puede no estar disponible; el fallback es el default.
      }
    });

    // Ir a la página print + esperar networkidle (asegura que IA + charts
    // hayan terminado de renderizar)
    await page.goto(targetUrl, {
      waitUntil: "networkidle0",
      timeout: 45000,
    });

    // Pequeño delay extra para asegurar que Recharts haya terminado animations
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Header / Footer templates (HTML simple para Puppeteer)
    const headerTemplate = `
      <div style="font-family: 'IBM Plex Sans', sans-serif; font-size: 9px; color: #71717A;
                   width: 100%; padding: 0 18mm; display: flex; align-items: center;
                   justify-content: space-between;">
        <span><span style="font-family: 'Source Serif 4', serif; font-style: italic; opacity: 0.5;">re</span><span style="font-family: 'Source Serif 4', serif; font-weight: bold;">franco</span><span style="color: #C8323C; font-weight: 600;">.ai</span></span>
        <span>${escapeHtml(headerLabel)} · ${escapeHtml(headerDate)}</span>
      </div>
    `;

    const footerTemplate = `
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
