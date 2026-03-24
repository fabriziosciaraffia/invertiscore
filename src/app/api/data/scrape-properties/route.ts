import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeTocTocAPI, scrapeTocToc, getComunasBatch, TOTAL_BATCHES, ScrapedProperty } from "@/lib/services/scraper/toctoc";


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

  const t0 = Date.now();

  // --- SCRAPING ---
  const maxPages = parseInt(url.searchParams.get("maxPages") || "5");
  const types: ("arriendo" | "venta")[] = typeParam === "arriendo" ? ["arriendo"] : typeParam === "venta" ? ["venta"] : ["arriendo", "venta"];
  let method = "api-paginated";

  for (const type of types) {
    // Intentar API paginada primero
    let result = await scrapeTocTocAPI(type, comunas, maxPages);
    if (result.properties.length === 0) {
      // Fallback al método __NEXT_DATA__
      result = await scrapeTocToc(type, comunas);
      method = "listing-fallback";
    }
    allProperties.push(...result.properties);
    allErrors.push(...result.errors);
  }

  const t1 = Date.now();

  // --- BULK UPSERT ---
  const validProps = allProperties.filter(p => p.precio > 0);
  const skipped = allProperties.length - validProps.length;
  let inserted = 0;

  const rows = validProps.map(propertyToRow);

  if (rows.length > 0) {
    const { error } = await supabase
      .from("scraped_properties")
      .upsert(rows, { onConflict: "source,source_id" });

    if (error) {
      allErrors.push(`Bulk upsert error: ${error.message}`);
    } else {
      inserted = rows.length;
    }
  }

  const t2 = Date.now();

  // Stats se recalculan via /api/data/calculate-stats (separado)
  const statsResult = { skipped: "run /api/data/calculate-stats separately" };

  const t3 = Date.now();

  return NextResponse.json({
    success: true,
    batch,
    totalBatches: TOTAL_BATCHES,
    comunas,
    method,
    inserted,
    skipped,
    totalScraped: allProperties.length,
    withCoords: allProperties.filter(p => p.lat && p.lng).length,
    errors: allErrors.slice(0, 20),
    stats: statsResult,
    timing: {
      scrape_ms: t1 - t0,
      upsert_ms: t2 - t1,
      stats_ms: t3 - t2,
      total_ms: t3 - t0,
    },
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
    condicion: prop.condicion || "usado",
    is_active: true,
    scraped_at: new Date().toISOString(),
    geocode_attempted: false,
  };
}
