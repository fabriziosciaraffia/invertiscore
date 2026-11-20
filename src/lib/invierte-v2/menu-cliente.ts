// ─────────────────────────────────────────────────────────────────────────────
// La entrada de Invierte en el menú, desde el navegador (láminas del 19-nov-2026; decisión de Fabrizio: una consulta liviana guardada
// en la sesión del navegador). La respuesta se guarda por correo en sessionStorage: la consulta sale una vez por sesión del navegador
// y por cuenta. Se borra al firmar, al elegir o sumar un depto (la próxima página vuelve a preguntar) y al cerrar sesión.
// Puro salvo el almacenamiento.
//   · QUÉ DICE (20-nov-2026, decisión de Fabrizio): antes de elegir deptos, «Seguir con Franco», a /invierte (que la lleva adonde
//     quedó: el perfil o el resultado); desde que elige al menos uno, «Mi inversión», a la base.
// ─────────────────────────────────────────────────────────────────────────────
export const URL_MENU_INVIERTE = "/api/invierte-v2/menu";
export const CLAVE_MENU_INVIERTE = "franco_inv2_menu";

/** ninguno: sin firma (o sin acceso), no hay entrada · seguir: firmó y no ha elegido · inversion: eligió al menos un depto. */
export type EstadoMenu = "ninguno" | "seguir" | "inversion";
const ESTADOS: readonly EstadoMenu[] = ["ninguno", "seguir", "inversion"];
export const esEstadoMenu = (x: unknown): x is EstadoMenu => typeof x === "string" && (ESTADOS as readonly string[]).includes(x);

export const MENU_COPY = { seguir: "Seguir con Franco", inversion: "Mi inversión" } as const;

/** La entrada del menú para un estado: el texto y adónde lleva. Sin firma, ninguna. */
export function entradaMenu(estado: EstadoMenu | null): { texto: string; href: string } | null {
  if (estado === "seguir") return { texto: MENU_COPY.seguir, href: "/invierte" };
  if (estado === "inversion") return { texto: MENU_COPY.inversion, href: "/invierte/base" };
  return null;
}

export function leerMenuGuardado(email: string): EstadoMenu | null {
  try {
    const raw = window.sessionStorage.getItem(CLAVE_MENU_INVIERTE);
    const d = raw ? (JSON.parse(raw) as { email?: string; estado?: unknown }) : null;
    // Lo guardado antes del 20-nov-2026 decía solo `firmo`: no sirve para elegir el texto, se vuelve a preguntar.
    return d && d.email === email && esEstadoMenu(d.estado) ? d.estado : null;
  } catch {
    return null;
  }
}

export function guardarMenu(email: string, estado: EstadoMenu): void {
  try { window.sessionStorage.setItem(CLAVE_MENU_INVIERTE, JSON.stringify({ email, estado })); } catch { /* sin almacenamiento */ }
}

export function olvidarMenu(): void {
  try { window.sessionStorage.removeItem(CLAVE_MENU_INVIERTE); } catch { /* sin almacenamiento */ }
}

export async function consultarMenu(pedir: typeof fetch = fetch): Promise<EstadoMenu | null> {
  try {
    const r = await pedir(URL_MENU_INVIERTE, { cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as { estado?: unknown };
    return esEstadoMenu(d.estado) ? d.estado : null;
  } catch {
    return null;
  }
}
