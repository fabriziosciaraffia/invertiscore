// ─────────────────────────────────────────────────────────────────────────
// Ruta DOCUMENTO LTR — GET /analisis/[id]/documento
//
// Vista dedicada del informe LTR como documento (contrato mockup-pdf-ltr.html
// v2.1). Es la superficie que Puppeteer (render-pdf.ts) visita para generar el
// PDF LTR — reemplazó al modo `?print=true` (retirado). Sin chrome de
// navegación: el header/footer corridos y la paginación los aporta page.pdf().
//
// Carga de datos y guard: espejo verbatim de /analisis/[id]/page.tsx — cero
// recálculo ni lógica nueva de motor. Tema claro estructural (no lee el theme).
// ─────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUFValue, resolveUfForAnalysis } from "@/lib/uf";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { enrichMetricsLegacy } from "@/lib/analysis/enrich-metrics-legacy";
import { hasNewAiStructure, PROMPT_VERSION_LTR } from "@/lib/ai-generation";
import { prefetchMedianaComunaVenta, type MedianaComunaSnapshot } from "@/lib/api-helpers/analisis-pipeline";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import { evaluarAccesoDocumento, logDenegacion } from "@/lib/pdf/documento-access";
import { readVeredicto } from "@/lib/results-helpers";
import type { Analisis, AnalisisInput, FullAnalysisResult, AIAnalysisV2 } from "@/lib/types";
import { stripMarcasDeep } from "@/lib/prosa-marcas";
import { DocumentoLTR } from "./DocumentoLTR";
import "./documento.css";

export const dynamic = "force-dynamic";

// Informe de usuario en vista documento: nunca indexable.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** T5: el PDF LTR vuelve a la UI cuando se reescriba sobre los cinco capítulos. */
const PDF_LTR_VISIBLE = false;

export default async function DocumentoLTRPage({
  params,
}: {
  params: { id: string };
}) {
  // T5 (03-sep-2026): el documento LTR está fuera de la UI — redirige al informe web
  // ANTES de consultar nada (sin fila, sin recompute). El resto de esta página y
  // DocumentoLTR.tsx se quedan en el repo para la reescritura sobre los cinco capítulos
  // (goal propio después de STR). STR y AMBAS no pasan por acá.
  if (!PDF_LTR_VISIBLE) {
    redirect(`/analisis/${params.id}?desde=documento`);
  }

  const supabase = createClient();

  const [{ data: { user } }, ufValue] = await Promise.all([
    supabase.auth.getUser(),
    getUFValue(),
  ]);

  const { data } = await supabase
    .from("analisis")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) {
    redirect(user ? "/dashboard" : "/");
  }

  // ── Gating dueño-only (D-1) ──
  // Antes de cualquier cómputo: quien no es dueño (ni admin, ni el renderer de
  // PDFs) no tiene por qué gastar el recompute. Va a `/analisis/[id]`, la vista
  // pública diseñada para compartir, con marca para medir el rebote.
  const acceso = evaluarAccesoDocumento({
    fila: {
      user_id: (data as Record<string, unknown>).user_id as string | null,
      anon_claim_token_hash: (data as Record<string, unknown>).anon_claim_token_hash as string | null,
    },
    user: user ?? null,
    permitirRenderer: true,
  });
  if (!acceso.ok) {
    logDenegacion({
      ruta: "/analisis/[id]/documento",
      analisisId: params.id,
      motivo: acceso.motivo,
      logueado: !!user,
    });
    redirect(`/analisis/${params.id}?desde=documento`);
  }

  // Guard STR (espejo de page.tsx:101-108): un análisis short-term no tiene
  // documento LTR — redirige a su ruta (el documento STR migra en otro goal).
  const rawTipo = (data as Record<string, unknown>).tipo_analisis;
  const rawResultsForGuard = (data as { results?: { tipoAnalisis?: string } }).results;
  if (
    rawTipo === "short-term" ||
    (rawTipo == null && rawResultsForGuard?.tipoAnalisis === "short-term")
  ) {
    redirect(`/analisis/renta-corta/${params.id}`);
  }

  const analisis = data as Analisis;

  // Recompute idempotente (espejo de page.tsx:130-177): UF congelada, mediana
  // snapshot-gana, fecha congelada a created_at. Cero lógica nueva.
  const rawResults: FullAnalysisResult | null = analisis.results || null;
  const inputDataRaw = analisis.input_data as AnalisisInput | undefined;
  const ufFrozen = resolveUfForAnalysis(rawResults, inputDataRaw, ufValue, analisis.id);

  const medianaSnapshot = (data as Record<string, unknown>).mediana_comuna_snapshot as
    | MedianaComunaSnapshot
    | null
    | undefined;
  const medianaComuna = inputDataRaw
    ? (medianaSnapshot != null
        ? { mediana: medianaSnapshot.mediana, n: medianaSnapshot.n ?? 0 }
        : await prefetchMedianaComunaVenta(supabase, inputDataRaw, ufFrozen))
    : undefined;

  const asOfFrozen = new Date(analisis.created_at);
  const results: FullAnalysisResult | null = inputDataRaw
    ? recomputeResultsForLegacy(inputDataRaw, ufFrozen, medianaComuna, asOfFrozen)
    : (rawResults && rawResults.metrics
        ? { ...rawResults, metrics: enrichMetricsLegacy(rawResults.metrics, {} as AnalisisInput) }
        : rawResults);

  // Sin results no hay documento posible (análisis legacy sin motor). Cae al informe.
  if (!results || !results.metrics) {
    redirect(`/analisis/${params.id}`);
  }

  // AI persistido + freshness (espejo de page.tsx:280-283). ai_analysis vive en
  // columna aparte; el recompute nunca lo toca.
  const ltrAiPersisted = (data as Record<string, unknown>).ai_analysis;
  const ltrAiFresh =
    hasNewAiStructure(ltrAiPersisted) &&
    (ltrAiPersisted as { promptVersion?: number }).promptVersion === PROMPT_VERSION_LTR;
  // stripMarcasDeep: la prosa v10 trae destacadores `**…**` para el informe web
  // (FASE 2 dictamen); el PDF queda FUERA del rediseño y los pinta crudos si no
  // se strippean. Mismo render tolerante que la raíz web.
  const ai: AIAnalysisV2 | null = ltrAiFresh
    ? stripMarcasDeep(ltrAiPersisted as unknown as AIAnalysisV2)
    : null;

  const veredicto = readVeredicto(results) ??
    (analisis.score >= 70 ? "COMPRAR" : analisis.score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA");

  const direccionLabel = analisis.direccion
    ? formatDireccionDisplay(analisis.direccion as string, analisis.comuna as string | null)
    : (analisis.comuna ? `Depto en ${analisis.comuna}` : "Análisis de inversión");

  const fechaCorta = new Date(analisis.created_at).toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric",
  });

  // Zona: la card muestra encuadre neutro. El insight narrativo
  // (headline/preview/narrative) se genera client-side (useZoneInsight) y no está
  // disponible en el server sin disparar IA. DESVIACIÓN documentada: el narrativo
  // se cablea en un goal posterior.
  return (
    <DocumentoLTR
      id={analisis.id}
      results={results}
      ai={ai}
      inputData={inputDataRaw}
      veredicto={veredicto}
      score={analisis.score}
      ufFrozen={ufFrozen}
      nombre={analisis.nombre}
      comuna={analisis.comuna}
      ciudad={analisis.ciudad}
      direccionLabel={direccionLabel}
      fechaCorta={fechaCorta}
      zonaLugares={null}
    />
  );
}
