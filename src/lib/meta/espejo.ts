/**
 * EL ESPEJO (15-oct-2026, medición para la campaña): el servidor decide cada evento de Meta —si corresponde, si la
 * cuenta es de prueba, si ya salió— y lo manda por la API de conversiones. Al navegador le deja el MISMO evento,
 * con el mismo `event_id`, para que el pixel lo repita: Meta junta los dos en una conversión. El navegador nunca
 * inventa el id de estos eventos; solo repite lo que el servidor le dejó.
 *
 * Por dónde llega el espejo:
 *   · una cookie corta (`franco_meta_espejo`) que el servidor pone en la respuesta —JSON o redirección— y que
 *     MetaPixel consume y vacía;
 *   · o una prop, cuando el evento sale al dibujar la página (ViewContent en el informe).
 *
 * Isomorfo en los tipos; `consumirCookieEspejo` y `espejarMeta` corren en el navegador.
 */
import { EVENTOS_PROPIOS } from "@/lib/meta/ids";
import { metaTrack, metaTrackCustom } from "@/lib/meta/pixel";

export interface EventoEspejo {
  evento: string;
  eventId: string;
  datos?: Record<string, unknown>;
}

export const COOKIE_ESPEJO = "franco_meta_espejo";
/** Cuánto vive el espejo si nadie lo consume (la vuelta desde Flow puede tardar). */
export const VIDA_ESPEJO_S = 60 * 60;
/** Tope de eventos en la cookie (una cookie no pasa de ~4 KB). */
export const TOPE_ESPEJO = 8;

/** Lee una lista de espejos de un texto (la cookie), descartando lo que no tenga forma. */
export function parsearEspejo(texto: string | null | undefined): EventoEspejo[] {
  if (!texto) return [];
  try {
    const v = JSON.parse(texto) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((e): e is EventoEspejo => !!e && typeof (e as EventoEspejo).evento === "string" && typeof (e as EventoEspejo).eventId === "string")
      .slice(0, TOPE_ESPEJO);
  } catch {
    return [];
  }
}

/** El pixel repite cada evento con su mismo id (los propios con `trackCustom`). Devuelve cuántos entraron. */
export function espejarMeta(lista: EventoEspejo[] | null | undefined): number {
  let n = 0;
  for (const e of lista ?? []) {
    if (EVENTOS_PROPIOS.has(e.evento)) {
      if (metaTrackCustom(e.evento, e.datos, e.eventId)) n++;
    } else {
      metaTrack(e.evento, e.datos, e.eventId);
      n++;
    }
  }
  return n;
}

/** Saca los espejos que dejó el servidor en la cookie y la borra. */
export function consumirCookieEspejo(): EventoEspejo[] {
  if (typeof document === "undefined") return [];
  const par = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_ESPEJO}=`));
  if (!par) return [];
  document.cookie = `${COOKIE_ESPEJO}=; Max-Age=0; Path=/; SameSite=Lax`;
  let valor = par.slice(COOKIE_ESPEJO.length + 1);
  try { valor = decodeURIComponent(valor); } catch { /* ya venía decodificada */ }
  return parsearEspejo(valor);
}
