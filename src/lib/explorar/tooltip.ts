// ─────────────────────────────────────────────────────────────────────────────
// DÓNDE VA UN TOOLTIP (03-nov-2026, la pasada real de Fabrizio: los de Filtros y el de la tasa se cortaban en los bordes, en el
// teléfono y en el PC). Debajo de su ⓘ y centrado en ella; si se sale por un lado, se corre hasta quedar entero; si abajo no
// cabe, va arriba; y nunca es más ancho que la pantalla menos sus márgenes. Pura: la usa info.tsx con las medidas reales y la
// prueba el tier EXPLORAR-PASADA con ⓘ en las esquinas, a 390 y a 1440.
// ─────────────────────────────────────────────────────────────────────────────

export interface Caja {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** El margen con el borde de la pantalla y la distancia a la ⓘ, en px. */
export const MARGEN_TOOLTIP = 12;
export const SEPARACION_TOOLTIP = 8;
/** El ancho del tooltip cuando cabe. */
export const ANCHO_TOOLTIP = 240;

/** El ancho que tendrá en una pantalla de este ancho. */
export const anchoTooltip = (vista: number, ancho: number = ANCHO_TOOLTIP, margen: number = MARGEN_TOOLTIP): number => Math.max(0, Math.min(ancho, vista - 2 * margen));

/** La posición del tooltip (en px de la pantalla, para `position: fixed`) para su ⓘ, su alto ya medido con ese ancho, y la
 *  pantalla. */
export function colocarTooltip(boton: Caja, alto: number, vista: { ancho: number; alto: number }, o: { ancho?: number; margen?: number; separacion?: number } = {}): { left: number; top: number; ancho: number; lado: "abajo" | "arriba" } {
  const margen = o.margen ?? MARGEN_TOOLTIP;
  const sep = o.separacion ?? SEPARACION_TOOLTIP;
  const ancho = anchoTooltip(vista.ancho, o.ancho ?? ANCHO_TOOLTIP, margen);
  const centro = (boton.left + boton.right) / 2;
  const left = Math.min(Math.max(centro - ancho / 2, margen), vista.ancho - margen - ancho);
  const abajo = boton.bottom + sep;
  const arriba = boton.top - sep - alto;
  const cabeAbajo = abajo + alto <= vista.alto - margen;
  const cabeArriba = arriba >= margen;
  // Abajo si cabe; si no, arriba si cabe; si no cabe en ninguno, donde hay más espacio, sin salirse.
  const lado: "abajo" | "arriba" = cabeAbajo || (!cabeArriba && vista.alto - boton.bottom >= boton.top) ? "abajo" : "arriba";
  const top = Math.min(Math.max(lado === "abajo" ? abajo : arriba, margen), Math.max(margen, vista.alto - margen - alto));
  return { left: Math.round(left), top: Math.round(top), ancho, lado };
}
