import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any>>;

function getSupabase(): AnySupabase {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface PropertyRow {
  comuna: string;
  type: string;
  precio: number;
  moneda: string;
  superficie_m2: number | null;
  dormitorios: number | null;
  gastos_comunes: number | null;
}

export async function calculateMarketStats() {
  const supabase = getSupabase();

  const { data: properties, error } = await supabase
    .from("scraped_properties")
    .select("comuna, type, precio, moneda, superficie_m2, dormitorios, gastos_comunes")
    .eq("is_active", true) as { data: PropertyRow[] | null; error: { message: string } | null };

  if (error || !properties || properties.length === 0) {
    return { error: error?.message || "No properties found" };
  }

  // Agrupar por comuna + type + dormitorios
  // Incluir grupo general (dormitorios=null) y por dormitorio
  const groups = new Map<string, PropertyRow[]>();

  for (const prop of properties) {
    if (prop.precio <= 0) continue;

    // Grupo general de la comuna
    const keyGeneral = `${prop.comuna}|null|${prop.type}`;
    if (!groups.has(keyGeneral)) groups.set(keyGeneral, []);
    groups.get(keyGeneral)!.push(prop);

    // Grupo por dormitorios
    if (prop.dormitorios) {
      const keyDorm = `${prop.comuna}|${prop.dormitorios}|${prop.type}`;
      if (!groups.has(keyDorm)) groups.set(keyDorm, []);
      groups.get(keyDorm)!.push(prop);
    }
  }

  let upserted = 0;
  for (const [key, props] of Array.from(groups.entries())) {
    const [comuna, dormStr, type] = key.split("|");
    const dormitorios = dormStr === "null" ? null : parseInt(dormStr);

    const precios = props.map(p => p.precio).sort((a, b) => a - b);
    if (precios.length === 0) continue;

    const preciosM2 = props
      .filter(p => p.superficie_m2 && p.superficie_m2 > 0 && p.precio > 0)
      .map(p => p.precio / p.superficie_m2!)
      .sort((a, b) => a - b);

    const ggccs = props
      .filter(p => p.gastos_comunes && p.gastos_comunes > 0)
      .map(p => p.gastos_comunes!)
      .sort((a, b) => a - b);

    const superficies = props
      .filter(p => p.superficie_m2 && p.superficie_m2 > 0)
      .map(p => p.superficie_m2!);

    const stats = {
      comuna,
      dormitorios,
      type,
      count: props.length,
      precio_promedio: Math.round(average(precios)),
      precio_mediana: Math.round(median(precios)),
      precio_p25: Math.round(percentile(precios, 25)),
      precio_p75: Math.round(percentile(precios, 75)),
      precio_m2_promedio: preciosM2.length > 0 ? Math.round(average(preciosM2)) : null,
      precio_m2_mediana: preciosM2.length > 0 ? Math.round(median(preciosM2)) : null,
      ggcc_promedio: ggccs.length > 0 ? Math.round(average(ggccs)) : null,
      superficie_promedio: superficies.length > 0 ? Math.round(average(superficies)) : null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("market_stats")
      .upsert(stats, { onConflict: "comuna,dormitorios,type" });

    if (!upsertError) upserted++;
  }

  return { success: true, groups: groups.size, upserted };
}

function average(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  const index = Math.ceil((p / 100) * arr.length) - 1;
  return arr[Math.max(0, index)];
}
