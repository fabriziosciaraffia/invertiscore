const UF_FALLBACK = 38800;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─────────────────────────────────────────────────────────────────────────────
// LA UF NUNCA CUELGA UN PEDIDO (09-oct-2026). A las 9:26–9:28 de Chile mindicador.cl respondía 500/502
// después de ~2 minutos; se le pedía sin tiempo máximo y sin recordar la falla, así que cada llamada volvía
// a esperar y `/api/data/suggestions` llegaba al corte de 300 s de Vercel: el wizard se quedaba en
// «Buscando comparables cerca…». Ahora: 3 s por intento (aunque el pedido ignore la señal), 5 minutos sin
// reintentar tras una falla, un solo pedido para las llamadas simultáneas, y de respaldo la última UF buena
// o la del día en la base (`config.uf_value`, del Banco Central) antes que el número fijo, que estaba 5,7%
// bajo la de ese día. Tier UF-TIEMPO.
// ─────────────────────────────────────────────────────────────────────────────
export const UF_TIEMPO_MAX_MS = 3000;
export const UF_ESPERA_TRAS_FALLA_MS = 5 * 60 * 1000;

/** Resuelve con el valor, o con null si `ms` pasa primero (el que cuelga no cuelga a quien espera). */
function conTiempoMax<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      () => { clearTimeout(t); resolve(null); },
    );
  });
}

/** La UF del día que guarda el cron del Banco Central (`update-market`). Solo en el servidor. */
async function ufDeLaBase(): Promise<number | null> {
  if (typeof window !== "undefined") return null;
  const { createServiceClient } = await import("./supabase/service");
  const { data } = await createServiceClient().from("config").select("value").eq("key", "uf_value").maybeSingle();
  return parseNumeroBCCH(data?.value);
}

export function crearLectorUF(o: {
  pedir?: (signal: AbortSignal) => Promise<Response>;
  respaldo?: () => Promise<number | null>;
  ahora?: () => number;
  tiempoMaxMs?: number;
  esperaTrasFallaMs?: number;
} = {}): () => Promise<number> {
  const ahora = o.ahora ?? (() => Date.now());
  const tiempoMax = o.tiempoMaxMs ?? UF_TIEMPO_MAX_MS;
  const espera = o.esperaTrasFallaMs ?? UF_ESPERA_TRAS_FALLA_MS;
  const pedir = o.pedir ?? ((signal: AbortSignal) => fetch("https://mindicador.cl/api/uf", { next: { revalidate: 86400 }, signal }));
  const respaldo = o.respaldo ?? ufDeLaBase;
  let cachedUF: { value: number; fetchedAt: number } | null = null;
  let fallaHasta = 0;
  let enCurso: Promise<number> | null = null;
  // La de la base se lee una vez por espera: el endpoint de sugerencias pide la UF varias veces por pedido.
  let deLaBaseMem: { value: number; hasta: number } | null = null;

  async function deRespaldo(): Promise<number> {
    if (cachedUF) return cachedUF.value; // la última buena, aunque tenga más de 24 h
    if (deLaBaseMem && ahora() < deLaBaseMem.hasta) return deLaBaseMem.value;
    const deLaBase = await conTiempoMax(respaldo(), tiempoMax);
    const valor = esUFPlausible(deLaBase) ? deLaBase : UF_FALLBACK;
    deLaBaseMem = { value: valor, hasta: Math.max(fallaHasta, ahora() + espera) };
    return valor;
  }

  async function pedirUna(): Promise<number> {
    try {
      const control = new AbortController();
      const valor = await conTiempoMax((async () => {
        const res = await pedir(control.signal);
        if (!res.ok) throw new Error(`mindicador.cl responded ${res.status}`);
        const data = await res.json();
        const serie = data?.serie;
        if (!Array.isArray(serie) || serie.length === 0) throw new Error("Empty serie");
        return Math.round(serie[0].valor);
      })(), tiempoMax);
      if (valor == null) {
        control.abort();
        throw new Error(`mindicador.cl no respondió en ${tiempoMax} ms (o respondió con error)`);
      }
      cachedUF = { value: valor, fetchedAt: ahora() };
      return valor;
    } catch (err) {
      fallaHasta = ahora() + espera;
      console.error("[UF-FALLBACK] Error fetching UF value, using cached/frozen fallback:", err);
      return deRespaldo();
    }
  }

  return function leerUF(): Promise<number> {
    if (cachedUF && ahora() - cachedUF.fetchedAt < CACHE_DURATION_MS) return Promise.resolve(cachedUF.value);
    if (ahora() < fallaHasta) return deRespaldo();
    if (!enCurso) enCurso = pedirUna().finally(() => { enCurso = null; });
    return enCurso;
  };
}

export const getUFValue: () => Promise<number> = crearLectorUF();

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
