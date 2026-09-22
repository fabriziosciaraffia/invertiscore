// Refinanciamiento al año de salida — lo que comparten el motor LTR (`calcRefinanceScenario`),
// el motor STR (`buildRefinanceScenario`) y el capítulo «Tu resultado a N años» de las dos
// modalidades. Decisión de Fabrizio (22-sep-2026): el capítulo LEE el escenario del motor —
// hasta hoy calculaba el suyo con otros supuestos (70% del valor, plazo y tasa originales,
// sin el flujo resultante) mientras `refinanceScenario` se emitía en el 100% de las filas y
// no lo leía nadie— y si la cuota nueva supera 1,5× la actual, lo dice.

/** Loan-to-value del crédito nuevo sobre el valor proyectado al año de salida. */
export const REFI_LTV = 0.8;

/** Sobre esta razón (cuota nueva ÷ cuota actual) el capítulo avisa que el refinanciamiento
 *  encarece la cuota de forma material. */
export const REFI_AVISO_CUOTA_RATIO = 1.5;

/** Cuota nueva sobre la actual; null sin cuota actual (pie 100%, sin crédito). */
export function ratioCuotaRefi(nuevoDividendo: number, dividendoActual: number): number | null {
  if (!(dividendoActual > 0) || !Number.isFinite(nuevoDividendo)) return null;
  return nuevoDividendo / dividendoActual;
}

export function avisaCuotaRefi(ratio: number | null | undefined): boolean {
  return ratio != null && Number.isFinite(ratio) && ratio > REFI_AVISO_CUOTA_RATIO;
}

/** La frase del aviso, en las dos modalidades. `veces` ya viene con una décima («1,8»). */
export function fraseAvisoCuotaRefi(p: { veces: string; cuotaNueva: string; cuotaActual: string; flujoNuevo: string; flujoNuevoNegativo: boolean }): string {
  const cola = p.flujoNuevoNegativo
    ? `con ella el mes queda en ${p.flujoNuevo}: la liquidez sale de tu bolsillo, en cuotas.`
    : `con ella el mes queda en ${p.flujoNuevo}.`;
  return `La cuota nueva es ${p.veces} veces la actual (${p.cuotaNueva} contra ${p.cuotaActual}); ${cola}`;
}
