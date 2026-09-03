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
// TRES FUENTES, UNA JERARQUÍA (sep-2026, goal fallback comunal). El dato scraped
// ya no es solo el radio: market-suggestions resuelve radio → mediana de la
// tipología en la comuna → estimado desde el m² comunal (referencia-arriendo.ts)
// → sin dato, y el wizard persiste cuál fue en `zonaRadio.arriendoFuente`. Las
// tres viajan por acá con su `fuente`, y el rótulo dice cuál es. La regla que
// cuida lo de arriba sigue en pie con otra forma: un ESTIMADO desde el m² no es
// un comparable. Sirve para sugerir y para nombrar la fuente; NO sirve para
// reprochar (anomalías ARRIENDO ALTO/BAJO), para el corte de "apuesta" de la
// palanca ni para el caso precio-justo — eso es `esReferenciaContrastable`.
// Filas anteriores a `arriendoFuente` se leen como radio, que es lo que eran.
//
// Si mañana aparece una cuarta puerta, entra por acá.
// ─────────────────────────────────────────────────────────────────────────────

/** De dónde salió la referencia. Espejo de `Sugerencias.source` sin "sin-dato". */
export type FuenteArriendoReferencia =
  /** Mediana de comparables dentro del radio adaptativo del depto. */
  | "radio"
  /** Mediana de la tipología (dorms) en la comuna entera, ≥20 avisos. */
  | "comuna"
  /** ESTIMADO desde el UF/m² comunal × superficie × factor por tipología. Rango. */
  | "comuna-m2";

/** Referencia de arriendo con procedencia real (scraped_properties). */
export interface ArriendoReferencia {
  /** Mediana (radio/comuna) o punto central del estimado (comuna-m2), CLP/mes. */
  valorCLP: number;
  /** Tamaño de la muestra detrás (0 si el payload no lo trae). */
  n: number;
  /** Radio en metros del que salió la muestra (solo tiene sentido en "radio"). */
  radioMetros: number;
  /** Fuente. Payloads anteriores al campo `arriendoFuente` se leen como "radio". */
  fuente: FuenteArriendoReferencia;
  /** Solo "comuna-m2": el rango publicado del estimado (estimado ∓ error residual). */
  rangoCLP?: { min: number; max: number };
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

type ConZonaRadio = {
  zonaRadio?: {
    arriendoPromedio?: number | null;
    sampleSizeArriendo?: number | null;
    radioMetros?: number | null;
    arriendoFuente?: string | null;
    arriendoRangoMin?: number | null;
    arriendoRangoMax?: number | null;
  } | null;
};

function esFuente(v: unknown): v is FuenteArriendoReferencia {
  return v === "radio" || v === "comuna" || v === "comuna-m2";
}

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
  // Filas viejas no traen el campo: eran radio, se leen como radio.
  const fuente: FuenteArriendoReferencia = esFuente(zonaRadio?.arriendoFuente) ? zonaRadio.arriendoFuente : "radio";
  const ref: ArriendoReferencia = { valorCLP: Math.round(valor), n, radioMetros, fuente };
  if (fuente === "comuna-m2") {
    const min = zonaRadio?.arriendoRangoMin;
    const max = zonaRadio?.arriendoRangoMax;
    if (typeof min === "number" && typeof max === "number" && min > 0 && max >= min) {
      ref.rangoCLP = { min: Math.round(min), max: Math.round(max) };
    }
  }
  return ref;
}

/**
 * ¿Sirve para CONTRASTAR el arriendo declarado? Radio y mediana de tipología
 * son medidas del mercado; el estimado desde el m² comunal es un orden de
 * magnitud con ±6-16% de error residual y NO se usa para reprochar (anomalías
 * ARRIENDO ALTO/BAJO), para el corte de "apuesta" de la palanca ni para el
 * caso precio-justo. Sí sirve para sugerir y para nombrar la fuente.
 */
export function esReferenciaContrastable(ref: ArriendoReferencia): boolean {
  return ref.fuente !== "comuna-m2";
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

function fmtCLP(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

/**
 * Rótulo honesto de la referencia para el prompt: nombra de dónde salió
 * (comparables en radio, mediana de la tipología en la comuna, o estimación
 * desde el m² comunal), nunca "referencia de zona" a secas — ese rótulo es el
 * que le daba autoridad de mercado a una constante hardcodeada.
 */
export function rotuloArriendoReferencia(ref: ArriendoReferencia): string {
  switch (ref.fuente) {
    case "comuna":
      return ref.n > 0
        ? `mediana de ${ref.n} arriendos publicados de esta tipología en la comuna entera, no del radio del depto`
        : "mediana de los arriendos publicados de esta tipología en la comuna entera, no del radio del depto";
    case "comuna-m2": {
      const base = ref.n > 0
        ? `estimación desde el metro cuadrado de ${ref.n} arriendos publicados en la comuna, ajustada por tipología`
        : "estimación desde el metro cuadrado de los arriendos publicados en la comuna, ajustada por tipología";
      return ref.rangoCLP ? `${base}, rango ${fmtCLP(ref.rangoCLP.min)} a ${fmtCLP(ref.rangoCLP.max)}` : base;
    }
    case "radio":
    default:
      return ref.n > 0
        ? `mediana de ${ref.n} ${ref.n === 1 ? "arriendo comparable publicado" : "arriendos comparables publicados"} en un radio de ${ref.radioMetros}m`
        : `mediana de arriendos comparables publicados en un radio de ${ref.radioMetros}m`;
  }
}
