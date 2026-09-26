// ─────────────────────────────────────────────────────────────────────────────
// LA MATRIZ DEL POP-UP DE AJUSTES — el modelo, sin React (24-sep-2026)
//
// Contrato visual: docs/wireframes/rediseno-informe/popup-matriz-aprobado.html (aprobado por
// Fabrizio el 24-sep-2026; versión final del 25-sep, tras probarlo en el teléfono). Cada celda
// es una combinación de pie y plazo:
//
//  · EN AJUSTAR, EL COLOR ES LA CERCANÍA A COMPRAR (`escalaCelda`, 25-sep): escala toda azul,
//    más intensa mientras menos descuento pide, rayada si no llega ni con el tope. El veredicto
//    de la combinación al precio pedido —`veredictoSinDescuento`— ya no pinta la celda: lo dice
//    la frase al tocarla («pasa de Ajustar a Comprar»).
//  · EN COMPRAR, EL COLOR ES EL VEREDICTO AL QUE CAE cada combinación, como siempre.
//  · EL NÚMERO ES LO QUE FALTA. En Ajustar, el descuento mínimo para llegar a Comprar con su
//    banda (`banda-esfuerzo.ts`), «sin descuento» si ya es Comprar, o «más de X%» si no llega ni
//    con el tope. En Comprar no hay descuento que pedir: el número es cuánto te queda al mes, y la
//    celda que cae dice «deja de ser Comprar».
//
// Vive acá y no en el componente para que los gates lo ejerciten sin montar React: la regla
// que más importa —«la celda muestra el veredicto real de esa combinación»— es una función de
// una línea, y una función de una línea se puede romper sin que nadie mire el navegador.
// ─────────────────────────────────────────────────────────────────────────────

import type { CeldaMix } from "./mix-palancas";
import type { HallazgoDistanciaVeredicto, MixPalancas, Veredicto } from "./types";
import { bandaDeDescuento, nivelDeDescuento, type BandaDescuento } from "./banda-esfuerzo";
import { esGrillaAlContado, mixAComprar, recomendacionFranco } from "./mix-a-comprar";

export type CifraCelda =
  | { tipo: "sin_descuento" }
  | { tipo: "descuento"; pct: number; banda: BandaDescuento }
  | { tipo: "no_llega"; topePct: number }
  | { tipo: "flujo"; clpMes: number | null }
  | { tipo: "cae" };

export type LecturaCelda = {
  /** El veredicto de la combinación AL PRECIO PEDIDO. De acá sale el color. */
  veredicto: Veredicto;
  cifra: CifraCelda;
};

/**
 * Lo que dice una celda. `esComprar` es el veredicto de la FILA (el informe), no de la celda:
 * en COMPRAR la grilla es la del modo «mejorar» y no hay descuento que biseccionar.
 */
export function lecturaCelda(c: CeldaMix, esComprar: boolean, topePct: number): LecturaCelda {
  const veredicto = c.veredictoSinDescuento;
  if (esComprar) {
    return { veredicto, cifra: veredicto === "COMPRAR" ? { tipo: "flujo", clpMes: c.metricas?.flujoMensual ?? null } : { tipo: "cae" } };
  }
  if (c.descuentoPct === null) return { veredicto, cifra: { tipo: "no_llega", topePct } };
  if (c.descuentoPct === 0) return { veredicto, cifra: { tipo: "sin_descuento" } };
  return { veredicto, cifra: { tipo: "descuento", pct: c.descuentoPct, banda: bandaDeDescuento(c.descuentoPct) } };
}

/**
 * LA ESCALA DE CERCANÍA A COMPRAR (mockup final del 25-sep-2026). EN AJUSTAR, EL COLOR DE LA
 * CELDA YA NO ES EL VEREDICTO AL PRECIO PEDIDO: en filas donde todo es Ajustar la matriz quedaba
 * entera ciruela y se leía «nunca llega», cuando cada celda con número SÍ llega a Comprar con ese
 * descuento. Ahora es una escala toda azul —más intensa mientras más cerca—: `e0` ya es Comprar
 * (sin descuento), `e1` fácil de negociar, `e2` con argumentos, `e3` difícil, y `fx` rayado cuando
 * no llega ni con el tope. Sale del MISMO `nivelDeDescuento` con que el motor elige la celda
 * Franco, así que el color y la recomendación no pueden discrepar sobre qué es fácil.
 * En COMPRAR no aplica: esa grilla sigue coloreada por el veredicto al que cae cada celda.
 */
export type EscalaCelda = "e0" | "e1" | "e2" | "e3" | "fx";
export function escalaCelda(c: CeldaMix): EscalaCelda {
  if (c.descuentoPct === null) return "fx";
  return (["e0", "e1", "e2", "e3"] as const)[nivelDeDescuento(c.descuentoPct)];
}

/**
 * LA GRILLA QUE DIBUJA EL POP-UP. BUSCAR OTRA NO TIENE POP-UP (decisión de Fabrizio, 24-sep):
 * si el veredicto es Buscar otra, la card dice la causa y la distancia a Comprar, y no hay
 * combinaciones que ofrecer.
 */
export function grillaDelPopup(p: {
  veredicto: Veredicto;
  distancia?: HallazgoDistanciaVeredicto | null;
  mixComprar?: MixPalancas | null;
}): MixPalancas | null {
  if (p.veredicto === "BUSCAR OTRA") return null;
  const v = p.distancia?.valor;
  const grilla = p.veredicto === "COMPRAR" ? p.mixComprar ?? null : v ? mixAComprar(v) : null;
  // AL CONTADO NO HAY MATRIZ (25-sep-2026): sin crédito no hay pie ni plazo que mover, y las
  // celdas no cambian nada. El motor deja la celda declarada (la lee el filtro del descuento),
  // pero el pop-up no la dibuja.
  if (esGrillaAlContado(grilla)) return null;
  return grilla;
}

/** ¿Hay pop-up? Solo si hay grilla que dibujar. Buscar otra, nunca. */
export function hayAjustesQueMostrar(p: {
  veredicto: Veredicto;
  distancia?: HallazgoDistanciaVeredicto | null;
  mixComprar?: MixPalancas | null;
}): boolean {
  return (grillaDelPopup(p)?.celdas?.length ?? 0) > 0;
}

/**
 * LA CELDA «FRANCO»: la recomendación, la misma que la card y que «A qué precio cerrar»
 * (`recomendacionFranco`). En COMPRAR no hay: no hay nada que recomendar para llegar. Sin
 * recomendación por mix (la grilla no cabe en el tope de capital) tampoco: la celda que el
 * motor corona ahí es la más barata, un narrador del borde y no un plan.
 */
export function celdaFranco(p: {
  veredicto: Veredicto;
  distancia?: HallazgoDistanciaVeredicto | null;
  grilla: MixPalancas | null;
}): CeldaMix | null {
  if (p.veredicto !== "AJUSTA SUPUESTOS" || !p.grilla?.celdas) return null;
  const v = p.distancia?.valor;
  if (!v || recomendacionFranco(v)?.via !== "mix") return null;
  return p.grilla.celdas.find((c) => c.esElegida) ?? null;
}

/** La banda más fácil disponible entre las combinaciones que Franco puede recomendar. */
export function nivelMasFacilDisponible(celdas: readonly CeldaMix[]): number | null {
  const niveles = celdas.filter((c) => c.descuentoPct !== null && c.alcanzable).map((c) => nivelDeDescuento(c.descuentoPct as number));
  return niveles.length ? Math.min(...niveles) : null;
}

/** El pie del día uno de una celda, en UF: su pie sobre el precio con su descuento. */
export function pieDiaUnoUF(c: CeldaMix, precioUF: number): number {
  return (c.piePct / 100) * precioUF * (1 - (c.descuentoPct ?? 0) / 100);
}
