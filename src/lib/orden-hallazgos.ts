// ─────────────────────────────────────────────────────────────────────────
// ORDEN ÚNICO de hallazgos (esquema C con umbral) — módulo PURO, server-safe.
//
// Una sola jerarquía para TODAS las superficies: índice del hero, pirámide,
// documento (PDF) y anclaje de la apertura Plan C. La regla:
//
//   · Posición 01 = el ADVERSO más decisivo, solo si su decisividad pasa el
//     piso vinculante (>= 0,85 — el mismo DECISIVIDAD_FLOOR de analysis.ts:
//     neutralizarlo flipea el veredicto o desarma un gate). Sin adverso sobre
//     el piso, no se fuerza apertura adversa.
//   · El resto: ranking puro decisividad DESC → magnitud continua DESC, SIN
//     partición por dirección. Los dec-0 (solo-lectura y capex resuelto) caen
//     al fondo solos: cualquier decisividad > 0 los supera.
//
// Reemplaza la Filosofía 1 (adversos primero, favorables después) y el guard
// coronaEsLaMasDecisiva: la jerarquía la carga la numeración compartida
// hero↔pirámide, no un kicker que había que validar.
// ─────────────────────────────────────────────────────────────────────────

import type { AIAnalysisV2, FullAnalysisResult, Hallazgo } from "@/lib/types";

/** Piso vinculante del 01 adverso — espejo de DECISIVIDAD_FLOOR (analysis.ts). */
export const DECISIVIDAD_FLOOR_ORDEN = 0.85;

// A empate TOTAL (misma decisividad Y misma magnitud — típico entre dos dec-0 con
// magnitud 0, ej. capex resuelto vs plusvalía en el umbral exacto), lo adverso se
// lee antes: no se entierra un "en contra" bajo un favorable igual de irrelevante.
// Antes ese empate lo resolvía el orden de gather (arbitrario); esto lo hace
// determinístico y calza con el mockup vinculante (capex 08 · plusvalía 09).
const rankDireccion = (d: Hallazgo["direccion"]) => (d === "adverso" ? 0 : d === "favorable" ? 2 : 1);

/** Comparador de cuatro niveles: decisividad DESC, magnitud continua DESC,
 *  a empate total adverso antes que favorable, y como último recurso el id
 *  (alfabético). El id cierra el orden TOTAL: sin él, un empate exacto (ej.
 *  cap_rate y sobreprecio ambos 1,00/1,00 en a610e8bb) lo resolvía la
 *  estabilidad del sort — es decir, el orden de gather de cada superficie —
 *  y la apertura Plan C podía anclar un 01 distinto del que la pirámide
 *  mostraba. Con el id, todas las superficies computan el mismo orden
 *  aunque junten los hallazgos en secuencias distintas. */
export const cmpDecisividad = (a: Hallazgo, b: Hallazgo) =>
  b.decisividad - a.decisividad ||
  (b.magnitudContinua ?? 0) - (a.magnitudContinua ?? 0) ||
  rankDireccion(a.direccion) - rankDireccion(b.direccion) ||
  a.id.localeCompare(b.id);

/**
 * Orden único (esquema C-umbral) sobre una lista ya deduplicada. El "adverso
 * más decisivo" es estricto (`direccion === "adverso"`): un hallazgo neutral
 * no puede abrir el informe como golpe. Como la lista sale ordenada por
 * cmpDecisividad, el primer adverso que aparece ES el más decisivo; si pasa
 * el piso, sube a 01 y el resto conserva su ranking relativo.
 */
export function ordenarHallazgosUnico(hallazgos: Hallazgo[] | null | undefined): Hallazgo[] {
  const list = (Array.isArray(hallazgos) ? hallazgos.filter(Boolean) : []).slice().sort(cmpDecisividad);
  const iAdv = list.findIndex((h) => h.direccion === "adverso");
  if (iAdv > 0 && list[iAdv].decisividad >= DECISIVIDAD_FLOOR_ORDEN - 1e-9) {
    return [list[iAdv], ...list.slice(0, iAdv), ...list.slice(iAdv + 1)];
  }
  return list;
}

/** Dedup por id: el hallazgo CON titular gana SIEMPRE al que no lo tiene (la
 *  copia legacy sin titular no gobierna ranking ni narración); entre dos con el
 *  mismo estado de titular, manda la mayor decisividad. Compartido por los
 *  gathers LTR y STR — una sola regla. */
export function dedupHallazgos(hallazgos: Hallazgo[]): Hallazgo[] {
  const byId = new Map<string, Hallazgo>();
  for (const h of hallazgos) {
    const prev = byId.get(h.id);
    const hT = !!h.titular;
    const pT = prev ? !!prev.titular : false;
    const gana = !prev || (hT && !pT) || (hT === pT && h.decisividad > prev.decisividad);
    if (gana) byId.set(h.id, h);
  }
  return Array.from(byId.values());
}

/** Numeración visual de posición: 0 → "01". Compartida por índice y eyebrows. */
export const numeroHallazgo = (index: number) => String(index + 1).padStart(2, "0");

/** Id de ancla estable de la card de un hallazgo (índice del hero → card). */
export const anchorHallazgo = (h: Pick<Hallazgo, "id">) => `hallazgo-${h.id}`;

// ─── Movido desde PiramideHallazgos.tsx (T5, 03-sep-2026) ───────────────────
// El componente <PiramideHallazgos> murió con T3 (los capítulos lo reemplazan); estos
// helpers siguen vivos: el orden del índice del hero y de Principales hallazgos
// (SubjectCardGrid), el orden del documento PDF y el reparto del nivel 3 de la
// pirámide STR.

function gatherHallazgos(
  results: FullAnalysisResult | null | undefined,
  aiAnalysis: AIAnalysisV2 | null | undefined,
): Hallazgo[] {
  const out: Hallazgo[] = [];
  const push = (h: Hallazgo | null | undefined) => {
    if (h && typeof h.decisividad === "number") out.push(h);
  };
  // Carriers del motor (mismos que lee el hero). El tipo AnalysisMetrics no expone
  // los hallazgo* nominalmente, por eso el narrow via Record.
  const m = results?.metrics as unknown as Record<string, Hallazgo | null | undefined> | undefined;
  push(m?.hallazgoSobreprecio);
  push(m?.hallazgoCapRate);
  push(m?.hallazgoFlujoMensual);
  push(m?.hallazgoPlusvalia);
  push(m?.hallazgoPuestaAPunto);
  // Sobreprecio async (vive en ai_analysis cuando la mediana se resolvió post-motor).
  push(aiAnalysis?.hallazgoSobreprecio);
  // Motor-seeded persistidos (estructura, y los demás en el recompute del render).
  if (Array.isArray(results?.hallazgos)) results.hallazgos.forEach(push);

  // Dedup por id: el hallazgo CON titular gana SIEMPRE al que no lo tiene (misma
  // regla que el hero — la copia legacy de sobreprecio en ai_analysis, sin titular
  // y con decisividad vieja, no debe gobernar ni el ranking ni la narración).
  return dedupHallazgos(out);
}

// Orden EXACTO que renderiza la pirámide (orden único C-umbral). Exportado: el
// índice del hero toma sus primeros 3 de ESTE mismo array, y la navegación
// prev/next de los drawers también se deriva de acá — un solo orden de verdad.
// gather + dedup + sort viven acá; el componente lo consume tal cual.
export function ordenarHallazgosPiramide(
  results: FullAnalysisResult | null | undefined,
  aiAnalysis: AIAnalysisV2 | null | undefined,
): Hallazgo[] {
  const gathered = gatherHallazgos(results, aiAnalysis);
  // distancia_veredicto NO va en la pirámide. Primero se le dio posición fija (banda
  // propia) porque competir por ranking degradaba hallazgos decisivos; después quedó claro
  // que tampoco es un hallazgo que explique el veredicto — es la salida, y su lugar es
  // "La posición de Franco", que ahora abre su drawer. Acá se excluye del orden: eso lo
  // saca del render Y de la secuencia prev/next (que se deriva de este mismo array), que
  // es lo correcto: ya no es una parada de la pirámide. El hallazgo sigue intacto en el
  // motor, el PDF y el prompt.
  return ordenarHallazgosUnico(gathered.filter((h) => h.id !== "distancia_veredicto"));
}

/**
 * Orden para el DOCUMENTO (PDF), que sí lista la distancia al veredicto: ahí no hay
 * drawers ni "La posición de Franco" clickeable, así que el hallazgo tiene que aparecer
 * entre los demás o se pierde. Mismo gather y mismo ORDEN ÚNICO que la web — la única
 * diferencia es que no se excluye (con decisividad 0 y sin magnitud, la distancia cae
 * sola al fondo de la lista). Función aparte y no un flag booleano para que en el call
 * site se lea QUÉ superficie se está armando.
 */
export function ordenarHallazgosDocumento(
  results: FullAnalysisResult | null | undefined,
  aiAnalysis: AIAnalysisV2 | null | undefined,
): Hallazgo[] {
  return ordenarHallazgosUnico(gatherHallazgos(results, aiAnalysis));
}

// Matriz de columnas del nivel 3 según cuántos chips quedan (Familia A, aprobada por
// Fabrizio). La estructura 1+2+resto NO cambia; solo el grid del resto se adapta para
// que la última fila quede balanceada en todo N∈[5,9] (evita el huérfano de N=7 y el
// 3+2 suelto de N=8). Clases ESTÁTICAS: Tailwind JIT no genera `grid-cols-${n}`
// interpolado, así que cada string de columnas es literal. El orden de `resto` se
// preserva (orden único): en el caso de 5, los 2 chips más decisivos ganan ancho en la
// fila de 2 y el resto va a la de 3. Mobile (<md): todas las filas apilan a 1 columna.
export function filasNivel3(resto: Hallazgo[]): { items: Hallazgo[]; cols: string }[] {
  const n = resto.length;
  if (n === 2) return [{ items: resto, cols: "md:grid-cols-2" }];
  if (n === 4) return [{ items: resto, cols: "md:grid-cols-4" }];
  if (n === 5)
    return [
      { items: resto.slice(0, 2), cols: "md:grid-cols-2" },
      { items: resto.slice(2), cols: "md:grid-cols-3" },
    ];
  // E.1b — pirámide STR llega a N=10/11 (resto 7/8). Balanceo sin huérfano:
  if (n === 7)
    return [
      { items: resto.slice(0, 4), cols: "md:grid-cols-4" },
      { items: resto.slice(4), cols: "md:grid-cols-3" },
    ];
  if (n === 8)
    return [
      { items: resto.slice(0, 4), cols: "md:grid-cols-4" },
      { items: resto.slice(4), cols: "md:grid-cols-4" },
    ];
  // 1, 3, 6, 9, >8 → grid de 3 (fallback): 3/6/9 = filas perfectas por wrap.
  return [{ items: resto, cols: "md:grid-cols-3" }];
}

/**
 * Reparto visual de la pirámide: 1 + 2 + resto. `ordenarHallazgosPiramide` ya excluye
 * `distancia_veredicto`, así que acá no hay nada que filtrar — se conserva el defensive
 * filter por si un caller pasa un array armado a mano.
 */
export function piramideLayout(ordered: Hallazgo[]): {
  nivel1: Hallazgo | undefined;
  nivel2: Hallazgo[];
  nivel3: Hallazgo[];
} {
  const rank = ordered.filter((h) => h.id !== "distancia_veredicto");
  return { nivel1: rank[0], nivel2: rank.slice(1, 3), nivel3: rank.slice(3) };
}
