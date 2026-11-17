// ─────────────────────────────────────────────────────────────────────────────
// INVIERTE CON FRANCO, COMPRADOR · EL INTERRUPTOR (etapa 1, 18-nov-2026; decisión de Fabrizio). Reglas puras: las usan el
// helper de servidor (acceso-servidor.ts), el admin y el tier INVIERTE-V2.
//   · EL MODO vive en la fila `config.invierte_v2_modo`: «apagado», «lista» o «todos». Ausente o con un valor raro, APAGADO
//     (el mismo contrato que AMBAS y OpenFactura: un producto apagado no revive por un dato que falta).
//   · LA LISTA vive en `invierte_v2_acceso`, por correo en minúsculas (se puede agregar a alguien antes de que tenga cuenta).
//   · Con «lista», solo las cuentas de la lista; sin sesión no hay a quién mirar: Pronto. Con «todos», cualquiera, también sin
//     sesión (el contacto se contesta sin cuenta y la cuenta se pide al pasar a la firma).
// ─────────────────────────────────────────────────────────────────────────────

export const MODOS_INVIERTE_V2 = ["apagado", "lista", "todos"] as const;
export type ModoInvierteV2 = (typeof MODOS_INVIERTE_V2)[number];

export const CLAVE_MODO = "invierte_v2_modo";
export const TABLA_ACCESO = "invierte_v2_acceso";

export const esModo = (x: unknown): x is ModoInvierteV2 => typeof x === "string" && (MODOS_INVIERTE_V2 as readonly string[]).includes(x);

/** El modo de la fila de `config`. Acepta el texto pelado o entre comillas (JSON); cualquier otra cosa es «apagado». */
export function leerModo(valor: unknown): ModoInvierteV2 {
  if (typeof valor !== "string") return "apagado";
  let v = valor.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).trim();
  return esModo(v) ? v : "apagado";
}

/** Un correo normalizado para la lista, o null si no parece correo. */
export function correoDeLista(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const c = x.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && c.length <= 200 ? c : null;
}

/** ¿Esta persona ve el flujo nuevo? */
export function tieneAcceso(p: { modo: ModoInvierteV2; email: string | null | undefined; lista: ReadonlySet<string> }): boolean {
  if (p.modo === "todos") return true;
  if (p.modo !== "lista") return false;
  const c = correoDeLista(p.email);
  return !!c && p.lista.has(c);
}
