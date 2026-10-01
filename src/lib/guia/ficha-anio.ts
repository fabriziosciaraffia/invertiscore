// ─────────────────────────────────────────────────────────────────────────────
// El año del edificio, leído de la ficha del aviso (30-sep-2026). No hay una lectura propia para el año:
// sale de la MISMA lectura que chequea si el aviso sigue publicado (publicacion.ts, 01-oct-2026), con sus
// resguardos —un GET, tope global por hora, sin reintentos—. Si la ficha no lo dice, el informe sale con
// 25 años supuestos y lo dice. El año de una ficha SE COMPARTE con los otros avisos del mismo edificio
// (`anios_edificio`). Puro: lo prueba el tier GUIA-BUSQUEDA.
// ─────────────────────────────────────────────────────────────────────────────

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
