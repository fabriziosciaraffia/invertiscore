// ─────────────────────────────────────────────────────────────────────────
// Anotaciones de los charts de "LA EVIDENCIA" — módulo PURO server-safe.
//
// Fuente única del texto que PatrimonioChartComparativa y FlujoMensualChart
// muestran bajo el gráfico. Se extrajo del JSX inline de ambos componentes
// ("use client") para que el ensamblador editorial (scripts/eval/editorial/
// ensamblar-ambas.ts) lea EXACTAMENTE la prosa que la página renderiza —
// regla espejo: mismo import, misma función, nunca una copia de plantilla.
//
// Los montos que la página pinta en font-mono viajan como segmentos con
// `mono: true`: el componente los mapea a <span className="font-mono">, el
// ensamblador los une planos con `notaTexto`. Así el refactor no cambia un
// píxel del render ni un byte del texto.
// ─────────────────────────────────────────────────────────────────────────

import type { FullAnalysisResult } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { fmtMoney } from "@/components/analysis/utils";
import { hayAsimetriaDeEntrega } from "@/lib/comparativa-patrimonio";

export interface NotaSegmento {
  t: string;
  /** El render lo envuelve en <span className="font-mono">. */
  mono?: boolean;
}

/** Texto plano de una secuencia de segmentos (para el ensamblador editorial). */
export const notaTexto = (segs: NotaSegmento[]): string => segs.map((s) => s.t).join("");

type Currency = "CLP" | "UF";

// ── Chart 1 · Patrimonio y riqueza ───────────────────────────────────────────

export interface NotaPatrimonioChart {
  kicker: string;        // "AL AÑO N · …"
  cuerpo: string;        // párrafo principal (sin tramos mono en el render actual)
  glosa: NotaSegmento[]; // línea "patrimonio bruto / comisión de venta"
}

/**
 * Reproduce las derivaciones del chart (overlap capado a 10 años, riqueza =
 * activo + flujo acumulado, asimetría con LAS DOS series) solo en lo que la
 * anotación necesita. `null` cuando el chart no se dibuja (sin proyecciones).
 */
export function buildNotaPatrimonioChart(
  ltrResults: FullAnalysisResult,
  strResults: ShortTermResult,
  currency: Currency,
  ufValue: number,
): NotaPatrimonioChart | null {
  const ltrProj = ltrResults.projections ?? [];
  const strProj = strResults.projections ?? [];
  const overlap = Math.min(ltrProj.length, strProj.length, 10);
  if (overlap === 0) return null;

  const i = overlap - 1;
  const ltrRow = ltrProj[i];
  const strRow = strProj[i] as { year?: number; patrimonioNeto?: number | null; flujoAcumulado?: number } | undefined;
  const lastYear = ltrRow?.anio ?? strRow?.year ?? overlap;

  const activoLTR = ltrRow?.patrimonioNeto ?? null;
  const activoSTR = strRow?.patrimonioNeto ?? null;
  const activoFinal = activoLTR ?? 0;
  const riquezaLTRFinal = activoLTR !== null ? activoLTR + (ltrRow?.flujoAcumulado ?? 0) : 0;
  const riquezaSTRFinal = activoSTR != null ? activoSTR + (strRow?.flujoAcumulado ?? 0) : 0;
  const brecha = riquezaLTRFinal - riquezaSTRFinal;
  const ganadora = brecha >= 0 ? "renta larga" : "renta corta";

  const asimetria = hayAsimetriaDeEntrega(ltrResults.projections, ltrResults.metrics, strResults.projections);

  const valorActivoFinal = ltrProj[i]?.valorPropiedad ?? 0;
  const comisionVentaFinal = Math.round(valorActivoFinal * 0.02);

  const m = (v: number) => fmtMoney(v, currency, ufValue);

  return {
    kicker: asimetria
      ? `AL AÑO ${lastYear} · SOLO RENTA LARGA`
      : `AL AÑO ${lastYear} · EL ACTIVO EMPATA, EL CAMINO NO`,
    cuerpo: asimetria
      ? `Acá va solo la renta larga: ${m(activoFinal)} de activo neto de deuda al año ${lastYear}, y ${m(riquezaLTRFinal)} descontando lo que pones de tu bolsillo por el camino. La renta corta no se dibuja porque este depto todavía no se entrega: con renta larga el crédito recién empieza a correr cuando lo recibas, y su proyección aún no descuenta esa espera. Superponerlas mostraría una brecha de punto de partida, no de modalidad.`
      : `El depto se aprecia igual y la deuda se amortiza igual, arriendes corto o largo: ${m(activoFinal)} de activo neto de deuda en las dos modalidades. Lo que cambia es cuánto pones de tu bolsillo por el camino. Descontándolo, terminas con ${m(riquezaLTRFinal)} en renta larga y ${m(riquezaSTRFinal)} en renta corta — ${m(Math.abs(brecha))} de diferencia a favor de la ${ganadora}. Esa brecha es la decisión, no el activo.`,
    glosa: comisionVentaFinal > 0
      ? [
          { t: "Es patrimonio bruto: el activo menos la deuda. Si vendes, la comisión de venta (2%) resta " },
          { t: m(comisionVentaFinal), mono: true },
          { t: " de esa cifra." },
        ]
      : [{ t: "Es patrimonio bruto: el activo menos la deuda. La comisión de venta (2%) no está descontada." }],
  };
}

// ── Chart 2 · Volatilidad del flujo ──────────────────────────────────────────

/**
 * Caption completa del chart de flujo mensual (rango STR, promedio, fondo de
 * reserva). `null` cuando el chart no se dibuja (sin flujo estacional).
 */
export function buildNotaFlujoChart(
  ltrResults: FullAnalysisResult,
  strResults: ShortTermResult,
  currency: Currency,
  ufValue: number,
): NotaSegmento[] | null {
  const flujoEst = strResults.flujoEstacional ?? [];
  if (flujoEst.length === 0) return null;

  const ltrFlujo = ltrResults.metrics?.flujoNetoMensual ?? 0;
  const flujos = flujoEst.map((mes) => mes.flujo);
  const minSTR = Math.min(...flujos);
  const maxSTR = Math.max(...flujos);
  const rangoSTR = maxSTR - minSTR;
  const promedioSTR = flujos.reduce((s, v) => s + v, 0) / flujos.length;

  const m = (v: number) => fmtMoney(v, currency, ufValue);

  return [
    { t: "LTR mantiene " },
    { t: m(ltrFlujo), mono: true },
    { t: " casi constante mes a mes. STR fluctúa entre " },
    { t: m(minSTR), mono: true },
    { t: " y " },
    { t: m(maxSTR), mono: true },
    { t: ` (${m(rangoSTR)} de rango) con promedio ` },
    { t: m(promedioSTR), mono: true },
    { t: ". La estacionalidad de Santiago (peak julio · valle febrero) exige fondo de reserva 3-4 meses si vas por STR." },
  ];
}
