// ─────────────────────────────────────────────────────────────────────────────
// EL CONSENTIMIENTO DE COOKIES (19-oct-2026, decisión de Fabrizio; pensado para la ley 21.719, que rige en diciembre).
//
// Un aviso de una línea, con «Aceptar» (lleno) y «Rechazar» (de borde) del mismo tamaño y a un clic (ajuste del
// 19-oct-2026). La elección vive en una cookie propia de un año
// (`franco_consentimiento`: «si» o «no») y se cambia desde el pie («Cookies»). Lo que depende de ella:
//   · el pixel de Meta (y su `_fbc`, `_fbp` y el espejo de eventos) carga SOLO con «si» (MetaPixel.tsx, middleware);
//   · PostHog mide siempre, pero sin «si» lo hace SIN cookies ni almacenamiento (`persistence: "memory"`) y sin la
//     grabación de sesiones (posthog-cliente.ts);
//   · la API de conversiones manda el correo hasheado (y el id de la cuenta) SOLO con «si» (meta/servidor.ts).
// Sin elección todavía, vale como «no»: nada de lo anterior corre hasta que la persona acepta.
//
// Sin React. Lo de `document` corre solo en el navegador; `consentimientoDeCookie` sirve también en el servidor.
// Lo fija el tier CONSENTIMIENTO.
// ─────────────────────────────────────────────────────────────────────────────

export const COOKIE_CONSENTIMIENTO = "franco_consentimiento";
/** Un año. */
export const VIDA_CONSENTIMIENTO_S = 365 * 24 * 60 * 60;
export type Consentimiento = "si" | "no";
/** Se dispara en `window` cuando la persona elige (detail: la elección). */
export const EVENTO_CONSENTIMIENTO = "franco:consentimiento";
/** El pie lo dispara para volver a mostrar el aviso. */
export const EVENTO_ABRIR_AVISO = "franco:cookies-abrir";

/**
 * El aviso en UNA línea (19-oct-2026, decisión de Fabrizio): «Usamos cookies para medir qué funciona y mejorar Franco ·
 * Privacidad», sin nombrar a Meta ni a PostHog (eso lo dice la política). En PC va todo en una línea; en el teléfono la
 * frase ocupa la primera y «Privacidad» pasa a la fila de los botones (con él, la frase no cabe en 390 px a un tamaño
 * legible: medido, 33,8 em contra 27,9 sin él).
 */
export const COOKIES_COPY = {
  texto: "Usamos cookies para medir qué funciona y mejorar Franco",
  separador: "·",
  aceptar: "Aceptar",
  rechazar: "Rechazar",
  privacidad: "Privacidad",
  pie: "Cookies",
} as const;

/**
 * La elección, medida en PostHog (19-oct-2026): un `cookies_eleccion` por cada vez que el aviso sale sin elección y se
 * resuelve — «acepta», «rechaza» o «ignora» (la persona se fue de la página con el aviso a la vista y sin elegir) — con
 * `origen: "aviso"`; cuando alguien la cambia desde el pie, `origen: "pie"`. La tasa de aceptación del día es
 * acepta / (acepta + rechaza + ignora) con origen «aviso» (panel «Cookies · consentimiento» en PostHog).
 */
export const EVENTO_ELECCION_COOKIES = "cookies_eleccion";
export type EleccionCookies = "acepta" | "rechaza" | "ignora";
export const eleccionDe = (c: Consentimiento): EleccionCookies => (c === "si" ? "acepta" : "rechaza");

/** La elección guardada en una cabecera `Cookie` (o en `document.cookie`). `null` = todavía no eligió. */
export function consentimientoDeCookie(cabecera: string | null | undefined): Consentimiento | null {
  if (!cabecera) return null;
  for (const parte of cabecera.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === COOKIE_CONSENTIMIENTO) {
      const valor = v.join("=");
      return valor === "si" || valor === "no" ? valor : null;
    }
  }
  return null;
}

/** ¿Hay permiso? Solo un «si» explícito: sin elección, no. */
export const conPermiso = (c: Consentimiento | null | undefined): boolean => c === "si";

/** La elección en este navegador. */
export function leerConsentimiento(): Consentimiento | null {
  if (typeof document === "undefined") return null;
  try {
    return consentimientoDeCookie(document.cookie);
  } catch {
    return null;
  }
}

/** Guarda la elección un año y avisa a quien escucha (el pixel, PostHog, el aviso). */
export function guardarConsentimiento(valor: Consentimiento): void {
  if (typeof document === "undefined") return;
  try {
    const seguro = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_CONSENTIMIENTO}=${valor}; Max-Age=${VIDA_CONSENTIMIENTO_S}; Path=/; SameSite=Lax${seguro}`;
  } catch {
    /* sin cookies, la elección vale para esta página */
  }
  window.dispatchEvent(new CustomEvent<Consentimiento>(EVENTO_CONSENTIMIENTO, { detail: valor }));
}

/** Escucha los cambios de elección. Devuelve la función que deja de escuchar. */
export function alCambiarConsentimiento(fn: (c: Consentimiento) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const oyente = (e: Event) => {
    const c = (e as CustomEvent<Consentimiento>).detail;
    if (c === "si" || c === "no") fn(c);
  };
  window.addEventListener(EVENTO_CONSENTIMIENTO, oyente);
  return () => window.removeEventListener(EVENTO_CONSENTIMIENTO, oyente);
}

/** Vuelve a mostrar el aviso (el «Cookies» del pie). */
export function abrirAvisoCookies(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_ABRIR_AVISO));
}
