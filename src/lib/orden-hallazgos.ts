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

import type { Hallazgo } from "@/lib/types";

/** Piso vinculante del 01 adverso — espejo de DECISIVIDAD_FLOOR (analysis.ts). */
export const DECISIVIDAD_FLOOR_ORDEN = 0.85;

// A empate TOTAL (misma decisividad Y misma magnitud — típico entre dos dec-0 con
// magnitud 0, ej. capex resuelto vs plusvalía en el umbral exacto), lo adverso se
// lee antes: no se entierra un "en contra" bajo un favorable igual de irrelevante.
// Antes ese empate lo resolvía el orden de gather (arbitrario); esto lo hace
// determinístico y calza con el mockup vinculante (capex 08 · plusvalía 09).
const rankDireccion = (d: Hallazgo["direccion"]) => (d === "adverso" ? 0 : d === "favorable" ? 2 : 1);

/** Comparador de tres niveles: decisividad DESC, magnitud continua DESC,
 *  y a empate total, adverso antes que favorable. */
export const cmpDecisividad = (a: Hallazgo, b: Hallazgo) =>
  b.decisividad - a.decisividad ||
  (b.magnitudContinua ?? 0) - (a.magnitudContinua ?? 0) ||
  rankDireccion(a.direccion) - rankDireccion(b.direccion);

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
