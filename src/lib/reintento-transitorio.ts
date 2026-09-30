// ─────────────────────────────────────────────────────────────────────────────
// Reintento de consultas a Supabase ante errores de red transitorios (30-sep-2026).
//
// El cron evaluar-avisos dejó en Sentry «PostgrestError: TypeError: fetch failed» (JAVASCRIPT-NEXTJS-W
// y -Q) desde su primera corrida: cortes de red entre la función y Supabase, que en esa ventana no
// devolvió un solo 5xx. En la lectura del radio ese corte hacía que el radio se diera por vacío y la
// sugerencia cayera en silencio a la referencia de la comuna. Acá: hasta ESPERAS_REINTENTO.length
// reintentos, SOLO para errores de red; un error de PostgREST con código (sintaxis, permisos, tabla)
// no se arregla reintentando y vuelve al primer intento.
// ─────────────────────────────────────────────────────────────────────────────

/** Esperas antes de cada reintento (ms): dos reintentos, 300 ms y 1,2 s. */
export const ESPERAS_REINTENTO = [300, 1200];

/** ¿Es un corte de red (vale reintentar) y no un error de la consulta? */
export function esErrorTransitorio(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const m = String(error.message ?? "");
  // Un código de Postgres/PostgREST (42P01, PGRST116…) es un error de la consulta, no de la red.
  if (error.code && /^[0-9A-Z]{5}$|^PGRST/.test(error.code)) return false;
  return /fetch failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|socket hang up|other side closed|network|timeout|terminated/i.test(m);
}

/**
 * Corre la consulta y la reintenta ante un corte de red. Devuelve la última respuesta (con su error si
 * todos los intentos fallaron) y cuántos intentos hizo.
 */
export async function reintentarConsulta<T extends { error: { message?: string; code?: string } | null }>(
  consulta: () => PromiseLike<T>,
  esperas: number[] = ESPERAS_REINTENTO,
): Promise<T & { intentos: number }> {
  let r = await consulta();
  let intentos = 1;
  for (const espera of esperas) {
    if (!esErrorTransitorio(r.error)) break;
    if (espera > 0) await new Promise((res) => setTimeout(res, espera));
    r = await consulta();
    intentos++;
  }
  return Object.assign(r, { intentos });
}
