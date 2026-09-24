// ─────────────────────────────────────────────────────────────────────────────
// LA MATRIZ DEL POP-UP DE AJUSTES — el modelo, sin React (24-sep-2026)
//
// Contrato visual: docs/wireframes/rediseno-informe/popup-matriz-aprobado.html (aprobado por
// Fabrizio el 24-sep-2026). Cada celda es una combinación de pie y plazo:
//
//  · EL COLOR ES EL VEREDICTO DE ESA COMBINACIÓN AL PRECIO PEDIDO —`veredictoSinDescuento`—,
//    con la tríada de la portada: azul Comprar, ciruela Ajustar, rojo Buscar otra. No el
//    veredicto al que llegaría con descuento: ese es el número.
//  · EL NÚMERO ES LO QUE FALTA. En Ajustar, el descuento mínimo para llegar a Comprar con su
//    banda (`banda-esfuerzo.ts`), «sin descuento» si ya es Comprar, o «no llega» ni con el tope.
//    En Comprar no hay descuento que pedir: el número es cuánto te queda al mes, y la celda que
//    cae dice «deja de ser Comprar».
//
// Vive acá y no en el componente para que los gates lo ejerciten sin montar React: la regla
// que más importa —«la celda muestra el veredicto real de esa combinación»— es una función de
// una línea, y una función de una línea se puede romper sin que nadie mire el navegador.
// ─────────────────────────────────────────────────────────────────────────────

import type { CeldaMix } from "./mix-palancas";
import type { HallazgoDistanciaVeredicto, MixPalancas, Veredicto } from "./types";
import { bandaDeDescuento, nivelDeDescuento, type BandaDescuento } from "./banda-esfuerzo";
import { mixAComprar, recomendacionFranco } from "./mix-a-comprar";

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
  if (p.veredicto === "COMPRAR") return p.mixComprar ?? null;
  const v = p.distancia?.valor;
  return v ? mixAComprar(v) : null;
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
