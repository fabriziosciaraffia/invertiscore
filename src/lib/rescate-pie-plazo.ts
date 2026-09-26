// ─────────────────────────────────────────────────────────────────────────────
// UN BUSCAR OTRO QUE LLEGA A COMPRAR CON PIE Y PLAZO NO ES BUSCAR OTRO (25-sep-2026)
//
// Decisión de Fabrizio. El brazo `breakEvenImposible` del gate 1 declara que el flujo no se
// arregla ni con la tasa en cero, pero nunca prueba más plazo ni más pie: una cuota más larga
// o más capital propio bajan el dividendo por una vía que la tasa no mide. Y la banda del
// puntaje tampoco los prueba. Así, un depto que llega a Comprar con solo estirar el crédito o
// poner más pie —sin pedirle un peso de descuento al vendedor— salía como «busca otro».
//
// La regla: con el veredicto del puntaje en BUSCAR OTRA se prueban las combinaciones de pie y
// plazo SIN DESCUENTO, dentro de los topes del mix: pie hasta 30% en pasos de 5 y como mucho
// 15 puntos del precio sobre el declarado (`MIX_COSTO_TOPE_PTS_PRECIO`, el alcance: sobre eso
// deja de ser un ajuste y pasa a ser otra compra), plazo hasta 30 años entre los que acepta el
// wizard, nunca hacia abajo. Si alguna llega a COMPRAR, el veredicto pasa a AJUSTA SUPUESTOS:
// el negocio no es bueno como viene, pero tiene un ajuste en manos del comprador.
//
// · El alcance de 15 puntos está medido: sin él se rescataban 5 filas LTR, tres de ellas con
//   20 puntos de pie extra (de 10% a 30%, o de 0% a 20% en 64c5f630). Con él quedan 2.
// · Esas celdas están en la grilla que lee el filtro del descuento (`ajustar-sin-camino.ts`),
//   así que un rescatado nunca vuelve a bajar: su camino más fácil a Comprar pide 0%.
// · El pie se mueve con la misma doctrina que el hallazgo de distancia: con bono pie no se
//   mueve (la plata no es del comprador) y en el techo no hay a dónde subir.
// · Corre FUERA de `deriveVeredicto` / `calcFrancoScoreSTR`: las sondas pasan por ahí, y cada
//   una tiene que devolver el veredicto del motor sin rescate.
//
// Medido antes de fijar (parque del 25-sep-2026): ver el acta del goal en el golden.
// ─────────────────────────────────────────────────────────────────────────────

import type { RazonSinCapital, Veredicto } from "./types";
import { MIX_COSTO_TOPE_PTS_PRECIO, MIX_PIE_PASO_PCT, MIX_PLAZOS_WIZARD } from "./mix-palancas";
import { PIE_TOPE_GRILLA_PCT, pieSeMueveEnLaGrilla } from "./pie-se-mueve";

/** El pie máximo que prueba la grilla (fuente única en `pie-se-mueve.ts`). */
export const RESCATE_PIE_TOPE_PCT = PIE_TOPE_GRILLA_PCT;

export type CombinacionPiePlazo = { piePct: number; plazoAnios: number };

export type RescatePieYPlazo = {
  veredicto: Veredicto;
  cambio: boolean;
  /** La combinación más barata que llega a Comprar sin descuento, cuando hubo rescate. */
  combinacion: CombinacionPiePlazo | null;
};

/**
 * Las combinaciones que se prueban, de la más barata a la más cara: primero la que menos pie
 * extra pide y, entre iguales, la de menos plazo. La actual queda fuera (ya se evaluó).
 */
export function combinacionesSinDescuento(p: {
  piePct: number;
  plazoAnios: number;
  razonSinPie?: RazonSinCapital | null;
}): CombinacionPiePlazo[] {
  const pieSeMueve = pieSeMueveEnLaGrilla(p.piePct, p.razonSinPie);
  const pies = [p.piePct];
  const techo = Math.min(RESCATE_PIE_TOPE_PCT, p.piePct + MIX_COSTO_TOPE_PTS_PRECIO);
  if (pieSeMueve) for (let x = p.piePct + MIX_PIE_PASO_PCT; x <= techo; x += MIX_PIE_PASO_PCT) pies.push(x);
  const plazos = [p.plazoAnios, ...MIX_PLAZOS_WIZARD.filter((a) => a > p.plazoAnios)];
  const out: CombinacionPiePlazo[] = [];
  for (const piePct of pies) {
    for (const plazoAnios of plazos) {
      if (piePct === p.piePct && plazoAnios === p.plazoAnios) continue;
      out.push({ piePct, plazoAnios });
    }
  }
  return out;
}

/**
 * EL RESCATE. Fuera de BUSCAR OTRA no toca nada. `sonda` devuelve el veredicto del motor —sin
 * rescate ni filtros— para una combinación, al precio de hoy.
 */
export function rescatarPorPieYPlazo(
  veredicto: Veredicto,
  p: { piePct: number; plazoAnios: number; razonSinPie?: RazonSinCapital | null },
  sonda: (c: CombinacionPiePlazo) => Veredicto,
): RescatePieYPlazo {
  if (veredicto !== "BUSCAR OTRA") return { veredicto, cambio: false, combinacion: null };
  // Sin pie o plazo legibles no hay de dónde partir: se sondearía con NaN.
  if (!Number.isFinite(p.piePct) || !Number.isFinite(p.plazoAnios)) return { veredicto, cambio: false, combinacion: null };
  for (const c of combinacionesSinDescuento(p)) {
    if (sonda(c) === "COMPRAR") return { veredicto: "AJUSTA SUPUESTOS", cambio: true, combinacion: c };
  }
  return { veredicto, cambio: false, combinacion: null };
}
