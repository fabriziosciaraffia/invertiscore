/**
 * Costo de IA por análisis, calculado desde los tokens medidos.
 *
 * REGLA CENTRAL: se guardan TOKENS, nunca pesos. Las tarifas cambian y el dólar
 * cambia todos los días; un costo persistido en CLP es una foto que envejece sin
 * avisar. Las columnas `ai_*` de `analisis` son la medición, y el precio se
 * aplica al leer, acá.
 *
 * NULL NO ES CERO. Las filas anteriores a la instrumentación tienen los seis
 * campos en NULL, y eso significa "no medido" — no "salió gratis". Todo lo de
 * este módulo excluye esas filas del cálculo y las cuenta aparte, porque
 * mezclarlas bajaría el promedio con análisis que sí costaron pero nadie midió.
 */

/** Tarifas en USD por millón de tokens. */
export interface TarifaModelo {
  /** Tokens de prompt que NO pegaron en cache. */
  input: number;
  /** Tokens generados. */
  output: number;
  /**
   * Escribir el cache cuesta 1,25× el input con el TTL de 5 minutos (el
   * `cache_control: { type: "ephemeral" }` sin ttl que usa este repo). Con TTL
   * de 1 hora serían 2×; si algún día se usa, va otra entrada, no un ajuste
   * mental en el call-site.
   */
  cacheWrite: number;
  /** Leer del cache cuesta ~0,1× el input. Es lo que hace rentable cachear. */
  cacheRead: number;
}

/**
 * Tarifas vigentes por modelo, en USD/millón de tokens.
 *
 * Agregar un modelo es una línea. Los dos que están son los que el producto usa
 * hoy: `CLAUDE_MODEL` (sonnet, toda la prosa) y el micro-check CATCH-ROOT-A
 * (haiku). Ver `src/lib/ai-config.ts`.
 *
 * Fuente: tarifas públicas de Anthropic. Si cambian, se cambian acá y TODO el
 * histórico se recalcula solo — que es exactamente el motivo de no persistir
 * pesos.
 */
export const TARIFAS: Record<string, TarifaModelo> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
};

/**
 * Dólar observado, en CLP.
 *
 * CONSTANTE CONFIGURABLE Y NO UNA INTEGRACIÓN NUEVA, a propósito: la tabla
 * `config` tiene `uf_value` y `tasa_hipotecaria` pero NO dólar, y traerlo del
 * Banco Central significaría otro cron, otro parser y otra cosa que se puede
 * quedar stale en silencio —el problema que ya nos costó la UF ×100— para una
 * cifra que solo mira el admin.
 *
 * Se sobreescribe con `USD_CLP` en el entorno cuando el valor se aleje. El costo
 * de IA se muestra además en USD, que es la moneda en que Anthropic factura y la
 * única cifra exacta acá: el CLP es orientativo.
 */
export const USD_CLP = Number(process.env.USD_CLP) || 950;

/** Lo que trae una fila de `analisis` sobre su consumo de IA. */
export interface UsoIA {
  ai_input_tokens: number | null;
  ai_output_tokens: number | null;
  ai_cache_read_tokens: number | null;
  ai_cache_creation_tokens: number | null;
  ai_calls: number | null;
  ai_model: string | null;
}

/** Costo de una fila. `null` = sin medir (ver la cabecera). */
export function costoUsd(uso: UsoIA): number | null {
  // Sin modelo no hay tarifa que aplicar, y sin ningún contador la fila es de
  // antes de la instrumentación. Cualquiera de las dos → no medido.
  if (!uso.ai_model) return null;
  const t = TARIFAS[uso.ai_model];
  if (!t) return null; // modelo desconocido: mejor "sin medir" que una cifra inventada

  const inp = uso.ai_input_tokens;
  const out = uso.ai_output_tokens;
  const cr = uso.ai_cache_read_tokens;
  const cw = uso.ai_cache_creation_tokens;
  if (inp == null && out == null && cr == null && cw == null) return null;

  // Los cuatro se suman por separado porque tienen precios distintos. Ojo con la
  // tentación de sumar el prompt: `input` es SOLO el resto no cacheado — el
  // prompt total es input + cache_creation + cache_read, y contarlo entero al
  // precio de input sobreestimaría el costo del que mejor usa el cache.
  return (
    ((inp ?? 0) * t.input +
      (out ?? 0) * t.output +
      (cr ?? 0) * t.cacheRead +
      (cw ?? 0) * t.cacheWrite) /
    1_000_000
  );
}

/** El mismo costo en CLP, con el dólar de arriba. Orientativo. */
export function costoClp(uso: UsoIA): number | null {
  const usd = costoUsd(uso);
  return usd == null ? null : usd * USD_CLP;
}

/** Lo que hace falta para mostrar un KPI honesto sobre un conjunto de filas. */
export interface ResumenCostoIA {
  /** Suma en USD de las filas medidas. */
  totalUsd: number;
  /** La misma suma en CLP. */
  totalClp: number;
  /** Cuántas filas entraron al cálculo. */
  medidos: number;
  /** Cuántas quedaron fuera por no tener medición. Se muestra, no se esconde. */
  sinMedir: number;
  /** Promedio por análisis MEDIDO — nunca sobre el total de filas. */
  promedioUsd: number | null;
}

/**
 * Agrega el costo de un conjunto de filas separando medido de no medido.
 *
 * El promedio divide por `medidos`, no por el largo del arreglo: con 100 filas
 * de las cuales 40 tienen medición, dividir por 100 daría un costo por informe
 * 2,5 veces más barato de lo real.
 */
export function resumirCosto(filas: UsoIA[]): ResumenCostoIA {
  let totalUsd = 0;
  let medidos = 0;
  let sinMedir = 0;

  for (const f of filas) {
    const c = costoUsd(f);
    if (c == null) sinMedir++;
    else {
      totalUsd += c;
      medidos++;
    }
  }

  return {
    totalUsd,
    totalClp: totalUsd * USD_CLP,
    medidos,
    sinMedir,
    promedioUsd: medidos > 0 ? totalUsd / medidos : null,
  };
}

/** Las seis columnas que hay que traer de `analisis` para calcular costo. */
export const COLUMNAS_USO_IA =
  "ai_input_tokens, ai_output_tokens, ai_cache_read_tokens, ai_cache_creation_tokens, ai_calls, ai_model";

/** USD con la precisión que el monto pide: centavos arriba de $1, milésimas abajo. */
export function fmtUsd(v: number): string {
  return v >= 1 ? `US$${v.toFixed(2)}` : `US$${v.toFixed(3)}`;
}
