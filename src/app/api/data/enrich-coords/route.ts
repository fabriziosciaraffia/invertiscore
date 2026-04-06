import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanAddressFromTitle, geocodeAddress } from "@/lib/services/geocoding";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const BATCH_LIMIT = 10;

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

  const supabase = getSupabase();

  // Propiedades sin coordenadas que no se han intentado geocodificar
  const { data: rows, error: fetchError } = await supabase
    .from("scraped_properties")
    .select("id, direccion, comuna")
    .is("lat", null)
    .eq("geocode_attempted", false)
    .not("direccion", "is", null)
    .limit(BATCH_LIMIT);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ success: true, message: "No properties to enrich", enriched: 0, failed: 0 });
  }

  let enriched = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const cleanAddress = cleanAddressFromTitle(row.direccion, row.comuna);

    if (!cleanAddress) {
      await supabase
        .from("scraped_properties")
        .update({ geocode_attempted: true })
        .eq("id", row.id);
      failed++;
      continue;
    }

    try {
      const result = await geocodeAddress(cleanAddress, row.comuna);

      if (result) {
        const { error } = await supabase
          .from("scraped_properties")
          .update({ lat: result.lat, lng: result.lng, geocode_attempted: true })
          .eq("id", row.id);
        if (error) {
          errors.push(`Update ${row.id}: ${error.message}`);
          failed++;
        } else {
          enriched++;
        }
      } else {
        await supabase
          .from("scraped_properties")
          .update({ geocode_attempted: true })
          .eq("id", row.id);
        failed++;
      }
    } catch (e) {
      errors.push(`Geocode ${row.id}: ${e instanceof Error ? e.message : "unknown"}`);
      await supabase
        .from("scraped_properties")
        .update({ geocode_attempted: true })
        .eq("id", row.id);
      failed++;
    }

    // Rate limit: 200ms para Google, 1100ms para Nominatim
    const delay = process.env.GOOGLE_MAPS_API_KEY ? 200 : 1100;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return NextResponse.json({
    success: true,
    processed: rows.length,
    enriched,
    failed,
    errors: errors.slice(0, 10),
  });
}
