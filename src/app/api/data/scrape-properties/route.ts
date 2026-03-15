import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeTocToc, ScrapedProperty } from "@/lib/services/scraper/toctoc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any>>;

function getSupabase(): AnySupabase {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  // Scrapear arriendos y ventas
  const arriendoResult = await scrapeTocToc("arriendo");
  const ventaResult = await scrapeTocToc("venta");

  const allProperties = [...arriendoResult.properties, ...ventaResult.properties];
  const allErrors = [...arriendoResult.errors, ...ventaResult.errors];

  let inserted = 0;
  let skipped = 0;

  for (const prop of allProperties) {
    if (prop.precio <= 0) { skipped++; continue; }

    const row = propertyToRow(prop);
    const { error } = await supabase
      .from("scraped_properties")
      .upsert(row, { onConflict: "source,source_id" });

    if (error) {
      allErrors.push(`DB insert ${prop.sourceId}: ${error.message}`);
      skipped++;
    } else {
      inserted++;
    }
  }

  // Actualizar market_stats después del scraping
  await updateMarketStats(supabase);

  return NextResponse.json({
    success: true,
    inserted,
    skipped,
    totalScraped: allProperties.length,
    errors: allErrors.slice(0, 20),
  });
}

function propertyToRow(prop: ScrapedProperty) {
  return {
    source: prop.source,
    source_id: prop.sourceId,
    type: prop.type,
    comuna: prop.comuna,
    direccion: prop.direccion || null,
    lat: prop.lat || null,
    lng: prop.lng || null,
    precio: prop.precio,
    moneda: prop.moneda,
    superficie_m2: prop.superficieM2 || null,
    dormitorios: prop.dormitorios || null,
    banos: prop.banos || null,
    gastos_comunes: prop.gastosComunes || null,
    estacionamientos: prop.estacionamientos || null,
    bodegas: prop.bodegas || null,
    piso: prop.piso || null,
    antiguedad: prop.antiguedad || null,
    url: prop.url || null,
    is_active: true,
    scraped_at: new Date().toISOString(),
  };
}

interface PropertyRow {
  comuna: string;
  dormitorios: number | null;
  type: string;
  precio: number;
  superficie_m2: number | null;
  gastos_comunes: number | null;
}

async function updateMarketStats(supabase: AnySupabase) {
  const { data: properties } = await supabase
    .from("scraped_properties")
    .select("comuna, dormitorios, type, precio, superficie_m2, gastos_comunes")
    .eq("is_active", true)
    .not("precio", "is", null) as { data: PropertyRow[] | null };

  if (!properties || properties.length === 0) return;

  const groups: Record<string, PropertyRow[]> = {};

  for (const p of properties) {
    const key = `${p.comuna}|${p.dormitorios || 0}|${p.type}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  for (const key of Object.keys(groups)) {
    const items = groups[key];
    const [comuna, dormStr, type] = key.split("|");
    const dormitorios = parseInt(dormStr);

    if (items.length < 3) continue;

    const precios = items.map((i: PropertyRow) => i.precio).sort((a: number, b: number) => a - b);
    const preciosM2 = items
      .filter((i: PropertyRow) => i.superficie_m2 && i.superficie_m2 > 0)
      .map((i: PropertyRow) => i.precio / i.superficie_m2!)
      .sort((a: number, b: number) => a - b);
    const ggccs = items
      .filter((i: PropertyRow) => i.gastos_comunes && i.gastos_comunes > 0)
      .map((i: PropertyRow) => i.gastos_comunes!);
    const superficies = items
      .filter((i: PropertyRow) => i.superficie_m2 && i.superficie_m2 > 0)
      .map((i: PropertyRow) => i.superficie_m2!);

    const mid = Math.floor(precios.length / 2);
    const p25idx = Math.floor(precios.length * 0.25);
    const p75idx = Math.floor(precios.length * 0.75);

    await supabase.from("market_stats").upsert({
      comuna,
      dormitorios: dormitorios || null,
      type,
      count: items.length,
      precio_promedio: Math.round(precios.reduce((a: number, b: number) => a + b, 0) / precios.length),
      precio_mediana: precios[mid],
      precio_p25: precios[p25idx],
      precio_p75: precios[p75idx],
      precio_m2_promedio: preciosM2.length > 0 ? Math.round(preciosM2.reduce((a: number, b: number) => a + b, 0) / preciosM2.length) : null,
      precio_m2_mediana: preciosM2.length > 0 ? preciosM2[Math.floor(preciosM2.length / 2)] : null,
      ggcc_promedio: ggccs.length > 0 ? Math.round(ggccs.reduce((a: number, b: number) => a + b, 0) / ggccs.length) : null,
      superficie_promedio: superficies.length > 0 ? Math.round(superficies.reduce((a: number, b: number) => a + b, 0) / superficies.length) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "comuna,dormitorios,type" });
  }
}
