// ─────────────────────────────────────────────────────────────────────────
// PDF Generation — Análisis STR (renta corta)
//
// Endpoint: GET /api/analisis/renta-corta/[id]/pdf
// Strategy: reusa el helper compartido src/lib/pdf/render-pdf.ts (Puppeteer +
// @sparticuz/chromium). Navega a la vista documento dedicada
// /analisis/renta-corta/[id]/documento (server-rendered, clara por construcción,
// con sentinel [data-doc-ready] para espera determinística). Ya no usa
// ?print=true ni el fix forceLightTheme — el documento es claro estructural.
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
import { captureApiError } from "@/lib/observabilidad";
import { createClient } from "@/lib/supabase/server";
import { renderPdf } from "@/lib/pdf/render-pdf";
import { accesoPdf, logDenegacion } from "@/lib/pdf/documento-access";
import { formatDireccionDisplay } from "@/lib/format-direccion";

/** 25-sep-2026: el PDF STR sale de la UI, igual que el LTR, al salir la IA del informe. */
const PDF_STR_VISIBLE = false;

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
      .select("id, comuna, direccion, ambas_role, ambas_group_id, user_id, anon_claim_token_hash")
      .eq("id", id)
      .single();
    if (!row) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    // 25-sep-2026: el PDF STR está fuera de la UI, igual que el LTR (mismo 410). El documento
    // imprimía la prosa de la IA —su titular, el reencuadre y cuatro capítulos— y exigía que
    // existiera (425); la IA salió del informe y ya no se genera. Vuelve cuando se reescriba sobre
    // el informe del motor. 410: retirado, no roto.
    if (!PDF_STR_VISIBLE) {
      return NextResponse.json(
        { error: "El PDF del informe de renta corta está fuera de la UI desde el 25-sep-2026; se reescribe sobre el informe del motor." },
        { status: 410 },
      );
    }

    // Gating dueño-only (D-1), espejo del LTR: el secreto del renderer NO abre
    // esta puerta — acá el solicitante tiene que ser dueño. Ver documento-access.
    const acceso = await accesoPdf(supabase, {
      user_id: (row as Record<string, unknown>).user_id as string | null,
      anon_claim_token_hash: (row as Record<string, unknown>).anon_claim_token_hash as string | null,
    });
    if (!acceso.ok) {
      logDenegacion({ ruta: "GET /api/analisis/renta-corta/[id]/pdf", analisisId: id, motivo: acceso.motivo, logueado: acceso.motivo === "sesion_ajena" });
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Subordinación AMBAS (migración 20260715): hijo STR de un comparativo → sin
    // PDF propio. Guard en la API, con confirmación del hermano (huérfano → suelto).
    const ambasRole = (row as Record<string, unknown>).ambas_role as string | null;
    const ambasGroupId = (row as Record<string, unknown>).ambas_group_id as string | null;
    if (ambasRole === "str" && ambasGroupId) {
      const { data: sibling } = await supabase
        .from("analisis")
        .select("id")
        .eq("ambas_group_id", ambasGroupId)
        .eq("ambas_role", "ltr")
        .maybeSingle();
      if (sibling?.id) {
        return NextResponse.json(
          { error: "Este análisis es parte de una comparativa. Descarga el PDF desde el comparativo." },
          { status: 403 },
        );
      }
    }

    // Hasta el 25-sep-2026 acá había un 425 si faltaba la prosa IA. La IA salió del informe y ya no
    // se genera: el PDF, cuando vuelva, no la puede exigir.

    const direccionLabel = row.direccion
      ? formatDireccionDisplay(row.direccion as string, row.comuna as string | null)
      : (row.comuna ? `Depto en ${row.comuna}` : "Análisis de inversión");
    const safeName = direccionLabel.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
    const filename = `franco-renta-corta-${safeName}-${id.slice(0, 8)}.pdf`;

    return renderPdf({
      request,
      // Vista documento dedicada (reemplaza ?print=true). Server-rendered, clara
      // por construcción, con sentinel [data-doc-ready] para espera determinística.
      path: `/analisis/renta-corta/${id}/documento`,
      filename,
      headerLabel: direccionLabel,
    });
  } catch (error) {
    console.error("[STR PDF] Error:", error);
    captureApiError(error, { ruta: "GET /api/analisis/renta-corta/[id]/pdf", operacion: "generar-pdf-str" });
    return NextResponse.json(
      { error: "Error generando PDF", detail: (error as Error).message },
      { status: 500 },
    );
  }
}
