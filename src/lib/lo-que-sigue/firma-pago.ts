// ─────────────────────────────────────────────────────────────────────────────
// LA FIRMA DEL RETORNO DEL PAGO (02-oct-2026). El pack se paga desde el ticket SIN sesión y Flow vuelve a
// /payments/return sin ella: hasta acá la pantalla no podía leer el pago (401) y decía «Tienes 3 análisis»
// sin verificar nada. Ahora la URL de retorno lleva `t`, una firma HMAC-SHA256 del `commerce_order`, y
// quien la trae puede leer el estado de ESE pago, el saldo de la cuenta dueña y la guía de su informe.
//
// EL SECRETO: `SUPABASE_SERVICE_ROLE_KEY`, que ya existe en todos los entornos donde esto corre (el
// endpoint que valida la firma lee `payments` con ese mismo cliente: sin la key no hay nada que mostrar).
// No es una variable nueva. La firma separa dominio (`franco/retorno-pago/v1:`) para que no sirva para
// otra cosa, y nunca expone la key: HMAC no se invierte. Si la key rota, los enlaces viejos dejan de
// validar y la pantalla cae a «Entra para ver tu pago» —se degrada, no miente—. Se descartó
// `CRON_SECRET`: no está en local ni en todas las previews, y ahí el retorno se rompería en silencio.
//
// Solo servidor: importa `crypto` y lee la key. El cliente recibe la firma ya hecha en la URL.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from "crypto";

export const DOMINIO_FIRMA_PAGO = "franco/retorno-pago/v1";
/** Largo de la firma en la URL: 32 caracteres base64url = 192 bits. */
export const LARGO_FIRMA_PAGO = 32;
const FORMA_FIRMA = /^[A-Za-z0-9_-]{32}$/;

/** La firma de una orden con un secreto dado (pura: la prueba el tier sin env). */
export function firmaPago(order: string, secreto: string): string {
  return createHmac("sha256", secreto).update(`${DOMINIO_FIRMA_PAGO}:${order}`).digest("base64url").slice(0, LARGO_FIRMA_PAGO);
}

function secretoServidor(): string | null {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return s && s.length >= 16 ? s : null;
}

/** La firma que va en la URL de retorno; null si el servidor no tiene la key (la URL sale sin `t`). */
export function firmarPago(order: string): string | null {
  const s = secretoServidor();
  return s ? firmaPago(order, s) : null;
}

/** ¿`t` es la firma de `order`? Comparación en tiempo constante; sin secreto, nunca. */
export function firmaPagoValida(order: string | null | undefined, t: string | null | undefined, secreto: string | null = secretoServidor()): boolean {
  if (!secreto || !order || !t || !FORMA_FIRMA.test(t)) return false;
  const esperada = Buffer.from(firmaPago(order, secreto));
  const dada = Buffer.from(t);
  return esperada.length === dada.length && timingSafeEqual(esperada, dada);
}
