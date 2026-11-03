// ─────────────────────────────────────────────────────────────────────────────
// EL SELLO DE LA NOCHE (03-nov-2026, decisión de Fabrizio: «las cifras de "convienen" y de los negociados que ven la página de
// /explorar, su API y la barra salen de una sola caché, con una sola edad: en una misma carga todas dicen lo mismo»). La noche
// de Explorar —los ✓ Comprar y los − Ajustar, leídos juntos— se guarda por SELLO, una ventana de diez minutos
// (portal-cache.ts › nocheExplorar). La página lee la del sello vigente y le pasa el sello al navegador; el navegador lo manda
// en cada pedido de la noche y la API lee la MISMA entrada, aunque entretanto haya llegado un sello nuevo. La siguiente carga
// trae el sello nuevo: las cifras cambian todas juntas, nunca una sola.
// FIRMADO, como el enlace compartido (firma-compartido.ts), con su propio dominio: la API solo lee sellos que el servidor
// entregó —uno inventado no fuerza lecturas de la base ni llena la caché— y uno de más de un día no vale (se sirve el vigente).
// Solo servidor: importa `crypto` y lee la key. El navegador recibe el sello hecho y lo devuelve tal cual.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from "crypto";

export const DOMINIO_SELLO = "franco/explorar-sello/v1";
/** Una ventana: lo que dura un sello antes de que el siguiente pedido traiga otro. */
export const VENTANA_SELLO_S = 600;
/** Hasta cuándo vale un sello que vuelve del navegador (una pestaña abierta de ayer sigue diciendo lo mismo). */
export const VIDA_SELLO_S = 86_400;
const FORMA_SELLO = /^(\d{1,9})\.([A-Za-z0-9_-]{12})$/;

/** El número de la ventana de una hora dada. */
export const selloDeHora = (ms: number): number => Math.floor(ms / (VENTANA_SELLO_S * 1000));

/** La firma de un sello con un secreto dado (pura: la prueba el tier). */
export function firmaSello(n: number, secreto: string): string {
  return createHmac("sha256", secreto).update(`${DOMINIO_SELLO}:${n}`).digest("base64url").slice(0, 12);
}

function secretoServidor(): string | null {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return s && s.length >= 16 ? s : null;
}

/** Lo que viaja al navegador: «número.firma». Null sin secreto (el navegador pide sin sello y le toca el vigente). */
export function tokenDeSello(n: number, secreto: string | null = secretoServidor()): string | null {
  return secreto ? `${n}.${firmaSello(n, secreto)}` : null;
}

/** El número de un sello que vuelve del navegador, si su firma vale y no tiene más de un día; si no, null. */
export function selloDeToken(t: string | null | undefined, ahora: number = Date.now(), secreto: string | null = secretoServidor()): number | null {
  if (!t || !secreto) return null;
  const m = FORMA_SELLO.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  const esperada = Buffer.from(firmaSello(n, secreto));
  const dada = Buffer.from(m[2]);
  if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) return null;
  const actual = selloDeHora(ahora);
  return n <= actual && n >= actual - VIDA_SELLO_S / VENTANA_SELLO_S ? n : null;
}
