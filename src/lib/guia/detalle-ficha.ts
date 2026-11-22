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
  /** La fecha o la antigüedad de la publicación, si la ficha la trae (22-nov-2026, decisión de Fabrizio: se captura en las lecturas que
   *  ya hace el relleno, sin pedidos extra). No se sabe todavía qué campo la trae: se guarda lo que parezca una fecha o una cuenta de
   *  días en los datos de la página (con el nombre del campo) y el texto «publicado hace …» si aparece. null si no hay nada. */
  publicado?: PublicadoFicha | null;
}

export interface PublicadoFicha { campos: Record<string, string | number>; texto: string | null }

const CLAVE_FECHA = /(publi|creat|fecha|date|dias|days|antig|since|updated|modif)/i;
const PARECE_FECHA = /^\d{4}-\d{2}-\d{2}|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{10,13}$/;

/** Busca en los datos de la página (hasta 3 niveles) los campos con nombre de fecha o de días y valor de fecha o número. Puro. */
export function camposDeFecha(data: unknown, prefijo = "", nivel = 0, out: Record<string, string | number> = {}): Record<string, string | number> {
  if (!data || typeof data !== "object" || nivel > 3 || Object.keys(out).length >= 12) return out;
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (k === "multimedia" || k === "description" || k === "client") continue;
    const ruta = prefijo ? `${prefijo}.${k}` : k;
    if (CLAVE_FECHA.test(k) && (typeof v === "number" || (typeof v === "string" && (PARECE_FECHA.test(v.trim()) || /\d/.test(v) && v.length <= 40)))) out[ruta] = typeof v === "string" ? v.trim().slice(0, 40) : v;
    else if (v && typeof v === "object" && !Array.isArray(v)) camposDeFecha(v, ruta, nivel + 1, out);
    if (Object.keys(out).length >= 12) break;
  }
  return out;
}

/** «Publicado hace 3 días», «publicado el 12/10/2026»: el texto visible de la ficha, si aparece. Puro. */
export function textoPublicado(html: string): string | null {
  const m = html.replace(/<[^>]+>/g, " ").match(/publicad[oa]\s+(?:hace\s+\d+\s+[^\s<]+|el\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|el\s+\d{1,2}\s+de\s+[^\s<]+(?:\s+de\s+\d{4})?)/i);
  return m ? m[0].replace(/\s+/g, " ").trim().slice(0, 60) : null;
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
  const campos = camposDeFecha(data);
  const texto = textoPublicado(html);
  const publicado = Object.keys(campos).length || texto ? { campos, texto } : null;
  return { fotos, descripcion: limpio(data.description, MAX_DESCRIPCION), direccion: direccion ? direccion.replace(/\s+/g, " ") : null, publicado };
}

export type PuertaDetalle = "guia" | "relleno" | "invierte";
