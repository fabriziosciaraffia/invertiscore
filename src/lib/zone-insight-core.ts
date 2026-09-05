// ============================================================================
// ZONE INSIGHT — núcleo de generación (extraído de la ruta · paquete B)
// ============================================================================
// Todo lo que computa el insight de zona (POIs + stats; sin prosa IA desde el 05-sep-2026)
// vive acá, sin HTTP ni persistencia. Lo consumen:
//   · la ruta GET /api/analisis/[id]/zone-insight (wrapper: auth + cache)
//   · scripts/regen-zone-insight.ts (regen administrativa por lote, service-role)
// La ruta App Router no puede exportar funciones arbitrarias (Next valida los
// exports de route.ts), por eso el núcleo vive en lib.


import { createClient as createAdminClient } from "@supabase/supabase-js";

import { reportarFalloQuery } from "@/lib/observabilidad";
import { getNearbyAttractors, type AttractorTipo } from "@/lib/data/attractors";
import { PLUSVALIA_ESTIMADO as PLUSVALIA_HISTORICA, PLUSVALIA_ESTIMADO_DEFAULT as PLUSVALIA_DEFAULT } from "@/lib/plusvalia-estimado.gen";
import {
  getComunaMedianaVentaUF,
  resolverCondicionMercado,
  type CondicionMercado,
} from "@/lib/comuna-stats";


// ─── Types ──────────────────────────────────────────
interface PoiBasic {
  nombre: string;
  distancia: number;  // meters, rounded
  lat: number;
  lng: number;
  linea?: string;     // L1, L2, ... — only for metro
  comuna?: string;    // optional, for debugging/filters
}

interface ZoneInsightStats {
  plusvaliaHistorica: {
    /** Acumulado 10 años (rango histórico A&C, ver rangoHist del módulo generado). Ej: 37 = 37% en la década. Fuente: Arenas & Cayo, Propital, Tinsa. */
    valor: number;
    /** Anualizado (la misma serie convertida a tasa anual). Ej: 3.2 = 3,2% anual. */
    anualizada: number;
    /** Promedio Gran Santiago **acumulado 10 años** (PLUSVALIA_DEFAULT.plusvalia10a = 35). NO es anualizado. Para el anualizado equivalente ver PLUSVALIA_DEFAULT.anualizada (3.0). */
    promedioSantiago: number;
  };
  precioM2: {
    tuDepto: number;
    medianaComuna: number;
    diffPct: number;
  } | null;
  ofertaComparable: {
    totalDeptos: number;
    rangoArriendoMin: number;
    rangoArriendoMax: number;
    percentilTuDepto: number;
    precision: "exacta" | "superficie_amplia" | "dormitorios_flexibles" | "comuna_general";
    /** Fecha ISO de la consulta de avisos (goal "LTR hereda", 05-sep-2026). OPCIONAL:
     *  las caches anteriores no la traen y no se reconsultan (la invalidación es por
     *  versión, no por edad); sin fecha la sección muestra "N avisos activos" a secas. */
    asOf?: string;
  } | null;
}

interface ZoneInsightPois {
  metro: PoiBasic[];
  clinicas: PoiBasic[];
  universidades: PoiBasic[];
  institutos: PoiBasic[];
  colegios: PoiBasic[];
  parques: PoiBasic[];
  malls: PoiBasic[];
  negocios: PoiBasic[];
  trenes: PoiBasic[];
}

export interface ZoneInsightResponse {
  stats: ZoneInsightStats;
  pois: ZoneInsightPois;
  /** Prosa IA de la zona. DESDE EL 05-sep-2026 NO SE GENERA (goal "el endpoint de zona
   *  deja de pagar IA"): ninguna superficie la mostraba desde 9704e8f y cada cache-miss
   *  pagaba una llamada de 13,5 s. Las caches anteriores la traen; el payload nuevo no. */
  insight?: {
    headline_clp: string;
    headline_uf: string;
    preview_clp: string;
    preview_uf: string;
    narrative_clp: string;
    narrative_uf: string;
    // Fase 5 v2 — campo agregado al schema. El cliente actual NO lo renderiza
    // (ZoneInsightAI.tsx / ZoneInsightMiniCard.tsx leen headline/preview/narrative).
    // Queda persistido en cache para coordinar UI por separado.
    accion: string;
  };
  valorUF: number;
  /**
   * Version de la cache de zona (nacio como version del prompt). Driver de la
   * invalidacion lazy-on-open: si el cache trae una version menor que
   * PROMPT_VERSION_ZONA (o no la trae), el endpoint la trata como cache-miss y
   * recalcula. Ausente => cache pre-versionado. Desde el 05-sep-2026 el payload no
   * lleva prosa IA y la version NO se sube: el payload nuevo es compatible (insight
   * ausente) y subirla reconsultaria 619 caches al abrirse.
   */
  promptVersion?: number;
}

/**
 * Version del prompt de zona. BUMP cada vez que cambie el prompt, el schema o la
 * doctrina de esta pieza.
 *
 * Existe porque la zona era la unica prosa del producto SIN invalidacion: la
 * prosa LTR/STR/AMBAS se regenera sola al abrir cuando su `promptVersion` quedo
 * atras, pero un `zone_insight` cacheado no se tocaba nunca (solo `recalculate`
 * lo anulaba). Efecto medido en el parque: la REGLA 9 (la zona no empuja contra
 * el veredicto) ya vivia en el prompt y 21 de 102 informes BUSCAR OTRA seguian
 * mostrando lenguaje celebratorio en cache -- doctrina escrita que no llegaba.
 *
 * La invalidacion es por VERSION, NO por edad (decision 2026-08-17). El informe
 * congela UF, `asOf` y mediana comunal al crearse; un TTL volveria a mover la
 * zona bajo una prosa que no se mueve y reintroduciria la divergencia que el fix
 * de coherencia cierra, ademas de regenerar el parque sin ganancia editorial.
 */
// v2 (2026-08-27, F4.1): el período de la plusvalía pasa a viajar con la cifra
// en el bloque del caso, porque con la cascada cada comuna tiene el suyo
// (2015-2025 / 2015-2024 / 2014-2024) y el system prompt, estático, no puede
// nombrar uno fijo. La prosa cacheada databa el número con el rango del DEFAULT.
// 05-sep-2026: muere la prosa IA de la zona; la version queda en 2 a proposito (ver arriba).
export const PROMPT_VERSION_ZONA = 2;

// ─── Stats helpers ──────────────────────────────────
// median() vive ahora en @/lib/comuna-stats (compartido con ai-generation).
function percentile(values: number[], target: number): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter((v) => v <= target).length;
  return Math.round((below / sorted.length) * 100);
}

// ─── POI selection: top 20 global + reps of missing relevant categories ──
type NearbyAttractor = ReturnType<typeof getNearbyAttractors>[number];

function makePoi(a: NearbyAttractor): PoiBasic {
  const poi: PoiBasic = {
    nombre: a.nombre,
    distancia: Math.round(a.distancia),
    lat: a.lat,
    lng: a.lng,
  };
  if (a.tipo === "metro" && a.meta) poi.linea = a.meta;
  if (a.comuna) poi.comuna = a.comuna;
  return poi;
}

/**
 * Nueva lógica: TOP 20 globales por distancia (sin cap por categoría) + representantes
 * de las categorías relevantes que hayan quedado fuera del top 20 (hasta +5). Esto evita
 * devolver clínicas a 3-4 km cuando hay parques a 200 m.
 */
function buildPoisTopN(nearby: NearbyAttractor[]): ZoneInsightPois {
  const TOP_N = 20;
  const top = nearby.slice(0, TOP_N);
  const topTypes = new Set(top.map((p) => p.tipo));

  const relevantCategories: AttractorTipo[] = [
    "metro",
    "clinica",
    "universidad",
    "parque",
    "mall",
    "negocios",
  ];
  const reps: NearbyAttractor[] = [];
  for (const t of relevantCategories) {
    if (topTypes.has(t)) continue;
    if (reps.length >= 5) break;
    const rep = nearby.find((p) => p.tipo === t);
    if (rep) reps.push(rep);
  }

  const finalPois = [...top, ...reps];
  const pickByTipo = (tipo: AttractorTipo): PoiBasic[] =>
    finalPois.filter((p) => p.tipo === tipo).map(makePoi);

  return {
    metro: pickByTipo("metro"),
    clinicas: pickByTipo("clinica"),
    universidades: pickByTipo("universidad"),
    institutos: pickByTipo("instituto"),
    colegios: pickByTipo("colegio"),
    parques: pickByTipo("parque"),
    malls: pickByTipo("mall"),
    negocios: pickByTipo("negocios"),
    trenes: pickByTipo("tren"),
  };
}

// --- Mediana comunal de la zona: quien manda -------------------------------
/**
 * Resuelve QUE mediana comunal publica la seccion de zona -- o si NO publica
 * ninguna. Tres fuentes posibles y una jerarquia:
 *
 *  1. `mediana_comuna_snapshot` (Fase A, congelado al crear el analisis) MANDA
 *     cuando existe: es la misma cifra que la card de sobreprecio y la prosa.
 *     Con `mediana: null` el snapshot dice "aca no hay mediana confiable" y la
 *     zona no compara.
 *  2. Sin snapshot (filas pre-Fase A), manda el veredicto de confiabilidad del
 *     MOTOR: `precioVsComuna.confiable === false` significa que el motor miro
 *     esta comuna, no encontro muestra suficiente, apago la card de sobreprecio
 *     y le prohibio a la prosa hablar de la comuna (REGLA 0). Antes la zona se
 *     quedaba con su propia query viva y quedaba como UNICA voz haciendo una
 *     comparacion comunal vedada al resto del informe -- contradiciendo ademas
 *     la lectura por radio (`valorMercadoFranco`) que la prosa si hace. Medido:
 *     10 de 119 informes con zona (e42f9e9f: prosa "25% bajo" vs zona "en linea";
 *     8bda5e13: "19% bajo" vs "muy sobre").
 *  3. Sin snapshot, queda la query viva de la zona (misma helper y mismo universo
 *     que el hallazgo de sobreprecio). El veredicto de confiabilidad del motor ya
 *     no la veta: se decidio al crear y envejece.
 */
export function resolverMedianaZona(p: {
  medSnap: { mediana: number | null; n: number; universo?: "nuevo" | "usado" } | null | undefined;
  pvcMotor: { confiable?: boolean; desviacionPct?: number | null } | null | undefined;
  precioM2Live: ZoneInsightStats["precioM2"];
}): { precioM2: ZoneInsightStats["precioM2"]; universo: "nuevo" | "usado" | undefined } {
  const { medSnap, pvcMotor, precioM2Live } = p;
  if (medSnap != null) {
    if (typeof medSnap.mediana === "number" && medSnap.mediana > 0) {
      return {
        precioM2: precioM2Live
          ? { ...precioM2Live, medianaComuna: medSnap.mediana }
          : { tuDepto: 0, medianaComuna: medSnap.mediana, diffPct: 0 },
        // El universo viaja CON la cifra: si la mediana la manda el snapshot, el
        // rotulo tambien -- un snapshot pre-segmentacion no trae universo y la
        // zona entonces no lo declara (mediana mixta, sin etiqueta que ponerle).
        universo: medSnap.universo,
      };
    }
    return { precioM2: null, universo: undefined };
  }
  // Tramo A (03-sep-2026): sin snapshot, la zona consulta VIVA igual que el hallazgo
  // de sobreprecio de la prosa. Antes acataba `precioVsComuna.confiable === false`
  // del motor, que se decidió al CREAR: 7710a017 (abril, n=0 entonces) quedó con la
  // zona en "sin mediana" para siempre mientras la prosa regenerada veía n=216.
  void pvcMotor;
  return { precioM2: precioM2Live, universo: undefined };
}

// ─── Comparable market stats from scraped_properties ──
async function fetchComunaStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  comuna: string,
  superficie: number,
  dormitorios: number | null,
  arriendoEstimadoCLP: number,
  ufValue: number,
  condicion: CondicionMercado
): Promise<{ precioM2: ZoneInsightStats["precioM2"]; ofertaComparable: ZoneInsightStats["ofertaComparable"] }> {
  // VENTA comparables (price/m²) use a ±20% surface window inside
  // getComunaMedianaVentaUF (shared with ai-generation), restricted to the
  // subject's own market universe (nuevo|usado) — same segmentation as the
  // sobreprecio finding, so drawer and hero never quote different markets.
  // ARRIENDO uses a cascading strategy in fetchOfertaComparableCascade below.

  // ── VENTA: median price/m² in UF ──
  const { mediana: medianaVentaUF } = await getComunaMedianaVentaUF(
    supabase,
    comuna,
    superficie,
    dormitorios,
    ufValue,
    condicion
  );

  const precioM2: ZoneInsightStats["precioM2"] =
    typeof medianaVentaUF === "number"
      ? {
          tuDepto: 0, // filled by caller from results.metrics.precioM2
          medianaComuna: medianaVentaUF,
          diffPct: 0, // filled by caller
        }
      : null;

  // ── ARRIENDO: cascade query with progressively looser filters ──
  const ofertaComparable = await fetchOfertaComparableCascade(
    supabase,
    comuna,
    superficie,
    dormitorios,
    arriendoEstimadoCLP,
    ufValue
  );

  return { precioM2, ofertaComparable };
}

// Shape of a single arriendo row we care about
interface ArriendoRow {
  precio: number;
  moneda: string;
  superficie_m2: number | null;
  dormitorios: number | null;
}

interface CascadeFilters {
  supMin: number;
  supMax: number;
  dormMin?: number;
  dormMax?: number;
}

async function runArriendoQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  comuna: string,
  f: CascadeFilters
): Promise<ArriendoRow[]> {
  let q = supabase
    .from("scraped_properties")
    .select("precio, moneda, superficie_m2, dormitorios")
    .eq("comuna", comuna)
    .eq("type", "arriendo")
    .eq("is_active", true)
    .gte("superficie_m2", f.supMin)
    .lte("superficie_m2", f.supMax)
    .limit(2000);
  if (typeof f.dormMin === "number" && typeof f.dormMax === "number") {
    if (f.dormMin === f.dormMax) q = q.eq("dormitorios", f.dormMin);
    else q = q.gte("dormitorios", f.dormMin).lte("dormitorios", f.dormMax);
  }
  const { data, error } = await q;
  reportarFalloQuery(error, {
    ruta: "lib/zone-insight",
    operacion: "query-arriendos-zona",
    tags: { tabla: "scraped_properties" },
    extra: { comuna, supMin: f.supMin, supMax: f.supMax, dormMin: f.dormMin, dormMax: f.dormMax },
  });
  return Array.isArray(data) ? (data as ArriendoRow[]) : [];
}

function filterValidPrices(rows: ArriendoRow[], ufValue: number): number[] {
  const preciosCLP: number[] = [];
  for (const r of rows) {
    if (!r.precio || r.precio <= 0) continue;
    const precioCLP = r.moneda === "UF" ? r.precio * (ufValue || 0) : r.precio;
    // Filter outliers (rent ought to be 80k–10M CLP)
    if (precioCLP < 80_000 || precioCLP > 10_000_000) continue;
    preciosCLP.push(precioCLP);
  }
  return preciosCLP;
}

function buildOferta(
  prices: number[],
  arriendoEstimadoCLP: number,
  precision: "exacta" | "superficie_amplia" | "dormitorios_flexibles" | "comuna_general"
): ZoneInsightStats["ofertaComparable"] {
  const sorted = [...prices].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  return {
    totalDeptos: sorted.length,
    rangoArriendoMin: Math.round(p10),
    rangoArriendoMax: Math.round(p90),
    percentilTuDepto: percentile(sorted, arriendoEstimadoCLP),
    precision,
    asOf: new Date().toISOString(),
  };
}

/**
 * Tries progressively looser filters until >= MIN_REQUIRED comparable rentals are found.
 * Returns null if even the broadest query is too thin.
 */
async function fetchOfertaComparableCascade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  comuna: string,
  superficie: number,
  dormitorios: number | null,
  arriendoEstimadoCLP: number,
  ufValue: number
): Promise<ZoneInsightStats["ofertaComparable"]> {
  const MIN_REQUIRED = 15;

  // Attempt 1: strict — ±10% surface, exact dormitorios (if provided)
  {
    const rows = await runArriendoQuery(supabase, comuna, {
      supMin: superficie * 0.9,
      supMax: superficie * 1.1,
      dormMin: dormitorios ?? undefined,
      dormMax: dormitorios ?? undefined,
    });
    const prices = filterValidPrices(rows, ufValue);
    if (prices.length >= MIN_REQUIRED) return buildOferta(prices, arriendoEstimadoCLP, "exacta");
  }

  // Attempt 2: wider surface — ±20%, exact dormitorios
  {
    const rows = await runArriendoQuery(supabase, comuna, {
      supMin: superficie * 0.8,
      supMax: superficie * 1.2,
      dormMin: dormitorios ?? undefined,
      dormMax: dormitorios ?? undefined,
    });
    const prices = filterValidPrices(rows, ufValue);
    if (prices.length >= MIN_REQUIRED) return buildOferta(prices, arriendoEstimadoCLP, "superficie_amplia");
  }

  // Attempt 3: dormitorios ±1 (if we had a target)
  if (dormitorios !== null) {
    const rows = await runArriendoQuery(supabase, comuna, {
      supMin: superficie * 0.8,
      supMax: superficie * 1.2,
      dormMin: Math.max(1, dormitorios - 1),
      dormMax: dormitorios + 1,
    });
    const prices = filterValidPrices(rows, ufValue);
    if (prices.length >= MIN_REQUIRED) return buildOferta(prices, arriendoEstimadoCLP, "dormitorios_flexibles");
  }

  // Attempt 4: broadest — comuna + ±30% surface, any dormitorios
  {
    const rows = await runArriendoQuery(supabase, comuna, {
      supMin: superficie * 0.7,
      supMax: superficie * 1.3,
    });
    const prices = filterValidPrices(rows, ufValue);
    if (prices.length >= MIN_REQUIRED) return buildOferta(prices, arriendoEstimadoCLP, "comuna_general");
  }

  return null;
}

// ─── Núcleo de generación (extraído del GET · paquete B) ─────────────────────
// Computa el zone insight COMPLETO para una fila de `analisis` ya cargada: POIs,
// stats (plusvalía/mediana/oferta) y el
// objeto de respuesta listo para cachear. NO persiste ni conoce HTTP — el GET lo
// envuelve (y cachea con el client del request); scripts/regen-zone-insight.ts lo
// invoca con service-role para regenerar zonas cacheadas por lote. Errores de
// precondición vuelven como { error, status } (el GET los traduce a HTTP).
export async function buildZoneInsightForRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
  // Client para el fallback de stats cuando no hay service-role en el env (el
  // path normal usa createAdminClient con SUPABASE_SERVICE_ROLE_KEY).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ response: ZoneInsightResponse } | { error: string; status: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = (row.input_data ?? {}) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (row.results ?? {}) as any;

  const lat = input.lat ?? input.zonaRadio?.lat ?? null;
  const lng = input.lng ?? input.zonaRadio?.lng ?? null;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { error: "Análisis sin coordenadas", status: 400 };
  }

  // Read from top-level columns first (row.precio / row.superficie / row.arriendo).
  // These are the values the UI shows in the HeroCard (page.tsx uses the same source).
  // input_data.* can diverge — e.g. superficie útil vs total — so falling back to it
  // caused precioM2 and percentilTuDepto to be off.
  const comuna: string = (row.comuna || input.comuna || "").trim();
  const precioUF: number = Number(row.precio) || Number(input.precio) || 0;
  const superficie: number = Number(row.superficie) || Number(input.superficie) || 50;
  const dormitorios: number | null =
    typeof row.dormitorios === "number" ? row.dormitorios
    : typeof input.dormitorios === "number" ? input.dormitorios
    : null;
  const arriendoEstimadoCLP: number =
    Number(row.arriendo) || Number(input.arriendo) || Number(results?.metrics?.ingresoMensual) || 0;
  // Universo del sujeto: el drawer compara contra el MISMO mercado que el
  // hallazgo de sobreprecio. `antiguedad` vive tanto en la columna top-level
  // como en input_data (fuente de verdad: la columna, ver CLAUDE.md).
  const condicionSujeto = resolverCondicionMercado({
    esNuevo: input.esNuevo,
    antiguedad: typeof row.antiguedad === "number" ? row.antiguedad : input.antiguedad,
  });
  const ufValue: number = results?.metrics?.precioCLP && precioUF
    ? results.metrics.precioCLP / precioUF
    : 38800;

  // 1) POIs ─────────────────────────────────────────
  const nearby = getNearbyAttractors(lat, lng, 2500);
  const pois = buildPoisTopN(nearby);

  // NOTA: la mención de metros futuros (L7/L8/L9) fue desactivada temporalmente
  // porque el dataset metro-stations.ts contiene estaciones ficticias (ej. "Pocuro")
  // con líneas/coordenadas incorrectas. El IA las inventaba en el narrative.
  // La auditoría completa del dataset de estaciones futuras contra fuentes oficiales
  // de metro.cl queda como proyecto separado (ver backlog). Reactivar SOLO después
  // de limpiar el dataset.

  // 2) Stats — plusvalía ───────────────────────────
  const histo = PLUSVALIA_HISTORICA[comuna];
  const plusvaliaHistorica = histo
    ? { valor: histo.plusvalia10a, anualizada: histo.anualizada, promedioSantiago: PLUSVALIA_DEFAULT.plusvalia10a }
    : { valor: PLUSVALIA_DEFAULT.plusvalia10a, anualizada: PLUSVALIA_DEFAULT.anualizada, promedioSantiago: PLUSVALIA_DEFAULT.plusvalia10a };

  // 3) Stats — comparable comuna ───────────────────
  let precioM2: ZoneInsightStats["precioM2"] = null;
  // Universo declarado por el snapshot (si lo trae). Ver el bloque Fase B abajo.
  let ofertaComparable: ZoneInsightStats["ofertaComparable"] = null;
  try {
    // Use service role for stats so we can read the full scraped dataset regardless of RLS.
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbForStats = serviceUrl && serviceKey
      ? createAdminClient(serviceUrl, serviceKey)
      : supabase;

    const stats = await fetchComunaStats(
      dbForStats,
      comuna,
      superficie,
      dormitorios,
      arriendoEstimadoCLP,
      ufValue,
      condicionSujeto
    );
    precioM2 = stats.precioM2;
    ofertaComparable = stats.ofertaComparable;

    // Fase B (sobreprecio-sync) — fuente única: si el análisis tiene snapshot de
    // mediana (Fase A), la medianaComuna del drawer sale de AHÍ (alineada con
    // hero/prosa/motor sync), no de getComunaMedianaVentaUF (que queda como
    // FALLBACK intacto dentro de fetchComunaStats para análisis sin snapshot).
    // SOLO se reemplaza la mediana; ofertaComparable / plusvalía / tuDepto se
    // computan igual. El snapshot PRESENTE gana: mediana number>0 → usarla
    // (construyendo precioM2 si la query fresca vino vacía); mediana null →
    // "sin mediana confiable", no se muestra comparación (congelado al crear).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const medSnap = (row as any).mediana_comuna_snapshot as
      { mediana: number | null; n: number; universo?: "nuevo" | "usado" } | null | undefined;
    // Veredicto de confiabilidad del motor sobre la mediana comunal. `undefined`
    // en results legacy sin precioVsComuna: ahí no hay opinión que acatar.
    const pvcMotor = results?.metrics?.precioVsComuna as
      { confiable?: boolean; desviacionPct?: number | null } | null | undefined;
    const resuelta = resolverMedianaZona({ medSnap, pvcMotor, precioM2Live: precioM2 });
    precioM2 = resuelta.precioM2;

    // Fill in tuDepto using precioUF / superficie directly (in UF).
    // We deliberately ignore results.metrics.precioM2 (it can add optional parking
    // price into precioTotal) and input_data.* (which can diverge from the top-level
    // columns the UI reads). precioUF + superficie above already unify both sources.
    if (precioM2) {
      const tuM2UF = superficie > 0 ? precioUF / superficie : 0;
      precioM2.tuDepto = Math.round(tuM2UF * 100) / 100;
      // La DESVIACIÓN sale del motor (metrics.precioVsComuna.desviacionPct), no
      // de un recálculo local. Recalcularla acá daba una cifra distinta de la de
      // la card por el redondeo del NUMERADOR —el motor redondea el UF/m² del
      // sujeto a 1 decimal (94,5) y esta función a 2 (94,55)—, y el informe
      // terminaba mostrando 23% en la card y 24% en la zona para la misma
      // comparación. Fallback al cálculo local solo si el motor no la trae
      // (results legacy sin precioVsComuna).
      const desvMotor = results?.metrics?.precioVsComuna?.desviacionPct;
      if (typeof desvMotor === "number" && Number.isFinite(desvMotor)) {
        precioM2.diffPct = desvMotor;
      } else if (precioM2.medianaComuna > 0) {
        precioM2.diffPct = Math.round(((precioM2.tuDepto - precioM2.medianaComuna) / precioM2.medianaComuna) * 1000) / 10;
      }
    }
  } catch (e) {
    console.error("zone-insight: stats query failed", e);
  }

  // 4) Sin prosa IA (05-sep-2026): la sección y el drawer escriben su síntesis desde las
  //    celdas; lo que el producto lee de acá es el rango de arriendos y los lugares.
  const response: ZoneInsightResponse = {
    stats: { plusvaliaHistorica, precioM2, ofertaComparable },
    pois,
    valorUF: ufValue,
    promptVersion: PROMPT_VERSION_ZONA,
  };
  return { response };
}

