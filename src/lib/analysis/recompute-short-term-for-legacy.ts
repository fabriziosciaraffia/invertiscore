import { calcShortTerm, type ShortTermInputs, type ShortTermResult } from "@/lib/engines/short-term-engine";
import { calcFrancoScoreSTR, type FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { buildStrHallazgos } from "@/lib/str-hallazgos";
import { buildAirbnbData } from "@/lib/api-helpers/analisis-pipeline";

/**
 * Recompute-on-load STR — espejo de `recomputeResultsForLegacy` (LTR). Reconstruye el
 * `results` persistido desde `input_data` + el `airbnbRaw` congelado en la fila, usando el
 * motor actual. Garantiza que la evolución del motor (rama comparabilidad-motores:
 * patrimonio sin flujo, equity/multiplicador homologados a LTR, inflación de flujos) se
 * refleje en filas persistidas SIN escribir la DB — idéntico patrón idempotente que LTR.
 *
 * Determinismo: usa el `airbnbRaw` PERSISTIDO (no re-pega a AirROI) y la UF CONGELADA
 * reconstruida de precioCompra/precioCompraUF, igual que LTR congela la suya. La mediana
 * comunal (sobreprecio de la pirámide) se prefetchea en el caller y se inyecta — sin ella
 * el hallazgo de sobreprecio se omite (N−1), así que el caller DEBE resolverla para paridad.
 *
 * Devuelve `null` cuando falta el `airbnbRaw` o el `input_data` mínimo (filas legacy
 * irreconstruibles) → el caller cae al `results` persistido tal cual (fallback seguro).
 *
 * asOf: congelada a created_at por el caller (espejo LTR). Hoy es no-op en la aritmética
 * STR (pre-entrega diferido; el motor la void-ea) pero fija la firma para esa rama futura.
 */
export type ShortTermResultsPersisted = ShortTermResult & {
  tipoAnalisis: "short-term";
  francoScore: FrancoScoreSTR;
  airbnbRaw: unknown;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function recomputeShortTermForLegacy(
  inputData: Record<string, any> | null | undefined,
  persistedResults: { airbnbRaw?: unknown; ocupacionRealizadaComparables?: ShortTermResult["ocupacionRealizadaComparables"] } | null | undefined,
  ufClp: number,
  asOf: Date,
  mediana: { mediana: number | null; n: number },
): ShortTermResultsPersisted | null {
  const airbnbRaw = persistedResults?.airbnbRaw;
  if (!airbnbRaw || !inputData || typeof inputData.precioCompra !== "number") return null;

  const airbnbData = buildAirbnbData(airbnbRaw as any, ufClp);

  // P2 (Rama 0b): base CLP re-escalada al MISMO `ufClp` que convierte el revenue
  // (buildAirbnbData arriba) → precio y revenue quedan en la misma UF, de modo que los
  // ratios (TIR, multiplicador de capital) son INVARIANTES al cambio de UF: solo re-escalan
  // las magnitudes CLP absolutas (patrimonio, saldo). precioCompra se deriva de
  // `precioCompraUF × ufClp`. Con la UF congelada propia (standalone) es no-op; en el
  // comparativo AMBAS el caller inyecta la UF real reconstruida del lado LTR, homologando la
  // base de ambos motores sin mover el veredicto STR. Fallback al precioCompra persistido si
  // no hay `precioCompraUF` reconstruible (fila legacy).
  const precioCompraUF =
    typeof inputData.precioCompraUF === "number" && inputData.precioCompraUF > 0
      ? inputData.precioCompraUF
      : null;
  const precioCompraBase =
    precioCompraUF != null ? Math.round(precioCompraUF * ufClp) : inputData.precioCompra;

  // Reconstrucción idéntica a buildShortTermAnalysisRow (analisis-pipeline.ts:496-526).
  const antiguedadEsFallback = inputData.antiguedad == null;
  const antiguedadResuelta = inputData.antiguedad ?? (inputData.tipoPropiedad === "nuevo" ? 0 : 5);
  const inputs: ShortTermInputs = {
    precioCompra: precioCompraBase,
    superficie: inputData.superficieUtil,
    dormitorios: inputData.dormitorios,
    banos: inputData.banos,
    tipoPropiedad: typeof inputData.tipoPropiedad === "string" ? inputData.tipoPropiedad : undefined,
    antiguedad: antiguedadResuelta,
    antiguedadEsFallback,
    comuna: typeof inputData.comuna === "string" ? inputData.comuna : undefined,
    piePercent: inputData.piePct / 100,
    tasaCredito: inputData.tasaInteres / 100,
    plazoCredito: inputData.plazoCredito,
    airbnbData,
    modoGestion: inputData.modoGestion,
    comisionAdministrador: inputData.comisionAdministrador,
    tipoEdificio: inputData.tipoEdificio,
    habilitacion: inputData.habilitacion,
    adminPro: inputData.adminPro === true,
    adrOverride: typeof inputData.adrOverride === "number" ? inputData.adrOverride : null,
    occOverride: typeof inputData.occOverride === "number" ? inputData.occOverride : null,
    costoElectricidad: inputData.costoElectricidad,
    costoAgua: inputData.costoAgua,
    costoWifi: inputData.costoWifi,
    costoInsumos: inputData.costoInsumos,
    gastosComunes: inputData.gastosComunes,
    mantencion: inputData.mantencion,
    contribuciones: inputData.contribuciones || 0,
    costoAmoblamiento: inputData.estaAmoblado ? 0 : (inputData.costoAmoblamiento || 0),
    arriendoLargoMensual: inputData.arriendoLargoMensual,
    valorUF: ufClp,
  };

  const result = calcShortTerm(inputs, asOf);

  const lat = typeof inputData.lat === "number" ? inputData.lat : -33.4378;
  const lng = typeof inputData.lng === "number" ? inputData.lng : -70.6504;
  const monthlyRevenue = Array.isArray(airbnbData.monthly_revenue) ? airbnbData.monthly_revenue : [];
  const revenueP50 = airbnbData.percentiles?.revenue?.p50 ?? airbnbData.estimated_annual_revenue ?? 0;

  const francoScore = calcFrancoScoreSTR({
    results: result,
    precioCompra: precioCompraBase,
    dormitorios: inputData.dormitorios,
    superficie: inputData.superficieUtil,
    regulacionEdificio: inputData.edificioPermiteAirbnb || "no_seguro",
    lat,
    lng,
    revenueP50,
    monthlyRevenue,
  });

  const strHallazgos = buildStrHallazgos({
    result,
    francoScore,
    comuna: typeof inputData.comuna === "string" ? inputData.comuna : "",
    precioUF: inputData.precioCompraUF,
    superficieM2: inputData.superficieUtil,
    piePct: inputData.piePct,
    tasaPct: inputData.tasaInteres,
    plazoAnios: inputData.plazoCredito,
    mediana,
    valorUF: ufClp,
    incluyeCorretaje: false,
  });
  const hallazgos = [...(result.hallazgos ?? []), ...strHallazgos];

  return {
    ...result,
    hallazgos,
    tipoAnalisis: "short-term",
    veredicto: francoScore.veredicto,
    francoScore,
    airbnbRaw,
    ...(persistedResults?.ocupacionRealizadaComparables
      ? { ocupacionRealizadaComparables: persistedResults.ocupacionRealizadaComparables }
      : {}),
  };
}
