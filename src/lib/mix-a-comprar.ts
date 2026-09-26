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

import type { HallazgoDistanciaVeredicto, MixPalancas, PalancaDistancia } from "./types";

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
/**
 * ¿Es la grilla de una compra al contado? (25-sep-2026) Sin crédito no hay pie ni plazo que mover:
 * el motor deja la celda declarada —la lee el filtro del descuento— pero ninguna superficie la
 * ofrece como combinación. Fuente única para el pop-up, la card y la recomendación.
 */
export function esGrillaAlContado(mix: MixPalancas | null | undefined): boolean {
  return !!mix?.celdas?.length && mix.celdas.every((c) => c.piePct >= 100);
}

export function mixAComprar(v: ValorDistancia) {
  const mix = v.veredictoBase === "BUSCAR OTRA" ? v.mixPalancasHastaComprar ?? null : v.mixPalancas ?? null;
  // AL CONTADO NO HAY MIX (25-sep-2026): sin crédito no hay pie ni plazo que mover, y la grilla
  // queda en la celda declarada. Ofrecerla como «si además mueves lo tuyo» sería vender un
  // cambio que no existe: la recomendación cae a la palanca de precio. El filtro del descuento
  // no pasa por acá: lee `mixPalancas` directo y sigue viendo esa celda.
  if (esGrillaAlContado(mix)) return null;
  return mix;
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

/**
 * LA RECOMENDACIÓN DE FRANCO, UNA SOLA VEZ (24-sep-2026).
 *
 * La leen tres superficies y tienen que decir lo mismo: la card «Lo que haría yo», el pop-up
 * (la celda marcada «Franco») y el capítulo «A qué precio cerrar» (`como-lo-pagas.ts`, que se
 * ancla a su precio). Hasta hoy cada una la derivaba por su lado —la card y el capítulo
 * saltaban el mix cuando era «redundante» con la palanca sola de precio y mostraban la palanca;
 * el pop-up marcaba la celda coronada—, y con la corona por banda eso las habría separado: la
 * celda Franco diría «pie 30% y 30 años, sin descuento» y la card «−25% de precio».
 *
 * Qué es: la raíz del mix hacia COMPRAR (`mixAComprar`) cuando cabe en el tope de capital y
 * llega a COMPRAR —su celda es la que lleva `esElegida`—. Sin eso, la palanca sola de precio
 * si alcanza (filas persistidas antes del mix, sin grilla). Si no, no hay recomendación.
 *
 * ⚠ LA REDUNDANCIA YA NO ESCONDE LA RECOMENDACIÓN. `redundanteConPalancaSola` decía «el mix
 * repite una fila que la card ya muestra», y la card mostraba la fila. La card simplificada
 * del 24-sep ya no muestra filas: muestra la recomendación, que es la raíz. El campo sigue
 * existiendo para quien lo necesite; esta función no lo lee.
 */
export type RecomendacionFranco =
  | { via: "mix"; mix: MixPalancas }
  | { via: "precio_solo"; palanca: PalancaDistancia };

export function recomendacionFranco(v: ValorDistancia): RecomendacionFranco | null {
  const mix = mixAComprar(v);
  if (mix && mix.dentroDelAlcance && (mix.destino ?? v.veredictoObjetivo) === "COMPRAR") return { via: "mix", mix };
  const precio = solasAComprar(v).find((p) => p.palanca === "precio" && p.deltaPct < 0);
  return precio ? { via: "precio_solo", palanca: precio } : null;
}
