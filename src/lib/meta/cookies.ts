/**
 * Las cookies de la medición de Meta que pone el middleware (15-oct-2026). Puro y sin dependencias de Node: corre
 * en el middleware.
 *
 *   · `_fbc`: el clic del anuncio. Meta lo arma con el `fbclid` de la URL, pero solo si el pixel alcanza a cargar
 *     antes de que la persona deje la página —y el pixel carga con la página quieta—. El middleware lo guarda en la
 *     primera respuesta, con el mismo formato que usa el pixel (`fb.1.<ms>.<fbclid>`), así el clic queda aunque el
 *     pixel no cargue. Si ya hay un `_fbc` de ese mismo clic, no se toca.
 *   · `franco_meta_prueba`: el MODO PRUEBA. `?meta_prueba=1` lo prende por un día; `?meta_prueba=0` lo apaga. Con él,
 *     los eventos del servidor salen con el código de prueba (servidor.ts).
 */

export const COOKIE_FBC = "_fbc";
export const COOKIE_PRUEBA = "franco_meta_prueba";
/** Lo que dura `_fbc`: los 90 días del pixel. */
export const VIDA_FBC_S = 90 * 24 * 60 * 60;
export const VIDA_PRUEBA_S = 24 * 60 * 60;

/** Un fbclid razonable: lo que trae Meta (letras, números, guiones y guiones bajos), acotado. */
export function fbclidValido(v: string | null | undefined): string | null {
  return v && /^[A-Za-z0-9_-]{8,500}$/.test(v) ? v : null;
}

export function fbcDeFbclid(fbclid: string, ahoraMs: number): string {
  return `fb.1.${ahoraMs}.${fbclid}`;
}

/** ¿El `_fbc` guardado es de este mismo clic? */
export function fbcEsDelClic(fbc: string | null | undefined, fbclid: string): boolean {
  return !!fbc && fbc.endsWith(`.${fbclid}`);
}

/** El dominio de la cookie: el sitio y sus subdominios en producción, el host solo en cualquier otro lado. */
export function dominioDeCookie(host: string | null | undefined): string | undefined {
  const h = (host ?? "").split(":")[0].toLowerCase();
  return h === "refranco.ai" || h.endsWith(".refranco.ai") ? ".refranco.ai" : undefined;
}

/** Qué hacer con las cookies de medición en esta llegada. */
export function cookiesDeLlegada(p: { search: string; host: string | null; fbcActual: string | null; ahoraMs: number }): {
  fbc: { valor: string; dominio: string | undefined } | null;
  prueba: "prender" | "apagar" | null;
} {
  const params = new URLSearchParams(p.search);
  const fbclid = fbclidValido(params.get("fbclid"));
  const fbc = fbclid && !fbcEsDelClic(p.fbcActual, fbclid) ? { valor: fbcDeFbclid(fbclid, p.ahoraMs), dominio: dominioDeCookie(p.host) } : null;
  const mp = params.get("meta_prueba");
  return { fbc, prueba: mp === "1" ? "prender" : mp === "0" ? "apagar" : null };
}
