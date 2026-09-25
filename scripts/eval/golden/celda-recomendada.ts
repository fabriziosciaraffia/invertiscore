// ============================================================================
// GOLDEN · LA CELDA RECOMENDADA (25-sep-2026)
// ============================================================================
// Hasta el 25-sep el golden NO guardaba qué recomienda Franco: el baseline llevaba veredicto,
// score, hallazgos y sus KPIs, y la grilla del mix no entraba en ninguno. Por eso el cambio de
// criterio del 24-sep (la corona pasó del mejor score a la banda de descuento más fácil) cambió
// la recomendación en 4 de las 11 seeds con grilla y el QUICK salió sin una sola alerta: un cero
// que no distinguía «no cambió» de «no se mide».
//
// Lo que se fija ahora es la MISMA recomendación que leen la card, la celda «Franco» del pop-up y
// «A qué precio cerrar» (`recomendacionFranco`): por mix, la celda con su pie, su plazo y su
// descuento; sin mix, el precio solo con su descuento; y `null` cuando no hay recomendación.
// Es un chequeo DURO: cambiar qué se recomienda es una decisión de producto y pasa por acta.
// ============================================================================
import type { Hallazgo } from "../../../src/lib/types";
import { recomendacionFranco } from "../../../src/lib/mix-a-comprar";

export type CeldaRecomendada =
  | { via: "mix"; piePct: number; plazoAnios: number; descuentoPct: number }
  | { via: "precio_solo"; descuentoPct: number }
  | null;

export function celdaRecomendadaDe(hallazgos: readonly Hallazgo[]): CeldaRecomendada {
  const dv = hallazgos.find((h) => h.id === "distancia_veredicto") as { valor?: unknown } | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = dv?.valor as any;
  if (!v) return null;
  const rec = recomendacionFranco(v);
  if (!rec) return null;
  if (rec.via === "precio_solo") return { via: "precio_solo", descuentoPct: Math.abs(rec.palanca.deltaPct) };
  const c = rec.mix.celdas?.find((x) => x.esElegida);
  // Sin celda elegida en una grilla que la recomendación da por buena, el dato está roto: no se
  // disfraza de «sin recomendación».
  if (!c) return { via: "mix", piePct: NaN, plazoAnios: NaN, descuentoPct: NaN };
  return { via: "mix", piePct: c.piePct, plazoAnios: c.plazoAnios, descuentoPct: c.descuentoPct ?? 0 };
}

export function fmtCelda(c: CeldaRecomendada | undefined): string {
  if (c === undefined) return "(el baseline no la guarda)";
  if (c === null) return "sin recomendación";
  if (c.via === "precio_solo") return `precio solo −${c.descuentoPct}%`;
  return `pie ${c.piePct} · ${c.plazoAnios}a · −${c.descuentoPct}%`;
}

/** Igualdad exacta. `undefined` en el baseline es una falla, no un pase: la seed nunca se midió. */
export function mismaCelda(a: CeldaRecomendada, base: CeldaRecomendada | undefined): boolean {
  if (base === undefined) return false;
  return JSON.stringify(a) === JSON.stringify(base);
}
