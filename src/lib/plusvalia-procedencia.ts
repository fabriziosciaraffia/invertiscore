// ─────────────────────────────────────────────────────────────────────────────
// PROCEDENCIA DE LA PLUSVALÍA HISTÓRICA — un solo lugar (goal "una sola etiqueta",
// 05-sep-2026). El período y la fuente de la cifra de cada comuna salen de la entry del
// `.gen.ts` (serie GfK 2015-2025 / 2015-2024, o Arenas & Cayo 2014-2024); sin entry, el
// promedio Gran Santiago con SU período. Lo leen el builder del hallazgo, el capítulo IV,
// la zona, la card, los drawers y la procedencia extendida: ningún consumidor vuelve a
// escribir "2014-2024" ni una atribución a mano. Antes el capítulo IV decía "Providencia
// 2014-2024" con la cifra GfK 2015-2025 dos secciones más abajo.
// ─────────────────────────────────────────────────────────────────────────────
import { PLUSVALIA_DEFAULT_RANGO, PLUSVALIA_ESTIMADO, type PlusvaliaComunaEntry } from "./plusvalia-estimado.gen";

export const ATRIBUCION_GFK = "GfK/NielsenIQ, precios de oferta de deptos nuevos";
export const ATRIBUCION_ARENAS_CAYO = "Arenas & Cayo, Tinsa, Propital, Activo Más";
/** Período del promedio Gran Santiago (la referencia cuando la comuna no tiene serie). */
export const RANGO_GRAN_SANTIAGO = PLUSVALIA_DEFAULT_RANGO;

export interface ProcedenciaPlusvalia {
  /** true si la comuna tiene serie propia en el dataset. */
  propia: boolean;
  /** Período de la cifra: el de la serie de la comuna, o el del promedio Gran Santiago. */
  rango: string;
  /** Rótulo corto para celdas ("GfK", "Arenas & Cayo", "promedio Gran Santiago"). */
  fuenteCorta: string;
  /** Atribución completa para líneas de fuente. */
  atribucion: string;
  entry: PlusvaliaComunaEntry | null;
}

export function procedenciaPlusvalia(comuna: string | null | undefined): ProcedenciaPlusvalia {
  const entry = comuna ? (PLUSVALIA_ESTIMADO[comuna.trim()] ?? null) : null;
  if (!entry) {
    return { propia: false, rango: RANGO_GRAN_SANTIAGO, fuenteCorta: "promedio Gran Santiago", atribucion: ATRIBUCION_ARENAS_CAYO, entry: null };
  }
  const gfk = entry.fuente === "gfk";
  return {
    propia: true,
    rango: entry.rangoHist,
    fuenteCorta: gfk ? "GfK" : "Arenas & Cayo",
    atribucion: gfk ? ATRIBUCION_GFK : ATRIBUCION_ARENAS_CAYO,
    entry,
  };
}

/** Línea de fuente del hallazgo/capítulo: "Histórico 2015-2025 · GfK/NielsenIQ, …" o
 *  "Promedio histórico Gran Santiago 2014-2024". Con `comuna` null y dato propio (filas
 *  viejas sin `valor.fuente` en superficies que no conocen la comuna) no se inventa un
 *  período. */
export function fuenteHistoricaPlusvalia(comuna: string | null | undefined, tieneData: boolean): string {
  if (!tieneData) return `Promedio histórico Gran Santiago ${RANGO_GRAN_SANTIAGO}`;
  const p = procedenciaPlusvalia(comuna);
  return p.propia ? `Histórico ${p.rango} · ${p.atribucion}` : `Histórico de la comuna · ${ATRIBUCION_ARENAS_CAYO}`;
}

/** El período que declara una línea de fuente ya escrita por el builder ("Histórico
 *  2015-2025 · …"), para superficies que solo tienen el hallazgo y no la comuna. */
export function rangoDesdeFuente(fuente: string | null | undefined): string | null {
  const m = fuente?.match(/\b(\d{4}-\d{4})\b/);
  return m ? m[1] : null;
}
