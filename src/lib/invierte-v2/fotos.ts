// ─────────────────────────────────────────────────────────────────────────────
// LAS FOTOS DE LOS DEPTOS EN INVIERTE CON FRANCO (entrega 3 de las láminas del 19-nov-2026). Puro: lo usan la pantalla, la ruta y
// el tier. Las fotos se guardan al leer la publicación (`publicacion_detalle`, detalle-ficha.ts) y se muestran SOLO a quien firmó
// la orden, a través de la ruta propia (URL_FOTO): la página nunca lleva la dirección de la fuente. Si un depto no tiene fotos
// utilizables, la tarjeta va sin foto, no con un hueco.
// ─────────────────────────────────────────────────────────────────────────────
export const URL_FOTO = "/api/invierte-v2/foto";
/** Cuántas fotos se ofrecen por depto en las flechas (las primeras de la publicación). */
export const MAX_FOTOS_VISTA = 12;
/** Lo más pesada que puede ser una foto que pasa por la ruta. */
export const MAX_BYTES_FOTO = 6 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const urlFoto = (avisoId: string, i: number) => `${URL_FOTO}?aviso=${encodeURIComponent(avisoId)}&i=${i}`;

/** El pedido de la ruta: un aviso (uuid) y un índice dentro de las que se ofrecen. */
export function pedidoFoto(aviso: string | null, i: string | null): { avisoId: string; i: number } | null {
  if (!aviso || !UUID.test(aviso)) return null;
  const n = Number(i);
  return Number.isInteger(n) && n >= 0 && n < MAX_FOTOS_VISTA ? { avisoId: aviso, i: n } : null;
}

/** Solo imágenes, y no más pesadas que el máximo. */
export const respuestaFotoValida = (tipo: string | null, largo: number | null) =>
  !!tipo && /^image\/(jpeg|png|webp)$/i.test(tipo.split(";")[0].trim()) && (largo == null || largo <= MAX_BYTES_FOTO);
