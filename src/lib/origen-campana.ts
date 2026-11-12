// ─────────────────────────────────────────────────────────────────────────────
// EL ORIGEN DE CADA REGISTRO (12-nov-2026, campaña de noviembre, fase 0; decisión de Fabrizio: la verdad de la campaña sale de
// nuestra base, no del panel de Meta). Puro y sin dependencias de Node: lo usa el middleware.
//   · EN LA PRIMERA VISITA el middleware guarda una cookie de primera parte, `franco_origen`, por 30 días: utm_source,
//     utm_medium, utm_campaign, utm_content, utm_term, el fbclid, la página de llegada y la hora. Primer toque: una visita
//     posterior no la pisa, salvo que la guardada no traiga campaña (ni UTM ni fbclid) y esta sí.
//   · AL REGISTRARSE, por cualquier puerta, el servidor la lee y la deja en la cuenta (`user_attribution`, que solo rellena lo
//     vacío): origen-campana-servidor.ts › guardarOrigenDeLaCuenta. El fbclid queda en el `fbc` de la cuenta
//     (`fb.1.<hora>.<fbclid>`, el formato del pixel).
//   · LA MISMA COOKIE da el origen de las inscripciones de «Invierte con Franco» y el `fbc` de los eventos del servidor a Meta
//     cuando el navegador todavía no tiene `_fbc`.
// Lo fija el tier CAMPANA-FASE0.
// ─────────────────────────────────────────────────────────────────────────────
import { fbcDeFbclid, fbclidValido } from "@/lib/meta/cookies";

export const COOKIE_ORIGEN = "franco_origen";
export const VIDA_ORIGEN_S = 30 * 24 * 60 * 60;

export const CLAVES_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type ClaveUtm = (typeof CLAVES_UTM)[number];

export interface OrigenCampana {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  /** La página de llegada (solo el path). */
  landing: string;
  /** La hora de la llegada (ms). */
  t: number;
}

const LIMPIO = /^[A-Za-z0-9À-ſ ._\-+:/|()[\]#@,]{1,200}$/;
const limpiar = (v: string | null | undefined): string | undefined => {
  const x = (v ?? "").trim();
  return x && LIMPIO.test(x) ? x : undefined;
};
const path = (p: string | null | undefined): string => {
  const x = (p ?? "/").split("?")[0].split("#")[0];
  return /^\/[\w\-./%]{0,200}$/.test(x) ? x : "/";
};

/** ¿Trae campaña? (algún UTM o el fbclid). */
export const tieneCampana = (o: OrigenCampana | null | undefined): boolean => !!o && (!!o.fbclid || CLAVES_UTM.some((k) => !!o[k]));

/** El origen de esta llegada: los UTM y el fbclid de la URL, la página y la hora. */
export function origenDeLlegada(p: { pathname: string; search: string; ahoraMs: number }): OrigenCampana {
  const q = new URLSearchParams(p.search);
  const o: OrigenCampana = { landing: path(p.pathname), t: p.ahoraMs };
  for (const k of CLAVES_UTM) {
    const v = limpiar(q.get(k));
    if (v) o[k] = v;
  }
  const f = fbclidValido(q.get("fbclid"));
  if (f) o.fbclid = f;
  return o;
}

/** Lo que vale la cookie: el JSON (`res.cookies.set` de Next lo codifica para la cabecera). */
export function valorCookieOrigen(o: OrigenCampana): string {
  return JSON.stringify(o);
}

/** La cookie leída y saneada; null si no hay o no vale. */
export function leerCookieOrigen(raw: string | null | undefined): OrigenCampana | null {
  if (!raw) return null;
  try {
    // Llega decodificada (`request.cookies.get` de Next) o tal cual viene en la cabecera (codificada): las dos valen.
    const texto = raw.trimStart().startsWith("{") ? raw : decodeURIComponent(raw);
    const x = JSON.parse(texto) as Record<string, unknown>;
    if (!x || typeof x !== "object" || typeof x.t !== "number" || !Number.isFinite(x.t)) return null;
    const o: OrigenCampana = { landing: path(typeof x.landing === "string" ? x.landing : "/"), t: x.t };
    for (const k of CLAVES_UTM) {
      const v = limpiar(typeof x[k] === "string" ? (x[k] as string) : null);
      if (v) o[k] = v;
    }
    const f = fbclidValido(typeof x.fbclid === "string" ? x.fbclid : null);
    if (f) o.fbclid = f;
    return o;
  } catch {
    return null;
  }
}

/** La cookie de una cabecera `Cookie` entera. */
export function origenDeCabecera(cookie: string | null | undefined): OrigenCampana | null {
  if (!cookie) return null;
  const par = cookie.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_ORIGEN}=`));
  return par ? leerCookieOrigen(par.slice(COOKIE_ORIGEN.length + 1)) : null;
}

/**
 * ¿Se escribe la cookie en esta llegada? Primer toque: si no hay, sí (toda primera visita queda, traiga o no campaña); si la
 * guardada no trae campaña y esta sí, también (el anuncio manda sobre la visita directa de antes); si no, no se toca.
 */
export function escribirOrigen(actual: OrigenCampana | null, llegada: OrigenCampana): boolean {
  if (!actual) return true;
  return !tieneCampana(actual) && tieneCampana(llegada);
}

/** El `fbc` del clic del anuncio que trajo la cookie (formato del pixel, con la hora de la llegada); null sin fbclid. */
export function fbcDeOrigen(o: OrigenCampana | null | undefined): string | null {
  return o?.fbclid ? fbcDeFbclid(o.fbclid, o.t) : null;
}

/** Lo que va a la cuenta (`user_attribution`): los UTM, la página de llegada y el fbc del fbclid. */
export function atribucionDeOrigen(o: OrigenCampana): { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null; landing_path: string | null; fbc: string | null } {
  return {
    utm_source: o.utm_source ?? null,
    utm_medium: o.utm_medium ?? null,
    utm_campaign: o.utm_campaign ?? null,
    utm_content: o.utm_content ?? null,
    utm_term: o.utm_term ?? null,
    landing_path: o.landing ?? null,
    fbc: fbcDeOrigen(o),
  };
}

/** El origen va a la cuenta solo AL REGISTRARSE: una cuenta creada hace más de esto que entra desde un anuncio no se lo lleva. */
export const VENTANA_REGISTRO_MS = 24 * 60 * 60 * 1000;

/**
 * Lo que la cuenta recién creada recibe de la cookie (para `guardarAtribucion`, que solo rellena lo vacío). Vacío si no hay
 * cookie o si la cuenta no es de las últimas 24 horas. Lo llaman las cuatro altas del servidor: deptos/alta-servidor.ts
 * (Explorar, /deptos, la invitación), /api/analisis/claim (banner, guía, /entrar, /register, /login), /auth/callback
 * (Google y el enlace del correo) y el ticket del pack.
 */
export function origenParaLaCuenta(cookie: string | null | undefined, creadaAt: string | null | undefined, ahora: number = Date.now()): Partial<ReturnType<typeof atribucionDeOrigen>> {
  const t = creadaAt ? Date.parse(creadaAt) : NaN;
  if (!Number.isFinite(t) || ahora - t > VENTANA_REGISTRO_MS) return {};
  const o = origenDeCabecera(cookie);
  return o ? atribucionDeOrigen(o) : {};
}
