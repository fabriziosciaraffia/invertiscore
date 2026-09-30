// ─────────────────────────────────────────────────────────────────────────────
// El año del edificio, leído A DEMANDA de la ficha del aviso (30-sep-2026). Es la única puerta a la
// ficha HTML de la fuente, que bloquea la IP a los ~36 GETs (CLAUDE.md). Resguardos, todos acá:
//   1 · cada ficha se lee UNA SOLA VEZ: la lectura se reserva antes de salir y el resultado se guarda
//       (`fichas_leidas`); una ficha ya leída no se vuelve a pedir, traiga o no el año;
//   2 · TOPE GLOBAL POR HORA para todas las lecturas (`TOPE_FICHAS_POR_HORA`), no por persona;
//   3 · SIN REINTENTOS: un solo pedido, con tiempo máximo; si falla o no trae el año, el informe sale
//       con 25 años supuestos y lo dice;
//   4 · el año de una ficha SE COMPARTE con los otros avisos del mismo edificio (`anios_edificio`):
//       si ya se sabe, no se lee nada.
// Lo llama solo «Analizar este» de la guía. Ningún cron ni backfill entra por acá.
// Puro: el almacén y la bajada se inyectan (el tier los prueba con dobles).
// ─────────────────────────────────────────────────────────────────────────────

export const TOPE_FICHAS_POR_HORA = 12;
export const TIMEOUT_FICHA_MS = 8000;

export interface AlmacenFichas {
  anioEdificio(clave: string): Promise<number | null>;
  fichaLeida(avisoId: string): Promise<{ anio: number | null } | null>;
  lecturasUltimaHora(): Promise<number>;
  /** Reserva la lectura; false si otra ya la reservó (clave única por aviso). */
  reservar(avisoId: string, clave: string): Promise<boolean>;
  cerrar(avisoId: string, estado: "anio" | "sin_anio" | "error", anio: number | null): Promise<void>;
  guardarAnioEdificio(clave: string, anio: number, avisoId: string): Promise<void>;
}

export type OrigenAnio = "edificio" | "ficha" | "ya-leida" | "tope" | "sin-ficha";

/** El edificio: la coordenada exacta que el listado le da a todos sus avisos (≈1 m), en su comuna. */
export function claveEdificio(a: { comuna: string; lat: number; lng: number }): string {
  return `${a.comuna}|${a.lat.toFixed(5)}|${a.lng.toFixed(5)}`;
}

const anioValido = (n: number, ahora: Date) => Number.isInteger(n) && n >= 1900 && n <= ahora.getFullYear();

/**
 * El año de construcción que dice la ficha: en sus características («Año de construcción», «Antigüedad»)
 * o en la descripción («construido en el año 2012»). null si no lo dice claro.
 */
export function parsearAnioFicha(html: string, ahora: Date = new Date()): number | null {
  const car = html.match(/"characteristics":(\[[^\]]*\])/);
  if (car) {
    try {
      const lista = JSON.parse(car[1]) as Array<{ name?: string; value?: string }>;
      for (const c of lista) {
        if (!/a[ñn]o|antig|construc/i.test(c.name ?? "")) continue;
        const v = String(c.value ?? "");
        const y = v.match(/\b(1[9]\d\d|20\d\d)\b/);
        if (y && anioValido(Number(y[1]), ahora)) return Number(y[1]);
        const n = v.match(/(\d{1,3})\s*a[ñn]os?/i);
        if (n) return ahora.getFullYear() - Number(n[1]);
      }
    } catch {
      /* características ilegibles: se mira la descripción */
    }
  }
  const pats = [
    /constru[ií]d[oa]s?\s+(?:en\s+)?(?:el\s+)?(?:a[ñn]o\s+)?(1[9]\d\d|20\d\d)\b/i,
    /a[ñn]o\s+de\s+construcci[oó]n\s*:?\s*(1[9]\d\d|20\d\d)\b/i,
  ];
  for (const p of pats) {
    const m = html.match(p);
    if (m && anioValido(Number(m[1]), ahora)) return Number(m[1]);
  }
  return null;
}

/** Los años del edificio para el motor, desde el año de construcción. */
export const aniosDesde = (anio: number, ahora: Date = new Date()) => Math.max(0, ahora.getFullYear() - anio);

/**
 * El año de un aviso usado. UN pedido como mucho, y solo si el edificio no se conoce, la ficha no se
 * leyó nunca y la hora tiene cupo. `bajarHtml` hace un solo intento y devuelve null si falla.
 */
export async function anioDeAviso(
  aviso: { id: string; url: string | null; comuna: string; lat: number; lng: number },
  almacen: AlmacenFichas,
  bajarHtml: (url: string) => Promise<string | null>,
  ahora: Date = new Date(),
): Promise<{ anio: number | null; origen: OrigenAnio }> {
  const clave = claveEdificio(aviso);
  const delEdificio = await almacen.anioEdificio(clave);
  if (delEdificio != null) return { anio: delEdificio, origen: "edificio" };
  const leida = await almacen.fichaLeida(aviso.id);
  if (leida) return { anio: leida.anio, origen: "ya-leida" };
  if (!aviso.url) return { anio: null, origen: "sin-ficha" };
  if ((await almacen.lecturasUltimaHora()) >= TOPE_FICHAS_POR_HORA) return { anio: null, origen: "tope" };
  if (!(await almacen.reservar(aviso.id, clave))) return { anio: null, origen: "ya-leida" };
  let html: string | null = null;
  try {
    html = await bajarHtml(aviso.url);
  } catch {
    html = null;
  }
  const anio = html ? parsearAnioFicha(html, ahora) : null;
  await almacen.cerrar(aviso.id, html == null ? "error" : anio != null ? "anio" : "sin_anio", anio);
  if (anio != null) await almacen.guardarAnioEdificio(clave, anio, aviso.id);
  return { anio, origen: "ficha" };
}
