/**
 * LA PUERTA POR DONDE ENTRÓ CADA CUENTA (15-oct-2026, medición para la campaña). Las cohortes se cortan por esto:
 *
 *   A · informe            — dejó el correo en su informe: el banner, el ticket del pack, la tarjeta de la guía.
 *   B · página de selección — dejó el correo en /deptos (16-oct-2026): la página marca `marcarPuertaCandidata("B",
 *                              "deptos")` y el alta la fija en el servidor (/api/deptos/alta).
 *   C · referido           — llegó por un enlace que le pasaron: un informe compartido o un `?ref=`.
 *   D · orgánico           — todo lo demás (el valor por defecto), SOLO para cuentas creadas desde el 15-oct-2026.
 *
 * ANTES DE LAS PUERTAS (26-oct-2026, decisión de Fabrizio): una cuenta creada antes del 15-oct-2026 (`INICIO_PUERTAS`, la
 * medianoche de Chile) no entró por ninguna puerta medida. Cuando vuelve a la app su navegador manda D —no sabe nada— y
 * hasta el 26-oct eso la dejaba como «D · orgánico» en la semana en que volvió (23 cuentas reales ese día). Ahora esa D
 * no se guarda (`puertaAdmitida`, y la misma regla en la RPC): queda sin puerta, que se lee «antes de las puertas»
 * (`etiquetaPuerta`). A, B y C sí se guardan a cualquier cuenta: esas las marca un lugar concreto, no el valor por defecto.
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

/** Desde cuándo se miden las puertas: el 15-oct-2026 a medianoche en Chile (UTC−3 en octubre). La RPC
 *  `upsert_user_attribution` usa el mismo instante (migración 20261026_puerta_d_desde_15oct). */
export const INICIO_PUERTAS = "2026-10-15T03:00:00Z";

/** ¿La cuenta es de antes de las puertas? Sin fecha, no se sabe: se la trata como nueva. */
export function esAntesDeLasPuertas(creadaAt: string | null | undefined): boolean {
  const t = creadaAt ? Date.parse(creadaAt) : NaN;
  return Number.isFinite(t) && t < Date.parse(INICIO_PUERTAS);
}

/** La puerta que se acepta guardar para esta cuenta: la D, solo si la cuenta es de desde el 15-oct-2026. */
export function puertaAdmitida(puerta: Puerta | null, creadaAt: string | null | undefined): Puerta | null {
  if (puerta === "D" && esAntesDeLasPuertas(creadaAt)) return null;
  return puerta;
}

/** Cómo se lee la puerta en un reporte: la letra con su nombre, o «antes de las puertas» para la cuenta vieja sin puerta. */
export const ANTES_DE_LAS_PUERTAS = "antes de las puertas";
export function etiquetaPuerta(puerta: Puerta | null, creadaAt: string | null | undefined): string {
  if (puerta) return `${puerta} · ${PUERTAS[puerta]}`;
  return esAntesDeLasPuertas(creadaAt) ? ANTES_DE_LAS_PUERTAS : "sin puerta todavía";
}

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
