// ─────────────────────────────────────────────────────────────────────────────
// LIMPIEZA DE SENTRY (27-nov-2026, la asesoría): las respuestas de «Tus números» y el aporte no salen del navegador sin cuenta, así
// que tampoco por un error. Antes de mandar un evento se borra todo campo cuyo nombre hable de renta, pie, deudas, aporte, tope,
// capacidad, edad o del estado de la asesoría, en `extra`, `contexts`, `tags`, el cuerpo del request y los breadcrumbs (con sus
// datos y los mensajes que traen la clave del estado). Puro y sin dependencias: lo usan las tres configuraciones de Sentry.
// ─────────────────────────────────────────────────────────────────────────────
export const CLAVES_SENSIBLES = /renta|(^|_)pie|deuda|aporte|tope|capacidad|edad|franco_asesoria|preaprob|numeros/i;
const BORRADO = "[borrado]";

function limpiarObjeto(o: unknown, prof = 0): unknown {
  if (o == null || typeof o !== "object" || prof > 6) return o;
  if (Array.isArray(o)) return o.map((x) => limpiarObjeto(x, prof + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) out[k] = CLAVES_SENSIBLES.test(k) ? BORRADO : limpiarObjeto(v, prof + 1);
  return out;
}

type EventoMin = {
  extra?: unknown; contexts?: unknown; tags?: unknown;
  request?: { data?: unknown; [k: string]: unknown };
  breadcrumbs?: Array<{ data?: unknown; message?: string; [k: string]: unknown }> | { values?: Array<{ data?: unknown; message?: string }> };
};

export function limpiarEventoSentry<T>(evento: T): T {
  const e = evento as unknown as EventoMin;
  if (!e || typeof e !== "object") return evento;
  if (e.extra) e.extra = limpiarObjeto(e.extra);
  if (e.contexts) e.contexts = limpiarObjeto(e.contexts);
  if (e.tags) e.tags = limpiarObjeto(e.tags);
  if (e.request && e.request.data != null) e.request.data = typeof e.request.data === "string" && /franco_asesoria|renta|aporte/i.test(e.request.data) ? BORRADO : limpiarObjeto(e.request.data);
  const migas = Array.isArray(e.breadcrumbs) ? e.breadcrumbs : e.breadcrumbs?.values;
  if (migas) for (const m of migas) {
    if (m.data) m.data = limpiarObjeto(m.data);
    if (typeof m.message === "string" && /franco_asesoria/.test(m.message)) m.message = BORRADO;
  }
  return evento;
}
