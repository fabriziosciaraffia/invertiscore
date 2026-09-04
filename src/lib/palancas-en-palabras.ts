// ─────────────────────────────────────────────────────────────────────────────
// "Cuántas vías cruzan", en palabras — una sola fuente para el copy del hero y del
// modal de vías, LTR y STR. Hasta T1 (04-sep-2026) el "cuatro" vivía escrito a mano en
// tres archivos (HeroLTR, DrawerDistanciaLtr, SubjectCardGrid) y STR, que prueba cinco
// vías (precio · tarifa · plazo · pie · gestión), no podía reusar ninguno.
//
// Contrato de no-regresión: con `total = 4` cada frase es byte a byte la que LTR ya
// mostraba (fixture `palancas-en-palabras-catch-test.ts`). El conteo sale de las vías
// REALES del hallazgo (`vias.filter(cruza)`), nunca de un número fijo.
// ─────────────────────────────────────────────────────────────────────────────

const CARDINAL: Record<number, string> = { 1: "Uno", 2: "Dos", 3: "Tres", 4: "Los cuatro", 5: "Los cinco", 6: "Los seis" };
const TOTAL_EN_PALABRAS: Record<number, string> = { 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis" };
const CRUZAN: Record<number, string> = { 2: "Dos", 3: "Tres", 4: "Las cuatro", 5: "Las cinco", 6: "Las seis" };

/** "cuatro" / "cinco" — el total probado, para "Franco probó cuatro ajustes". */
export function totalEnPalabras(total: number): string {
  return TOTAL_EN_PALABRAS[total] ?? String(total);
}

/** Línea del footer del hero: "Franco probó cuatro ajustes. Dos mueven el veredicto."
 *  Sin vías (filas viejas) queda la línea genérica. */
export function lineaFooterVias(nCruzan: number | null, total: number): string {
  const t = totalEnPalabras(total);
  if (nCruzan == null) return `Franco probó ${t} ajustes que mueven el veredicto.`;
  const cuantos =
    nCruzan === 0 ? "Ninguno mueve" : nCruzan >= total ? `${CARDINAL[total] ?? `Los ${t}`} mueven` : nCruzan === 1 ? "Uno mueve" : `${CARDINAL[nCruzan] ?? String(nCruzan)} mueven`;
  return `Franco probó ${t} ajustes. ${cuantos} el veredicto.`;
}

/** Intro del modal de vías cuando el hallazgo trae `vias`:
 *  "Franco probó cuatro ajustes, uno a la vez y con el resto fijo. Dos cruzan a COMPRAR, …". */
export function introModalVias(nCruzan: number, total: number, objetivo: string): string {
  const t = totalEnPalabras(total);
  const cabeza = `Franco probó ${t} ajustes, uno a la vez y con el resto fijo. `;
  if (nCruzan === 0) return `${cabeza}Ninguna cruza a ${objetivo}: cada una dice hasta dónde se probó.`;
  if (nCruzan === 1) return `${cabeza}Una cruza a ${objetivo} por su cuenta; las demás dicen hasta dónde se probaron.`;
  if (nCruzan >= total) return `${cabeza}${CRUZAN[total] ?? `Las ${t}`} cruzan a ${objetivo}, cada una por su cuenta: no se suman, cualquiera alcanza.`;
  return `${cabeza}${CRUZAN[nCruzan] ?? String(nCruzan)} cruzan a ${objetivo}, cada una por su cuenta; las demás dicen hasta dónde se probaron.`;
}
