// Tasa ÚNICA de proyección de plusvalía a futuro del análisis (LTR + STR).
// Decisión de producto (rama motor-supuestos): 3% real anual, en un solo lugar.
//
// NO confundir con:
//   · PLUSVALIA_HISTORICA[comuna].anualizada — apreciación histórica OBSERVADA por comuna
//     (plusvalia-historica.ts). Es un dato del pasado, distinto por comuna.
//   · PLUSVALIA_REF_REAL (plusvalia-hallazgo.ts) — UMBRAL de apreciación real de largo plazo
//     usado para clasificar la histórica. Otro concepto (coincide en 3% por ahora, pero no
//     es la misma cifra semánticamente).
//
// Esta constante es la "proyección estándar Franco" que se declara en superficie
// ("proyección estándar Franco: 3% anual · histórico de tu comuna: X%"). Toda tasa de
// proyección a futuro del motor sale de acá — ningún literal 0.04/0.03 debe sobrevivir aparte.
export const PLUSVALIA_PROYECCION_ANUAL = 0.03; // 3% real anual: se compone CON la inflación (abajo).

// ─── LA PLUSVALÍA REAL, EN PESOS DE CADA AÑO (29-sep-2026) ───────────────────────────────
// Las proyecciones de los dos motores están en pesos de cada año: el dividendo crece con la UF
// (inflación 3%), el arriendo 3,5% y los costos 3%. El valor del depto, en cambio, crecía
// `precio × 1,03^año`: el «3% real» aplicado a pesos nominales, que en la práctica es ~0% real
// contra un dividendo que sí se inflaba. Y el saldo del crédito, que es una deuda en UF, se
// amortizaba en pesos del día 0.
//
// Desde hoy las dos existencias van en la misma moneda que los flujos: el valor crece con la
// plusvalía real Y la inflación (`factorValorNominal`), y el saldo en UF se convierte con la UF
// del año (`factorInflacion`). La inflación es la misma que ya infla el dividendo.
export const INFLACION_PROYECCION_ANUAL = 0.03;

/** Pesos de hoy → pesos del año `anios` (la UF sigue a la inflación). */
export function factorInflacion(anios: number): number {
  return Math.pow(1 + INFLACION_PROYECCION_ANUAL, anios);
}

/** Valor del depto en pesos del año `anios`: plusvalía real compuesta con la inflación. */
export function factorValorNominal(anios: number, plusvaliaReal: number = PLUSVALIA_PROYECCION_ANUAL): number {
  return Math.pow((1 + plusvaliaReal) * (1 + INFLACION_PROYECCION_ANUAL), anios);
}
