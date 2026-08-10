// ─────────────────────────────────────────────────────────────────────────
// Vista DOCUMENTO comparativa (AMBAS) — ruta dedicada que visita Puppeteer para
// el PDF. Espejo estructural de los documentos LTR y STR: guard-only (el gate de
// caché IA vive en la ruta /pdf), light por construcción, sentinel [data-doc-ready].
//
// Identifica el par igual que la vista pública: el token codifica {ltrId, strId}
// (las dos filas del grupo AMBAS). Carga y recompute IDÉNTICOS a
// /share/comparativa/[token] — incluida la homologación: el lado STR se recomputa
// con la UF congelada del lado LTR (TIR-neutral) para que ambas bases CLP calcen.
// Cero recálculo propio.
// ─────────────────────────────────────────────────────────────────────────

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUFValue, resolveUfForAnalysis } from "@/lib/uf";
import { decodeShareToken } from "@/lib/share-token";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import type { Analisis, FullAnalysisResult, AIAnalysisComparativa, AnalisisInput } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";
import { PROMPT_VERSION_AMBAS } from "@/lib/ai-generation-ambas";
import { DocumentoAmbas } from "./DocumentoAmbas";
import "./documento.css";

export const dynamic = "force-dynamic";

type LTRResultsWithCache = FullAnalysisResult & {
  comparativaAI?: AIAnalysisComparativa;
  tipoAnalisis?: string;
};

type STRResultsWithScore = ShortTermResult & {
  tipoAnalisis?: string;
  francoScore?: FrancoScoreSTR;
};

export default async function DocumentoAmbasPage({
  params,
}: {
  params: { token: string };
}) {
  const decoded = decodeShareToken(params.token);
  if (!decoded) {
    notFound();
  }

  const supabase = createClient();
  const [{ data: ltrRow }, { data: strRow }, ufValue] = await Promise.all([
    supabase.from("analisis").select("*").eq("id", decoded.ltrId).single(),
    supabase.from("analisis").select("*").eq("id", decoded.strId).single(),
    getUFValue(),
  ]);

  if (!ltrRow || !strRow) {
    notFound();
  }

  // Guard de roles: SQL `tipo_analisis` autoritativa; jsonb solo si SQL es null.
  const ltrSql = (ltrRow as Record<string, unknown>).tipo_analisis as string | null | undefined;
  const strSql = (strRow as Record<string, unknown>).tipo_analisis as string | null | undefined;
  const ltrIsSTR =
    ltrSql === "short-term" ||
    (ltrSql == null && (ltrRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis === "short-term");
  const strIsSTR =
    strSql === "short-term" ||
    (strSql == null && (strRow.results as { tipoAnalisis?: string } | null)?.tipoAnalisis === "short-term");
  if (ltrIsSTR || !strIsSTR) {
    notFound();
  }

  const ltr = ltrRow as Analisis;
  const str = strRow as Analisis & { results?: STRResultsWithScore };
  const ltrResultsPersisted = (ltr.results ?? null) as LTRResultsWithCache | null;
  const strResultsPersisted = (str.results ?? null) as STRResultsWithScore | null;

  if (!ltrResultsPersisted || !strResultsPersisted) {
    notFound();
  }

  const strInput = (str.input_data ?? null) as Record<string, unknown> | null;
  const costoAmoblamiento = (strInput?.costoAmoblamiento as number) ?? 0;
  const modoGestion = ((strInput?.modoGestion as string) ?? "auto") as "auto" | "admin";
  const comisionAdministrador = (strInput?.comisionAdministrador as number) ?? 0.2;
  const edificioPermiteAirbnb = (strInput?.edificioPermiteAirbnb as string) ?? "no_seguro";

  // Homologación: el lado STR adopta la UF real reconstruida del lado LTR.
  const ltrUfFrozen = resolveUfForAnalysis(
    ltrResultsPersisted as { metrics?: { precioCLP?: number | null } | null } | null,
    ltr.input_data as { precio?: number | null } | null,
    ufValue,
    ltr.id,
  );

  const ltrInput = (ltr.input_data ?? null) as AnalisisInput | null;
  const ltrAsOfFrozen = new Date(ltr.created_at ?? new Date().toISOString());
  const ltrMediana = ltrInput
    ? await prefetchMedianaComunaVenta(supabase, ltrInput, ltrUfFrozen)
    : { mediana: null, n: 0 };
  const ltrResults = (
    ltrInput
      ? { ...recomputeResultsForLegacy(ltrInput, ltrUfFrozen, ltrMediana, ltrAsOfFrozen), comparativaAI: ltrResultsPersisted?.comparativaAI }
      : ltrResultsPersisted
  ) as LTRResultsWithCache;

  const strAsOfFrozen = new Date(str.created_at ?? new Date().toISOString());
  const strMediana = strInput
    ? await prefetchMedianaComunaVenta(
        supabase,
        {
          comuna: (strInput.comuna as string) ?? str.comuna ?? "",
          superficie: Number(strInput.superficieUtil) || 0,
          dormitorios: Number(strInput.dormitorios) || 0,
          esNuevo: strInput.tipoPropiedad === "nuevo",
          antiguedad: typeof strInput.antiguedad === "number" ? strInput.antiguedad : undefined,
        },
        ltrUfFrozen,
      )
    : { mediana: null, n: 0 };
  const strResults = (recomputeShortTermForLegacy(
    strInput,
    strResultsPersisted,
    ltrUfFrozen,
    strAsOfFrozen,
    strMediana,
  ) ?? strResultsPersisted) as STRResultsWithScore;

  const direccionLabel = ltr.direccion
    ? formatDireccionDisplay(ltr.direccion as string, ltr.comuna as string | null)
    : (ltr.comuna ? `Depto en ${ltr.comuna}` : "Análisis comparativo");

  return (
    <DocumentoAmbas
      token={params.token}
      ltrResults={ltrResults}
      strResults={strResults}
      // Cache VERSION-AWARE (espejo de la web logueada y del share). El PDF no
      // regenera: con una versión vieja los 3 movimientos se omiten y el
      // documento queda motor-templated completo (Plan C). Sin esto el PDF
      // imprimía prosa v2 bajo el hero v3.
      ai={
        ltrResults?.comparativaAI?.promptVersion === PROMPT_VERSION_AMBAS
          ? ltrResults.comparativaAI
          : null
      }
      ltrInput={(ltr.input_data ?? null) as Record<string, unknown> | null}
      strInput={strInput}
      ltrScore={ltr.score ?? 0}
      strScore={strResults?.francoScore?.score ?? 0}
      ufFrozen={ltrUfFrozen}
      comuna={ltr.comuna ?? str.comuna ?? ""}
      direccionLabel={direccionLabel}
      costoAmoblamiento={costoAmoblamiento}
      modoGestion={modoGestion}
      comisionAdministrador={comisionAdministrador}
      edificioPermiteAirbnb={edificioPermiteAirbnb}
    />
  );
}
