// ─────────────────────────────────────────────────────────────────────────────
// «Mi inversión» en el menú, desde el navegador (láminas del 19-nov-2026; decisión de Fabrizio: una consulta liviana guardada en la
// sesión del navegador). La respuesta se guarda por correo en sessionStorage: la consulta sale una vez por sesión del navegador
// y por cuenta. Se borra al firmar (la próxima página vuelve a preguntar) y al cerrar sesión. Puro salvo el almacenamiento.
// ─────────────────────────────────────────────────────────────────────────────
export const URL_MENU_INVIERTE = "/api/invierte-v2/menu";
export const CLAVE_MENU_INVIERTE = "franco_inv2_menu";

export function leerMenuGuardado(email: string): boolean | null {
  try {
    const raw = window.sessionStorage.getItem(CLAVE_MENU_INVIERTE);
    const d = raw ? (JSON.parse(raw) as { email?: string; firmo?: boolean }) : null;
    return d && d.email === email && typeof d.firmo === "boolean" ? d.firmo : null;
  } catch {
    return null;
  }
}

export function guardarMenu(email: string, firmo: boolean): void {
  try { window.sessionStorage.setItem(CLAVE_MENU_INVIERTE, JSON.stringify({ email, firmo })); } catch { /* sin almacenamiento */ }
}

export function olvidarMenu(): void {
  try { window.sessionStorage.removeItem(CLAVE_MENU_INVIERTE); } catch { /* sin almacenamiento */ }
}

export async function consultarMenu(pedir: typeof fetch = fetch): Promise<boolean | null> {
  try {
    const r = await pedir(URL_MENU_INVIERTE, { cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as { firmo?: unknown };
    return d.firmo === true;
  } catch {
    return null;
  }
}
