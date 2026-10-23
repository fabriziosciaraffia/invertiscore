/**
 * LOS EVENTOS DE META Y SUS ID (15-oct-2026, medición para la campaña). Un solo lugar define el nombre de cada
 * evento y cómo se arma su `event_id`: el servidor lo manda por la API de conversiones y le devuelve al navegador
 * el mismo id para que el pixel lo repita (espejo.ts). Meta junta los dos —mismo nombre, mismo id— en una sola
 * conversión. Isomorfo: lo usan el servidor y el navegador.
 *
 * Lo prueba el tier MEDICION-META (la deduplicación).
 */

export const EVENTOS_META = {
  /** Dejó el correo: banner del informe, ticket, página de selección (B), página del invitado. */
  lead: "Lead",
  /** La cuenta nueva, por cualquier puerta (22-oct-2026): sale al crearla, con la puerta y el «cuándo» si lo contestó. */
  registro: "CompleteRegistration",
  /** Contestó «¿Cuándo piensas comprar?» después (22-oct-2026): propio, con la respuesta como dato. */
  intencion: "IntencionCompra",
  /** Vio su informe, con el veredicto y la comuna. */
  vistaInforme: "ViewContent",
  /** Pagó: pack, suelto, tres análisis o el primer cobro de un plan. */
  compra: "Purchase",
  /** El primer cobro de un plan, además de la compra. */
  suscripcion: "Subscribe",
  /** Propios, para públicos. */
  analizarEste: "AnalizarEste",
  quieroVerlo: "QuieroVerlo",
  semanalClic: "SemanalClic",
} as const;

export type EventoMeta = (typeof EVENTOS_META)[keyof typeof EVENTOS_META];

/** Los que no son del catálogo de Meta: el pixel los manda con `trackCustom`. */
export const EVENTOS_PROPIOS: ReadonlySet<string> = new Set([EVENTOS_META.analizarEste, EVENTOS_META.quieroVerlo, EVENTOS_META.semanalClic, EVENTOS_META.intencion]);

/** SHA-256 en hex con la Web Crypto, que existe en el navegador y en Node. */
export async function sha256Hex(texto: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const normalizarCorreo = (correo: string) => correo.trim().toLowerCase();

/** Un Lead por correo, para siempre: el mismo correo en el banner y en el ticket es una sola persona. */
export async function idLead(correo: string): Promise<string> {
  return `lead-${(await sha256Hex(normalizarCorreo(correo))).slice(0, 32)}`;
}
/** Un registro por cuenta. */
export const idRegistro = (userId: string) => `reg-${userId}`;
/** Una intención por cuenta y respuesta: cambiar de «mirando» a «ya» es otra señal. */
export const idIntencion = (userId: string, cuando: string) => `ic-${userId}-${cuando.slice(0, 12)}`;
/** Una vista por informe. */
export const idVistaInforme = (analysisId: string) => `vc-${analysisId}`;
/** Una compra por orden: el mismo `commerce_order` que ve /payments/return. */
export const idCompra = (commerceOrder: string) => commerceOrder;
/** El primer cobro de un plan: `sub-<id de la suscripción>`, el mismo que trae el retorno del alta. */
export const idCompraPlan = (subscriptionId: string) => `sub-${subscriptionId}`;
/** «Analizar este»: por aviso y por la selección o el informe de donde salió. */
export const idAnalizarEste = (avisoId: string, desde: string) => `ae-${avisoId}-${desde.slice(0, 24)}`;
/** «Quiero verlo»: uno por informe hecho desde un aviso. */
export const idQuieroVerlo = (analysisId: string) => `qv-${analysisId}`;
/** Un clic del correo semanal: por selección y por destino (el aviso o la página). */
export const idSemanalClic = (token: string, destino: string) => `sc-${token.slice(0, 24)}-${destino.slice(0, 40)}`;
