// ─────────────────────────────────────────────────────────────────────────
// PDF Generation — Comparativa pública (Commit 3c · 2026-05-12)
//
// Endpoint: GET /api/share/comparativa/[token]/pdf
// Strategy: Puppeteer + @sparticuz/chromium en Vercel Functions (Node.js
// runtime). Navega a /share/comparativa/[token]?print=true en headless
// Chrome, espera a que la página termine de cargar (incluyendo Recharts +
// narrativa IA si necesita generarse), y emite PDF A4 con header/footer.
//
// On-demand sin cache PDF — el cache vive en `ltr.results.comparativaAI`
// (Commit 3b). Re-generar el PDF es barato porque la IA no se llama.
//
// Vercel config: nodejs runtime, maxDuration 60s (PDF + nav + IA puede
// tomar 20-40s en cold start).
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";
import { decodeShareToken } from "@/lib/share-token";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getOrigin(request: Request): string {
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

export async function GET(
  request: Request,
  { params }: { params: { token: string } },
) {
  const decoded = decodeShareToken(params.token);
  if (!decoded) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  // Validar que ambos análisis existen antes de gastar tiempo en Chromium.
  const supabase = createClient();
  const [{ data: ltrRow }, { data: strRow }] = await Promise.all([
    supabase.from("analisis").select("id, comuna, direccion, dormitorios, banos, results").eq("id", decoded.ltrId).single(),
    supabase.from("analisis").select("id").eq("id", decoded.strId).single(),
  ]);
  if (!ltrRow || !strRow) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }

  // Guard: la narrativa IA debe estar cacheada (Commit 3b) antes de generar
  // PDF. Si no, la generación dispararía Anthropic dentro de Puppeteer y
  // ese chain puede exceder maxDuration 60s. Forzamos al usuario a abrir
  // el análisis en la web primero (donde la IA se persiste en jsonb).
  // HTTP 425 Too Early es semánticamente correcto: el prerequisito no
  // está listo aún.
  const ltrResults = ltrRow.results as { comparativaAI?: unknown } | null;
  if (!ltrResults?.comparativaAI) {
    return NextResponse.json(
      { error: "Abre el análisis en la web antes de descargar el PDF" },
      { status: 425 },
    );
  }

  const direccionLabel = (ltrRow.direccion as string | null)
    || (ltrRow.comuna ? `Depto en ${ltrRow.comuna}` : "Análisis comparativo");
  const fechaCorta = new Date().toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric",
  });

  const origin = getOrigin(request);
  const targetUrl = `${origin}/share/comparativa/${params.token}?print=true`;

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1400, deviceScaleFactor: 2 });

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
        <span>${escapeHtml(direccionLabel)} · ${escapeHtml(fechaCorta)}</span>
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

    await browser.close();
    browser = null;

    const safeName = direccionLabel.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
    const filename = `franco-comparativa-${safeName}-${params.token.slice(0, 8)}.pdf`;

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
  } catch (error) {
    console.error("[Comparativa PDF] Error:", error);
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignored
      }
    }
    return NextResponse.json(
      { error: "Error generando PDF", detail: (error as Error).message },
      { status: 500 },
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
