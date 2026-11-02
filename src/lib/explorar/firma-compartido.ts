// ─────────────────────────────────────────────────────────────────────────────
// LA FIRMA DE UN ENLACE COMPARTIDO (03-nov-2026, goal «los enlaces compartidos llevan una firma»). Al tocar «Compartir», el
// servidor firma el enlace de ESE aviso y, si quien comparte tiene cuenta, de su código de invitación (`i`): la firma va en
// `f` y no vence. Al abrir un enlace con `desde=compartido`, el precio negociado nítido, la vista previa con cifras y su
// imagen salen SOLO si la firma vale para ese aviso y ese código; sin firma, con la de otro aviso o con otro código, la página
// es /explorar sin cuenta de siempre (abre el pin, borroso) y la vista previa es la genérica. Así un enlace armado a mano no
// destapa las cifras de cualquier aviso, y el código de otro no se le puede pegar a un enlace firmado.
// EL SECRETO, como la firma del retorno del pago (lo-que-sigue/firma-pago.ts): `SUPABASE_SERVICE_ROLE_KEY`, que ya está en
// todos los entornos, con su propio dominio (`franco/depto-compartido/v1:`) para que no sirva para otra cosa. Si la key rota,
// los enlaces firmados vuelven a abrir borrosos —se degradan, no mienten—.
// CORTA: 16 caracteres base64url (96 bits): no se adivina, y el enlace sigue siendo corto en WhatsApp.
// Solo servidor: importa `crypto` y lee la key. El navegador recibe la firma hecha (POST /api/explorar/compartido).
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from "crypto";

export const DOMINIO_FIRMA_COMPARTIDO = "franco/depto-compartido/v1";
/** Largo de la firma en el enlace: 16 caracteres base64url = 96 bits. */
export const LARGO_FIRMA_COMPARTIDO = 16;
const FORMA_FIRMA = /^[A-Za-z0-9_-]{16}$/;

/** La firma de un aviso (y del código de quien comparte; vacío sin cuenta) con un secreto dado (pura: la prueba el tier). */
export function firmaCompartido(avisoId: string, codigo: string | null, secreto: string): string {
  return createHmac("sha256", secreto).update(`${DOMINIO_FIRMA_COMPARTIDO}:${avisoId.toLowerCase()}:${codigo ?? ""}`).digest("base64url").slice(0, LARGO_FIRMA_COMPARTIDO);
}

function secretoServidor(): string | null {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return s && s.length >= 16 ? s : null;
}

/** La firma que va en el enlace; null si el servidor no tiene la key. */
export function firmarCompartido(avisoId: string, codigo: string | null): string | null {
  const s = secretoServidor();
  return s ? firmaCompartido(avisoId, codigo, s) : null;
}

/** ¿`f` es la firma de este aviso con este código? Comparación en tiempo constante; sin secreto o sin firma, nunca. */
export function firmaCompartidoValida(avisoId: string | null | undefined, codigo: string | null | undefined, f: string | null | undefined, secreto: string | null = secretoServidor()): boolean {
  if (!secreto || !avisoId || !f || !FORMA_FIRMA.test(f)) return false;
  const esperada = Buffer.from(firmaCompartido(avisoId, codigo ?? null, secreto));
  const dada = Buffer.from(f);
  return esperada.length === dada.length && timingSafeEqual(esperada, dada);
}
