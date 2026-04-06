import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_PROPERTIES = 500;

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

  const body = await request.json();
  const properties = body?.properties;

  if (!Array.isArray(properties) || properties.length === 0) {
    return NextResponse.json({ error: "properties array required" }, { status: 400 });
  }

  if (properties.length > MAX_PROPERTIES) {
    return NextResponse.json({ error: `Max ${MAX_PROPERTIES} properties per call` }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const rows = properties
    .filter((p: Record<string, unknown>) => p.source && p.source_id && p.precio)
    .map((p: Record<string, unknown>) => ({
      source: p.source,
      source_id: p.source_id,
      type: p.type || "arriendo",
      comuna: p.comuna || null,
      direccion: p.direccion || null,
      lat: p.lat || null,
      lng: p.lng || null,
      precio: p.precio,
      moneda: p.moneda || "CLP",
      superficie_m2: p.superficie_m2 || null,
      dormitorios: p.dormitorios || null,
      banos: p.banos || null,
      gastos_comunes: p.gastos_comunes || null,
      estacionamientos: p.estacionamientos || null,
      bodegas: p.bodegas || null,
      piso: p.piso || null,
      antiguedad: p.antiguedad || null,
      url: p.url || null,
      condicion: p.condicion || "usado",
      is_active: p.is_active !== false,
      scraped_at: new Date().toISOString(),
      geocode_attempted: false,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid properties (need source, source_id, precio)" }, { status: 400 });
  }

  const { error } = await supabase
    .from("scraped_properties")
    .upsert(rows, { onConflict: "source,source_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    inserted: rows.length,
    total: properties.length,
    skipped: properties.length - rows.length,
  });
}
