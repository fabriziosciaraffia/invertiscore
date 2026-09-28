// La firma de los webhooks de Resend (los firma Svix): `svix-id`, `svix-timestamp` y
// `svix-signature` (una o varias `v1,<base64>` separadas por espacio). La firma es HMAC-SHA256 de
// `${id}.${timestamp}.${cuerpo}` con el secreto (`whsec_` + base64). Se rechaza un timestamp a más
// de cinco minutos, en cualquier sentido. Sin dependencia nueva: `crypto` de Node alcanza.

import crypto from "crypto";

export const TOLERANCIA_SEG = 5 * 60;

export interface FirmaSvix {
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  cuerpo: string;
  secreto: string | undefined;
  /** Segundos Unix «ahora» (inyectable en los tests). */
  ahoraSeg?: number;
}

export function firmarSvix(id: string, timestamp: string, cuerpo: string, secreto: string): string {
  const clave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
  return crypto.createHmac("sha256", clave).update(`${id}.${timestamp}.${cuerpo}`).digest("base64");
}

export function verificarFirmaSvix(f: FirmaSvix): boolean {
  if (!f.secreto || !f.svixId || !f.svixTimestamp || !f.svixSignature) return false;
  const ts = Number(f.svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  const ahora = f.ahoraSeg ?? Math.floor(Date.now() / 1000);
  if (Math.abs(ahora - ts) > TOLERANCIA_SEG) return false;
  const esperada = Buffer.from(firmarSvix(f.svixId, f.svixTimestamp, f.cuerpo, f.secreto));
  for (const parte of f.svixSignature.split(" ")) {
    const [version, firma] = parte.split(",");
    if (version !== "v1" || !firma) continue;
    const recibida = Buffer.from(firma);
    if (recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada)) return true;
  }
  return false;
}
