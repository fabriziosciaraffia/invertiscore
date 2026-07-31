// ─────────────────────────────────────────────────────────────────────────────
// Intención de destino a través de las pantallas de auth
//
// `?next=` (y `?plan=`) dicen a dónde quería ir el usuario antes de que le
// pidieran identificarse. Los handlers de /login, /register y /auth/callback ya
// los respetan bien; lo que se perdía era el SALTO LATERAL entre esas pantallas:
// el link "¿Ya tienes cuenta? Inicia sesión" era un `href="/login"` pelado, así
// que el invitado que llenaba el wizard, tocaba "Crear cuenta gratis" y desde
// ahí se iba a login terminaba en /dashboard con 12 pantallas de trabajo
// perdidas.
//
// Módulo PURO y sin React: lo usan también el middleware (que corre en Edge) y
// el route handler del callback. La versión con hook vive en el componente
// `LinkAuth`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Params que expresan a dónde iba el usuario. Se preservan en whitelist y no
 * copiando la query entera: así no se arrastran estados de la pantalla actual
 * (`confirm_error`, mensajes de error) al saltar a la otra.
 */
const PARAMS_INTENCION = ["next", "plan"] as const;

/** Solo relativos: un `next` absoluto sería un open redirect. */
export function esDestinoSeguro(next: string | null | undefined): next is string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
}

/**
 * Query de intención extraída de un `location.search`. Devuelve "" si no hay
 * nada que preservar (así el href queda limpio en el caso normal).
 */
export function queryDeIntencion(search: string): string {
  try {
    const origen = new URLSearchParams(search);
    const out = new URLSearchParams();
    for (const p of PARAMS_INTENCION) {
      const v = origen.get(p);
      if (!v) continue;
      // `next` solo si es un path relativo; `plan` va tal cual (lo valida checkout).
      if (p === "next" && !esDestinoSeguro(v)) continue;
      out.set(p, v);
    }
    const s = out.toString();
    return s ? `?${s}` : "";
  } catch {
    return "";
  }
}

/** Href a la otra pantalla de auth conservando la intención. */
export function hrefAuth(destino: "/login" | "/register", search: string): string {
  return `${destino}${queryDeIntencion(search)}`;
}

/**
 * Agrega `next` a un destino, para cuando el redirect lo decide el server
 * (middleware al frenar una ruta protegida, callback al fallar la confirmación).
 * Ignora destinos no seguros y evita el `next` redundante al propio destino.
 */
export function conNext(destino: URL, next: string | null | undefined): URL {
  if (!esDestinoSeguro(next)) return destino;
  if (next === destino.pathname) return destino;
  destino.searchParams.set("next", next);
  return destino;
}
