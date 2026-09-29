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
export const PLUSVALIA_PROYECCION_ANUAL = 0.03; // 3% real anual, en pesos de hoy (abajo).

// ─── LA PROYECCIÓN, EN PESOS DE HOY (29-sep-2026) ────────────────────────────────────────
// Regla de Fabrizio: todo monto futuro se muestra en pesos de hoy —equivalente a UF— y todo
// porcentaje de rentabilidad, tasa o crecimiento en términos reales, como habla el mercado
// («UF + 4%»). El botón CLP/UF muestra lo mismo en las dos unidades, sin inflación de por medio.
//
// Hasta hoy los flujos iban en pesos de cada año (el dividendo crecía 3% con la UF, el arriendo
// 3,5%, los costos 3%) mientras el valor del depto crecía 3% y el saldo quedaba en pesos del día
// 0: dos monedas en la misma proyección, y el «3% real» era ~0% real contra un dividendo inflado.
// Ahora TODO va en pesos de hoy: el valor crece con la plusvalía real, el saldo es la deuda en UF
// (pesos de hoy), la cuota es fija en UF y cada término crece solo lo que supera a la inflación
// (`crecimientoReal`). Con todos los años en la misma moneda, restar o comparar montos de años
// distintos es legítimo, y la TIR de esos flujos es la TIR real.
export const INFLACION_PROYECCION_ANUAL = 0.03;

/** Crecimiento real de un término que en pesos crece `nominal` al año: (1+n)/(1+inflación) − 1. */
export function crecimientoReal(nominal: number): number {
  return (1 + nominal) / (1 + INFLACION_PROYECCION_ANUAL) - 1;
}
