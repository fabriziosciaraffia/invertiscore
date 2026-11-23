// ─────────────────────────────────────────────────────────────────────────────
// LOS AVISOS REPUBLICADOS (23-nov-2026; criterio aprobado por Fabrizio el 22-nov; migración 20261201_avisos_gemelos). Un aviso nuevo
// que es la republicación de uno dado de baja (el «gemelo» con otro id, en `avisos_gemelos`) hereda sus días y sus rebajas: los días
// cuentan desde el primer eslabón de la cadena, y las rebajas son las de cualquier eslabón más la republicación misma si volvió más
// barato. Puro: lo usan las señales del rango (rango-servidor.ts) y el tier. El criterio vive en SQL; estas constantes lo repiten
// para el tier, que exige que coincidan con la migración.
// ─────────────────────────────────────────────────────────────────────────────

export const CRITERIO_GEMELO = { radioM: 30, m2: 1, precioPct: 3, diasAntes: 10, diasDespues: 1 } as const;
/** Una bajada cuenta si el precio baja más de 0,5 % (la misma vara del historial de precios). */
export const BAJADA_MIN_PCT = 0.5;

export interface BajadaPrecio { fecha: string; precioAntes: number; precio: number }
export interface SaltoGemelo { fecha: string; precioViejoUF: number; precioNuevoUF: number }

/** La última bajada de la cadena: un cambio de precio de cualquier eslabón o la republicación más barata; la más reciente. */
export function ultimaBajadaCadena(cambios: readonly BajadaPrecio[], saltos: readonly SaltoGemelo[]): { uf: number; fecha: string } | null {
  const todas = [
    ...cambios.filter((c) => c.precioAntes > 0 && (1 - c.precio / c.precioAntes) * 100 > BAJADA_MIN_PCT).map((c) => ({ uf: c.precioAntes - c.precio, fecha: c.fecha })),
    ...saltos.filter((s) => s.precioViejoUF > 0 && (1 - s.precioNuevoUF / s.precioViejoUF) * 100 > BAJADA_MIN_PCT).map((s) => ({ uf: s.precioViejoUF - s.precioNuevoUF, fecha: s.fecha })),
  ];
  if (!todas.length) return null;
  const u = todas.sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return { uf: Math.round(u.uf * 10) / 10, fecha: u.fecha };
}

/** Desde cuándo está publicado, contando la cadena: el primer eslabón. */
export function publicadoDesde(cadena: readonly { vistoDesde: string }[]): string | null {
  if (!cadena.length) return null;
  return cadena.map((c) => c.vistoDesde).sort()[0];
}
