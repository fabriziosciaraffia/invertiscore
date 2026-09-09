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

// ─────────────────────────────────────────────────────────────────────────────
// EL CAVEAT DEL PERÍODO — F3 (09-sep-2026).
//
// El capítulo IV ya muestra el período («Providencia 2015-2025 · 2,9% al año») pero no
// dice lo que ese período tiene de raro. Hasta hoy lo decía la prosa, en 9 de 30
// generaciones medidas: «cruza el estallido y la pandemia, así que es ruidoso».
//
// Es DETERMINISTA y no depende del caso: dado el rango, qué tramos atípicos cruza es un
// lookup. La regla y los tramos son los de la REGLA 9 del system prompt LTR, que ya los
// enumeraba para el modelo — acá se calculan en vez de pedirse.
//
// DECISIÓN: el boom se declara por PERÍODO, no por comuna. La REGLA 9 lo acota a las
// comunas en densificación, pero el trabajo de esta glosa es decir «este promedio cruza
// tramos atípicos, por eso es ruidoso» — no atribuir cuánto movió cada tramo, que es
// justo lo que la regla prohíbe («son el marco temporal, NO causas cuantificables»).
// ─────────────────────────────────────────────────────────────────────────────

/** Un tramo atípico con los años que ocupa. Cerrado: no se agregan sin dato que lo respalde. */
const TRAMOS_ATIPICOS: ReadonlyArray<{ desde: number; hasta: number; etiqueta: string }> = [
  { desde: 2014, hasta: 2018, etiqueta: "el boom de densificación (2014-18)" },
  { desde: 2019, hasta: 2019, etiqueta: "el estallido (2019)" },
  { desde: 2020, hasta: 2021, etiqueta: "la pandemia (2020-21)" },
];

/** Los tramos atípicos que cruza un período «AAAA-AAAA». Vacío si el rango no parsea. */
export function tramosDelPeriodo(rango: string | null | undefined): string[] {
  const m = rango?.match(/^(\d{4})-(\d{4})$/);
  if (!m) return [];
  const de = Number(m[1]);
  const a = Number(m[2]);
  if (!(a >= de)) return [];
  // Solapamiento, no contención: 2015-2025 cruza el boom aunque no lo cubra entero.
  return TRAMOS_ATIPICOS.filter((t) => t.desde <= a && t.hasta >= de).map((t) => t.etiqueta);
}

/**
 * La glosa del período para el capítulo IV. `null` cuando el rango no parsea o no cruza
 * ningún tramo: sin tramos no hay nada que advertir, y una glosa que dijera «es ruidoso»
 * sin nombrar por qué sería una advertencia vacía.
 */
export function glosaPeriodoPlusvalia(rango: string | null | undefined): string | null {
  const tramos = tramosDelPeriodo(rango);
  if (tramos.length === 0) return null;
  const lista =
    tramos.length === 1
      ? tramos[0]
      : `${tramos.slice(0, -1).join(", ")} y ${tramos[tramos.length - 1]}`;
  return `El período cruza ${lista}: es un promedio de años atípicos, no una proyección.`;
}
