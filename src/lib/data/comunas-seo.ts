import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { slugify } from "@/lib/utils";
import { calcDividendo, calcPrecioParaCuota } from "@/lib/analysis";
import { esTasaPlausible } from "@/lib/uf";
import { TASA_MERCADO_FALLBACK } from "@/lib/constants/subsidio";

function getSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Normalize encoding variants from scraped data to canonical names
const COMUNA_CANONICAL: Record<string, string> = {
  "Conchali": "Conchalí",
  "Estacion Central": "Estación Central",
  "Penalolen": "Peñalolén",
  "San Joaquin": "San Joaquín",
  "Maipu": "Maipú",
  "Nunoa": "Ñuñoa",
};

export function normalizeComunaName(raw: string): string {
  return COMUNA_CANONICAL[raw] || raw;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Banda de esfuerzo del descuento necesario. Los cortes son los de
 * `analysis-voice-franco` §1.12 — no se inventó un umbral propio.
 */
export type BandaEsfuerzo = "normal" | "con-argumentos" | "dificil" | "estructural";

/** Clasifica el descuento (en % positivo) según los cortes de la doctrina. */
export function bandaDeEsfuerzo(descuentoPct: number): BandaEsfuerzo {
  if (descuentoPct <= 5) return "normal";
  if (descuentoPct <= 12) return "con-argumentos";
  if (descuentoPct <= 25) return "dificil";
  return "estructural";
}

/**
 * La tipología que manda el titular de la comuna: la de más margen si alguna se
 * paga sola, y si ninguna lo hace, la que quedó más cerca. Vive acá y no en el
 * componente porque la usan el hero, la FAQ y el CTA — un solo criterio.
 */
export function tipologiaLider(tipologias: TipologiaStats[]): TipologiaStats | null {
  if (!tipologias.length) return null;
  const cubren = tipologias.filter((t) => t.cubre);
  const universo = cubren.length ? cubren : tipologias;
  // deltaPct MÁS ALTO = más margen si cubre, o menos descuento pendiente si no.
  return universo.reduce((a, b) => (b.deltaPct > a.deltaPct ? b : a));
}

/**
 * Una tipología (1D/2D/3D/4D) con muestra suficiente en la comuna.
 *
 * OJO CON LAS UNIDADES: los precios de acá son **UF del departamento completo**.
 * La sección de plusvalía de la misma página habla en **UF por m²** cuando la
 * fuente es GfK (ver `unidadPrecio` en `plusvalia-estimado.gen`). Son dos
 * unidades distintas a pocos centímetros: toda superficie que muestre estas
 * cifras tiene que rotularlas.
 */
export interface TipologiaStats {
  dorms: number;
  nArriendos: number;
  nVentas: number;
  /** Mediana de arriendo mensual, CLP. */
  arriendoCLP: number;
  /** Mediana de precio de venta del depto completo, CLP y UF. */
  ventaCLP: number;
  ventaUF: number;
  /** Rentabilidad bruta anual, %. */
  rentabilidadBruta: number;
  /** Cuota mensual del crédito a los supuestos declarados, CLP. */
  dividendoCLP: number;
  /** arriendo − dividendo. Positivo = se paga sola. */
  brechaCLP: number;
  cubre: boolean;
  /** Precio al que el arriendo cubre la cuota (NO el flujo completo). */
  precioCuotaCLP: number;
  precioCuotaUF: number;
  /** Distancia del precio de equilibrio a la mediana, %. Negativo = hay que bajar. */
  deltaPct: number;
  /** Pie que cerraría la brecha sin tocar el precio, %. Null si no aplica. */
  pieNecesarioPct: number | null;
  /** Banda de esfuerzo del descuento. Null cuando la tipología ya se paga sola. */
  banda: BandaEsfuerzo | null;
  /** Menos de 50 arriendos publicados: la mediana se mueve con pocos datos. */
  muestraChica: boolean;
}

/** Supuestos del crédito con los que se calculó el dividendo. Van SIEMPRE visibles. */
export interface SupuestosCredito {
  piePct: number;
  plazoAnos: number;
  /** % anual. Sale de `config.tasa_hipotecaria` (BCCh, cron diario). */
  tasaAnual: number;
  /** true si la tasa vino de la config; false si cayó al fallback del motor. */
  tasaEsViva: boolean;
  ufCLP: number;
}

/** De dónde sale el total de avisos que la página declara. */
export interface ProcedenciaMuestra {
  /** Avisos activos de la comuna, antes de cualquier filtro de cálculo. */
  activosTotales: number;
  /** Excluidos por no publicar superficie útil (0, null o > 300 m²). */
  sinSuperficie: number;
  /** Excluidos por estar fuera del rango de 1 a 4 dormitorios. */
  fueraDeRango: number;
  /** Excluidos por caer en una tipología que no llega al mínimo de muestra. */
  bajoUmbral: number;
  /** Los que efectivamente alimentan las cifras publicadas. */
  enCalculo: number;
  /** Fecha del scraping más reciente de la comuna (YYYY-MM-DD), o null. */
  ultimaActualizacion: string | null;
}

export interface ComunaStats {
  nombre: string;
  slug: string;
  totalPropiedades: number;
  arriendoRepresentativo: number; // CLP — promedio ponderado de medianas por segmento
  rentabilidadBruta: number;      // % — promedio ponderado por segmento
  precioM2Promedio: number;       // UF/m²
  arriendoUFm2Mes: number;        // UF/m²/mes — arriendo unitario
  nSegmentos: number;             // cuántos segmentos (dormitorios) contribuyen
  /** Desglose por tipología, ordenado por dormitorios. Omisión, nunca relleno:
   *  la tipología sin muestra suficiente NO aparece. */
  tipologias: TipologiaStats[];
  supuestos: SupuestosCredito;
  procedencia: ProcedenciaMuestra;
}

export const MIN_PER_TYPE = 20; // mínimo 20 arriendos Y 20 ventas por segmento
const MIN_TOTAL = 50;    // mínimo 50 propiedades totales por comuna
/** Menos de 50 arriendos: el doble del mínimo, donde la mediana deja de bailar. */
const MIN_ARRIENDOS_MUESTRA_SOLIDA = 50;

// Supuestos del crédito de las páginas de comuna. Van visibles en la página —
// cambiarlos acá cambia el dividendo y el precio de equilibrio de las 25.
export const PIE_PCT_COMUNA = 20;
export const PLAZO_ANOS_COMUNA = 30;

export interface RawRow {
  comuna: string;
  dormitorios: number;
  precio: number;
  moneda?: string;
  superficie_m2: number;
  scraped_at?: string;
}

/** Un aviso entra al cálculo, o no entra por una razón que la página declara. */
export function superficieUtil(r: RawRow): boolean {
  return r.superficie_m2 > 0 && r.superficie_m2 <= 300;
}
export function dormsEnRango(r: RawRow): boolean {
  return r.dormitorios >= 1 && r.dormitorios <= 4;
}

export async function fetchAllRows(supabase: ReturnType<typeof getSupabase>, type: "arriendo" | "venta"): Promise<RawRow[]> {
  const allRows: RawRow[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Los filtros de superficie y dormitorios salieron del SQL y se aplican en
    // memoria: la página declara CUÁNTOS avisos quedaron fuera y por qué, y para
    // contarlos hay que verlos. Los que sí entran al cálculo son exactamente los
    // mismos de antes — el filtro no cambió, cambió dónde se aplica.
    const { data, error } = await supabase
      .from("scraped_properties")
      .select("comuna, dormitorios, precio, moneda, superficie_m2, scraped_at")
      .eq("type", type)
      .eq("is_active", true)
      .gt("precio", 0)
      .range(offset, offset + pageSize - 1);
    // Un error a mitad de la paginación cortaba el loop en silencio: las páginas SEO
    // computaban stats sobre datos PARCIALES sin que nada lo dijera.
    reportarFalloQuery(error, { ruta: "lib/data/comunas-seo", operacion: `paginar-scraped-${type}`, tags: { offset: String(offset) } });

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows.push(...data);
      offset += pageSize;
      if (data.length < pageSize) hasMore = false;
    }
  }
  return allRows;
}

interface SegmentResult {
  comuna: string;
  dorms: number;
  nArr: number;
  nVen: number;
  medianaArriendo: number;
  medianaVenta: number;
  rentBruta: number;
  medianaM2UF: number;
  medianaArriendoUFm2: number; // UF/m²/mes
}

/** Lo que el cómputo deja listo para armar las ComunaStats. */
interface SegmentsBundle {
  segments: SegmentResult[];
  supuestos: SupuestosCredito;
  /** Contadores de procedencia por comuna, antes de aplicar el umbral. */
  crudos: Map<string, { activos: number; sinSup: number; fueraRango: number; entran: number; fecha: string | null }>;
}

async function computeAllSegments(): Promise<SegmentsBundle> {
  const supabase = getSupabase();

  // Get UF value — config stores CLP value, sanity check it's in expected range
  const { data: configData, error: configError } = await supabase
    .from("config")
    .select("value")
    .eq("key", "uf_value")
    .single();
  reportarFalloQuery(configError, { ruta: "lib/data/comunas-seo", operacion: "leer-uf-config" });
  const rawUF = parseFloat(configData?.value || "0");
  const ufValue = rawUF > 30000 && rawUF < 50000 ? rawUF : 38800;

  // Tasa hipotecaria VIVA: la escribe el cron diario /api/data/update-market
  // desde la serie del Banco Central, con guard de plausibilidad. Si no está o
  // no es plausible, cae al fallback del motor y la página lo declara.
  const { data: tasaRow, error: tasaError } = await supabase
    .from("config")
    .select("value")
    .eq("key", "tasa_hipotecaria")
    .single();
  reportarFalloQuery(tasaError, { ruta: "lib/data/comunas-seo", operacion: "leer-tasa-config" });
  const tasaCruda = parseFloat(tasaRow?.value || "");
  const tasaEsViva = esTasaPlausible(tasaCruda);
  const tasaAnual = tasaEsViva ? tasaCruda : TASA_MERCADO_FALLBACK;

  const supuestos: SupuestosCredito = {
    piePct: PIE_PCT_COMUNA,
    plazoAnos: PLAZO_ANOS_COMUNA,
    tasaAnual,
    tasaEsViva,
    ufCLP: ufValue,
  };

  // Fetch all active properties
  const arriendoRowsRaw = await fetchAllRows(supabase, "arriendo");
  const ventaRowsRaw = await fetchAllRows(supabase, "venta");

  // Normalize comuna names
  arriendoRowsRaw.forEach((r) => { r.comuna = normalizeComunaName(r.comuna); });
  ventaRowsRaw.forEach((r) => { r.comuna = normalizeComunaName(r.comuna); });

  // Clasificación de procedencia + filtro en memoria. El aviso que no entra al
  // cálculo se cuenta por SU razón, para que la página pueda decirla.
  const crudos = new Map<string, { activos: number; sinSup: number; fueraRango: number; entran: number; fecha: string | null }>();
  const clasificar = (rows: RawRow[]): RawRow[] => {
    const pasan: RawRow[] = [];
    for (const r of rows) {
      if (!crudos.has(r.comuna)) crudos.set(r.comuna, { activos: 0, sinSup: 0, fueraRango: 0, entran: 0, fecha: null });
      const c = crudos.get(r.comuna)!;
      c.activos++;
      const d = (r.scraped_at || "").slice(0, 10);
      if (d && (!c.fecha || d > c.fecha)) c.fecha = d;
      const okSup = superficieUtil(r);
      const okDorms = dormsEnRango(r);
      // Un aviso puede fallar las dos: se cuenta en ambas razones, y por eso la
      // página nunca resta los excluidos — publica el total y el desglose.
      if (!okSup) c.sinSup++;
      if (!okDorms) c.fueraRango++;
      if (okSup && okDorms) { c.entran++; pasan.push(r); }
    }
    return pasan;
  };
  const arriendoRows = clasificar(arriendoRowsRaw);
  const ventaRows = clasificar(ventaRowsRaw);

  // Group by comuna + dormitorios
  type GroupKey = string; // "comuna|dorms"
  const arrGroups = new Map<GroupKey, { precios: number[]; ufm2: number[] }>();
  const venGroups = new Map<GroupKey, { precios: number[]; m2: number[] }>();

  for (const r of arriendoRows) {
    const key = `${r.comuna}|${r.dormitorios}`;
    if (!arrGroups.has(key)) arrGroups.set(key, { precios: [], ufm2: [] });
    const g = arrGroups.get(key)!;
    g.precios.push(r.precio);
    if (r.superficie_m2 > 0) {
      g.ufm2.push(r.precio / r.superficie_m2 / ufValue); // UF/m²/mes
    }
  }

  for (const r of ventaRows) {
    const key = `${r.comuna}|${r.dormitorios}`;
    if (!venGroups.has(key)) venGroups.set(key, { precios: [], m2: [] });
    const g = venGroups.get(key)!;
    const precioCLP = r.moneda === "UF" ? r.precio * ufValue : r.precio;
    g.precios.push(precioCLP);
    if (r.superficie_m2 > 0) {
      g.m2.push(precioCLP / r.superficie_m2 / ufValue); // UF/m²
    }
  }

  // Calculate per-segment stats
  const segments: SegmentResult[] = [];
  const allKeys = new Set([...Array.from(arrGroups.keys()), ...Array.from(venGroups.keys())]);

  for (const key of Array.from(allKeys)) {
    const [comuna, dormsStr] = key.split("|");
    const dorms = parseInt(dormsStr);
    const arrData = arrGroups.get(key);
    const arrPrecios = arrData?.precios ?? [];
    const venData = venGroups.get(key);
    const venPrecios = venData?.precios ?? [];

    if (arrPrecios.length < MIN_PER_TYPE || venPrecios.length < MIN_PER_TYPE) continue;

    const medianaArriendo = median(arrPrecios);
    const medianaVenta = median(venPrecios);
    const medianaM2UF = venData?.m2.length ? median(venData.m2) : 0;
    const medianaArriendoUFm2 = arrData?.ufm2.length ? median(arrData.ufm2) : 0;

    if (medianaVenta <= 0 || medianaM2UF <= 0) continue;

    segments.push({
      comuna,
      dorms,
      nArr: arrPrecios.length,
      nVen: venPrecios.length,
      medianaArriendo,
      medianaVenta,
      rentBruta: (medianaArriendo * 12 / medianaVenta) * 100,
      medianaM2UF,
      medianaArriendoUFm2,
    });
  }

  return { segments, supuestos, crudos };
}

/**
 * Deriva la capa de palanca de un segmento: dividendo, brecha, precio al que el
 * arriendo cubre la cuota, y las dos vías para llegar (descuento o pie).
 * Todo sale del motor — `calcDividendo` y su inverso `calcPrecioParaCuota`.
 */
function construirTipologia(seg: SegmentResult, s: SupuestosCredito): TipologiaStats {
  const financiamiento = (100 - s.piePct) / 100;
  const dividendoCLP = calcDividendo(seg.medianaVenta * financiamiento, s.tasaAnual, s.plazoAnos);
  const brechaCLP = Math.round(seg.medianaArriendo - dividendoCLP);
  const cubre = seg.medianaArriendo >= dividendoCLP;

  const precioCuotaCLP = calcPrecioParaCuota(seg.medianaArriendo, s.piePct, s.tasaAnual, s.plazoAnos);
  const deltaPct = seg.medianaVenta > 0
    ? ((precioCuotaCLP - seg.medianaVenta) / seg.medianaVenta) * 100
    : 0;

  // Pie que cerraría la brecha SIN tocar el precio. El dividendo es lineal en el
  // crédito, así que basta escalar el financiamiento en la razón arriendo/cuota:
  //   financiamiento' = financiamiento × arriendo / dividendo
  // Es el mismo factor de amortización, despejado por el otro lado. Solo se
  // ofrece cuando hoy no se paga sola y el pie resultante es algo que alguien
  // podría poner.
  let pieNecesarioPct: number | null = null;
  if (!cubre && dividendoCLP > 0) {
    const pieExacto = 100 * (1 - (financiamiento * seg.medianaArriendo) / dividendoCLP);
    pieNecesarioPct = pieExacto > 0 && pieExacto < 100 ? Math.round(pieExacto) : null;
  }

  return {
    dorms: seg.dorms,
    nArriendos: seg.nArr,
    nVentas: seg.nVen,
    arriendoCLP: Math.round(seg.medianaArriendo),
    ventaCLP: Math.round(seg.medianaVenta),
    ventaUF: Math.round(seg.medianaVenta / s.ufCLP),
    rentabilidadBruta: Math.round(seg.rentBruta * 10) / 10,
    dividendoCLP,
    brechaCLP,
    cubre,
    precioCuotaCLP: Math.round(precioCuotaCLP),
    precioCuotaUF: Math.round(precioCuotaCLP / s.ufCLP),
    deltaPct: Math.round(deltaPct * 10) / 10,
    pieNecesarioPct,
    banda: cubre ? null : bandaDeEsfuerzo(Math.abs(deltaPct)),
    muestraChica: seg.nArr < MIN_ARRIENDOS_MUESTRA_SOLIDA,
  };
}

function aggregateByComunas(bundle: SegmentsBundle): ComunaStats[] {
  const { segments, supuestos, crudos } = bundle;
  // Group segments by comuna
  const comunaMap = new Map<string, SegmentResult[]>();
  for (const seg of segments) {
    if (!comunaMap.has(seg.comuna)) comunaMap.set(seg.comuna, []);
    comunaMap.get(seg.comuna)!.push(seg);
  }

  const results: ComunaStats[] = [];

  for (const [comuna, segs] of Array.from(comunaMap.entries())) {
    let totalWeight = 0;
    let sumRent = 0;
    let sumArriendo = 0;
    let sumM2 = 0;
    let sumArrUFm2 = 0;
    let arrUFm2Weight = 0;
    let totalProps = 0;

    for (const seg of segs) {
      const weight = seg.nArr + seg.nVen;
      totalWeight += weight;
      sumRent += seg.rentBruta * weight;
      sumArriendo += seg.medianaArriendo * weight;
      sumM2 += seg.medianaM2UF * weight;
      totalProps += weight;
      if (seg.medianaArriendoUFm2 > 0) {
        sumArrUFm2 += seg.medianaArriendoUFm2 * seg.nArr;
        arrUFm2Weight += seg.nArr;
      }
    }

    if (totalWeight === 0 || totalProps < MIN_TOTAL) continue;

    const crudo = crudos.get(comuna);
    const activosTotales = crudo?.activos ?? totalProps;
    const enCalculo = crudo?.entran ?? totalProps;
    const procedencia: ProcedenciaMuestra = {
      activosTotales,
      sinSuperficie: crudo?.sinSup ?? 0,
      fueraDeRango: crudo?.fueraRango ?? 0,
      // Lo que pasó los filtros pero cayó en una tipología sin muestra mínima.
      bajoUmbral: Math.max(0, enCalculo - totalProps),
      enCalculo: totalProps,
      ultimaActualizacion: crudo?.fecha ?? null,
    };

    results.push({
      nombre: comuna,
      slug: slugify(comuna),
      totalPropiedades: totalProps,
      arriendoRepresentativo: Math.round(sumArriendo / totalWeight),
      rentabilidadBruta: Math.round((sumRent / totalWeight) * 10) / 10,
      precioM2Promedio: Math.round((sumM2 / totalWeight) * 10) / 10,
      arriendoUFm2Mes: arrUFm2Weight > 0 ? Math.round((sumArrUFm2 / arrUFm2Weight) * 1000) / 1000 : 0,
      nSegmentos: segs.length,
      tipologias: segs
        .slice()
        .sort((a, b) => a.dorms - b.dorms)
        .map((seg) => construirTipologia(seg, supuestos)),
      supuestos,
      procedencia,
    });
  }

  results.sort((a, b) => b.rentabilidadBruta - a.rentabilidadBruta);
  return results;
}

// Cache segments in memory for the duration of a single build/request cycle
let cachedSegments: SegmentsBundle | null = null;

async function getSegments(): Promise<SegmentsBundle> {
  if (!cachedSegments) {
    cachedSegments = await computeAllSegments();
  }
  return cachedSegments;
}

export async function getAllComunasStats(): Promise<ComunaStats[]> {
  const bundle = await getSegments();
  return aggregateByComunas(bundle);
}

export async function getComunaStats(comunaSlug: string): Promise<ComunaStats | null> {
  const all = await getAllComunasStats();
  return all.find((c) => c.slug === comunaSlug) ?? null;
}

/** Format CLP with thousands separator */
export function fmtCLP(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(Math.round(n)).toLocaleString("es-CL");
}

/** Format UF */
export function fmtUF(n: number): string {
  if (Math.abs(n) >= 100) return `UF ${Math.round(n).toLocaleString("es-CL")}`;
  return `UF ${n.toFixed(1).replace(".", ",")}`;
}

export const UF_CLP = 38800;
