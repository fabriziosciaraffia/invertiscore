// ─────────────────────────────────────────────────────────────────────────────
// EL TÍTULO DE UN DEPTO (etapa 3, parte A, 20-nov-2026; láminas 3.3-base y 3.2-resultado, y su LEEME): la calle y el metro cercano,
// SIN número («Dublé Almeyda · Metro Ñuñoa»), en la base, el resultado y los mensajes. Si la publicación no trae una calle confiable,
// el título es el metro; si tampoco hay metro cerca, el sector (la comuna). El número de la calle se muestra recién en la página del
// depto (parte B), y solo si salió limpio.
//
// La calle la lee «Lo que ve Franco» de la publicación (campo `calle`, interno): la dirección que guardamos viene sucia («Serrano Sin
// número», «SANTIAGO CENTRO 0», «ANTIGUO AMUNATEGUI REMODELADO 0»). Lo que la lectura devuelve pasa además por `limpiarCalle`.
// Sin "use client": lo usan el servidor y las tarjetas.
// ─────────────────────────────────────────────────────────────────────────────

/** Hasta qué distancia una estación cuenta como «metro cercano» para el título: la misma que «a pie» en la lectura. */
export const DIST_METRO_TITULO = 1000;

export interface PartesTitulo { calle?: string | null; metro?: { estacion: string; metros: number } | null; comuna?: string | null; /** Solo la página del depto (B1): el número, si salió limpio. */ numero?: string | null }

/** «Dublé Almeyda · Metro Ñuñoa»; «Metro Ñuñoa» sin calle; «Ñuñoa» (el sector) sin calle ni metro cerca. */
export function tituloDepto(p: PartesTitulo): string {
  const limpia = limpiarCalle(p.calle ?? null, p.comuna ?? null);
  const numero = limpia ? limpiarNumero(p.numero ?? null) : null;
  const calle = limpia && numero ? `${limpia} ${numero}` : limpia;
  const metro = p.metro && p.metro.metros <= DIST_METRO_TITULO ? `Metro ${p.metro.estacion.replace(/^(Estación|Metro)\s+/i, "")}` : null;
  const partes = [calle, metro].filter((x): x is string => !!x);
  return partes.length ? partes.join(" · ") : (p.comuna ?? "").trim() || "Depto";
}

/** La dirección sola, sin metro: «Nataniel Cox 1250» con el número si salió limpio, o la calle; null sin calle confiable. Para el volver
 *  de la oferta, el encabezado de la oferta y la firma, y la tarjeta (rediseño del 23-nov-2026). */
export function direccionDepto(p: Pick<PartesTitulo, "calle" | "numero" | "comuna">): string | null {
  const limpia = limpiarCalle(p.calle ?? null, p.comuna ?? null);
  const numero = limpia ? limpiarNumero(p.numero ?? null) : null;
  return limpia && numero ? `${limpia} ${numero}` : limpia;
}

/** Palabras que dicen que lo que vino no es una calle (marketing o estado del depto, no una dirección). */
const NO_ES_CALLE = /\b(remodelad|impecable|oportunidad|(?:venta|vendo|arriendo|depto|metro|cerca|sector|lindo|amplio|nuevo|usado)\b|departamento|dormitorio|ba[nñ]o|estaci[oó]n|excelente|precios)/i;
const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "el", "y", "e"]);

/** La calle, limpia y sin número, o null si no es confiable. Pasa a mayúsculas normales lo que viene todo en mayúsculas. */
export function limpiarCalle(x: string | null | undefined, comuna: string | null = null): string | null {
  if (typeof x !== "string") return null;
  let t = x.replace(/\s+/g, " ").trim();
  // Sin número ni lo que viene después (depto, oficina, torre): el título nunca lleva número.
  // «Serrano Sin número», «Serrano S/N»: queda la calle.
  t = t.replace(/\s*(?:sin\s+n[uú]mero|s\/n)\s*$/i, "");
  t = t.replace(/\s*(?:#|n[°º]\.?|nro\.?|n[uú]mero)?\s*\d.*$/i, "").replace(/[,;·\-–]+$/, "").trim();
  if (t.length < 3 || t.length > 48 || /\d/.test(t) || NO_ES_CALLE.test(t)) return null;
  if (comuna && t.localeCompare(comuna.trim(), "es", { sensitivity: "base" }) === 0) return null;
  // Todo en mayúsculas o todo en minúsculas (como la escribe a veces el admin: «nataniel cox»): mayúsculas bien puestas (23-nov-2026).
  if (t === t.toUpperCase() || t === t.toLowerCase()) t = t.toLowerCase().split(" ").map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
  return t;
}

/** El número de la calle, solo si es un número limpio («1234», «1234 B»); si no, null. No va en el título. */
export function limpiarNumero(x: string | null | undefined): string | null {
  if (typeof x !== "string") return null;
  const t = x.replace(/\s+/g, " ").trim();
  return /^[1-9]\d{0,4}(?: ?[A-Za-z])?$/.test(t) ? t.toUpperCase() : null;
}

