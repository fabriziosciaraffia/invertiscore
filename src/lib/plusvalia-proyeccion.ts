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
export const PLUSVALIA_PROYECCION_ANUAL = 0.03; // 3% real anual, nominal flat.
