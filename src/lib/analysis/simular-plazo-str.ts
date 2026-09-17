// ────────────────────────────────────────────────────────────────────────────
// LA LÍNEA DEL PLAZO · STR — espejo de `simularPlazo` (LTR) sobre el motor de renta
// corta. Es CÓDIGO NUEVO, no una mudanza: la escalera del plazo solo existió para LTR
// (`simularPlazo` toma `AnalisisInput` y corre `calcMetrics`), y el drawer STR que se
// retiró el 17-sep-2026 usaba únicamente la escalera del PIE.
//
// Reusa `buildStrRecomputeCtx` por la misma razón que `simularPieStr`: el contexto ya
// se arma desde lo persistido y está en producción. Acá se compone lo que existe.
//
// ⚠ UNIDADES — el interés va en UF y la conversión es del render, con la misma UF que
// el resto de la página. En CLP la resta «pagos − capital» ni siquiera es monótona en
// el plazo: el dividendo es constante en UF y la UF sigue a la inflación, así que restar
// pagos inflados menos capital sin inflar da un artefacto. Mismo aviso que
// `NivelPlazo.interesTotalUF`, y por la misma razón. NO lo "arregles" pasándolo a CLP.
// ────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
import { calcShortTerm } from "@/lib/engines/short-term-engine";
import type { NivelPlazo } from "@/lib/analysis";
import { PLAZOS_COMERCIALES } from "@/lib/analysis";
import { buildStrRecomputeCtx } from "./recompute-short-term-for-legacy";

/**
 * Niveles de plazo para STR. Mismos tramos comerciales que LTR (15/20/25/30) y la misma
 * regla de vacío: si el plazo declarado no es uno de esos tramos no hay línea que dibujar
 * sobre un valor que no contiene, y sin crédito no hay interés.
 *
 * Devuelve [] también cuando el contexto no se puede reconstruir — sin `airbnbRaw` no hay
 * recompute y no se inventa uno.
 */
export function simularPlazoStr(
  inputData: Record<string, any> | null | undefined,
  persistedResults: { airbnbRaw?: unknown } | null | undefined,
  ufClp: number,
  asOf: Date,
): NivelPlazo[] {
  const ctx = buildStrRecomputeCtx(inputData, persistedResults, ufClp);
  if (!ctx) return [];
  if (!(ufClp > 0)) return [];

  const actual = ctx.inputs.plazoCredito;
  if (!PLAZOS_COMERCIALES.includes(actual as (typeof PLAZOS_COMERCIALES)[number])) return [];

  const salida: NivelPlazo[] = [];
  for (const plazoAnios of PLAZOS_COMERCIALES) {
    const r = calcShortTerm({ ...ctx.inputs, plazoCredito: plazoAnios }, asOf);
    const creditoCLP = r.montoCredito;
    // Sin crédito no hay interés ni línea (compra al contado).
    if (!(creditoCLP > 0)) return [];
    const cuotaUF = r.dividendoMensual / ufClp;
    const creditoUF = creditoCLP / ufClp;
    salida.push({
      plazoAnios,
      esActual: plazoAnios === actual,
      flujoMensual: r.escenarios.base.flujoCajaMensual,
      cuotaMensual: r.dividendoMensual,
      interesTotalUF: cuotaUF * 12 * plazoAnios - creditoUF,
    });
  }
  return salida;
}
