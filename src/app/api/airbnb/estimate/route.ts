import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { processComparables, filterComparables, getTopComparables } from "@/lib/airbnb/process-comparables";
import type { AirROIComparable, AirROIResponse, AirbnbEstimateResponse } from "@/lib/airbnb/types";

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignored in route handler
          }
        },
      },
    }
  );
}

function getAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

function makeCacheKey(address: string, bedrooms: number, baths: number, guests: number): string {
  const raw = `${address.toLowerCase().trim()}|${bedrooms}|${baths}|${guests}`;
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, bedrooms, baths, guests } = body;

    // ── Validate inputs ──────────────────────────────
    if (!address || typeof address !== "string" || address.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "validation_error", message: "La dirección es requerida" } satisfies AirbnbEstimateResponse,
        { status: 400 },
      );
    }

    const bed = Number(bedrooms);
    const bath = Number(baths);
    const gst = Number(guests);

    if (isNaN(bed) || bed < 0 || isNaN(bath) || bath < 1 || isNaN(gst) || gst < 1) {
      return NextResponse.json(
        { success: false, error: "validation_error", message: "Dormitorios, baños y huéspedes deben ser números válidos" } satisfies AirbnbEstimateResponse,
        { status: 400 },
      );
    }

    // ── DB client: prefer service role (bypasses RLS), fall back to server client ──
    const db = getAdmin() ?? createSupabaseServer();

    // ── Check cache ──────────────────────────────────
    const cacheKey = makeCacheKey(address, bed, bath, gst);

    const { data: cached } = await db
      .from("airbnb_estimates")
      .select("*")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      const isDirectSource = cached.comparables_count === 0 && cached.tier_premium_count === 0;
      const rawResponse = cached.raw_response as Record<string, unknown>;

      if (isDirectSource) {
        // Cached calculator_direct response
        return NextResponse.json({
          success: true,
          cached: true,
          source: "calculator_direct",
          data: {
            address: cached.address,
            bedrooms: cached.bedrooms,
            baths: cached.baths,
            guests: cached.guests,
            estimated_adr: cached.median_adr,
            estimated_occupancy: cached.median_occupancy,
            estimated_annual_revenue: cached.median_annual_revenue,
            percentiles: (rawResponse?.percentiles as Record<string, unknown>) ?? {},
            monthly_revenue: (rawResponse?.monthly_revenue_distributions as unknown[]) ?? [],
            currency: (rawResponse?.currency as string) ?? "USD",
            comparables_count: 0,
            expires_at: cached.expires_at,
          },
        } satisfies AirbnbEstimateResponse);
      }

      // Cached comparables response
      return NextResponse.json({
        success: true,
        cached: true,
        source: "comparables",
        data: {
          address: cached.address,
          bedrooms: cached.bedrooms,
          baths: cached.baths,
          guests: cached.guests,
          comparables_count: cached.comparables_count,
          median_adr: cached.median_adr,
          median_occupancy: cached.median_occupancy,
          median_annual_revenue: cached.median_annual_revenue,
          premium: {
            count: cached.tier_premium_count,
            median_adr: cached.tier_premium_adr,
            median_occupancy: cached.tier_premium_occupancy,
            median_annual_revenue: cached.tier_premium_revenue,
          },
          standard: {
            count: cached.tier_standard_count,
            median_adr: cached.tier_standard_adr,
            median_occupancy: cached.tier_standard_occupancy,
            median_annual_revenue: cached.tier_standard_revenue,
          },
          top_comparables: (rawResponse as unknown as AirROIResponse)?.comparables
            ? getTopComparables(filterComparables((rawResponse as unknown as AirROIResponse).comparables))
            : [],
          expires_at: cached.expires_at,
        },
      } satisfies AirbnbEstimateResponse);
    }

    // ── Call AirROI API ──────────────────────────────
    const apiKey = process.env.AIRROI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "airbnb_api_error", message: "API key de AirROI no configurada" } satisfies AirbnbEstimateResponse,
        { status: 500 },
      );
    }

    const params = new URLSearchParams({
      address: address.trim(),
      bedrooms: String(bed),
      baths: String(bath),
      guests: String(gst),
    });

    const airroiRes = await fetch(
      `https://api.airroi.com/calculator/estimate?${params}`,
      { headers: { "x-api-key": apiKey } },
    );

    if (!airroiRes.ok) {
      const errorText = await airroiRes.text().catch(() => "Unknown error");
      return NextResponse.json(
        { success: false, error: "airbnb_api_error", message: `AirROI respondió con ${airroiRes.status}: ${errorText}` } satisfies AirbnbEstimateResponse,
        { status: 502 },
      );
    }

    const airroiRaw = await airroiRes.json();

    // ── DEBUG: Log raw AirROI response structure ─────
    const topLevelKeys = Object.keys(airroiRaw);
    const rawComparables: unknown[] =
      airroiRaw.comparables ??
      airroiRaw.listings ??
      airroiRaw.entries ??
      airroiRaw.data?.comparables ??
      airroiRaw.data?.listings ??
      airroiRaw.data ??
      (Array.isArray(airroiRaw) ? airroiRaw : []);

    console.log("[airbnb/estimate] AirROI status:", airroiRes.status);
    console.log("[airbnb/estimate] AirROI top-level keys:", topLevelKeys);
    console.log("[airbnb/estimate] Raw comparables count:", rawComparables.length);
    if (rawComparables.length > 0) {
      const sample = rawComparables.slice(0, 3);
      for (let i = 0; i < sample.length; i++) {
        const c = sample[i] as Record<string, unknown>;
        console.log(`[airbnb/estimate] Comparable #${i} keys:`, Object.keys(c));
        const perf = c.performance_metrics as Record<string, unknown> | undefined;
        const ratings = c.ratings as Record<string, unknown> | undefined;
        console.log(`[airbnb/estimate] Comparable #${i} perf:`, perf ? { ttm_occupancy: perf.ttm_occupancy, ttm_revenue: perf.ttm_revenue } : "MISSING");
        console.log(`[airbnb/estimate] Comparable #${i} ratings:`, ratings ? { num_reviews: ratings.num_reviews, rating_overall: ratings.rating_overall } : "MISSING");
      }
    }

    // ── DEBUG: Log direct calculator fields ────────────
    console.log("[airbnb/estimate] Direct fields — revenue:", JSON.stringify(airroiRaw.revenue, null, 2));
    console.log("[airbnb/estimate] Direct fields — average_daily_rate:", JSON.stringify(airroiRaw.average_daily_rate, null, 2));
    console.log("[airbnb/estimate] Direct fields — occupancy:", JSON.stringify(airroiRaw.occupancy, null, 2));
    console.log("[airbnb/estimate] Direct fields — percentiles:", JSON.stringify(airroiRaw.percentiles, null, 2));
    console.log("[airbnb/estimate] Direct fields — monthly_revenue_distributions:", JSON.stringify(airroiRaw.monthly_revenue_distributions, null, 2));
    console.log("[airbnb/estimate] Direct fields — currency:", airroiRaw.currency);

    // Cast to our expected shape — use the resolved array
    const airroiData: AirROIResponse = { comparables: rawComparables as AirROIComparable[] };

    // ── Process comparables ──────────────────────────
    const filtered = filterComparables(airroiData.comparables ?? []);
    console.log(`[airbnb/estimate] After filterComparables: ${filtered.length} (from ${rawComparables.length})`);

    const processed = processComparables(airroiData.comparables ?? []);

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // ── Path A: comparables with data → tier segmentation ──
    if (processed) {
      await db.from("airbnb_estimates").upsert(
        {
          cache_key: cacheKey,
          address: address.trim(),
          bedrooms: bed,
          baths: bath,
          guests: gst,
          raw_response: airroiRaw,
          comparables_count: processed.comparables_count,
          median_adr: processed.median_adr,
          median_occupancy: processed.median_occupancy,
          median_annual_revenue: processed.median_annual_revenue,
          tier_premium_adr: processed.premium.median_adr,
          tier_premium_occupancy: processed.premium.median_occupancy,
          tier_premium_revenue: processed.premium.median_annual_revenue,
          tier_premium_count: processed.premium.count,
          tier_standard_adr: processed.standard.median_adr,
          tier_standard_occupancy: processed.standard.median_occupancy,
          tier_standard_revenue: processed.standard.median_annual_revenue,
          tier_standard_count: processed.standard.count,
          expires_at: expiresAt,
        },
        { onConflict: "cache_key" },
      );

      return NextResponse.json({
        success: true,
        cached: false,
        source: "comparables",
        data: {
          address: address.trim(),
          bedrooms: bed,
          baths: bath,
          guests: gst,
          comparables_count: processed.comparables_count,
          median_adr: processed.median_adr,
          median_occupancy: processed.median_occupancy,
          median_annual_revenue: processed.median_annual_revenue,
          premium: processed.premium,
          standard: processed.standard,
          top_comparables: processed.top_comparables,
          expires_at: expiresAt,
        },
      } satisfies AirbnbEstimateResponse);
    }

    // ── Path B: no comparables but direct calculator data ──
    const directRevenue = airroiRaw.revenue;
    const directADR = airroiRaw.average_daily_rate;
    const directOccupancy = airroiRaw.occupancy;

    const hasDirectData =
      directRevenue != null &&
      directADR != null &&
      directOccupancy != null;

    if (hasDirectData) {
      // Extract numeric values — handle both plain numbers and objects with mean/median
      const adrValue = typeof directADR === "number" ? directADR : (directADR?.mean ?? directADR?.median ?? directADR?.value ?? 0);
      const occValue = typeof directOccupancy === "number" ? directOccupancy : (directOccupancy?.mean ?? directOccupancy?.median ?? directOccupancy?.value ?? 0);
      const revValue = typeof directRevenue === "number" ? directRevenue : (directRevenue?.mean ?? directRevenue?.median ?? directRevenue?.value ?? 0);

      console.log("[airbnb/estimate] Using calculator_direct path — ADR:", adrValue, "Occ:", occValue, "Rev:", revValue);

      // Cache the direct data
      await db.from("airbnb_estimates").upsert(
        {
          cache_key: cacheKey,
          address: address.trim(),
          bedrooms: bed,
          baths: bath,
          guests: gst,
          raw_response: airroiRaw,
          comparables_count: 0,
          median_adr: Math.round(adrValue),
          median_occupancy: Math.round(occValue * 100) / 100,
          median_annual_revenue: Math.round(revValue),
          tier_premium_adr: 0,
          tier_premium_occupancy: 0,
          tier_premium_revenue: 0,
          tier_premium_count: 0,
          tier_standard_adr: 0,
          tier_standard_occupancy: 0,
          tier_standard_revenue: 0,
          tier_standard_count: 0,
          expires_at: expiresAt,
        },
        { onConflict: "cache_key" },
      );

      return NextResponse.json({
        success: true,
        cached: false,
        source: "calculator_direct",
        data: {
          address: address.trim(),
          bedrooms: bed,
          baths: bath,
          guests: gst,
          estimated_adr: adrValue,
          estimated_occupancy: occValue,
          estimated_annual_revenue: revValue,
          percentiles: airroiRaw.percentiles ?? {},
          monthly_revenue: airroiRaw.monthly_revenue_distributions ?? [],
          currency: airroiRaw.currency ?? "USD",
          comparables_count: 0,
          expires_at: expiresAt,
        },
      } satisfies AirbnbEstimateResponse);
    }

    // ── Path C: nothing useful at all ────────────────
    return NextResponse.json(
      { success: false, error: "no_comparables", message: "No se encontraron propiedades comparables ni datos calculados en esta zona" } satisfies AirbnbEstimateResponse,
      { status: 404 },
    );
  } catch (err) {
    console.error("[airbnb/estimate] Error:", err);
    return NextResponse.json(
      { success: false, error: "airbnb_api_error", message: "Error interno al procesar la estimación" } satisfies AirbnbEstimateResponse,
      { status: 500 },
    );
  }
}
