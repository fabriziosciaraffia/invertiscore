import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/utils";

function getSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const UF_CLP = 38800;

// Normalize encoding variants from scraped data to canonical names
const COMUNA_CANONICAL: Record<string, string> = {
  "Conchali": "Conchalí",
  "Conchal\uFFFD": "Conchalí",
  "Estacion Central": "Estación Central",
  "Estaci\uFFFDn Central": "Estación Central",
  "Penalolen": "Peñalolén",
  "Pe\uFFFDalol\uFFFDn": "Peñalolén",
  "San Joaquin": "San Joaquín",
  "San Joaqu\uFFFDn": "San Joaquín",
  "Maipu": "Maipú",
  "Maip\uFFFD": "Maipú",
  "Nunoa": "Ñuñoa",
  "\uFFFDu\uFFFDoa": "Ñuñoa",
};

function normalizeComunaName(raw: string): string {
  return COMUNA_CANONICAL[raw] || raw;
}

export interface ComunaStats {
  nombre: string;
  slug: string;
  totalPropiedades: number;
  arriendoPromedio: number;
  ventaPromedio: number;
  precioM2Promedio: number;
  rentabilidadBruta: number;
}

export async function getComunaStats(comunaSlug: string): Promise<ComunaStats | null> {
  const supabase = getSupabase();

  // Fetch all rows and normalize in JS (can't normalize in SQL)
  const { data: arriendoRows } = await supabase
    .from("market_stats")
    .select("*")
    .eq("type", "arriendo");

  const { data: ventaRows } = await supabase
    .from("market_stats")
    .select("*")
    .eq("type", "venta");

  if (!arriendoRows) return null;

  // Normalize names
  arriendoRows.forEach((r) => { r.comuna = normalizeComunaName(r.comuna); });
  ventaRows?.forEach((r) => { r.comuna = normalizeComunaName(r.comuna); });

  // Find canonical name matching slug
  const uniqueComunas = Array.from(new Set(arriendoRows.map((r) => r.comuna)));
  const comunaNombre = uniqueComunas.find((c) => slugify(c) === comunaSlug);
  if (!comunaNombre) return null;

  // Filter rows for this comuna (now normalized, may combine multiple DB rows)
  const arrFiltered = arriendoRows.filter((r) => r.comuna === comunaNombre);
  const venFiltered = ventaRows?.filter((r) => r.comuna === comunaNombre) ?? [];

  const arrTotal = arrFiltered.reduce((s, r) => s + (r.count || 0), 0);
  const arrProm = arrTotal > 0
    ? arrFiltered.reduce((s, r) => s + (r.precio_mediana || 0) * (r.count || 0), 0) / arrTotal
    : 0;

  const venTotal = venFiltered.reduce((s, r) => s + (r.count || 0), 0);
  const venProm = venTotal > 0
    ? venFiltered.reduce((s, r) => s + (r.precio_mediana || 0) * (r.count || 0), 0) / venTotal
    : 0;
  const m2Prom = venTotal > 0
    ? venFiltered.reduce((s, r) => s + (r.precio_m2_mediana || 0) * (r.count || 0), 0) / venTotal
    : 0;

  const rentBruta = venProm > 0 ? (arrProm * 12 / venProm) * 100 : 0;

  if (arrTotal === 0 || venTotal === 0) return null;

  return {
    nombre: comunaNombre,
    slug: comunaSlug,
    totalPropiedades: arrTotal + venTotal,
    arriendoPromedio: Math.round(arrProm),
    ventaPromedio: Math.round(venProm),
    precioM2Promedio: Math.round((m2Prom / UF_CLP) * 10) / 10,
    rentabilidadBruta: Math.round(rentBruta * 10) / 10,
  };
}

export async function getAllComunasStats(): Promise<ComunaStats[]> {
  const supabase = getSupabase();

  const { data: arriendoRows } = await supabase
    .from("market_stats")
    .select("*")
    .eq("type", "arriendo");

  const { data: ventaRows } = await supabase
    .from("market_stats")
    .select("*")
    .eq("type", "venta");

  if (!arriendoRows?.length) return [];

  // Normalize names
  arriendoRows.forEach((r) => { r.comuna = normalizeComunaName(r.comuna); });
  ventaRows?.forEach((r) => { r.comuna = normalizeComunaName(r.comuna); });

  // Group by normalized comuna
  const comunaSet = new Set<string>();
  arriendoRows.forEach((r) => comunaSet.add(r.comuna));
  ventaRows?.forEach((r) => comunaSet.add(r.comuna));
  const comunaNames = Array.from(comunaSet);

  const results: ComunaStats[] = [];

  for (const comuna of comunaNames) {
    const arrRows = arriendoRows.filter((r) => r.comuna === comuna);
    const venRows = ventaRows?.filter((r) => r.comuna === comuna) ?? [];

    const arrTotal = arrRows.reduce((s, r) => s + (r.count || 0), 0);
    const arrProm = arrTotal > 0
      ? arrRows.reduce((s, r) => s + (r.precio_mediana || 0) * (r.count || 0), 0) / arrTotal
      : 0;

    const venTotal = venRows.reduce((s, r) => s + (r.count || 0), 0);
    const venProm = venTotal > 0
      ? venRows.reduce((s, r) => s + (r.precio_mediana || 0) * (r.count || 0), 0) / venTotal
      : 0;
    const m2Prom = venTotal > 0
      ? venRows.reduce((s, r) => s + (r.precio_m2_mediana || 0) * (r.count || 0), 0) / venTotal
      : 0;

    const rentBruta = venProm > 0 ? (arrProm * 12 / venProm) * 100 : 0;
    const total = arrTotal + venTotal;

    // Require both arriendo and venta data, minimum 5 total
    if (arrTotal === 0 || venTotal === 0 || total < 5) continue;

    results.push({
      nombre: comuna,
      slug: slugify(comuna),
      totalPropiedades: total,
      arriendoPromedio: Math.round(arrProm),
      ventaPromedio: Math.round(venProm),
      precioM2Promedio: Math.round((m2Prom / UF_CLP) * 10) / 10,
      rentabilidadBruta: Math.round(rentBruta * 10) / 10,
    });
  }

  results.sort((a, b) => b.rentabilidadBruta - a.rentabilidadBruta);
  return results;
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

export { UF_CLP };
