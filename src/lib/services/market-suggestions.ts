import { createClient } from "@supabase/supabase-js";
import { getUFValue } from "../uf";
import { estimarContribuciones } from "../contribuciones";

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
  arriendo: number;
  ggcc: number | null;
  contribTrim: number;
  source: "radio" | "comuna" | "estimacion";
  sampleSize: number;
  radiusMeters?: number;
  /** Radio final usado por el loop adaptativo (solo source="radio"). Alias explícito de radiusMeters. */
  radiusUsed?: number;
  precioM2?: number;
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
        best = { ...result, radiusUsed: r, radiusMeters: r };
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

  // NIVEL 2: Estadísticas por comuna + dormitorios
  const dormForComuna = dormFilter || 2;
  const comunaResult = await getSugerenciasPorComuna(comuna, superficie, dormForComuna, propType);
  if (comunaResult) return comunaResult;

  // NIVEL 3: Fallback a estimación hardcodeada
  const ufCLP = await getUFValue();
  return getFallbackEstimacion(comuna, superficie, dormForComuna, precioUF, ufCLP);
}

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
  const { data: allProps } = await supabase.rpc("properties_within_radius", {
    center_lat: lat,
    center_lng: lng,
    radius_meters: radiusMeters,
    prop_type: propType,
    prop_dorms: null,
    prop_comuna: comuna || null,
    prop_condicion: condicion,
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
    const { data: filteredProps } = await supabase.rpc("properties_within_radius", {
      center_lat: lat,
      center_lng: lng,
      radius_meters: radiusMeters,
      prop_type: propType,
      prop_dorms: dormitorios,
      prop_comuna: comuna || null,
      prop_condicion: condicion,
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

  // Usar la función RPC de PostGIS
  const { data: arriendos } = await supabase.rpc("properties_within_radius", {
    center_lat: lat,
    center_lng: lng,
    radius_meters: radiusMeters,
    prop_type: propType,
    prop_dorms: dormitorios,
    prop_comuna: comuna || null,
    prop_condicion: condicion,
  });

  // Filter outliers, then by surface range ±30%
  const clean = filterBySurface(filterOutliers(arriendos || []), superficie);
  if (clean.length < 5) {
    // Intentar sin filtro de dormitorios (si ya estaba sin filtro, skip)
    if (dormitorios === null) return null;
    const { data: arriendosGeneral } = await supabase.rpc("properties_within_radius", {
      center_lat: lat,
      center_lng: lng,
      radius_meters: radiusMeters,
      prop_type: propType,
      prop_dorms: null,
      prop_comuna: comuna || null,
      prop_condicion: condicion,
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
      precioM2: Math.round(medianaM2),
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
    precioM2: preciosM2.length > 0 ? Math.round(median(preciosM2)) : undefined,
  };
}

async function getSugerenciasPorComuna(
  comuna: string,
  superficie: number,
  dormitorios: number,
  propType: string = "arriendo"
): Promise<Sugerencias | null> {
  const supabase = getSupabase();

  const { data: stats } = await supabase
    .from("market_stats")
    .select("*")
    .eq("comuna", comuna)
    .eq("dormitorios", dormitorios)
    .eq("type", propType)
    .single();

  if (stats && stats.count >= 5) {
    return {
      arriendo: Math.round(stats.precio_mediana / 1000) * 1000,
      ggcc: stats.ggcc_promedio ? Math.round(stats.ggcc_promedio / 1000) * 1000 : null,
      contribTrim: stats.precio_m2_mediana ? estimarContribuciones(Math.round(stats.precio_m2_mediana * superficie)) : estimarContribuciones(superficie * 2_000_000),
      source: "comuna",
      sampleSize: stats.count,
      precioM2: stats.precio_m2_mediana ? Math.round(stats.precio_m2_mediana) : undefined,
    };
  }
  return null;
}

function getFallbackEstimacion(
  comuna: string,
  superficie: number,
  dormitorios: number,
  precioUF?: number,
  ufCLP: number = 38800
): Sugerencias {
  const ESTIMACIONES: Record<string, { arriendoM2: number; ggccM2: number }> = {
    "Providencia": { arriendoM2: 7600, ggccM2: 1200 },
    "Las Condes": { arriendoM2: 8200, ggccM2: 1400 },
    "Ñuñoa": { arriendoM2: 7000, ggccM2: 1100 },
    "Santiago": { arriendoM2: 6200, ggccM2: 1000 },
    "Santiago Centro": { arriendoM2: 6200, ggccM2: 1000 },
    "La Florida": { arriendoM2: 5800, ggccM2: 900 },
    "Vitacura": { arriendoM2: 9500, ggccM2: 1800 },
    "Lo Barnechea": { arriendoM2: 8500, ggccM2: 1600 },
    "San Miguel": { arriendoM2: 6000, ggccM2: 950 },
    "Macul": { arriendoM2: 5500, ggccM2: 850 },
    "Estación Central": { arriendoM2: 5600, ggccM2: 900 },
    "Independencia": { arriendoM2: 5400, ggccM2: 850 },
    "Recoleta": { arriendoM2: 5200, ggccM2: 800 },
    "Maipú": { arriendoM2: 5000, ggccM2: 750 },
    "Puente Alto": { arriendoM2: 4500, ggccM2: 700 },
    "Peñalolén": { arriendoM2: 5300, ggccM2: 850 },
    "La Reina": { arriendoM2: 7200, ggccM2: 1200 },
  };

  const data = ESTIMACIONES[comuna] || { arriendoM2: 6000, ggccM2: 1000 };
  const ajusteDorm = dormitorios >= 3 ? 1.05 : dormitorios === 1 ? 0.95 : 1.0;

  return {
    arriendo: Math.round(data.arriendoM2 * superficie * ajusteDorm / 1000) * 1000,
    ggcc: Math.round(data.ggccM2 * superficie / 1000) * 1000,
    contribTrim: estimarContribuciones(precioUF ? precioUF * ufCLP : 3000 * ufCLP),
    source: "estimacion",
    sampleSize: 0,
  };
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
