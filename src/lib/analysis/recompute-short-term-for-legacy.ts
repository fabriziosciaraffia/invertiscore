import { calcShortTerm, type ShortTermInputs, type ShortTermResult } from "@/lib/engines/short-term-engine";
import { calcFrancoScoreSTR, type FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { buildStrHallazgos, mergeHallazgosStr } from "@/lib/str-hallazgos";
import { buildAirbnbData } from "@/lib/api-helpers/analisis-pipeline";
import { piePercentDesdeInputData } from "@/lib/analysis/pie-input-data";
import type { ScoreSTRExtras } from "@/lib/analysis/veredicto-str-con-patch";

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

/**
 * Reconstrucción de los DOS objetos que deciden el veredicto STR de una fila persistida:
 * `ShortTermInputs` (motor) y los extras de `ScoreSTRInputs` (dimensión factibilidad).
 * Extraído de `recomputeShortTermForLegacy` para que el closure `veredictoStrConPatch` y el
 * recompute-on-load partan del MISMO input reconstruido — si divergieran, el hallazgo de
 * distancia mediría contra un análisis que no es el que el usuario está leyendo.
 *
 * Devuelve `null` con los mismos guards que el recompute (sin airbnbRaw / sin input_data).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function buildStrRecomputeCtx(
  inputData: Record<string, any> | null | undefined,
  persistedResults: { airbnbRaw?: unknown } | null | undefined,
  ufClp: number,
): { inputs: ShortTermInputs; scoreExtras: ScoreSTRExtras; airbnbRaw: unknown } | null {
  const airbnbRaw = persistedResults?.airbnbRaw;
  if (!airbnbRaw || !inputData || typeof inputData.precioCompra !== "number") return null;

  // Pie normalizado (piePct % del pipeline actual | piePercent fracción legacy
  // — fuente única en pie-input-data). Sin pie en ninguna convención la fila es
  // irreconstruible: antes `inputData.piePct / 100` daba NaN y envenenaba todo
  // el recompute en silencio; el `null` cae al `results` persistido, que es el
  // fallback seguro documentado arriba.
  const piePercent = piePercentDesdeInputData(inputData);
  if (piePercent == null) return null;

  const airbnbData = buildAirbnbData(airbnbRaw as any, ufClp);

  // P2 (Rama 0b): base CLP re-escalada al MISMO `ufClp` que convierte el ingreso
  // (buildAirbnbData arriba) → precio y ingreso quedan en la misma UF, de modo que los
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
    piePercent,
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
    // Gate del modelo de costos: la versión estampada al crear. Filas previas no
    // la traen ⇒ legacy ⇒ curva de CapEx idéntica a la que las generó.
    methodologyVersion: typeof inputData.methodologyVersion === "string" ? inputData.methodologyVersion : undefined,
    // Entrega futura. Sin esto el recompute-on-load reconstruía SIEMPRE como
    // entrega inmediata, así que la pre-entrega del motor no se veía al abrir
    // un análisis persistido — solo al crearlo. El `asOf` que este helper ya
    // congela contra created_at es justamente lo que la vuelve estable.
    estadoVenta: inputData.estadoVenta,
    fechaEntrega: inputData.fechaEntrega,
  };

  const lat = typeof inputData.lat === "number" ? inputData.lat : -33.4378;
  const lng = typeof inputData.lng === "number" ? inputData.lng : -70.6504;
  const ingresoMensualScore = Array.isArray(airbnbData.monthly_revenue) ? airbnbData.monthly_revenue : [];
  const ingresoP50 = airbnbData.percentiles?.revenue?.p50 ?? airbnbData.estimated_annual_revenue ?? 0;

  return {
    inputs,
    airbnbRaw,
    scoreExtras: {
      dormitorios: inputData.dormitorios,
      superficie: inputData.superficieUtil,
      regulacionEdificio: inputData.edificioPermiteAirbnb || "no_seguro",
      lat,
      lng,
      ingresoP50,
      ingresoMensualScore,
    },
  };
}

export function recomputeShortTermForLegacy(
  inputData: Record<string, any> | null | undefined,
  persistedResults: { airbnbRaw?: unknown; ocupacionRealizadaComparables?: ShortTermResult["ocupacionRealizadaComparables"] } | null | undefined,
  ufClp: number,
  asOf: Date,
  mediana: { mediana: number | null; n: number },
): ShortTermResultsPersisted | null {
  const ctx = buildStrRecomputeCtx(inputData, persistedResults, ufClp);
  if (!ctx || !inputData) return null;
  const { inputs, scoreExtras, airbnbRaw } = ctx;

  const result = calcShortTerm(inputs, asOf);

  const francoScore = calcFrancoScoreSTR({
    ...scoreExtras,
    results: result,
    precioCompra: inputs.precioCompra,
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
    // Distancia al veredicto: el MISMO input reconstruido que produjo `result`, así que la
    // distancia se mide contra el análisis que el usuario tiene en pantalla.
    veredictoCtx: { inputs, scoreExtras, asOf },
  });
  const hallazgos = mergeHallazgosStr(result.hallazgos, strHallazgos);

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
