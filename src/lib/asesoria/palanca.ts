// ─────────────────────────────────────────────────────────────────────────────
// EL PLAZO CORTO Y LA PALANCA (27-nov-2026, punto 5 de Fabrizio). A quien su edad le da un plazo menor a 30 años se le dice por qué ve
// menos deptos —«Con tu plazo de 20 años, convienen X de los Y»—, en la fórmula y en el perfil. Y si le quedan menos de 3 deptos NO
// se rellena con otros: se dice cuántos hay y se ofrece la palanca que más mueve, con la cifra:
//   · más aporte al mes: el alto siguiente del slider;
//   · más pie: el chip siguiente (con la renta limitando también suma: el tope es pie + crédito). Se recalcula la capacidad entera.
// Gana la que deja más deptos; si ninguna deja más que hoy, no se ofrece ninguna. Puro. Tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────
import { APORTES, type Candidato, type PlazoMascara } from "./aporte";
import { CHIPS_PIE, capacidad, type Numeros } from "./capacidad";
import { universoDe, type PerfilTres } from "./tres";

/** Cuántos Comprar a 30 años siguen siendo Comprar con su plazo (sin tope, aporte ni zonas): «convienen X de los Y». */
export function conveniencia(cs: readonly Candidato[], plazo: PlazoMascara): { x: number; y: number } {
  return { x: cs.filter((c) => c.comprar[plazo] && c.flujo[plazo] != null).length, y: cs.length };
}

export type Palanca = { tipo: "aporte"; aporte: number; n: number } | { tipo: "pie"; pieUF: number; n: number };

export function palanca(cs: readonly Candidato[], p: PerfilTres, numeros: Numeros, cfg: { tasaPct: number; uf: number }): Palanca | null {
  const hoy = universoDe(cs, p).length;
  const opciones: Palanca[] = [];
  const siguiente = APORTES.find((a) => a > p.aporte);
  if (siguiente != null) opciones.push({ tipo: "aporte", aporte: siguiente, n: universoDe(cs, { ...p, aporte: siguiente }).length });
  const i = CHIPS_PIE.findIndex((c) => c.id === numeros.pie);
  const chip = i >= 0 ? CHIPS_PIE[i + 1] : undefined;
  if (chip && chip.valor != null) {
    const otra = capacidad({ ...numeros, pie: chip.id }, cfg);
    opciones.push({ tipo: "pie", pieUF: chip.valor, n: universoDe(cs, { ...p, topeUF: otra.topeUF }).length });
  }
  const mejor = opciones.filter((o) => o.n > hoy).sort((a, b) => b.n - a.n)[0];
  return mejor ?? null;
}

/** LA PALANCA EN LA FÓRMULA (decisión de Fabrizio, 27-nov-2026): con 0 deptos que le alcanzan, se ofrece ahí mismo, no al final. En el
 *  navegador, sobre los mismos Comprar del mapa (precio público) y, con plazo corto, solo los que son Comprar a su plazo: el chip de pie
 *  más bajo, por encima del suyo, con el que aparece al menos uno. null si ningún pie alcanza (por ejemplo, si las deudas no dejan cuota). */
export function palancaFormula(
  comprar: ReadonlyArray<{ avisoId: string; precioUF: number }>,
  numeros: Numeros,
  cfg: { tasaPct: number; uf: number },
  idsPlazo: ReadonlySet<string> | null,
): { pieUF: number; n: number } | null {
  const i = CHIPS_PIE.findIndex((c) => c.id === numeros.pie);
  for (let k = i + 1; k < CHIPS_PIE.length; k++) {
    const chip = CHIPS_PIE[k];
    if (chip.valor == null) continue;
    const tope = capacidad({ ...numeros, pie: chip.id }, cfg).topeUF;
    const n = comprar.filter((x) => x.precioUF <= tope && (!idsPlazo || idsPlazo.has(x.avisoId))).length;
    if (n > 0) return { pieUF: chip.valor, n };
  }
  return null;
}
