import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeTocTocMap, scrapeTocTocAPI, scrapeTocToc, getComunasBatch, TOTAL_BATCHES, ScrapedProperty } from "@/lib/services/scraper/toctoc";

// Vercel Hobby permite hasta 60s. Sin esto, el techo es 10s y una corrida real
// (1 comuna x 5 páginas, ~11s) lo supera. Necesario antes de subir BATCH_SIZE/maxPages.
export const maxDuration = 60;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any>>;

function getSupabase(): AnySupabase {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
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
  let method = ""; // refleja el método que efectivamente trajo datos (primer type con >0)

  for (const type of types) {
    // a. Map API (GetProps, hasta 510 props con coords) — primer intento
    const mapResult = await scrapeTocTocMap(type, comunas);
    allErrors.push(...mapResult.errors);
    let result = mapResult;
    let localMethod = "map-getprops";

    // b. API paginada (gw-lista-seo) si Map no trajo nada
    if (result.properties.length === 0) {
      const apiResult = await scrapeTocTocAPI(type, comunas, maxPages);
      allErrors.push(...apiResult.errors); // preservar errores/DEBUG de la API
      result = apiResult;
      localMethod = "api-paginated";
    }

    // c. Fallback __NEXT_DATA__ si los dos anteriores fallaron
    if (result.properties.length === 0) {
      result = await scrapeTocToc(type, comunas);
      localMethod = "listing-fallback";
      allErrors.push(...result.errors); // errores del fallback aparte
    }

    // d. Acumular; method = primer type que trajo datos
    allProperties.push(...result.properties);
    if (!method && result.properties.length > 0) {
      method = localMethod;
    }
  }

  if (!method) method = "none"; // ningún type trajo datos

  const t1 = Date.now();

  // --- BULK UPSERT ---
  const validProps = allProperties.filter(p => p.precio > 0);
  const skipped = allProperties.length - validProps.length;
  let inserted = 0;

  const allRows = validProps.map(propertyToRow);
  // Dedup por source+source_id (un aviso puede repetirse entre paginas); ultima ocurrencia gana.
  const rowsByKey = new Map<string, typeof allRows[number]>();
  for (const r of allRows) rowsByKey.set(`${r.source}|${r.source_id}`, r);
  const rows = Array.from(rowsByKey.values());

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

// Vercel Cron dispara GET. Reusamos el handler POST (con su validación Bearer
// CRON_SECRET) para no duplicar lógica ni perder la auth.
export const GET = POST;
