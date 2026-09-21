// ─────────────────────────────────────────────────────────────────────────────
// EL MIX QUE LLEGA A COMPRAR, Y SOLO ESE — fuente única (21-sep-2026).
//
// Vivía como función local de `PopupAjustes.tsx`. Sale a la lib porque ahora lo leen DOS
// superficies —el pop-up y el capítulo «Cómo lo pagas»— y la regla no puede escribirse
// dos veces: el 21-sep el mockup del capítulo la reescribió como
// `hastaComprar ?? mixPalancas` y reintrodujo el bug del 13-sep (la recomendación con
// cambios para llegar a AJUSTAR). Un solo import, sin fallback, y un gate que lo caza
// (`scripts/eval/golden/como-lo-pagas-catch-test.ts`).
// ─────────────────────────────────────────────────────────────────────────────

import type { HallazgoDistanciaVeredicto, PalancaDistancia } from "./types";

type ValorDistancia = HallazgoDistanciaVeredicto["valor"];

/**
 * `mixPalancas` apunta al veredicto INMEDIATAMENTE superior: desde AJUSTA eso ya es
 * COMPRAR, pero desde BUSCAR OTRA es el escalón intermedio, y **el escalón no se muestra
 * nunca**. Hasta el 13-sep el pop-up tomaba `mixPalancas ?? mixPalancasHastaComprar`, o
 * sea prefería el del escalón: 399 filas LTR y 55 STR estaban sensibilizando hacia Ajustar
 * y ofreciendo un plan que no lleva a Comprar, sin decirlo.
 *
 * ⚠ SIN FALLBACK A `mixPalancas` EN BUSCAR OTRA. Si `mixPalancasHastaComprar` es `null`
 *   (se midió, ninguna cruza) o `undefined` (LTR todavía no lo mide), la respuesta es
 *   «no hay mix», no el del escalón. Misma regla que la card (`lo-que-haria-yo.ts`).
 */
export function mixAComprar(v: ValorDistancia) {
  return v.veredictoBase === "BUSCAR OTRA" ? v.mixPalancasHastaComprar ?? null : v.mixPalancas ?? null;
}

/**
 * LAS PALANCAS QUE LLEGAN AL DESTINO, y solo esas (17-sep-2026). Misma regla que
 * `mixAComprar`: en BUSCAR OTRA `palancas` apunta al escalón intermedio.
 *
 * ⚠ AUSENTE ≠ VACÍO. En una fila persistida antes del salto de dos bandas el campo es
 * `undefined`: nadie midió la vía a COMPRAR. `[]` es «se midió y ninguna llega». Las dos
 * dibujan lo mismo —nada— pero por razones distintas, y leer el undefined como lista
 * vacía haría que la superficie publicara una medición que no existe. Por eso el
 * predicado es `Array.isArray` y no `?? []`.
 */
export function solasAComprar(v: ValorDistancia): PalancaDistancia[] {
  if (v.veredictoBase !== "BUSCAR OTRA") return v.palancas ?? [];
  return Array.isArray(v.palancasHastaComprar) ? v.palancasHastaComprar : [];
}
