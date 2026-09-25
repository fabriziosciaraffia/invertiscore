import { normalizarResultsStrPersistidos } from "@/lib/analysis/normalizar-results-str";
// ─────────────────────────────────────────────────────────────────────────
// Vista DOCUMENTO STR (renta corta) — ruta dedicada que visita Puppeteer para
// el PDF. Espejo estructural de /analisis/[id]/documento (LTR): guard-only (sin
// accessLevel — el gate vive en la ruta /pdf), light por construcción, con
// sentinel [data-doc-ready]. Carga los datos con el MISMO pipeline STR que
// /analisis/renta-corta/[id] (recomputeShortTermForLegacy) — cero recálculo propio.
// ─────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUFValue } from "@/lib/uf";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { conOcupacionRealizadaDelCache } from "@/lib/airbnb/ocupacion-realizada-cache";
import { prefetchMercadoStr } from "@/lib/api-helpers/analisis-pipeline";
import type { StrRefZonaSnapshot } from "@/lib/strref-zona";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { AIAnalysisSTRv2 } from "@/lib/types";
import { DocumentoSTR } from "./DocumentoSTR";
import "./documento.css";
import { evaluarAccesoDocumento, logDenegacion } from "@/lib/pdf/documento-access";

export const dynamic = "force-dynamic";

// Informe de usuario en vista documento: nunca indexable (misma regla que el LTR).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** 25-sep-2026: el documento STR sale de la UI, igual que el LTR, al salir la IA del informe. */
const PDF_STR_VISIBLE = false;

export default async function DocumentoSTRPage({ params }: { params: { id: string } }) {
  // 25-sep-2026: fuera de la UI, espejo del LTR — redirige al informe web ANTES de consultar nada.
  // El resto de esta página y DocumentoSTR.tsx se quedan para la reescritura sobre el motor.
  if (!PDF_STR_VISIBLE) {
    redirect(`/analisis/renta-corta/${params.id}?desde=documento`);
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

  // ── Gating dueño-only (D-1) ── espejo verbatim del LTR. Ver documento-access.
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
      ruta: "/analisis/renta-corta/[id]/documento",
      analisisId: params.id,
      motivo: acceso.motivo,
      logueado: !!user,
    });
    redirect(`/analisis/renta-corta/${params.id}?desde=documento`);
  }

  const persistedResults = normalizarResultsStrPersistidos(data.results as (ShortTermResult & { tipoAnalisis?: string }) | null);

  // Guard: un análisis long-term va al documento LTR (espejo del guard inverso).
  const tipoCol = (data as Record<string, unknown>).tipo_analisis;
  if (tipoCol === "long-term" || (tipoCol == null && persistedResults?.tipoAnalisis !== "short-term")) {
    redirect(`/analisis/${params.id}/documento`);
  }
  if (!persistedResults) {
    redirect(user ? "/dashboard" : "/");
  }

  // Recompute UF-congelada (mismo pipeline que la ruta de resultados STR).
  const inputDataStr = data.input_data as Record<string, unknown> | null;
  const precioCompraUF = Number(inputDataStr?.precioCompraUF) || 0;
  const precioCompraCLP = Number(inputDataStr?.precioCompra) || 0;
  const ufFrozen = precioCompraUF > 0 ? precioCompraCLP / precioCompraUF : ufValue;
  const asOfFrozen = new Date(data.created_at ?? new Date().toISOString());
  const medianaStr = inputDataStr
    ? await prefetchMercadoStr(
        supabase,
        {
          comuna: (inputDataStr.comuna as string) ?? "",
          superficie: Number(inputDataStr.superficieUtil) || 0,
          dormitorios: Number(inputDataStr.dormitorios) || 0,
          esNuevo: inputDataStr.tipoPropiedad === "nuevo",
          antiguedad: typeof inputDataStr.antiguedad === "number" ? inputDataStr.antiguedad : undefined,
        },
        ufFrozen,
        ((data as Record<string, unknown>).strref_zona_snapshot as StrRefZonaSnapshot | null | undefined) ?? null,
      )
    : { mediana: null, n: 0 };

  const recomputed = recomputeShortTermForLegacy(
    inputDataStr,
    await conOcupacionRealizadaDelCache(inputDataStr, persistedResults),
    ufFrozen,
    asOfFrozen,
    medianaStr,
  );
  const results = (recomputed ?? persistedResults) as ShortTermResult & { francoScore?: FrancoScoreSTR; tipoAnalisis?: string };

  // La prosa IA salió del informe (25-sep-2026): el documento, cuando vuelva, se escribe sin ella.
  const ai: AIAnalysisSTRv2 | null = null;

  const direccionLabel = data.direccion
    ? formatDireccionDisplay(data.direccion as string, data.comuna as string | null)
    : (data.comuna ? `Depto en ${data.comuna}` : "Análisis de renta corta");

  return (
    <DocumentoSTR
      id={data.id}
      results={results}
      ai={ai}
      inputData={inputDataStr}
      ufFrozen={ufFrozen}
      nombre={data.nombre}
      comuna={data.comuna}
      ciudad={data.ciudad}
      direccionLabel={direccionLabel}
    />
  );
}
