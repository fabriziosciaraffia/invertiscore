// ─────────────────────────────────────────────────────────────────────────
// PDF Generation — Comparativa pública (Commit 3c · 2026-05-12)
//
// Endpoint: GET /api/share/comparativa/[token]/pdf
// Strategy: Puppeteer + @sparticuz/chromium en Vercel Functions (Node.js
// runtime). Navega a /share/comparativa/[token]?print=true en headless
// Chrome, espera a que la página termine de cargar (incluyendo Recharts +
// narrativa IA si necesita generarse), y emite PDF A4 con header/footer.
//
// La mecánica genérica de render (browser, viewport, tema claro, goto, pdf
// y respuesta) vive en src/lib/pdf/render-pdf.ts. Este route solo aporta lo
// específico de la comparativa: decode del token, lookups, guard de caché
// 425, labels del header y filename.
//
// On-demand sin cache PDF — el cache vive en `ltr.results.comparativaAI`
// (Commit 3b). Re-generar el PDF es barato porque la IA no se llama.
//
// Vercel config: nodejs runtime, maxDuration 60s (PDF + nav + IA puede
// tomar 20-40s en cold start).
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { decodeShareToken } from "@/lib/share-token";
import { createClient } from "@/lib/supabase/server";
import { renderPdf } from "@/lib/pdf/render-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { token: string } },
) {
  try {
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

    const safeName = direccionLabel.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
    const filename = `franco-comparativa-${safeName}-${params.token.slice(0, 8)}.pdf`;

    return renderPdf({
      request,
      path: `/share/comparativa/${params.token}?print=true`,
      filename,
      headerLabel: direccionLabel,
      headerDate: fechaCorta,
    });
  } catch (error) {
    console.error("[Comparativa PDF] Error:", error);
    return NextResponse.json(
      { error: "Error generando PDF", detail: (error as Error).message },
      { status: 500 },
    );
  }
}
