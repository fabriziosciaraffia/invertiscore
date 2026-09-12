// ─────────────────────────────────────────────────────────────────────────────
// RENTABILIDAD SOBRE LO PUESTO EN EL SCORE (12-sep-2026) — fuente única.
//
// Decisión de producto (Fabrizio): el score mira el retorno sobre lo que pone el
// comprador, no solo el activo. Hasta hoy el cash-on-cash pesaba 0 y la TIR era una
// puerta binaria del 6 %: poner más pie subía el veredicto aunque el retorno por peso
// bajara. Desde acá las dos entran como DIMENSIONES PONDERADAS, en las dos
// modalidades, con el esquema A medido en FASE 0 sobre 1.204 LTR y 249 STR.
//
// LAS PUERTAS DEL FLUJO NO SE TOCAN. G1/G2/G3 (LTR) y los ocho brazos (STR) siguen en
// `analysis.ts` y `short-term-score.ts` con sus umbrales: un depto que no se paga solo
// no es COMPRAR aunque rinda. Este módulo solo dice cuánto pesa cada cosa y cómo se
// puntúa.
//
// Este archivo lo leen los dos motores, el PDF (que hasta hoy hardcodeaba 30/25/25/20)
// y el tier `score-retorno` del golden. No lo importa ningún prompt: el bump de los
// system va en su propio bloque.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PESOS LTR (esquema A). Plusvalía y eficiencia conservan su proporción de siempre
 * (25:20) y ceden juntas 15 puntos; rentabilidad y flujo ceden 10 y 5. Medido en el
 * parque con la curva calibrada: 10 de 1.204 veredictos cambian (7 bajan, 3 suben) y
 * las bandas 70/45 se sostienen (cortes equivalentes 68 / 42).
 */
export const PESOS_SCORE_LTR = {
  rentabilidad: 20,
  flujoCaja: 20,
  cashOnCash: 20,
  tir: 10,
  plusvalia: 17,
  eficiencia: 13,
} as const;

/**
 * PESOS STR (esquema A). El cap rate cede 10 y las otras tres 5 cada una; sostenibilidad
 * y factibilidad no bajan de 20 porque ahí viven el flujo y la zona. Medido: 5 de 249
 * veredictos cambian (1 baja, 4 suben), bandas sostenidas (cortes equivalentes 69 / 46).
 */
export const PESOS_SCORE_STR = {
  rentabilidad: 15,
  sostenibilidad: 20,
  ventaja: 20,
  factibilidad: 20,
  cashOnCash: 15,
  tir: 10,
} as const;

/**
 * CURVA DEL CASH-ON-CASH, en % anual sobre el capital propio. CALIBRADA AL PARQUE, no a
 * un ideal: el parque chileno es apalancado y su CoC mediano es negativo (−5 % en
 * AJUSTA, −14 % en BUSCAR), así que la mediana de cada veredicto cae donde caen hoy sus
 * otras dimensiones —BUSCAR ≈ 35, AJUSTA ≈ 58, COMPRAR ≈ 88—. La curva «absoluta»
 * (0 % → 45) se midió y se descartó: desinflaba el score 7-11 puntos y solo bajaba
 * veredictos. Mismos puntos para LTR y STR.
 */
export const CURVA_CASH_ON_CASH: readonly (readonly [number, number])[] = [
  [-25, 5], [-14, 30], [-9, 45], [-5, 58], [-2, 68], [0, 74], [3, 82], [6, 90], [12, 100],
];

/**
 * CURVA DE LA TIR a 10 años, en %. Calibrada igual: 3 % (mediana BUSCAR) → 35, 7 %
 * (mediana AJUSTA) → 58, 12 % → 82, 20 % → 100. El 6 % que era puerta binaria queda
 * dentro de la curva (≈ 53), no como salto.
 */
export const CURVA_TIR: readonly (readonly [number, number])[] = [
  [-2, 0], [3, 35], [5, 48], [7, 58], [9, 68], [12, 82], [16, 95], [20, 100],
];

/** Lineal entre puntos de quiebre, saturada en los extremos. */
export function interpolarCurva(curva: readonly (readonly [number, number])[], x: number): number {
  if (!Number.isFinite(x)) return curva[0][1];
  if (x <= curva[0][0]) return curva[0][1];
  for (let i = 1; i < curva.length; i++) {
    if (x <= curva[i][0]) {
      const [x0, y0] = curva[i - 1];
      const [x1, y1] = curva[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return curva[curva.length - 1][1];
}

export const puntajeCashOnCash = (pct: number): number => interpolarCurva(CURVA_CASH_ON_CASH, pct);
export const puntajeTir = (pct: number): number => interpolarCurva(CURVA_TIR, pct);

/**
 * Media ponderada de dimensiones donde alguna puede NO APLICAR (`puntaje: null`): su
 * peso se reparte proporcionalmente entre las demás en vez de puntuarla con un neutro.
 *
 * Es la regla de PIE CERO para la TIR: sin capital propio el motor la declara
 * `no_aplica` (y también el CoC, pero ese se reemplaza por el rendimiento neto sobre el
 * precio, ver los motores). Un neutro de 45 se midió y castigaba lo que no se puede
 * medir: 3 COMPRAR LTR y 1 STR caían a AJUSTA solo por no tener pie.
 */
export function combinarConReparto(partes: readonly { peso: number; puntaje: number | null }[]): number {
  let suma = 0;
  let pesoTotal = 0;
  for (const p of partes) {
    if (p.puntaje == null || !Number.isFinite(p.puntaje)) continue;
    suma += p.peso * p.puntaje;
    pesoTotal += p.peso;
  }
  if (pesoTotal <= 0) return 0;
  return Math.round(suma / pesoTotal);
}
