// ─────────────────────────────────────────────────────────────────────────
// buildPatrimonioSeriesSTR — adapta results.projections (YearProjectionSTR[])
// al shape PatrimonioRow que consume PatrimonioChartSVG (reuso del componente
// SVG genérico del documento LTR; ver /analisis/[id]/documento/PatrimonioChartSVG).
//
// Fuente única con el chart web STR: replica EXACTO el useMemo de
// PatrimonioChartSTR.tsx (derivación del aporteAcum), agregando los dos campos
// que PatrimonioRow pide y el chart web no cargaba (flujoAcumulado, isPreEntrega).
// El motor STR compoundéa desde el año 1 y no modela entrega futura → isPreEntrega
// siempre false, valorDepto siempre presente.
// ─────────────────────────────────────────────────────────────────────────

import type { PatrimonioRow } from "./patrimonio-series";
import type { ShortTermResult } from "./engines/short-term-engine";

export function buildPatrimonioSeriesSTR(results: ShortTermResult): PatrimonioRow[] {
  const projections = results.projections ?? [];
  if (projections.length === 0) return [];
  const capitalInicial = results.capitalInvertido;
  // Precio pactado: el motor STR deriva pie y crédito del precio de compra
  // (short-term-engine.ts:825-826), así que la suma lo reconstruye exacto.
  // STR compoundéa desde precioCompra en el año 1 (:834) — misma base que LTR.
  const precioPactadoCLP = results.pie + results.montoCredito;

  return projections.map((p) => {
    // Aporte acumulado: capital inicial + |suma de flujos operacionales negativos
    // hasta el año p.year| (espejo EXACTO de PatrimonioChartSTR.tsx:48-53).
    const aportesNegativos = projections
      .slice(0, p.year)
      .filter((q) => q.flujoOperacionalAnual < 0)
      .reduce((sum, q) => sum + Math.abs(q.flujoOperacionalAnual), 0);

    return {
      anio: p.year,
      aporteAcum: capitalInicial + aportesNegativos,
      valorDepto: p.valorDepto,
      precioPactadoCLP,
      patrimonioNeto: p.patrimonioNeto, // valorDepto − saldoCredito (sin flujo · homologación LTR)
      flujoAcumulado: p.flujoAcumulado,
      deudaPendiente: p.saldoCredito,
      isPreEntrega: false, // STR no modela entrega futura (compoundéa desde año 1)
    };
  });
}
