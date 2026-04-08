import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/utils";

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

function normalizeComunaName(raw: string): string {
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

export interface ComunaStats {
  nombre: string;
  slug: string;
  totalPropiedades: number;
  arriendoRepresentativo: number; // CLP — promedio ponderado de medianas por segmento
  rentabilidadBruta: number;      // % — promedio ponderado por segmento
  precioM2Promedio: number;       // UF/m²
  arriendoUFm2Mes: number;        // UF/m²/mes — arriendo unitario
  nSegmentos: number;             // cuántos segmentos (dormitorios) contribuyen
}

const MIN_PER_TYPE = 20; // mínimo 20 arriendos Y 20 ventas por segmento
const MIN_TOTAL = 50;    // mínimo 50 propiedades totales por comuna

interface RawRow {
  comuna: string;
  dormitorios: number;
  precio: number;
  moneda?: string;
  superficie_m2: number;
}

async function fetchAllRows(supabase: ReturnType<typeof getSupabase>, type: "arriendo" | "venta"): Promise<RawRow[]> {
  const allRows: RawRow[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from("scraped_properties")
      .select("comuna, dormitorios, precio, moneda, superficie_m2")
      .eq("type", type)
      .eq("is_active", true)
      .gt("precio", 0)
      .gt("superficie_m2", 0)
      .lte("superficie_m2", 300)
      .gte("dormitorios", 1)
      .lte("dormitorios", 4)
      .range(offset, offset + pageSize - 1);

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

async function computeAllSegments(): Promise<SegmentResult[]> {
  const supabase = getSupabase();

  // Get UF value — config stores CLP value, sanity check it's in expected range
  const { data: configData } = await supabase
    .from("config")
    .select("value")
    .eq("key", "uf_value")
    .single();
  const rawUF = parseFloat(configData?.value || "0");
  const ufValue = rawUF > 30000 && rawUF < 50000 ? rawUF : 38800;

  // Fetch all active properties
  const arriendoRows = await fetchAllRows(supabase, "arriendo");
  const ventaRows = await fetchAllRows(supabase, "venta");

  // Normalize comuna names
  arriendoRows.forEach((r) => { r.comuna = normalizeComunaName(r.comuna); });
  ventaRows.forEach((r) => { r.comuna = normalizeComunaName(r.comuna); });

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

  return segments;
}

function aggregateByComunas(segments: SegmentResult[]): ComunaStats[] {
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

    results.push({
      nombre: comuna,
      slug: slugify(comuna),
      totalPropiedades: totalProps,
      arriendoRepresentativo: Math.round(sumArriendo / totalWeight),
      rentabilidadBruta: Math.round((sumRent / totalWeight) * 10) / 10,
      precioM2Promedio: Math.round((sumM2 / totalWeight) * 10) / 10,
      arriendoUFm2Mes: arrUFm2Weight > 0 ? Math.round((sumArrUFm2 / arrUFm2Weight) * 1000) / 1000 : 0,
      nSegmentos: segs.length,
    });
  }

  results.sort((a, b) => b.rentabilidadBruta - a.rentabilidadBruta);
  return results;
}

// Cache segments in memory for the duration of a single build/request cycle
let cachedSegments: SegmentResult[] | null = null;

async function getSegments(): Promise<SegmentResult[]> {
  if (!cachedSegments) {
    cachedSegments = await computeAllSegments();
  }
  return cachedSegments;
}

export async function getAllComunasStats(): Promise<ComunaStats[]> {
  const segments = await getSegments();
  return aggregateByComunas(segments);
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
