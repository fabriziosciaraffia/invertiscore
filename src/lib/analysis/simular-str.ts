// ─────────────────────────────────────────────────────────────────────────────
// SIMULACIONES STR DEL CONGELADO (T0 · 04-sep-2026) — fronteras de los diales y las
// dos matrices, emitidas por el motor. Nada se bisecciona en el render.
//
//   · fronterasIngreso — UNA bisección del ingreso (tarifa × ocupación mueven el ingreso
//     por la misma razón, así que la frontera es un factor sobre el ingreso base). Los
//     dos diales —tarifa y ocupación— leen el mismo objeto: cada uno lo expresa en su
//     unidad (CLP por noche / % de ocupación).
//   · fronteraPrecio — hasta dónde sube a COMPRAR bajando el precio y sobre qué precio
//     cae a BUSCAR OTRA (la primera ya la emite `distancia_veredicto`; acá viven juntas
//     para el dial de precio).
//   · matrizTarifaOcupacion — 4 × 4 recomputes completos (motor + score): tarifas y
//     ocupaciones en los percentiles de la zona más el caso, veredicto por celda.
//   · matrizPiePlazo — espejo de `simularPieYPlazo` (LTR): pie −5 / actual / +5 / +10
//     × plazos comerciales, flujo, TIR y veredicto por celda.
//
// Todo pasa por `recomputeStrConPatch`: la MISMA ruta motor → score → gates del veredicto
// canónico. Sin `airbnbRaw` no hay contexto y no se inventa uno (igual que simularPieStr).
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
import { metricaValorONull, type Veredicto } from "@/lib/types";
import { biseccionFactor } from "@/lib/distancia-veredicto-hallazgo";
import { buildStrRecomputeCtx } from "./recompute-short-term-for-legacy";
import { recomputeStrConPatch, type VeredictoStrCtx } from "./veredicto-str-con-patch";

const RANK: Record<Veredicto, number> = { "BUSCAR OTRA": 0, "AJUSTA SUPUESTOS": 1, COMPRAR: 2 };
/** Rango explorado para el ingreso: hasta −70% hacia abajo y hasta ×3 hacia arriba. */
export const SIM_INGRESO_MIN = 0.3;
export const SIM_INGRESO_MAX = 3.0;
/** Rango explorado para el precio: hasta −70% y hasta ×2. */
export const SIM_PRECIO_MIN = 0.3;
export const SIM_PRECIO_MAX = 2.0;
export const PLAZOS_COMERCIALES_STR = [15, 20, 25, 30] as const;

export interface FronteraLado {
  /** Factor sobre el valor base donde el veredicto cambia (1 = el caso). */
  factor: number;
  /** Veredicto al que cambia. */
  veredicto: Veredicto;
}

export interface FronterasIngresoStr {
  veredictoBase: Veredicto;
  /** Factor del ingreso bajo el cual el veredicto CAE (null: no cae ni a −70%). */
  abajo: FronteraLado | null;
  /** Factor del ingreso sobre el cual el veredicto SUBE (null: no sube ni a ×3, o ya es COMPRAR). */
  arriba: FronteraLado | null;
  /** El mismo factor expresado en tarifa por noche (CLP). */
  tarifa: { actual: number; abajo: number | null; arriba: number | null };
  /** El mismo factor expresado en ocupación (0-1). */
  ocupacion: { actual: number; abajo: number | null; arriba: number | null };
}

export interface FronteraPrecioStr {
  precioUFActual: number;
  /** Bajo este precio (UF) el veredicto sube (null: no sube ni a −70%, o ya es COMPRAR). */
  subeA: (FronteraLado & { precioUF: number }) | null;
  /** Sobre este precio (UF) el veredicto cae (null: no cae ni a ×2). */
  caeA: (FronteraLado & { precioUF: number }) | null;
}

export interface CeldaTarifaOcupacion {
  tarifaCLP: number;
  ocupacion: number;
  flujoMensual: number;
  veredicto: Veredicto;
  esActual: boolean;
  /** Veredicto superior al del caso. */
  cruza: boolean;
  /** Veredicto inferior al del caso. */
  cae: boolean;
}

export interface MatrizTarifaOcupacion {
  /** Columnas: p25 de la zona · el caso · p75 · p90 (ordenadas, sin repetidos). */
  tarifas: number[];
  /** Filas: p25 · el caso · p75 · p90 (ordenadas, sin repetidos). */
  ocupaciones: number[];
  celdas: CeldaTarifaOcupacion[];
}

export interface CeldaPiePlazoStr {
  piePct: number;
  plazoAnios: number;
  esActual: boolean;
  flujoMensual: number;
  tirPct: number | null;
  veredicto: Veredicto;
  cruza: boolean;
}

export interface MatrizPiePlazoStr {
  pies: number[];
  plazos: number[];
  celdas: CeldaPiePlazoStr[];
}

export interface SimulacionStr {
  veredictoBase: Veredicto;
  fronterasIngreso: FronterasIngresoStr;
  fronteraPrecio: FronteraPrecioStr;
  matrizTarifaOcupacion: MatrizTarifaOcupacion;
  matrizPiePlazo: MatrizPiePlazoStr;
}

const uniqSorted = (xs: number[]) => Array.from(new Set(xs.filter((x) => Number.isFinite(x) && x > 0))).sort((a, b) => a - b);

/** Fronteras del ingreso: una sola bisección, dos diales. */
export function fronterasIngresoStr(ctx: VeredictoStrCtx, base: { veredicto: Veredicto; adr: number; ocupacion: number }): FronterasIngresoStr {
  const rankBase = RANK[base.veredicto];
  const veredictoA = (f: number) => recomputeStrConPatch(ctx, { adrOverride: Math.max(1, Math.round(base.adr * f)) }).francoScore.veredicto;
  const fAbajo = biseccionFactor((f) => RANK[veredictoA(f)] < rankBase, SIM_INGRESO_MIN, false);
  const fArriba = base.veredicto === "COMPRAR" ? null : biseccionFactor((f) => RANK[veredictoA(f)] > rankBase, SIM_INGRESO_MAX, true);
  const abajo = fAbajo != null ? { factor: fAbajo, veredicto: veredictoA(fAbajo) } : null;
  const arriba = fArriba != null ? { factor: fArriba, veredicto: veredictoA(fArriba) } : null;
  return {
    veredictoBase: base.veredicto,
    abajo,
    arriba,
    tarifa: { actual: base.adr, abajo: abajo ? Math.round(base.adr * abajo.factor) : null, arriba: arriba ? Math.round(base.adr * arriba.factor) : null },
    ocupacion: {
      actual: base.ocupacion,
      abajo: abajo ? Math.round(base.ocupacion * abajo.factor * 1000) / 1000 : null,
      arriba: arriba ? Math.min(1, Math.round(base.ocupacion * arriba.factor * 1000) / 1000) : null,
    },
  };
}

/** Frontera del precio: sube a … bajando, cae a … subiendo. */
export function fronteraPrecioStr(ctx: VeredictoStrCtx, base: { veredicto: Veredicto; precioCLP: number; precioUF: number }): FronteraPrecioStr {
  const rankBase = RANK[base.veredicto];
  const veredictoP = (f: number) => recomputeStrConPatch(ctx, { precioCompra: Math.round(base.precioCLP * f) }).francoScore.veredicto;
  const fSube = base.veredicto === "COMPRAR" ? null : biseccionFactor((f) => RANK[veredictoP(f)] > rankBase, SIM_PRECIO_MIN, false);
  const fCae = biseccionFactor((f) => RANK[veredictoP(f)] < rankBase, SIM_PRECIO_MAX, true);
  return {
    precioUFActual: base.precioUF,
    subeA: fSube != null ? { factor: fSube, veredicto: veredictoP(fSube), precioUF: Math.floor(base.precioUF * fSube) } : null,
    caeA: fCae != null ? { factor: fCae, veredicto: veredictoP(fCae), precioUF: Math.ceil(base.precioUF * fCae) } : null,
  };
}

/** 4 × 4 recomputes completos: tarifa (columnas) × ocupación (filas). */
export function simularTarifaYOcupacionStr(
  ctx: VeredictoStrCtx,
  base: { veredicto: Veredicto; adr: number; ocupacion: number },
  percentiles?: { adr: { p25: number; p75: number; p90: number }; ocupacion: { p25: number; p75: number; p90: number } } | null,
): MatrizTarifaOcupacion {
  const rankBase = RANK[base.veredicto];
  const tarifas = uniqSorted(
    percentiles ? [percentiles.adr.p25, base.adr, percentiles.adr.p75, percentiles.adr.p90] : [base.adr * 0.85, base.adr, base.adr * 1.25, base.adr * 1.5],
  ).map((t) => Math.round(t));
  const ocupaciones = uniqSorted(
    percentiles
      ? [percentiles.ocupacion.p25, base.ocupacion, percentiles.ocupacion.p75, percentiles.ocupacion.p90]
      : [base.ocupacion * 0.7, base.ocupacion, base.ocupacion * 1.35, base.ocupacion * 1.65],
  ).map((o) => Math.min(0.99, Math.round(o * 1000) / 1000));
  const celdas: CeldaTarifaOcupacion[] = [];
  for (const ocupacion of ocupaciones) {
    for (const tarifaCLP of tarifas) {
      const r = recomputeStrConPatch(ctx, { adrOverride: tarifaCLP, occOverride: ocupacion });
      const v = r.francoScore.veredicto;
      celdas.push({
        tarifaCLP,
        ocupacion,
        flujoMensual: r.result.escenarios.base.flujoCajaMensual,
        veredicto: v,
        esActual: tarifaCLP === Math.round(base.adr) && ocupacion === Math.min(0.99, Math.round(base.ocupacion * 1000) / 1000),
        cruza: RANK[v] > rankBase,
        cae: RANK[v] < rankBase,
      });
    }
  }
  return { tarifas, ocupaciones, celdas };
}

/** Espejo de `simularPieYPlazo` (LTR): pie −5 / actual / +5 / +10 × plazos comerciales. */
export function simularPieYPlazoStr(ctx: VeredictoStrCtx, base: { veredicto: Veredicto }): MatrizPiePlazoStr {
  const vacia: MatrizPiePlazoStr = { pies: [], plazos: [], celdas: [] };
  const rankBase = RANK[base.veredicto];
  const pieActual = Math.round(ctx.inputs.piePercent * 1000) / 10;
  const plazoActual = ctx.inputs.plazoCredito;
  if (!Number.isFinite(pieActual) || pieActual <= 0 || pieActual >= 100) return vacia;
  if (!(PLAZOS_COMERCIALES_STR as readonly number[]).includes(plazoActual)) return vacia;
  const pies = [pieActual - 5, pieActual, pieActual + 5, pieActual + 10].filter((p) => p > 0 && p < 100).map((p) => (p === pieActual ? p : Math.round(p * 10) / 10));
  const plazos = [...PLAZOS_COMERCIALES_STR];
  const celdas: CeldaPiePlazoStr[] = [];
  for (const piePct of pies) {
    for (const plazoAnios of plazos) {
      const r = recomputeStrConPatch(ctx, { piePercent: piePct / 100, plazoCredito: plazoAnios });
      const v = r.francoScore.veredicto;
      celdas.push({
        piePct,
        plazoAnios,
        esActual: piePct === pieActual && plazoAnios === plazoActual,
        flujoMensual: r.result.escenarios.base.flujoCajaMensual,
        tirPct: r.result.exitScenario ? metricaValorONull(r.result.exitScenario.tirAnual) : null,
        veredicto: v,
        cruza: RANK[v] > rankBase,
      });
    }
  }
  return { pies, plazos, celdas };
}

/** Todo junto, desde un contexto ya armado (pipeline, golden, fixtures). */
export function simularStr(
  ctx: VeredictoStrCtx,
  base: { veredicto: Veredicto; adr: number; ocupacion: number; precioCLP: number; precioUF: number },
  percentiles?: Parameters<typeof simularTarifaYOcupacionStr>[2],
): SimulacionStr {
  return {
    veredictoBase: base.veredicto,
    fronterasIngreso: fronterasIngresoStr(ctx, base),
    fronteraPrecio: fronteraPrecioStr(ctx, base),
    matrizTarifaOcupacion: simularTarifaYOcupacionStr(ctx, base, percentiles),
    matrizPiePlazo: simularPieYPlazoStr(ctx, base),
  };
}

/**
 * Desde lo persistido (input_data + results.airbnbRaw), como `simularPieStr`: reconstruye
 * el contexto con `buildStrRecomputeCtx`, recomputa el caso base y simula. Devuelve null
 * sin contexto (sin airbnbRaw no hay recompute posible).
 */
export function simularStrDesdePersistido(
  inputData: Record<string, any> | null | undefined,
  persistedResults: { airbnbRaw?: unknown } | null | undefined,
  ufClp: number,
  asOf: Date,
): SimulacionStr | null {
  const ctx = buildStrRecomputeCtx(inputData, persistedResults, ufClp);
  if (!ctx) return null;
  const vctx: VeredictoStrCtx = { inputs: ctx.inputs, scoreExtras: ctx.scoreExtras, asOf };
  const base = recomputeStrConPatch(vctx, {});
  const adr = base.result.ejesAplicados?.adrFinal ?? base.result.escenarios.base.adrReferencia;
  const ocupacion = base.result.ejesAplicados?.ocupacionFinal ?? base.result.escenarios.base.ocupacionReferencia;
  const precioCLP = ctx.inputs.precioCompra;
  const precioUF = ufClp > 0 ? precioCLP / ufClp : 0;
  if (!(adr > 0) || !(ocupacion > 0) || !(precioCLP > 0) || !(precioUF > 0)) return null;
  const pc = ctx.inputs.airbnbData?.percentiles;
  const percentiles = pc?.average_daily_rate && pc?.occupancy
    ? { adr: { p25: pc.average_daily_rate.p25, p75: pc.average_daily_rate.p75, p90: pc.average_daily_rate.p90 }, ocupacion: { p25: pc.occupancy.p25, p75: pc.occupancy.p75, p90: pc.occupancy.p90 } }
    : null;
  return simularStr(vctx, { veredicto: base.francoScore.veredicto, adr, ocupacion, precioCLP, precioUF }, percentiles);
}
