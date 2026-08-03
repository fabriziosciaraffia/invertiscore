// ─────────────────────────────────────────────────────────────────────────────
// Arriendo de referencia de la zona — FUENTE ÚNICA.
//
// Antes había dos puertas con criterios distintos: el bloque de anomalías
// (`zonaRadio?.arriendoPromedio || arriendoZona`) y la línea "Arriendo de
// referencia de la zona" del prompt (`arriendoZona` pelado, sin guard). Las dos
// terminaban en el mismo lugar cuando faltaba el dato scraped: SEED_MARKET_DATA,
// una constante hardcodeada de 15 comunas con UN arriendo por comuna, sin
// superficie, sin dormitorios más allá del tipo, sin frescura — y que en la
// práctica es el ÚNICO camino, porque la tabla `market_data` no existe en la base
// y `getMarketDataForComuna` cae al seed vía try/catch silencioso.
//
// El daño medido: el arriendo que el propio wizard sugiere sale de
// `scraped_properties` (radio adaptativo, filtro de dormitorios y superficie
// ±30%, mediana, n≈29-57). Contra el seed queda 44% arriba en la mediana y hasta
// +171% en 3D+ — 125 de 127 análisis. Resultado: 11 informes en que Franco
// reprocha al usuario el arriendo que Franco mismo sugirió.
//
// Criterio único: la referencia es SOLO el dato scraped. El seed NO es fallback.
// Sin dato scraped la referencia NO EXISTE — no se emite al prompt y las
// anomalías de arriendo no se calculan. Mismo principio que CATCH-ROOT-A para
// precio/m² (ai-generation.ts): mejor sin referencia que con una falsa, porque el
// modelo copia la cifra que le des.
//
// Si mañana aparece una tercera puerta, entra por acá.
// ─────────────────────────────────────────────────────────────────────────────

/** Referencia de arriendo con procedencia real (comparables scrapeados por radio). */
export interface ArriendoReferencia {
  /** Mediana de arriendos comparables, CLP/mes. */
  valorCLP: number;
  /** Tamaño de la muestra de arriendos (0 si el payload no lo trae). */
  n: number;
  /** Radio en metros del que salió la muestra. */
  radioMetros: number;
}

/**
 * Procedencia del arriendo que el análisis está usando.
 *
 * DERIVADA, no persistida: el wizard v4 conoce la procedencia (`arrModo`) pero no
 * la manda en el payload. Lo que sí llega es que `arriendo` y
 * `zonaRadio.arriendoPromedio` salen ambos de `ctx.arriendoSugerido`
 * (wizardV4Submit.ts) — si el usuario acepta la estimación quedan idénticos al
 * peso. La igualdad exacta es la señal. Cuando exista la bandera persistida,
 * reemplaza a esta derivación sin tocar a los consumidores.
 */
export type ProcedenciaArriendo =
  /** Franco lo estimó y el usuario lo aceptó tal cual. */
  | "estimacion_franco"
  /** El usuario tecleó un valor distinto al estimado. */
  | "declarado_usuario"
  /** Sin referencia con que comparar — no se puede saber. */
  | "sin_registro";

/** Tolerancia en CLP para la igualdad exacta (el wizard escribe el entero). */
const EPSILON_CLP = 1;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type ConZonaRadio = { zonaRadio?: { arriendoPromedio?: number | null; sampleSizeArriendo?: number | null; radioMetros?: number | null } | null };

/**
 * Resuelve la referencia de arriendo de la zona. `null` = no hay dato scraped y
 * por lo tanto NO hay referencia (no caer al seed, ver cabecera).
 */
export function resolverArriendoReferencia(input: unknown): ArriendoReferencia | null {
  const zonaRadio = (input as ConZonaRadio | null | undefined)?.zonaRadio;
  const valor = zonaRadio?.arriendoPromedio;
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) return null;
  const n = typeof zonaRadio?.sampleSizeArriendo === "number" ? zonaRadio.sampleSizeArriendo : 0;
  const radioMetros = typeof zonaRadio?.radioMetros === "number" && zonaRadio.radioMetros > 0
    ? zonaRadio.radioMetros
    : 500;
  return { valorCLP: Math.round(valor), n, radioMetros };
}

/** Procedencia del arriendo usado, derivada de su igualdad con la referencia. */
export function resolverProcedenciaArriendo(
  arriendoCLP: number,
  referencia: ArriendoReferencia | null,
): ProcedenciaArriendo {
  if (!referencia || !Number.isFinite(arriendoCLP) || arriendoCLP <= 0) return "sin_registro";
  return Math.abs(arriendoCLP - referencia.valorCLP) < EPSILON_CLP
    ? "estimacion_franco"
    : "declarado_usuario";
}

/**
 * Rótulo honesto de la referencia para el prompt: nombra de dónde salió
 * (comparables en radio), nunca "referencia de zona" a secas — ese rótulo es el
 * que le daba autoridad de mercado a una constante hardcodeada.
 */
export function rotuloArriendoReferencia(ref: ArriendoReferencia): string {
  const muestra = ref.n > 0
    ? `mediana de ${ref.n} ${ref.n === 1 ? "arriendo comparable publicado" : "arriendos comparables publicados"} en un radio de ${ref.radioMetros}m`
    : `mediana de arriendos comparables publicados en un radio de ${ref.radioMetros}m`;
  return muestra;
}
