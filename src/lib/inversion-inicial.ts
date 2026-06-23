/**
 * Inversión inicial (capital "día 1") — fuente única.
 *
 * Suma los aportes 100% equity que el comprador pone el día 1, sin financiar:
 * pie + gastos de cierre + (STR) amoblamiento + (usados) CapEx de puesta a punto.
 *
 * El caller pasa cada componente YA computado en CLP. Este helper NO recalcula
 * gastos de cierre ni ningún otro componente — solo centraliza la suma para que
 * los distintos puntos del motor (LTR métricas, LTR salida/TIR, espejo IA en la
 * narración, STR) no se desincronicen.
 */
export function calcInversionInicialCLP(p: {
  pieCLP: number;
  gastosCierreCLP: number; // ya computado por el caller (no recalcular)
  costoAmoblamientoCLP?: number; // STR; default 0
  capexPuestaAPuntoCLP?: number; // CapEx puesta a punto usados; default 0
}): number {
  return (
    p.pieCLP +
    p.gastosCierreCLP +
    (p.costoAmoblamientoCLP ?? 0) +
    (p.capexPuestaAPuntoCLP ?? 0)
  );
}
