// ─────────────────────────────────────────────────────────────────────────────
// LAS FOTOS, EL TEXTO DEL PUBLICADOR Y LA DIRECCIÓN DE UNA PUBLICACIÓN (19-nov-2026, decisión de Fabrizio). Puro: lo usa
// `leerFicha` en cada 200 de la ficha nueva, sin un GET extra, y el tier. Los datos de la página vienen en `__NEXT_DATA__`
// (props.pageProps.initialState.property.property.data, medido el 20-nov-2026): `multimedia.images` (direcciones completas de las
// fotos), `description` y `address.street`. Se guardan en `publicacion_detalle` (uso interno; las fotos se muestran solo a quien
// firmó la orden, a través de /api/invierte-v2/foto, nunca con la dirección de la fuente).
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_FOTOS = 40;
export const MAX_DESCRIPCION = 8000;
export const MAX_DIRECCION = 300;

export interface DetalleFicha {
  fotos: string[];
  descripcion: string | null;
  direccion: string | null;
}

const FOTO = /^https:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp)(?:\?[^\s"'<>]*)?$/i;

/** Lo que trae la ficha. null si la página no trae los datos (no es la ficha, o cambió su forma). */
export function parsearDetalleFicha(html: string | null | undefined): DetalleFicha | null {
  if (!html) return null;
  const m = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data: { multimedia?: { images?: unknown }; description?: unknown; address?: { street?: unknown } } | undefined;
  try {
    data = (JSON.parse(m[1]) as { props?: { pageProps?: { initialState?: { property?: { property?: { data?: typeof data } } } } } })
      ?.props?.pageProps?.initialState?.property?.property?.data;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const imgs = Array.isArray(data.multimedia?.images) ? data.multimedia!.images as unknown[] : [];
  const fotos = Array.from(new Set(imgs.filter((u): u is string => typeof u === "string" && FOTO.test(u.trim())).map((u) => u.trim()))).slice(0, MAX_FOTOS);
  const limpio = (x: unknown, max: number) => (typeof x === "string" && x.trim() ? x.replace(/\r\n/g, "\n").trim().slice(0, max) : null);
  const direccion = limpio(data.address?.street, MAX_DIRECCION);
  return { fotos, descripcion: limpio(data.description, MAX_DESCRIPCION), direccion: direccion ? direccion.replace(/\s+/g, " ") : null };
}

export type PuertaDetalle = "guia" | "relleno" | "invierte";
