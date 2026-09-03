// ============================================================================
// CENSO EDITORIAL — prosa fresca (persist:false, cero writes)
// ============================================================================
// Genera la prosa que el usuario VERÍA tras el lazy-regen del producto, sin
// escribir nada en la base. Existe para el re-censo contra una línea base cuyo
// parque quedó en promptVersion vieja: el censo con --prosa-fresca mide el
// prompt VIGENTE sobre las mismas filas, no la prosa persistida.
//
//  · LTR: generateAiAnalysis(id, sb, {persist:false}) — lee la fila por id y
//    recomputa solo, mismo orquestador que el pipeline y el golden FULL.
//  · STR: generateStrProse necesita el motor recomputado a mano. La prep de
//    abajo es réplica de scripts/regen-corpus-str.ts (recompute forward-only:
//    buildShortTermAnalysisRow SIN re-fetch AirROI — airbnbRaw persistido).
//    Si esta réplica y la del regen divergen, la verdad es el pipeline
//    (analisis-pipeline.ts), no ninguna de las dos copias.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../../../src/lib/engines/short-term-score";
import { buildStrHallazgos, mergeHallazgosStr } from "../../../src/lib/str-hallazgos";
import { buildAirbnbData } from "../../../src/lib/api-helpers/analisis-pipeline";
import { getComunaMedianaVentaUF, resolverCondicionMercado } from "../../../src/lib/comuna-stats";
import { generateStrProse } from "../../../src/lib/ai-generation-str";
import { generateAiAnalysis } from "../../../src/lib/ai-generation";
import type { AIAnalysisSTRv2 } from "../../../src/lib/types";
import type { AiUsage } from "../../../src/lib/ai-usage";
import type { FilaAnalisis } from "./ensamblar";

/** Prosa LTR fresca con el prompt vigente. null si la generación falla. */
export async function prosaFrescaLtr(sb: SupabaseClient, id: string): Promise<Record<string, unknown> | null> {
  return generateAiAnalysis(id, sb, { persist: false });
}

// ── buildInputs: idéntico al pipeline (analisis-pipeline.ts:496-526), copiado
// de regen-corpus-str.ts:47 ──
function buildInputs(d: any, airbnbData: any, uf: number) {
  return {
    precioCompra: d.precioCompra, superficie: d.superficieUtil, dormitorios: d.dormitorios, banos: d.banos,
    tipoPropiedad: typeof d.tipoPropiedad === "string" ? d.tipoPropiedad : undefined,
    antiguedad: d.antiguedad ?? (d.tipoPropiedad === "nuevo" ? 0 : 5), antiguedadEsFallback: d.antiguedad == null,
    comuna: typeof d.comuna === "string" ? d.comuna : undefined, piePercent: d.piePct / 100, tasaCredito: d.tasaInteres / 100,
    plazoCredito: d.plazoCredito, airbnbData, modoGestion: d.modoGestion, comisionAdministrador: d.comisionAdministrador,
    tipoEdificio: d.tipoEdificio, habilitacion: d.habilitacion, adminPro: d.adminPro === true,
    adrOverride: typeof d.adrOverride === "number" ? d.adrOverride : null, occOverride: typeof d.occOverride === "number" ? d.occOverride : null,
    costoElectricidad: d.costoElectricidad, costoAgua: d.costoAgua, costoWifi: d.costoWifi, costoInsumos: d.costoInsumos,
    gastosComunes: d.gastosComunes, mantencion: d.mantencion, contribuciones: d.contribuciones || 0,
    costoAmoblamiento: d.estaAmoblado ? 0 : (d.costoAmoblamiento || 0), arriendoLargoMensual: d.arriendoLargoMensual, valorUF: uf,
  };
}

/**
 * Prosa STR fresca con el prompt vigente sobre el motor recomputado
 * forward-only (airbnbRaw persistido, NUNCA re-fetch). Lanza si la fila no
 * tiene lo mínimo (input_data.precioCompraUF, results.airbnbRaw).
 */
export async function prosaFrescaStr(
  sb: SupabaseClient,
  anthropic: Anthropic,
  fila: Pick<FilaAnalisis, "input_data" | "results" | "comuna">,
): Promise<{ ai: AIAnalysisSTRv2; usage: AiUsage }> {
  const d: any = fila.input_data;
  const oldResults: any = fila.results;
  const comuna = (fila.comuna as string) || "";
  if (!d?.precioCompraUF || !oldResults?.airbnbRaw) throw new Error("fila STR sin precioCompraUF o airbnbRaw");

  const uf = d.precioCompra / d.precioCompraUF;
  const airbnbData = buildAirbnbData(oldResults.airbnbRaw, uf);
  const rec = calcShortTerm(buildInputs(d, airbnbData, uf) as any);
  const lat = typeof d.lat === "number" ? d.lat : -33.4378;
  const lng = typeof d.lng === "number" ? d.lng : -70.6504;
  const scoreExtras = {
    dormitorios: d.dormitorios, superficie: d.superficieUtil,
    regulacionEdificio: d.edificioPermiteAirbnb || "no_seguro", lat, lng,
    revenueP50: airbnbData.percentiles.revenue.p50, monthlyRevenue: airbnbData.monthly_revenue,
  };
  const score = calcFrancoScoreSTR({ results: rec, precioCompra: d.precioCompra, ...scoreExtras } as any);
  let mediana: { mediana: number | null; n: number } = { mediana: null, n: 0 };
  try {
    mediana = await getComunaMedianaVentaUF(sb, comuna, d.superficieUtil, d.dormitorios ?? null, uf,
      resolverCondicionMercado({ esNuevo: d.tipoPropiedad === "nuevo", antiguedad: d.antiguedad }));
  } catch { /* sin mediana → sobreprecio omitido, patrón LTR */ }
  const inputs = buildInputs(d, airbnbData, uf);
  const strHallazgos = buildStrHallazgos({
    result: rec, francoScore: score, comuna, precioUF: d.precioCompraUF, superficieM2: d.superficieUtil,
    piePct: d.piePct, tasaPct: d.tasaInteres, plazoAnios: d.plazoCredito, mediana, valorUF: uf, incluyeCorretaje: false,
    veredictoCtx: { inputs: inputs as any, scoreExtras: scoreExtras as any, asOf: new Date() },
  });
  const newResults = {
    ...rec,
    hallazgos: mergeHallazgosStr(rec.hallazgos, strHallazgos),
    tipoAnalisis: "short-term",
    veredicto: score.veredicto,
    francoScore: score,
    airbnbRaw: oldResults.airbnbRaw,
    ...(oldResults.ocupacionRealizadaComparables ? { ocupacionRealizadaComparables: oldResults.ocupacionRealizadaComparables } : {}),
  };
  const gen = await generateStrProse({ anthropic, inp: d, r: newResults as any, comuna });
  return { ai: gen.ai, usage: gen.usage };
}
