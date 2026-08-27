// ─────────────────────────────────────────────────────────────────────────────
// ESCALERA DEL PIE · STR — espejo de `simularPie` (LTR) sobre el motor de renta
// corta. Existe para que las dos modalidades muestren el MISMO diagrama: LTR con
// escalera y STR sin ella sería justo la divergencia que el vocabulario único vino
// a eliminar.
//
// NO reconstruye el input a mano: reusa `buildStrRecomputeCtx`, que ya arma un
// `ShortTermInputs` desde lo persistido (input_data + results.airbnbRaw) y que ya
// está en producción alimentando la bisección del hallazgo de distancia STR. El
// parcheo del pie tampoco es nuevo — `veredictoStrConPatch` ya lo soporta como
// palanca. Acá se compone lo que existe, en vez de duplicar una tercera versión
// del mismo recompute.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
import { calcShortTerm } from "@/lib/engines/short-term-engine";
import { metricaValorONull } from "@/lib/types";
import type { NivelPie } from "@/lib/analysis";
import { buildStrRecomputeCtx } from "./recompute-short-term-for-legacy";

/**
 * Escalera del pie para STR. Mismos niveles relativos que LTR (−5 / actual / +5 /
 * +10, tramos de 5) y los mismos dos casos vacíos resueltos ACÁ y no en el render:
 * pie 0 (lo cubre un bono: subirlo es deshacer el trato) y pie 100% (al contado, no
 * hay cuota que mover). Devuelve [] también cuando el contexto no se puede
 * reconstruir — sin `airbnbRaw` no hay recompute posible y no se inventa uno.
 */
export function simularPieStr(
  inputData: Record<string, any> | null | undefined,
  persistedResults: { airbnbRaw?: unknown } | null | undefined,
  ufClp: number,
  asOf: Date,
): NivelPie[] {
  const ctx = buildStrRecomputeCtx(inputData, persistedResults, ufClp);
  if (!ctx) return [];

  const actualPct = ctx.inputs.piePercent * 100;
  if (!Number.isFinite(actualPct) || actualPct <= 0 || actualPct >= 100) return [];
  const precioCompra = ctx.inputs.precioCompra;
  if (!(precioCompra > 0)) return [];

  const niveles = [actualPct - 5, actualPct, actualPct + 5, actualPct + 10]
    .filter((p) => p > 0 && p < 100)
    .map((p) => Math.round(p * 10) / 10);

  return niveles.map((piePct) => {
    const r = calcShortTerm({ ...ctx.inputs, piePercent: piePct / 100 }, asOf);
    return {
      piePct,
      esActual: piePct === Math.round(actualPct * 10) / 10,
      pieCLP: precioCompra * (piePct / 100),
      flujoMensual: r.escenarios.base.flujoCajaMensual,
      // Sin escenario de salida no hay TIR: se devuelve null y la columna muestra "—",
      // en vez de un 0 que se leería como "no rinde".
      tirPct: r.exitScenario ? metricaValorONull(r.exitScenario.tirAnual) : null,
    };
  });
}
