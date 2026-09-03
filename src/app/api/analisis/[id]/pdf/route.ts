// ─────────────────────────────────────────────────────────────────────────
// PDF Generation — Análisis LTR (renta larga)
//
// Endpoint: GET /api/analisis/[id]/pdf
// Strategy: reusa el helper compartido src/lib/pdf/render-pdf.ts (Puppeteer +
// @sparticuz/chromium). Navega a la VISTA DOCUMENTO /analisis/[id]/documento en
// headless Chrome (server-rendered, clara por construcción, con sentinel
// [data-doc-ready] para espera determinística) y emite PDF A4 con header
// (dirección) + footer (tagline + paginación). Ya no usa ?print=true.
//
// Análogo a api/share/comparativa/[token]/pdf/route.ts, pero para un único
// análisis LTR identificado por id (no por share token).
//
// On-demand sin cache PDF — el cache de la narrativa IA vive en la columna
// SQL `ai_analysis`. Re-generar el PDF es barato porque la IA no se llama.
//
// Vercel config: nodejs runtime, maxDuration 60s (PDF + nav + IA puede
// tomar 20-40s en cold start).
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createClient } from "@/lib/supabase/server";
import { renderPdf } from "@/lib/pdf/render-pdf";
import { accesoPdf, logDenegacion } from "@/lib/pdf/documento-access";

/** T5: el PDF LTR vuelve cuando se reescriba sobre los cinco capítulos. */
const PDF_LTR_VISIBLE = false;
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
      .select("id, comuna, direccion, ai_analysis, ambas_role, ambas_group_id, user_id, anon_claim_token_hash")
      .eq("id", id)
      .single();
    if (!row) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    // T5 (03-sep-2026): el PDF LTR está fuera de la UI hasta que se reescriba sobre los
    // cinco capítulos. La vista /documento redirige al informe web, así que renderizar
    // acá solo produciría un PDF del redirect. 410: retirado, no roto.
    if (!PDF_LTR_VISIBLE) {
      return NextResponse.json(
        { error: "El PDF del informe LTR está fuera de la UI desde T5; se reescribe sobre los cinco capítulos." },
        { status: 410 },
      );
    }

    // Gating dueño-only (D-1). Va ANTES de todo lo demás: sin esto, gatear la
    // vista documento sería decorativo — cualquiera con el UUID pediría el PDF
    // y el pipeline, que sí tiene el secreto del renderer, le entregaría el
    // informe completo. Acá el solicitante tiene que ser dueño de verdad; el
    // secreto NO abre esta puerta.
    const acceso = await accesoPdf(supabase, {
      user_id: (row as Record<string, unknown>).user_id as string | null,
      anon_claim_token_hash: (row as Record<string, unknown>).anon_claim_token_hash as string | null,
    });
    if (!acceso.ok) {
      logDenegacion({ ruta: "GET /api/analisis/[id]/pdf", analisisId: id, motivo: acceso.motivo, logueado: acceso.motivo === "sesion_ajena" });
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Subordinación AMBAS (migración 20260715): un hijo de un comparativo no tiene
    // PDF propio — el informe es el comparativo. Guard también en la API (no solo
    // esconder el botón). Se confirma el hermano; huérfano (grupo incompleto) →
    // se permite como análisis suelto.
    const ambasRole = (row as Record<string, unknown>).ambas_role as string | null;
    const ambasGroupId = (row as Record<string, unknown>).ambas_group_id as string | null;
    if (ambasRole === "ltr" && ambasGroupId) {
      const { data: sibling } = await supabase
        .from("analisis")
        .select("id")
        .eq("ambas_group_id", ambasGroupId)
        .eq("ambas_role", "str")
        .maybeSingle();
      if (sibling?.id) {
        return NextResponse.json(
          { error: "Este análisis es parte de una comparativa. Descarga el PDF desde el comparativo." },
          { status: 403 },
        );
      }
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
    const safeName = direccionLabel.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
    const filename = `franco-${safeName}-${id.slice(0, 8)}.pdf`;

    return renderPdf({
      request,
      // Vista documento dedicada (reemplaza ?print=true). Server-rendered, clara
      // por construcción, con sentinel [data-doc-ready] para espera determinística.
      path: `/analisis/${id}/documento`,
      filename,
      headerLabel: direccionLabel,
    });
  } catch (error) {
    console.error("[LTR PDF] Error:", error);
    captureApiError(error, { ruta: "GET /api/analisis/[id]/pdf", operacion: "generar-pdf-ltr" });
    return NextResponse.json(
      { error: "Error generando PDF", detail: (error as Error).message },
      { status: 500 },
    );
  }
}
