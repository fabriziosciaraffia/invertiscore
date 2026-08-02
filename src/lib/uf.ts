const UF_FALLBACK = 38800;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

let cachedUF: { value: number; fetchedAt: number } | null = null;

export async function getUFValue(): Promise<number> {
  // Return cached value if still fresh
  if (cachedUF && Date.now() - cachedUF.fetchedAt < CACHE_DURATION_MS) {
    return cachedUF.value;
  }

  try {
    const res = await fetch("https://mindicador.cl/api/uf", {
      next: { revalidate: 86400 }, // Next.js cache: 24h
    });

    if (!res.ok) throw new Error(`mindicador.cl responded ${res.status}`);

    const data = await res.json();
    const serie = data?.serie;
    if (!Array.isArray(serie) || serie.length === 0) throw new Error("Empty serie");

    const valor = Math.round(serie[0].valor);
    cachedUF = { value: valor, fetchedAt: Date.now() };
    return valor;
  } catch (err) {
    console.error("[UF-FALLBACK] Error fetching UF value, using cached/frozen fallback:", err);
    // Return cached even if expired, otherwise fallback
    return cachedUF?.value ?? UF_FALLBACK;
  }
}

// Synchronous fallback for client-side code that can't await
export const UF_CLP_FALLBACK = UF_FALLBACK;

// Rango plausible de la UF chilena (CLP). Un ratio precioCLP/precio fuera de
// esta banda se trata como dato corrupto y se cae a la UF viva.
export const UF_FROZEN_MIN = 25000;
export const UF_FROZEN_MAX = 45000;

/**
 * Parsea un número que viene del Banco Central, que manda el mismo dato en dos
 * formatos según la serie: chileno ("39.841,72") o con punto decimal
 * ("39841.72").
 *
 * El parseo anterior era `.replace(/\./g, "").replace(",", ".")`: borraba TODOS
 * los puntos asumiendo separador de miles. Con "39.841,72" funcionaba; con
 * "39841.72" devolvía 3984172 — la UF quedó guardada ×100 en config el
 * 2026-03-16 y ahí siguió, porque nada volvió a escribirla (la ruta que la
 * actualiza no tiene cron).
 *
 * Reglas, en orden:
 *  1. Si hay coma, la coma es el decimal y los puntos son miles.
 *  2. Sin coma y con UN punto seguido de exactamente 3 dígitos ("39.841"), el
 *     punto es separador de miles — es el único caso realmente ambiguo y en
 *     castellano gana la lectura de miles.
 *  3. Cualquier otro caso: punto decimal o entero pelado.
 *
 * Devuelve null si no queda un número finito.
 */
export function parseNumeroBCCH(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  let normalizado: string;
  if (s.includes(",")) {
    normalizado = s.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = s.split(".");
    normalizado =
      partes.length === 2 && partes[0].length > 0 && partes[1].length === 3
        ? partes.join("")
        : s;
  }

  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * ¿Este número puede ser la UF de hoy en CLP? Guarda de escritura: ante un valor
 * implausible es mejor dejar el dato viejo que pisarlo con basura — un valor
 * corrupto silencioso es peor que uno stale, porque el stale al menos se ve en
 * el panel con su fecha.
 */
export function esUFPlausible(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= UF_FROZEN_MIN && n <= UF_FROZEN_MAX;
}

/** Banda plausible de la tasa hipotecaria en UF (% anual). Mismo criterio. */
export function esTasaPlausible(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n < 20;
}

/**
 * Resuelve la UF que el RENDER debe usar para recomputar un análisis, de modo
 * que sus KPI calcen con la prosa IA. La prosa se generó con la UF CONGELADA al
 * crear el análisis — `ai-generation.ts:716` usa `results.metrics.precioCLP /
 * input.precio`. Acá reconstruimos esa MISMA UF desde datos persistidos:
 *
 *   ufFrozen = rawResults.metrics.precioCLP / inputData.precio
 *
 * Es byte-idéntica a la que usó la generación (`enrichMetricsLegacy` no toca
 * `precioCLP`). Mata el drift prosa↔KPI por construcción (Opción 3, mismo patrón
 * "snapshot congelado gana" que `mediana_comuna_snapshot`). Los CLP del análisis
 * quedan como foto fija del día de creación.
 *
 * Fallback: si no hay `precioCLP`/`precio` reconstruible, o el ratio cae fuera
 * de [UF_FROZEN_MIN, UF_FROZEN_MAX] (fila legacy/corrupta), retorna `ufLive`
 * (getUFValue) y loggea `[UF-FROZEN-FALLBACK]` server-side para dimensionar
 * cuántas filas legacy hay.
 *
 * Nota: divide por `input.precio` (no `precioTotal`) para espejar EXACTO la
 * generación. En filas con estacionamiento de precio separado el ratio se
 * distorsiona respecto a la UF real (ver of-audit-drift-uf.md) — hoy 0 filas
 * en ese caso.
 *
 * @see of-audit-drift-uf.md · src/lib/ai-generation.ts:716
 */
export function resolveUfForAnalysis(
  rawResults: { metrics?: { precioCLP?: number | null } | null } | null | undefined,
  inputData: { precio?: number | null } | null | undefined,
  ufLive: number,
  analysisId?: string,
): number {
  const precioCLP = rawResults?.metrics?.precioCLP;
  const precio = inputData?.precio;
  if (
    typeof precioCLP === "number" && precioCLP > 0 &&
    typeof precio === "number" && precio > 0
  ) {
    const ratio = precioCLP / precio;
    if (Number.isFinite(ratio) && ratio >= UF_FROZEN_MIN && ratio <= UF_FROZEN_MAX) {
      return ratio;
    }
  }
  console.warn(
    `[UF-FROZEN-FALLBACK]${analysisId ? ` ${analysisId}` : ""}: ` +
      `no se pudo reconstruir la UF congelada (precioCLP=${precioCLP}, precio=${precio}) — ` +
      `usando UF viva ${ufLive}`,
  );
  return ufLive;
}
