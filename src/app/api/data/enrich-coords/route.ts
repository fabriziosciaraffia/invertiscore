import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchCoordinates } from "@/lib/services/scraper/toctoc";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const BATCH_LIMIT = 10;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  // Get properties that have a URL but no coordinates and haven't been attempted
  const { data: rows, error: fetchError } = await supabase
    .from("scraped_properties")
    .select("id, url")
    .is("lat", null)
    .eq("geocode_attempted", false)
    .not("url", "is", null)
    .limit(BATCH_LIMIT);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ success: true, message: "No properties to enrich", enriched: 0, failed: 0 });
  }

  // Fetch coordinates in parallel
  const results = await Promise.all(
    rows.map(async (row) => {
      const coords = await fetchCoordinates(row.url);
      return { id: row.id, coords };
    })
  );

  let enriched = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const { id, coords } of results) {
    if (coords) {
      const { error } = await supabase
        .from("scraped_properties")
        .update({ lat: coords.lat, lng: coords.lng, geocode_attempted: true })
        .eq("id", id);
      if (error) {
        errors.push(`Update ${id}: ${error.message}`);
        failed++;
      } else {
        enriched++;
      }
    } else {
      // Mark as attempted so we don't retry
      await supabase
        .from("scraped_properties")
        .update({ geocode_attempted: true })
        .eq("id", id);
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    processed: rows.length,
    enriched,
    failed,
    errors: errors.slice(0, 10),
  });
}
