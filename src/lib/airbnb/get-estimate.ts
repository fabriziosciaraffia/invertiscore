// ─────────────────────────────────────────────────────────────────────────
// AirROI estimate — función pura reusable.
//
// Extraída del POST handler de `/api/airbnb/estimate/route.ts` para eliminar
// el sub-fetch HTTP que el endpoint /api/analisis/short-term hacía contra
// otra serverless function. Ese sub-fetch sufría doble cold start + doble
// timeout en Vercel y devolvía HTML cuando la function de estimate
// colapsaba — el endpoint STR parseaba HTML como JSON y tiraba SyntaxError
// genérico. Ver bug-report 2026-05-09 (análisis 71f4d2fd…).
//
// Esta función NO conoce HTTP. Recibe args, retorna el shape estándar.
// ─────────────────────────────────────────────────────────────────────────

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterComparables,
  getTopComparables,
  processComparables,
} from "./process-comparables";
import type {
  AirROIComparable,
  AirROIResponse,
  AirbnbEstimateResponse,
} from "./types";

function getAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

function makeCacheKey(
  address: string,
  bedrooms: number,
  baths: number,
  guests: number,
): string {
  const raw = `${address.toLowerCase().trim()}|${bedrooms}|${baths}|${guests}`;
  return createHash("sha256").update(raw).digest("hex");
}

interface DirectFieldRich {
  mean?: number;
  median?: number;
  value?: number;
}

/**
 * Estimate AirROI revenue/ADR/occupancy para una propiedad.
 *
 * Camino:
 *  1. Cache lookup en `airbnb_estimates` (TTL 90 días).
 *  2. Si no hay cache: fetch a AirROI externo (api.airroi.com) con `AIRROI_API_KEY`.
 *  3. Procesar comparables → tier segmentation. Path A.
 *  4. Si no hay comparables pero AirROI devolvió calculator direct fields → Path B.
 *  5. Si nada útil → AirbnbEstimateError 'no_comparables'.
 *
 * Caller responsabilidad: Caller decide qué hacer con `success: false`. Esta
 * función NO tira excepciones por errores conocidos (devuelve shape Error).
 * Solo tira excepciones si hay bug interno (network unhandled, throw de
 * upstream lib). Caller debería envolver en try/catch para esos casos.
 */
export async function getAirbnbEstimate(
  address: string,
  bedrooms: number,
  baths: number,
  guests: number,
  options?: { dbClient?: SupabaseClient },
): Promise<AirbnbEstimateResponse> {
  // ── Validate inputs ──────────────────────────────
  if (!address || typeof address !== "string" || address.trim().length === 0) {
    return {
      success: false,
      error: "validation_error",
      message: "La dirección es requerida",
    };
  }

  if (
    isNaN(bedrooms) || bedrooms < 0
    || isNaN(baths) || baths < 1
    || isNaN(guests) || guests < 1
  ) {
    return {
      success: false,
      error: "validation_error",
      message: "Dormitorios, baños y huéspedes deben ser números válidos",
    };
  }

  // ── DB client: prefer service role (bypasses RLS), fall back to caller-provided ──
  const db = options?.dbClient ?? getAdminClient();
  if (!db) {
    return {
      success: false,
      error: "airbnb_api_error",
      message: "Cliente de base de datos no disponible",
    };
  }

  // ── Cache lookup ─────────────────────────────────
  const cacheKey = makeCacheKey(address, bedrooms, baths, guests);

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
      return {
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
      };
    }

    // Cached comparables response
    return {
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
    };
  }

  // ── Call AirROI API ──────────────────────────────
  const apiKey = process.env.AIRROI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "airbnb_api_error",
      message: "API key de AirROI no configurada",
    };
  }

  const params = new URLSearchParams({
    address: address.trim(),
    bedrooms: String(bedrooms),
    baths: String(baths),
    guests: String(guests),
  });

  const airroiRes = await fetch(
    `https://api.airroi.com/calculator/estimate?${params}`,
    { headers: { "x-api-key": apiKey } },
  );

  if (!airroiRes.ok) {
    const errorText = await airroiRes.text().catch(() => "Unknown error");
    return {
      success: false,
      error: "airbnb_api_error",
      message: `AirROI respondió con ${airroiRes.status}: ${errorText.slice(0, 200)}`,
    };
  }

  const airroiRaw = await airroiRes.json();

  // ── Resolve comparables array (multiple shape variants) ─
  const rawComparables: unknown[] =
    airroiRaw.comparables ??
    airroiRaw.listings ??
    airroiRaw.entries ??
    airroiRaw.data?.comparables ??
    airroiRaw.data?.listings ??
    airroiRaw.data ??
    (Array.isArray(airroiRaw) ? airroiRaw : []);

  console.log("[airbnb/estimate] AirROI status:", airroiRes.status);
  console.log("[airbnb/estimate] AirROI top-level keys:", Object.keys(airroiRaw));
  console.log("[airbnb/estimate] Raw comparables count:", rawComparables.length);

  const airroiData: AirROIResponse = { comparables: rawComparables as AirROIComparable[] };

  // ── Process comparables (Path A) ─────────────────
  const processed = processComparables(airroiData.comparables ?? []);
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  if (processed) {
    await db.from("airbnb_estimates").upsert(
      {
        cache_key: cacheKey,
        address: address.trim(),
        bedrooms,
        baths,
        guests,
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

    return {
      success: true,
      cached: false,
      source: "comparables",
      data: {
        address: address.trim(),
        bedrooms,
        baths,
        guests,
        comparables_count: processed.comparables_count,
        median_adr: processed.median_adr,
        median_occupancy: processed.median_occupancy,
        median_annual_revenue: processed.median_annual_revenue,
        premium: processed.premium,
        standard: processed.standard,
        top_comparables: processed.top_comparables,
        expires_at: expiresAt,
      },
    };
  }

  // ── Path B: calculator direct fields ─────────────
  const directRevenue = airroiRaw.revenue;
  const directADR = airroiRaw.average_daily_rate;
  const directOccupancy = airroiRaw.occupancy;

  const hasDirectData =
    directRevenue != null
    && directADR != null
    && directOccupancy != null;

  if (hasDirectData) {
    const adrValue = typeof directADR === "number"
      ? directADR
      : ((directADR as DirectFieldRich)?.mean ?? (directADR as DirectFieldRich)?.median ?? (directADR as DirectFieldRich)?.value ?? 0);
    const occValue = typeof directOccupancy === "number"
      ? directOccupancy
      : ((directOccupancy as DirectFieldRich)?.mean ?? (directOccupancy as DirectFieldRich)?.median ?? (directOccupancy as DirectFieldRich)?.value ?? 0);
    const revValue = typeof directRevenue === "number"
      ? directRevenue
      : ((directRevenue as DirectFieldRich)?.mean ?? (directRevenue as DirectFieldRich)?.median ?? (directRevenue as DirectFieldRich)?.value ?? 0);

    console.log("[airbnb/estimate] Using calculator_direct path — ADR:", adrValue, "Occ:", occValue, "Rev:", revValue);

    await db.from("airbnb_estimates").upsert(
      {
        cache_key: cacheKey,
        address: address.trim(),
        bedrooms,
        baths,
        guests,
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

    return {
      success: true,
      cached: false,
      source: "calculator_direct",
      data: {
        address: address.trim(),
        bedrooms,
        baths,
        guests,
        estimated_adr: adrValue,
        estimated_occupancy: occValue,
        estimated_annual_revenue: revValue,
        percentiles: airroiRaw.percentiles ?? {},
        monthly_revenue: airroiRaw.monthly_revenue_distributions ?? [],
        currency: airroiRaw.currency ?? "USD",
        comparables_count: 0,
        expires_at: expiresAt,
      },
    };
  }

  // ── Path C: nothing useful ───────────────────────
  return {
    success: false,
    error: "no_comparables",
    message: "No se encontraron propiedades comparables ni datos calculados en esta zona",
  };
}
