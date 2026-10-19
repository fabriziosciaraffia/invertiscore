// ─────────────────────────────────────────────────────────────────────────────
// La causa de un «fetch failed» hacia el portal (19-oct-2026). Desde el 13-oct hubo ventanas de minutos en que ningún
// pedido por el proxy recibió respuesta (httpStatus −1 en ~170 ms, cero 403), y no se podía saber si era el proxy o el
// portal: el código guardaba `String(e)` —«TypeError: fetch failed»— y descartaba `e.cause`, donde undici dice qué pasó:
// «Proxy response (407) !== 200 when HTTP Tunneling» (el proxy rechazó el túnel: 407 = la cuenta no autentica) o el
// error del socket (ECONNRESET, UND_ERR_SOCKET, UND_ERR_CONNECT_TIMEOUT…). Puro: lo prueba el tier UNIDADES-PRESUPUESTO.
// ─────────────────────────────────────────────────────────────────────────────

/** El texto con que empieza el error de un pedido que no recibió respuesta HTTP. */
export const SIN_RESPUESTA = "fetch failed";

export interface CausaFalla {
  /** «fetch failed · proxy 407», «fetch failed · ECONNRESET», «fetch failed» (sin causa conocida). */
  texto: string;
  /** El código con que el proxy rechazó el túnel, si fue eso. */
  proxy: number | null;
}

const PROXY = /Proxy response \((\d{3})\) !== 200 when HTTP Tunneling/;

/** La causa de un error de `fetch`: recorre `cause` (hasta tres niveles) buscando la respuesta del proxy o el código del
 *  socket. Nunca lanza. */
export function causaDeFalla(e: unknown): CausaFalla {
  let actual: unknown = e;
  let codigo: string | null = null;
  for (let i = 0; i < 4 && actual; i++) {
    const x = actual as { message?: unknown; code?: unknown; cause?: unknown };
    const m = typeof x.message === "string" ? x.message.match(PROXY) : null;
    if (m) return { texto: `${SIN_RESPUESTA} · proxy ${m[1]}`, proxy: Number(m[1]) };
    // El más profundo gana: ECONNRESET dice más que el UND_ERR_SOCKET que lo envuelve.
    if (i > 0 && typeof x.code === "string" && x.code !== "UND_ERR_ABORTED") codigo = x.code;
    actual = x.cause;
  }
  return { texto: codigo ? `${SIN_RESPUESTA} · ${codigo}` : SIN_RESPUESTA, proxy: null };
}

/** ¿El error de un proyecto es un pedido sin respuesta (ni HTTP ni tiempo agotado con respuesta)? Lo usa el cortacircuito. */
export function esSinRespuesta(error: string | undefined): boolean {
  return !!error && (error.startsWith(SIN_RESPUESTA) || error.startsWith("sin respuesta en "));
}

/** La acción que pide una persona (cron-alertas.ts, en el acto): el proxy rechazó la autenticación. */
export const ACCION_PROXY_407 = {
  codigo: "proxy-407",
  texto: "El proxy rechazó la autenticación (407): revisa el plan o las credenciales del proxy (PROXY_URL).",
} as const;
