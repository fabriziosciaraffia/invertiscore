// ============================================================================
// GOLDEN · timeout por llamada (06-sep-2026)
// ============================================================================
// Una tanda FULL LTR se quedó colgada 8 horas en un reintento del generador (una
// llamada HTTP que nunca volvió) sin escribir una línea: el runner no tenía techo por
// llamada. Este helper lo pone: la promesa que no vuelve en `ms` se rechaza con
// TimeoutGolden, el tier marca el seed como FALLA-TIMEOUT y sigue con el siguiente.
// La llamada colgada queda huérfana (no se puede abortar desde afuera el cliente que
// arma el generador); el runner termina con process.exit, así que no retiene el proceso.
// ============================================================================

export const TIMEOUT_GENERADOR_MS = 5 * 60 * 1000;

export class TimeoutGolden extends Error {
  constructor(public readonly etiqueta: string, public readonly ms: number) {
    super(`FALLA-TIMEOUT: ${etiqueta} no volvió en ${Math.round(ms / 1000)} s`);
    this.name = "TimeoutGolden";
  }
}

/** Rechaza con TimeoutGolden si `p` no resuelve en `ms`. El timer se limpia al resolver. */
export function conTimeout<T>(p: Promise<T>, ms: number, etiqueta: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const reloj = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new TimeoutGolden(etiqueta, ms)), ms); });
  return Promise.race([p, reloj]).finally(() => { if (timer) clearTimeout(timer); });
}

export const esTimeout = (e: unknown): e is TimeoutGolden => e instanceof TimeoutGolden;
