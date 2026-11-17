// ─────────────────────────────────────────────────────────────────────────────
// LA COPIA DE LA ORDEN QUE NO SALIÓ (18-nov-2026, decisión de Fabrizio tras la prueba del preview). Reglas puras: las usan el
// reintento del cron `correo-del-dia`, el admin y el tier INVIERTE-V2.
//   · SE REINTENTA durante 7 días desde la firma, hasta 5 intentos fallidos, espaciados (PLAN_REINTENTO_MIN): el primero apenas
//     lo ve el cron; después a los 10, 30, 60 y 180 minutos del intento anterior.
//   · MIENTRAS EL MODO NO SEA «todos», solo se reintentan órdenes de correos de la lista.
//   · PASADA UNA HORA sin copia, un aviso a hola@, una vez por orden.
//   · EL PASO VA AISLADO en el cron: corre después del correo diario, con su propio try y un tope de tiempo; nunca lanza, y si
//     falla o se demora, el correo diario ya salió y su corrida ya cerró.
// ─────────────────────────────────────────────────────────────────────────────

export const VENTANA_REINTENTO_DIAS = 7;
export const MAX_INTENTOS_COPIA = 5;
/** Minutos a esperar desde el último intento fallido, según cuántos van (índice = intentos fallidos). */
export const PLAN_REINTENTO_MIN = [0, 10, 30, 60, 180] as const;
export const ALERTA_COPIA_MIN = 60;
/** El tope del paso dentro del cron. */
export const TOPE_PASO_COPIAS_MS = 20_000;

export interface EstadoCopia {
  firmadoAt: string;
  intentos: number;
  ultimoIntentoAt: string | null;
}

/** ¿Le toca un intento ahora? */
export function tocaReintentar(e: EstadoCopia, ahora: Date): boolean {
  const t = ahora.getTime();
  if (t - Date.parse(e.firmadoAt) > VENTANA_REINTENTO_DIAS * 86_400_000) return false;
  if (e.intentos >= MAX_INTENTOS_COPIA) return false;
  if (!e.ultimoIntentoAt || e.intentos === 0) return true;
  const espera = PLAN_REINTENTO_MIN[Math.min(e.intentos, PLAN_REINTENTO_MIN.length - 1)] * 60_000;
  return t - Date.parse(e.ultimoIntentoAt) >= espera;
}

/** ¿Hay que avisar a hola@? Una sola vez por orden, pasada la hora. */
export function debeAvisar(p: { firmadoAt: string; yaAvisada: boolean }, ahora: Date): boolean {
  return !p.yaAvisada && ahora.getTime() - Date.parse(p.firmadoAt) >= ALERTA_COPIA_MIN * 60_000;
}

/** Corre `fn` sin dejar que lance ni que se demore más que `topeMs`. Devuelve qué pasó; nunca rechaza. */
export async function pasoAislado<T>(fn: () => Promise<T>, topeMs: number, alFallar: (e: unknown) => void): Promise<{ ok: true; valor: T } | { ok: false; motivo: "error" | "tope" }> {
  if (!(topeMs > 0)) return { ok: false, motivo: "tope" };
  let timer: ReturnType<typeof setTimeout> | null = null;
  const tope = new Promise<"tope">((r) => { timer = setTimeout(() => r("tope"), topeMs); });
  try {
    const r = await Promise.race([fn().then((valor) => ({ valor })), tope]);
    if (r === "tope") { alFallar(new Error(`paso aislado: pasó el tope de ${topeMs} ms`)); return { ok: false, motivo: "tope" }; }
    return { ok: true, valor: r.valor };
  } catch (e) {
    try { alFallar(e); } catch { /* el aviso tampoco puede cortar */ }
    return { ok: false, motivo: "error" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * EL CORREO DIARIO PRIMERO, EL PASO DESPUÉS (la condición de Fabrizio, 18-nov-2026). Lo usa tal cual el cron `correo-del-dia`:
 * corre `diario` hasta el final (envíos y cierre de la corrida), y recién entonces el paso aislado, con su tope. Devuelve SIEMPRE
 * lo que devolvió `diario`, falle o se demore el paso. Lo prueba el tier INVIERTE-V2 con un paso que lanza y uno que no termina.
 */
export async function diarioYLuegoPaso<R>(diario: () => Promise<R>, paso: () => Promise<unknown>, topeMs: () => number, alFallar: (e: unknown) => void): Promise<R> {
  const r = await diario();
  await pasoAislado(paso, topeMs(), alFallar);
  return r;
}
