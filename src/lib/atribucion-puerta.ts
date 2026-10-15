/**
 * LA PUERTA POR DONDE ENTRÓ CADA CUENTA (15-oct-2026, medición para la campaña). Las cohortes se cortan por esto:
 *
 *   A · informe            — dejó el correo en su informe: el banner, el ticket del pack, la tarjeta de la guía.
 *   B · página de selección — dejó el correo en la página de selección (todavía no existe: la página la marca con
 *                              `marcarPuertaCandidata("B", …)` cuando se haga).
 *   C · referido           — llegó por un enlace que le pasaron: un informe compartido o un `?ref=`.
 *   D · orgánico           — todo lo demás (el valor por defecto).
 *
 * Se guarda en `user_attribution.puerta`, junto a los UTM. La regla —la misma de la RPC `upsert_user_attribution`—:
 * la primera gana, salvo que D cede ante A, B o C (D es lo que manda el navegador cuando no sabe nada, y puede llegar
 * antes que la puerta real).
 *
 * El navegador lleva una PUERTA CANDIDATA (localStorage): la marcan los lugares donde se deja el correo y la llegada
 * por un enlace compartido; useAttributionSync la manda al servidor junto a los UTM. El servidor la fija además
 * donde la sabe sin el navegador: la cuenta que crea el ticket (A) y el reclamo del banner (A).
 *
 * Lo prueba el tier MEDICION-META (la atribución por puerta).
 */

export type Puerta = "A" | "B" | "C" | "D";
export const PUERTAS: Record<Puerta, string> = { A: "informe", B: "página de selección", C: "referido", D: "orgánico" };
export const esPuerta = (v: unknown): v is Puerta => v === "A" || v === "B" || v === "C" || v === "D";

/** La puerta que queda guardada cuando llega una nueva: la regla de la RPC. */
export function fusionarPuerta(actual: Puerta | null, nueva: Puerta | null): Puerta | null {
  if (!nueva) return actual;
  if (!actual) return nueva;
  if (actual === "D" && nueva !== "D") return nueva;
  return actual;
}

export interface Candidata {
  puerta: Puerta;
  detalle: string;
  t: number;
}

export const CLAVE_PUERTA = "franco_puerta";

/** ¿La llegada viene de un enlace que le pasaron? Un `?ref=` o un informe compartido (`/share/…`). */
export function puertaDeLlegada(p: { pathname: string; search: string }): Candidata | null {
  const params = new URLSearchParams(p.search);
  if (params.get("ref")) return { puerta: "C", detalle: `ref:${params.get("ref")!.slice(0, 40)}`, t: 0 };
  if (p.pathname.startsWith("/share/")) return { puerta: "C", detalle: "compartido", t: 0 };
  return null;
}

function almacen(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function leerPuertaCandidata(): Candidata | null {
  try {
    const crudo = almacen()?.getItem(CLAVE_PUERTA);
    if (!crudo) return null;
    const c = JSON.parse(crudo) as Partial<Candidata>;
    return esPuerta(c.puerta) && typeof c.detalle === "string" ? { puerta: c.puerta, detalle: c.detalle, t: Number(c.t) || 0 } : null;
  } catch {
    return null;
  }
}

/** Marca la puerta candidata de este navegador, con la misma regla: la primera gana, D cede. */
export function marcarPuertaCandidata(puerta: Puerta, detalle: string): void {
  const a = almacen();
  if (!a) return;
  const actual = leerPuertaCandidata();
  if (fusionarPuerta(actual?.puerta ?? null, puerta) === actual?.puerta) return;
  try {
    a.setItem(CLAVE_PUERTA, JSON.stringify({ puerta, detalle: detalle.slice(0, 60), t: Date.now() }));
  } catch {
    /* sin storage no hay candidata: la cuenta queda en D */
  }
}

/** Lo que el navegador manda al sincronizar la atribución: su candidata, o D. */
export function puertaParaSincronizar(): { puerta: Puerta; puerta_detalle: string } {
  const c = leerPuertaCandidata();
  return c ? { puerta: c.puerta, puerta_detalle: c.detalle } : { puerta: "D", puerta_detalle: "sin_puerta" };
}
