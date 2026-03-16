import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeTocToc, getComunasBatch, TOTAL_BATCHES, ScrapedProperty } from "@/lib/services/scraper/toctoc";
import { calculateMarketStats } from "@/lib/services/scraper/stats";

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

  const url = new URL(request.url);

  // Batch: explícito o auto-rotación por día del mes
  let batch: number;
  if (url.searchParams.has("batch")) {
    batch = parseInt(url.searchParams.get("batch")!);
  } else {
    batch = new Date().getDate() % TOTAL_BATCHES;
  }
  const comunas = getComunasBatch(batch);

  // Tipo: arriendo (default), venta, o ambos
  const typeParam = url.searchParams.get("type");

  const supabase = getSupabase();

  const allProperties: ScrapedProperty[] = [];
  const allErrors: string[] = [];

  const types: ("arriendo" | "venta")[] =
    typeParam === "arriendo" || typeParam === "venta" ? [typeParam] : ["arriendo", "venta"];

  for (const t of types) {
    const result = await scrapeTocToc(t, comunas);
    allProperties.push(...result.properties);
    allErrors.push(...result.errors);
  }

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

  // Recalcular estadísticas de mercado
  const statsResult = await calculateMarketStats();

  return NextResponse.json({
    success: true,
    batch,
    totalBatches: TOTAL_BATCHES,
    comunas,
    method: "listing",
    inserted,
    skipped,
    totalScraped: allProperties.length,
    withCoords: allProperties.filter(p => p.lat && p.lng).length,
    errors: allErrors.slice(0, 20),
    stats: statsResult,
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
