// ─────────────────────────────────────────────────────────────────────────────
// EL NAVEGADOR DE ORIGEN (02-oct-2026, decisión de Fabrizio): «su propio informe, abierto desde el
// mismo navegador donde lo hizo, se ve completo, no como ajeno».
//
// El informe anónimo se reconoce por la cookie httpOnly `franco_anon` (su sha256 calza con
// `anon_claim_token_hash`). Al reclamarlo —registrarse, o pagar el pack desde el ticket— ese hash se
// borra y el informe pasa a tener dueño: abierto después SIN sesión, en el MISMO navegador, se veía
// «Compartido contigo» y recortado. El claim ahora conserva el hash en `anon_origen_hash`, y acá se
// compara contra la cookie.
//
// Reglas: solo sin sesión (con sesión manda la sesión, sea quien sea); solo filas CON dueño (las sin
// dueño son el anónimo-dueño de siempre); solo si la cookie calza. Otro navegador no tiene la cookie y
// sigue viéndolo compartido. Puro: lo prueba el tier PAGO-SIN-SESION.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from "crypto";

export function esNavegadorDeOrigen(p: {
  conSesion: boolean;
  duenoId: string | null | undefined;
  origenHash: string | null | undefined;
  tokenCookie: string | null | undefined;
}): boolean {
  if (p.conSesion || !p.duenoId || !p.origenHash || !p.tokenCookie) return false;
  return createHash("sha256").update(p.tokenCookie).digest("hex") === p.origenHash;
}
