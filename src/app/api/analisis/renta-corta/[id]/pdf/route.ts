// ─────────────────────────────────────────────────────────────────────────
// PDF Generation — Análisis STR (renta corta)
//
// Endpoint: GET /api/analisis/renta-corta/[id]/pdf
// Strategy: reusa el helper compartido src/lib/pdf/render-pdf.ts (Puppeteer +
// @sparticuz/chromium). Navega a /analisis/renta-corta/[id]?print=true en
// headless Chrome (modo print: sin chrome de nav ni CTAs, con AdvancedSectionSTR
// abierta) y emite PDF A4 con header/footer. Hereda el fix de tema claro del
// helper.
//
// Espejo de api/analisis/[id]/pdf/route.ts (LTR), pero para un análisis de
// renta corta identificado por id.
//
// On-demand sin cache PDF — el cache de la narrativa IA vive en la columna
// SQL `ai_analysis`. Re-generar el PDF es barato porque la IA no se llama.
//
// Vercel config: nodejs runtime, maxDuration 60s (PDF + nav + IA puede
// tomar 20-40s en cold start).
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderPdf } from "@/lib/pdf/render-pdf";
import { formatDireccionDisplay } from "@/lib/format-direccion";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id;

    // Validar que el análisis existe antes de gastar tiempo en Chromium.
    const supabase = createClient();
    const { data: row } = await supabase
      .from("analisis")
      .select("id, comuna, direccion, ai_analysis")
      .eq("id", id)
      .single();
    if (!row) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    // Guard: la narrativa IA debe estar cacheada (columna SQL `ai_analysis`)
    // antes de generar PDF. Si no, la generación dispararía Anthropic dentro
    // de Puppeteer y ese chain puede exceder maxDuration 60s. Forzamos al
    // usuario a abrir el análisis en la web primero (donde la IA se persiste).
    // HTTP 425 Too Early es semánticamente correcto: el prerequisito no está
    // listo aún.
    if (!(row as Record<string, unknown>).ai_analysis) {
      return NextResponse.json(
        { error: "Abre el análisis en la web antes de descargar el PDF" },
        { status: 425 },
      );
    }

    const direccionLabel = row.direccion
      ? formatDireccionDisplay(row.direccion as string, row.comuna as string | null)
      : (row.comuna ? `Depto en ${row.comuna}` : "Análisis de inversión");
    const fechaCorta = new Date().toLocaleDateString("es-CL", {
      day: "numeric", month: "long", year: "numeric",
    });

    const safeName = direccionLabel.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
    const filename = `franco-renta-corta-${safeName}-${id.slice(0, 8)}.pdf`;

    return renderPdf({
      request,
      path: `/analisis/renta-corta/${id}?print=true`,
      filename,
      headerLabel: direccionLabel,
      headerDate: fechaCorta,
    });
  } catch (error) {
    console.error("[STR PDF] Error:", error);
    return NextResponse.json(
      { error: "Error generando PDF", detail: (error as Error).message },
      { status: 500 },
    );
  }
}
