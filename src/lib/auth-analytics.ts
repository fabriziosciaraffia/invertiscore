"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Instrumentación de autenticación — punto ciego del funnel del gate
//
// Hasta acá el único evento de auth era `signup_completed`, y solo en el camino
// email+contraseña. Eso dejaba DOS agujeros medibles en el funnel del gate del
// wizard, ambos verificados en PostHog (30 días):
//
//  · 277 usuarios anónimos vieron `wizard4_gate_auth_shown`
//  · 29 hicieron `signup_completed` después (10,5%)
//  · pero 40 llegaron a `wizard4_analysis_created` después (14,4%)
//
// Los ~11 de diferencia volvieron autenticándose por una vía que no emitía
// nada: login (nunca instrumentado) o alta con Google (el `capture` de
// /register vive DESPUÉS del signUp por email, y el botón de Google se va en
// redirect antes de llegar ahí). Sin cerrarlos, la métrica de éxito de
// cualquier cambio en el gate mide de menos.
//
// El login por email se captura en el lugar obvio (la pantalla, tras el éxito).
// El de OAuth no puede: `signInWithOAuth` navega a Google y la vuelta entra por
// /auth/callback, que es un route handler server-side — no hay componente
// cliente en el camino. Por eso la intención se DEJA MARCADA antes de salir y
// se consume al volver, desde el provider global (que ya espera la sesión y ya
// hace el identify). sessionStorage y no localStorage a propósito: la marca es
// de ESTA pestaña y de ESTE viaje, y sobrevive la vuelta desde otro origen.
// ─────────────────────────────────────────────────────────────────────────────

const OAUTH_PENDIENTE_KEY = "franco_oauth_pendiente";

/**
 * Ventana de validez de la marca. Una vuelta de OAuth real tarda segundos; 10
 * minutos es holgura sin volverse una marca eterna. Sin este tope, un usuario
 * que abandona el flujo de Google y más tarde entra por email en la misma
 * pestaña se llevaría un `login_completed` con `method: "google"` que nunca
 * ocurrió.
 */
const VENTANA_MS = 10 * 60 * 1000;

export type AuthTipo = "login" | "signup";

interface MarcaOAuth {
  tipo: AuthTipo;
  t: number;
}

/** Antes de salir a Google: deja anotado qué venía a hacer el usuario. */
export function marcarOAuthPendiente(tipo: AuthTipo): void {
  try {
    const marca: MarcaOAuth = { tipo, t: Date.now() };
    sessionStorage.setItem(OAUTH_PENDIENTE_KEY, JSON.stringify(marca));
  } catch {
    /* sessionStorage puede fallar en modo privado — se pierde el evento, no el login */
  }
}

/**
 * Al volver: lee y BORRA la marca. Borra siempre, aunque esté vencida o aunque
 * el llamador termine no emitiendo nada — una marca que sobrevive a su consumo
 * es exactamente el falso positivo que el tope de ventana viene a evitar.
 */
export function consumirOAuthPendiente(): AuthTipo | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_PENDIENTE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(OAUTH_PENDIENTE_KEY);
    const marca = JSON.parse(raw) as Partial<MarcaOAuth>;
    if (marca.tipo !== "login" && marca.tipo !== "signup") return null;
    if (typeof marca.t !== "number" || Date.now() - marca.t > VENTANA_MS) return null;
    return marca.tipo;
  } catch {
    return null;
  }
}
