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

// ─── palancas-en-palabras-catch-test.ts — RETIRADO CON ACTA (17-sep-2026) ────
//
// Fijaba las ocho salidas de `lineaFooterVias` con su redacción de entonces. El commit
// `21562e0d` (10-sep-2026, «las cinco superficies dejan de decir que no hay salida cuando
// la hay») le agregó a la función la combinación del mix, así que «Ninguno mueve el
// veredicto» pasó a ganar «; juntos, sí» — y las ocho expectativas quedaron desfasadas.
//
// Estuvo en rojo desde entonces sin que nadie lo viera: no estaba cableado al runner.
//
// NO SE REESCRIBE ACÁ, y no es abandono: lo que ese test fijaba —que el footer diga
// «juntos, sí» cuando hay combinación— lo cubre hoy `salida-str-copy-catch-test.ts`, que
// sí corre en el golden y lo mide sobre la función viva en vez de sobre ocho literales.
// Un guard duplicado que además está desfasado no protege: entrega dos respuestas.
/** Línea del footer del hero: "Franco probó cuatro ajustes. Dos mueven el veredicto."
 *  Sin vías (filas viejas) queda la línea genérica. */
export function lineaFooterVias(nCruzan: number | null, total: number, haySalidaCombinando = false, escalon: string | null = null): string {
  const t = totalEnPalabras(total);
  if (nCruzan == null) return `Franco probó ${t} ajustes que mueven el veredicto.`;
  const cuantos =
    nCruzan === 0 ? "Ninguno mueve" : nCruzan >= total ? `${CARDINAL[total] ?? `Los ${t}`} mueven` : nCruzan === 1 ? "Uno mueve" : `${CARDINAL[nCruzan] ?? String(nCruzan)} mueven`;
  // «POR SEPARADO» es la palabra que faltaba, y es la que la vuelve cierta: Franco los
  // probó de a uno. Sin ella, «ninguno mueve el veredicto» le miente a las 179 filas
  // donde la combinación sí lo mueve — y esta línea se lee en la card, sin abrir nada.
  const cabeza = `Franco probó ${t} ajustes por separado. ${cuantos} el veredicto`;
  // STR desde BUSCAR: la combinación llega a Ajusta supuestos, no a Comprar; se dice hasta dónde.
  if (nCruzan === 0 && haySalidaCombinando) return escalon ? `${cabeza}; juntos, solo hasta ${escalon}.` : `${cabeza}; juntos, sí.`;
  return `${cabeza}.`;
}

/** Intro del modal de vías cuando el hallazgo trae `vias`:
 *  "Franco probó cuatro ajustes, uno a la vez y con el resto fijo. Dos cruzan a COMPRAR, …".
 *
 *  ⛔ SIN SUPERFICIE DESDE EL 17-sep-2026, Y CONSERVADA A PROPÓSITO. Su único lector era el
 *    modal de vías de `DrawerDistanciaLtr`, borrado ese día con el resto de lo que colgaba
 *    de `drawerSequence = ["zona"]`.
 *
 *    El pop-up de ajustes NO la reemplaza: no tiene intro en prosa —es título, matriz,
 *    óptimo, tabla y CTA, por contrato visual del bloque B (13-sep)—. Así que la frase que
 *    decía lo más importante de ese modal —que las vías se probaron **una a la vez y con el
 *    resto fijo**— hoy no la dice nadie. Eso es una pérdida de información, no una
 *    simplificación, y por eso la función se queda: el día que alguna superficie vuelva a
 *    necesitarla está escrita y con su contrato de conteo intacto.
 *
 *    `lineaFooterVias`, su hermana, sigue viva en los dos heros. */
export function introModalVias(nCruzan: number, total: number, objetivo: string): string {
  const t = totalEnPalabras(total);
  const cabeza = `Franco probó ${t} ajustes, uno a la vez y con el resto fijo. `;
  if (nCruzan === 0) return `${cabeza}Ninguna cruza a ${objetivo}: cada una dice hasta dónde se probó.`;
  if (nCruzan === 1) return `${cabeza}Una cruza a ${objetivo} por su cuenta; las demás dicen hasta dónde se probaron.`;
  if (nCruzan >= total) return `${cabeza}${CRUZAN[total] ?? `Las ${t}`} cruzan a ${objetivo}, cada una por su cuenta: no se suman, cualquiera alcanza.`;
  return `${cabeza}${CRUZAN[nCruzan] ?? String(nCruzan)} cruzan a ${objetivo}, cada una por su cuenta; las demás dicen hasta dónde se probaron.`;
}
