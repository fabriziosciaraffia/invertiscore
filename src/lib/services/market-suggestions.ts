import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  precioM2?: number;
  nearbyProperties?: NearbyPropertyPoint[];
  totalInRadius?: number;
  filteredInRadius?: number;
}

export async function getSugerencias(
  comuna: string,
  superficie: number,
  dormitorios: number,
  precioUF?: number,
  lat?: number,
  lng?: number,
  radiusMeters: number = 800
): Promise<Sugerencias> {
  // Fetch nearby properties for map: ALL properties (sin filtro dormitorios) for density
  let nearbyProperties: NearbyPropertyPoint[] | undefined;
  let totalInRadius = 0;
  let filteredInRadius = 0;
  if (lat && lng) {
    const mapData = await getNearbyPropertiesForMap(lat, lng, radiusMeters, dormitorios);
    nearbyProperties = mapData.all;
    totalInRadius = mapData.all.length;
    filteredInRadius = mapData.filteredCount;
  }

  const mapFields = { nearbyProperties, totalInRadius, filteredInRadius };

  // NIVEL 1: Si tenemos coordenadas, buscar por radio
  if (lat && lng) {
    const radioResult = await getSugerenciasPorRadio(
      lat, lng, radiusMeters, superficie, dormitorios
    );
    if (radioResult) return { ...radioResult, ...mapFields };

    // Expandir radio si no hay suficientes datos
    const expandedResult = await getSugerenciasPorRadio(
      lat, lng, radiusMeters * 2, superficie, dormitorios
    );
    if (expandedResult) return { ...expandedResult, radiusMeters: radiusMeters * 2, ...mapFields };
  }

  // NIVEL 2: Estadísticas por comuna + dormitorios
  const comunaResult = await getSugerenciasPorComuna(comuna, superficie, dormitorios);
  if (comunaResult) return { ...comunaResult, ...mapFields };

  // NIVEL 3: Fallback a estimación hardcodeada
  const fallback = getFallbackEstimacion(comuna, superficie, dormitorios, precioUF);
  return { ...fallback, ...mapFields };
}

async function getNearbyPropertiesForMap(
  lat: number,
  lng: number,
  radiusMeters: number,
  dormitorios: number
): Promise<{ all: NearbyPropertyPoint[]; filteredCount: number }> {
  const supabase = getSupabase();

  // Query ALL properties without dormitorios filter for map density
  const { data: allProps } = await supabase.rpc("properties_within_radius", {
    center_lat: lat,
    center_lng: lng,
    radius_meters: radiusMeters,
    prop_type: "arriendo",
    prop_dorms: null,
  });

  const all = (allProps || []).map((p: { lat: number; lng: number; precio: number; superficie_m2: number | null; distance_meters: number; dormitorios: number | null }) => ({
    lat: p.lat,
    lng: p.lng,
    precio: p.precio,
    superficie_m2: p.superficie_m2,
    distance_meters: p.distance_meters,
  }));

  // Count how many match the dormitorios filter
  const filteredCount = (allProps || []).filter(
    (p: { dormitorios: number | null }) => p.dormitorios === dormitorios
  ).length;

  return { all, filteredCount };
}

async function getSugerenciasPorRadio(
  lat: number,
  lng: number,
  radiusMeters: number,
  superficie: number,
  dormitorios: number
): Promise<Sugerencias | null> {
  const supabase = getSupabase();

  // Usar la función RPC de PostGIS
  const { data: arriendos } = await supabase.rpc("properties_within_radius", {
    center_lat: lat,
    center_lng: lng,
    radius_meters: radiusMeters,
    prop_type: "arriendo",
    prop_dorms: dormitorios,
  });

  // Mínimo 5 propiedades para una sugerencia confiable
  if (!arriendos || arriendos.length < 5) {
    // Intentar sin filtro de dormitorios
    const { data: arriendosGeneral } = await supabase.rpc("properties_within_radius", {
      center_lat: lat,
      center_lng: lng,
      radius_meters: radiusMeters,
      prop_type: "arriendo",
      prop_dorms: null,
    });

    if (!arriendosGeneral || arriendosGeneral.length < 5) return null;

    const preciosM2 = arriendosGeneral
      .filter((a: { superficie_m2: number }) => a.superficie_m2 && a.superficie_m2 > 0)
      .map((a: { precio: number; superficie_m2: number }) => a.precio / a.superficie_m2)
      .sort((a: number, b: number) => a - b);

    if (preciosM2.length < 3) return null;

    const medianaM2 = preciosM2[Math.floor(preciosM2.length / 2)];
    const arriendo = Math.round(medianaM2 * superficie / 1000) * 1000;

    const ggccs = arriendosGeneral
      .filter((a: { gastos_comunes: number }) => a.gastos_comunes && a.gastos_comunes > 0)
      .map((a: { gastos_comunes: number }) => a.gastos_comunes);

    return {
      arriendo,
      ggcc: ggccs.length >= 3 ? Math.round(median(ggccs) / 1000) * 1000 : null,
      contribTrim: estimateContribuciones(superficie, medianaM2),
      source: "radio",
      sampleSize: arriendosGeneral.length,
      radiusMeters,
      precioM2: Math.round(medianaM2),
    };
  }

  // Tenemos suficientes datos con dormitorios
  const precios = arriendos.map((a: { precio: number }) => a.precio).sort((a: number, b: number) => a - b);
  const preciosM2 = arriendos
    .filter((a: { superficie_m2: number }) => a.superficie_m2 && a.superficie_m2 > 0)
    .map((a: { precio: number; superficie_m2: number }) => a.precio / a.superficie_m2);
  const ggccs = arriendos
    .filter((a: { gastos_comunes: number }) => a.gastos_comunes && a.gastos_comunes > 0)
    .map((a: { gastos_comunes: number }) => a.gastos_comunes);

  return {
    arriendo: Math.round(median(precios) / 1000) * 1000,
    ggcc: ggccs.length >= 3 ? Math.round(median(ggccs) / 1000) * 1000 : null,
    contribTrim: estimateContribuciones(superficie),
    source: "radio",
    sampleSize: arriendos.length,
    radiusMeters,
    precioM2: preciosM2.length > 0 ? Math.round(median(preciosM2)) : undefined,
  };
}

async function getSugerenciasPorComuna(
  comuna: string,
  superficie: number,
  dormitorios: number
): Promise<Sugerencias | null> {
  const supabase = getSupabase();

  const { data: stats } = await supabase
    .from("market_stats")
    .select("*")
    .eq("comuna", comuna)
    .eq("dormitorios", dormitorios)
    .eq("type", "arriendo")
    .single();

  if (stats && stats.count >= 5) {
    return {
      arriendo: Math.round(stats.precio_mediana / 1000) * 1000,
      ggcc: stats.ggcc_promedio ? Math.round(stats.ggcc_promedio / 1000) * 1000 : null,
      contribTrim: estimateContribuciones(superficie),
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
  precioUF?: number
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

  const ufCLP = 39842;

  return {
    arriendo: Math.round(data.arriendoM2 * superficie * ajusteDorm / 1000) * 1000,
    ggcc: Math.round(data.ggccM2 * superficie / 1000) * 1000,
    contribTrim: estimateContribuciones(superficie, precioUF ? precioUF * ufCLP / superficie : undefined),
    source: "estimacion",
    sampleSize: 0,
  };
}

function estimateContribuciones(superficie: number, precioM2CLP?: number): number {
  const ufCLP = 39842;
  const precioEstimadoUF = precioM2CLP ? (precioM2CLP * superficie / ufCLP) : 3000;
  const avaluoFiscal = precioEstimadoUF * 0.7;
  const contribAnualUF = avaluoFiscal * 0.012;
  return Math.round(contribAnualUF / 4 * ufCLP / 1000) * 1000;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
