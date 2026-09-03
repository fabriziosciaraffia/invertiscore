import { universoDeSugerenciaVenta } from "@/lib/valor-mercado";
import { createClient } from "@supabase/supabase-js";
import { getUFValue } from "../uf";
import { estimarContribuciones } from "../contribuciones";
import { getFactorCierre, getComunaMedianaVentaUF, PAGINA_POSTGREST, median as medianaDe, normalizeComuna } from "@/lib/comuna-stats";
import { medianaArriendoUFm2Mes, resolverReferenciaArriendo } from "@/lib/referencia-arriendo";
import { reportarFalloQuery } from "@/lib/observabilidad";

const RUTA = "GET /api/data/suggestions";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface NearbyPropertyPoint {
  lat: number;
  lng: number;
  precio: number;
  superficie_m2: number | null;
  distance_meters: number;
}

export interface Sugerencias {
  /**
   * null = Franco no tiene con qué estimar. NO es 0 ni un valor por defecto: el
   * consumidor debe mostrar el campo vacío y pedirle el número al usuario.
   * Hasta el 2026-08-04 esto nunca era null porque había dos niveles de relleno
   * (market_stats congelada + un seed hardcodeado de 17 comunas); ambos se
   * retiraron. Ver `source`.
   */
  arriendo: number | null;
  ggcc: number | null;
  contribTrim: number | null;
  /**
   * De dónde salió el número, para que el consumidor pueda decirlo sin mentir:
   * - "radio"     → mediana de comparables publicados dentro de `radiusUsed` metros.
   * - "comuna"    → VENTA: mediana comunal (helper canónico). ARRIENDO: mediana de
   *                 la tipología (dorms) en la comuna entera, ≥20 avisos.
   * - "comuna-m2" → solo ARRIENDO: ESTIMADO desde el UF/m² comunal × superficie
   *                 × factor por tipología (referencia-arriendo.ts). Viene con
   *                 `rangoArriendo`; `arriendo` es el punto central. Es un orden
   *                 de magnitud, no un comparable: el informe lo nombra y no lo
   *                 usa para reprochar.
   * - "sin-dato"  → ni comparables ni muestra comunal. `arriendo` viene en null.
   */
  source: "radio" | "comuna" | "comuna-m2" | "sin-dato";
  /** Solo source="comuna-m2": rango publicado del estimado (∓ error residual de la tipología). */
  rangoArriendo?: { min: number; max: number };
  /** Solo source="comuna-m2": arriendos de la comuna (todas las tipologías) detrás del UF/m². */
  nComunal?: number;
  sampleSize: number;
  radiusMeters?: number;
  /** Radio final usado por el loop adaptativo (solo source="radio"). Alias explícito de radiusMeters. */
  radiusUsed?: number;
  precioM2?: number;
  /** Solo VENTA: universo de la muestra detrás de precioM2 (Tramo A). "mixto" = radio sin condición. */
  universoVenta?: "nuevo" | "usado" | "mixto";
  nearbyProperties?: NearbyPropertyPoint[];
  totalInRadius?: number;
  filteredInRadius?: number;
}

// Radio adaptativo: objetivo 20 comparables, tope 2000m.
// Empieza a 500m y expande progresivamente hasta conseguir la muestra.
const ADAPTIVE_RADII = [500, 750, 1000, 1500, 2000] as const;
const TARGET_SAMPLE = 20;

export async function getSugerencias(
  comuna: string,
  superficie: number,
  dormitorios: number,
  precioUF?: number,
  lat?: number,
  lng?: number,
  // Deprecated: el loop adaptativo ignora este valor. Se mantiene por
  // compatibilidad con callers antiguos.
  _radiusMeters: number = 500,
  propType: string = "arriendo",
  condicion: string | null = null
): Promise<Sugerencias> {
  void _radiusMeters;
  const dormFilter = dormitorios > 0 ? dormitorios : null;

  // NIVEL 1: loop adaptativo por radio (500→750→1000→1500→2000)
  if (lat && lng) {
    let best: Sugerencias | null = null;
    let bestMap: Awaited<ReturnType<typeof getNearbyPropertiesForMap>> | null = null;

    for (const r of ADAPTIVE_RADII) {
      const mapData = await getNearbyPropertiesForMap(
        lat, lng, r, dormFilter, comuna, propType, condicion,
      );
      const result = await getSugerenciasPorRadio(
        lat, lng, r, superficie, dormFilter, comuna, propType, condicion,
      );

      if (!result) {
        // no hay nada con este radio — seguir expandiendo
        if (!best) bestMap = mapData; // guardar último map por si caemos a fallback
        continue;
      }

      // Guardar siempre el "mejor hasta ahora" (mayor sampleSize gana)
      if (!best || result.sampleSize > best.sampleSize) {
        best = { ...result, radiusUsed: r, radiusMeters: r, ...(propType === "venta" ? { universoVenta: universoDeSugerenciaVenta("radio", condicion) } : {}) };
        bestMap = mapData;
      }

      // Si alcanzamos el objetivo, cortar el loop
      if (result.sampleSize >= TARGET_SAMPLE) break;
    }

    if (best && bestMap) {
      return {
        ...best,
        nearbyProperties: bestMap.all,
        totalInRadius: bestMap.all.length,
        filteredInRadius: dormFilter ? bestMap.filteredCount : bestMap.all.length,
      };
    }
  }

  // NIVEL 2 — VENTA: mediana comunal desde scraped_properties.
  if (propType === "venta") {
    const dormForComuna = dormFilter || 2;
    const ventaResult = await getMedianaComunalVenta(comuna, superficie, dormForComuna, condicion);
    if (ventaResult) return ventaResult;
  }

  // NIVELES 2 y 3 — ARRIENDO: la jerarquía de referencia-arriendo.ts sobre la
  // comuna (mediana de la tipología ≥20 → estimado desde el m² comunal ≥15 →
  // nada), calculada sobre los MISMOS avisos que publica /comunas/[slug].
  //
  // Historia, para que nadie la repita: el arriendo tuvo un nivel 2 hasta el
  // 2026-08-04 que leía `market_stats`, una tabla congelada el 2026-03-24 cuyo
  // writer nunca paginó el SELECT (calculó sobre 1.000 de 55.466 propiedades) y
  // servía medianas de n=1 como si fueran de la comuna entera; y un nivel 3,
  // `getFallbackEstimacion`, un seed de 17 comunas con un arriendo por m² fijo.
  // Ninguno era un dato, y el wizard los presentaba con el rótulo de los
  // comparables medidos. Lo que vuelve ahora es distinto en las tres cosas que
  // importaban: se calcula en vivo sobre el scraping, exige muestra con nombre
  // (MIN_ARRIENDOS_TIPOLOGIA / MIN_ARRIENDOS_COMUNAL_ENTRA), y declara su fuente
  // con un `source` propio que el wizard, el payload y el informe arrastran.
  if (propType === "arriendo") {
    const comunal = await getReferenciaComunalArriendo(comuna, superficie, dormFilter);
    if (comunal) return comunal;
  }

  return SIN_DATO;
}

/** Respuesta canónica cuando no hay comparables. Ver `Sugerencias.arriendo`. */
const SIN_DATO: Sugerencias = {
  arriendo: null,
  ggcc: null,
  contribTrim: null,
  source: "sin-dato",
  sampleSize: 0,
};

async function getNearbyPropertiesForMap(
  lat: number,
  lng: number,
  radiusMeters: number,
  dormitorios: number | null,
  comuna?: string,
  propType: string = "arriendo",
  condicion: string | null = null
): Promise<{ all: NearbyPropertyPoint[]; filteredCount: number }> {
  const supabase = getSupabase();

  // Query ALL properties without dormitorios filter for map density
  const { data: allProps, error: errAll } = await supabase.rpc("properties_within_radius", {
    center_lat: lat,
    center_lng: lng,
    radius_meters: radiusMeters,
    prop_type: propType,
    prop_dorms: null,
    prop_comuna: comuna || null,
    prop_condicion: condicion,
  });
  reportarFalloQuery(errAll, {
    ruta: RUTA,
    operacion: "rpc-radio-mapa",
    tags: { rpc: "properties_within_radius", tipo: String(propType) },
    extra: { comuna, radiusMeters, dormitorios: null },
  });

  const raw = (allProps || []).map((p: { lat: number; lng: number; precio: number; superficie_m2: number | null; distance_meters: number }) => ({
    lat: p.lat,
    lng: p.lng,
    precio: p.precio,
    superficie_m2: p.superficie_m2,
    distance_meters: p.distance_meters,
  }));
  const all = filterOutliers(raw) as NearbyPropertyPoint[];

  // Count filtered by dormitorios via a second RPC call (reliable, doesn't depend on RPC returning dormitorios)
  let filteredCount = all.length;
  if (dormitorios) {
    const { data: filteredProps, error: errFiltered } = await supabase.rpc("properties_within_radius", {
      center_lat: lat,
      center_lng: lng,
      radius_meters: radiusMeters,
      prop_type: propType,
      prop_dorms: dormitorios,
      prop_comuna: comuna || null,
      prop_condicion: condicion,
    });
    reportarFalloQuery(errFiltered, {
      ruta: RUTA,
      operacion: "rpc-radio-conteo-dorms",
      tags: { rpc: "properties_within_radius", tipo: String(propType) },
      extra: { comuna, radiusMeters, dormitorios },
    });
    filteredCount = filterOutliers(filteredProps || []).length;
  }

  return { all, filteredCount };
}

async function getSugerenciasPorRadio(
  lat: number,
  lng: number,
  radiusMeters: number,
  superficie: number,
  dormitorios: number | null,
  comuna?: string,
  propType: string = "arriendo",
  condicion: string | null = null
): Promise<Sugerencias | null> {
  const supabase = getSupabase();

  // Factor de corrección publicado->cierre: solo afecta el precioM2 de VENTA, y
  // solo cuando NO es "nuevo" (usado o null → corregir; ~93% del inventario es usado).
  const factorCierre = (propType === "venta" && condicion !== "nuevo" && comuna)
    ? getFactorCierre(comuna) : 1;

  // Usar la función RPC de PostGIS
  const { data: arriendos, error: errMuestra } = await supabase.rpc("properties_within_radius", {
    center_lat: lat,
    center_lng: lng,
    radius_meters: radiusMeters,
    prop_type: propType,
    prop_dorms: dormitorios,
    prop_comuna: comuna || null,
    prop_condicion: condicion,
  });
  // El más caro de los cuatro: de acá sale la mediana que el wizard propone. Si
  // falla, el nivel 1 se declara sin comparables y el usuario ve "sin arriendos
  // publicados cerca" — un hueco de datos y una caída de la RPC se ven idénticos.
  reportarFalloQuery(errMuestra, {
    ruta: RUTA,
    operacion: "rpc-radio-muestra",
    tags: { rpc: "properties_within_radius", tipo: String(propType), decide: "mediana" },
    extra: { comuna, radiusMeters, dormitorios, superficie },
  });

  // Filter outliers, then by surface range ±30%
  const clean = filterBySurface(filterOutliers(arriendos || []), superficie);
  if (clean.length < 5) {
    // Intentar sin filtro de dormitorios (si ya estaba sin filtro, skip)
    if (dormitorios === null) return null;
    const { data: arriendosGeneral, error: errGeneral } = await supabase.rpc("properties_within_radius", {
      center_lat: lat,
      center_lng: lng,
      radius_meters: radiusMeters,
      prop_type: propType,
      prop_dorms: null,
      prop_comuna: comuna || null,
      prop_condicion: condicion,
    });
    reportarFalloQuery(errGeneral, {
      ruta: RUTA,
      operacion: "rpc-radio-muestra-sin-dorms",
      tags: { rpc: "properties_within_radius", tipo: String(propType), decide: "mediana" },
      extra: { comuna, radiusMeters, superficie },
    });

    const cleanGeneral = filterBySurface(filterOutliers(arriendosGeneral || []), superficie);
    if (cleanGeneral.length < 5) return null;

    const preciosM2 = cleanGeneral
      .filter((a) => a.superficie_m2 && a.superficie_m2 > 0)
      .map((a) => a.precio / a.superficie_m2!)
      .sort((a, b) => a - b);

    if (preciosM2.length < 3) return null;

    const medianaM2 = preciosM2[Math.floor(preciosM2.length / 2)];
    const arriendo = Math.round(medianaM2 * superficie / 1000) * 1000;

    const ggccs = (cleanGeneral as Array<{ gastos_comunes?: number } & typeof cleanGeneral[0]>)
      .filter((a) => a.gastos_comunes && a.gastos_comunes > 0)
      .map((a) => a.gastos_comunes!);

    return {
      arriendo,
      ggcc: ggccs.length >= 3 ? Math.round(median(ggccs) / 1000) * 1000 : null,
      contribTrim: estimarContribuciones(Math.round(medianaM2 * superficie)),
      source: "radio",
      sampleSize: cleanGeneral.length,
      radiusMeters,
      precioM2: Math.round(medianaM2 * factorCierre),
    };
  }

  // Tenemos suficientes datos con dormitorios (post-filter)
  const precios = clean.map((a) => a.precio).sort((a, b) => a - b);
  const preciosM2 = clean
    .filter((a) => a.superficie_m2 && a.superficie_m2 > 0)
    .map((a) => a.precio / a.superficie_m2!);
  const ggccs = (clean as Array<{ gastos_comunes?: number } & typeof clean[0]>)
    .filter((a) => a.gastos_comunes && a.gastos_comunes > 0)
    .map((a) => a.gastos_comunes!);

  return {
    arriendo: Math.round(median(precios) / 1000) * 1000,
    ggcc: ggccs.length >= 3 ? Math.round(median(ggccs) / 1000) * 1000 : null,
    contribTrim: preciosM2.length > 0 ? estimarContribuciones(Math.round(median(preciosM2) * superficie)) : estimarContribuciones(superficie * 2_000_000),
    source: "radio",
    sampleSize: clean.length,
    radiusMeters,
    precioM2: preciosM2.length > 0 ? Math.round(median(preciosM2) * factorCierre) : undefined,
  };
}

/**
 * NIVEL 2 de VENTA. El precioM2 sale del helper canónico getComunaMedianaVentaUF,
 * que lee scraped_properties DIRECTO (misma fuente que el sobreprecio → coherencia
 * garantizada) con ventana superficie ±20%, dormitorios, segmentación por universo
 * (nuevo|usado), escalera de frescura por universo y factor cierre YA aplicado por fila.
 *
 * `condicion` la manda el wizard como `tipoPropiedad` y decide el universo de la
 * mediana. Así el precio/m² SUGERIDO sale del mismo mercado contra el que después
 * se mide el sobreprecio — sin eso, a un depto nuevo se le sugeriría un valor de usados.
 */
async function getMedianaComunalVenta(
  comuna: string,
  superficie: number,
  dormitorios: number,
  condicion: string | null = null
): Promise<Sugerencias | null> {
  const supabase = getSupabase();
  const ufCLP = await getUFValue();
  const { mediana: medianaUF, n } = await getComunaMedianaVentaUF(
    supabase, comuna, superficie, dormitorios, ufCLP,
    condicion === "nuevo" ? "nuevo" : "usado");
  if (!medianaUF || medianaUF <= 0) return null; // sin ventas frescas suficientes

  // medianaUF es UF/m²; el consumidor espera CLP/m² (lo divide por UF). No re-aplicar
  // factorCierre: el helper ya lo aplicó internamente.
  const precioM2CLP = Math.round(medianaUF * ufCLP);
  const precioTotalCLP = Math.round(precioM2CLP * superficie);
  return {
    // En venta, "arriendo" no lo lee el consumidor; lo dejamos como precio total implícito.
    arriendo: Math.round(precioTotalCLP / 1000) * 1000,
    ggcc: null,
    contribTrim: estimarContribuciones(precioTotalCLP),
    source: "comuna",
    sampleSize: n,
    precioM2: precioM2CLP,
    universoVenta: universoDeSugerenciaVenta("comuna", condicion),
  };
}

/** Variantes de escritura de una comuna en scraped_properties (con y sin tildes). */
function variantesComuna(comuna: string): string[] {
  const canon = normalizeComuna(comuna);
  // Sin \p{M}: el target del app no lo admite. Tras NFD las marcas diacríticas
  // viven en el bloque 0x0300-0x036F; se filtran por rango de code point.
  const plana = Array.from(canon.normalize("NFD"))
    .filter((c) => {
      const cp = c.charCodeAt(0);
      return cp < 0x0300 || cp > 0x036f;
    })
    .join("");
  return Array.from(new Set([canon, plana]));
}

/**
 * NIVELES 2 y 3 de ARRIENDO. Lee los arriendos activos de la comuna con los
 * mismos cortes que comunas-seo (superficie útil 0-300 m², 1 a 4 dorms) y
 * resuelve la jerarquía de referencia-arriendo.ts para la tipología del
 * sujeto. La superficie de referencia del estimado es la del PROPIO depto:
 * acá no se estima una fila de tabla sino este caso. Umbral comunal seco
 * (el informe no tiene snapshot con qué hacer histéresis).
 */
async function getReferenciaComunalArriendo(
  comuna: string,
  superficie: number,
  dormitorios: number | null,
): Promise<Sugerencias | null> {
  const supabase = getSupabase();
  const variantes = variantesComuna(comuna);
  const rows: Array<{ precio: number; superficie_m2: number | null; dormitorios: number | null }> = [];
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    const { data, error } = await supabase
      .from("scraped_properties")
      .select("precio, superficie_m2, dormitorios")
      .in("comuna", variantes)
      .eq("type", "arriendo")
      .eq("is_active", true)
      .gt("precio", 0)
      .order("id", { ascending: true })
      .range(off, off + PAGINA_POSTGREST - 1);
    reportarFalloQuery(error, {
      ruta: RUTA,
      operacion: "arriendos-comuna-referencia",
      tags: { tabla: "scraped_properties", decide: "referencia-arriendo" },
      extra: { comuna, dormitorios, superficie, offset: off },
    });
    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGINA_POSTGREST) break;
  }
  // Mismos cortes que superficieUtil/dormsEnRango de comunas-seo: la muestra
  // comunal del informe tiene que ser la que la página de comuna declara.
  const entran = rows.filter((r) => {
    const sup = Number(r.superficie_m2);
    const d = Number(r.dormitorios);
    return sup > 0 && sup <= 300 && d >= 1 && d <= 4;
  });
  if (!entran.length) return null;

  const ufCLP = await getUFValue();
  const propias = dormitorios ? entran.filter((r) => Number(r.dormitorios) === dormitorios) : [];
  const ref = resolverReferenciaArriendo({
    dorms: dormitorios ?? 2,
    tipologia: { n: propias.length, medianaCLP: propias.length ? medianaDe(propias.map((r) => Number(r.precio))) : 0 },
    comunal: { n: entran.length, ufM2Mes: medianaArriendoUFm2Mes(entran, ufCLP) },
    superficieRefM2: superficie > 0 ? superficie : null,
    ufCLP,
  });
  if (ref.fuente === "porTipologia") {
    return {
      arriendo: Math.round(ref.medianaCLP / 1000) * 1000,
      ggcc: null,
      contribTrim: null,
      source: "comuna",
      sampleSize: ref.n,
    };
  }
  if (ref.fuente === "comunalPorM2") {
    return {
      arriendo: ref.estimadoCLP,
      ggcc: null,
      contribTrim: null,
      source: "comuna-m2",
      sampleSize: ref.nComunal,
      nComunal: ref.nComunal,
      rangoArriendo: ref.rangoCLP,
    };
  }
  return null;
}

/**
 * Fallback para gastos comunes cuando el RPC devuelve ggcc=null (ninguno de los
 * comparables tiene dato). Promedios de mercado por tier de comuna, en CLP/m²/mes.
 * Fuentes: portales inmobiliarios Santiago, promedios primera mitad 2026.
 */
const GGCC_POR_M2_TIER_ALTO = 2200; // Providencia, Las Condes, Vitacura, Lo Barnechea
const GGCC_POR_M2_TIER_MEDIO = 1800; // Santiago, Ñuñoa, La Reina
const GGCC_POR_M2_TIER_BAJO = 1400; // Resto

const COMUNAS_TIER_ALTO = new Set(["Providencia", "Las Condes", "Vitacura", "Lo Barnechea"]);
const COMUNAS_TIER_MEDIO = new Set(["Santiago", "Santiago Centro", "Ñuñoa", "La Reina"]);

export function getGgccFallback(comuna: string, superficie: number): number | null {
  if (!superficie || superficie <= 0) return null;
  const porM2 = COMUNAS_TIER_ALTO.has(comuna)
    ? GGCC_POR_M2_TIER_ALTO
    : COMUNAS_TIER_MEDIO.has(comuna)
      ? GGCC_POR_M2_TIER_MEDIO
      : GGCC_POR_M2_TIER_BAJO;
  // Redondear a miles para no mostrar cifras sueltas tipo $108.372.
  return Math.round((porM2 * superficie) / 1000) * 1000;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Filter by surface area ±30% — falls back to unfiltered if fewer than 4 remain */
function filterBySurface<T extends { superficie_m2: number | null }>(props: T[], targetSup: number): T[] {
  if (!targetSup || targetSup <= 0) return props;
  const minSup = targetSup * 0.7;
  const maxSup = targetSup * 1.3;
  const filtered = props.filter(
    (p) => p.superficie_m2 && p.superficie_m2 >= minSup && p.superficie_m2 <= maxSup
  );
  return filtered.length >= 4 ? filtered : props;
}

/** Filter outliers by superficie range + IQR on precio/m2 */
function filterOutliers<T extends { precio: number; superficie_m2: number | null }>(props: T[]): T[] {
  // 1. Remove absurd superficie
  const valid = props.filter(
    (p) => !p.superficie_m2 || (p.superficie_m2 >= 15 && p.superficie_m2 <= 300)
  );

  // 2. IQR filter on precio/m2 (only for props with superficie)
  const withM2 = valid.filter((p) => p.superficie_m2 && p.superficie_m2 > 0);
  const withoutM2 = valid.filter((p) => !p.superficie_m2 || p.superficie_m2 <= 0);

  if (withM2.length < 4) return valid; // not enough data for IQR

  const ppm2 = withM2.map((p) => p.precio / p.superficie_m2!).sort((a, b) => a - b);
  const q1 = percentile(ppm2, 25);
  const q3 = percentile(ppm2, 75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;

  const filtered = withM2.filter((p) => {
    const pm2 = p.precio / p.superficie_m2!;
    return pm2 >= lo && pm2 <= hi;
  });

  return [...filtered, ...withoutM2];
}
