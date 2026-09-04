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
import { contarLlamadaAirroi, type OrigenAirroi } from "./contador-airroi";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterComparables,
  getTopComparables,
  processComparables,
  summarizeRealizedOccupancy,
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

export function makeCacheKey(
  address: string,
  comuna: string,
  bedrooms: number,
  baths: number,
  guests: number,
): string {
  // F1 (2026-06): la comuna entra al key. Antes se omitía y addresses "pelados"
  // (sin comuna en el string, ej. "alameda 107") podían colisionar con homónimos
  // de otra comuna y compartir un estimate errado. AirROI es building-level, así
  // que la unidad/depto NO va al key (compartir entre unidades del mismo edificio
  // es correcto).
  const raw = `${address.toLowerCase().trim()}|${(comuna ?? "").toLowerCase().trim()}|${bedrooms}|${baths}|${guests}`;
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
  comuna: string,
  bedrooms: number,
  baths: number,
  guests: number,
  /**
   * `origen` alimenta el conteo diario de metrics_daily: sin él no se puede
   * separar lo que gasta el wizard explorando de lo que cuesta un informe. Es
   * opcional para no romper callers, pero todo call-site vivo lo manda.
   */
  options?: { dbClient?: SupabaseClient; origen?: OrigenAirroi },
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
  const cacheKey = makeCacheKey(address, comuna, bedrooms, baths, guests);

  const { data: cached } = await db
    .from("airbnb_estimates")
    .select("*")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (cached) {
    const isDirectSource = cached.comparables_count === 0 && cached.tier_premium_count === 0;
    const rawResponse = cached.raw_response as Record<string, unknown>;

    // Display-only (transparencia 2026-06): occ realizada desde la pool cruda.
    // Lee `comparable_listings` APARTE — NO toca isDirectSource ni el scoring.
    const realizedOccupancy = summarizeRealizedOccupancy(rawResponse?.comparable_listings);

    // El hit no cuesta plata, pero sin contarlo no se sabe si el cache sirve.
    void contarLlamadaAirroi(db, options?.origen ?? "informe", true);

    if (isDirectSource) {
      return {
        success: true,
        cached: true,
        source: "calculator_direct",
        realizedOccupancy,
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
      realizedOccupancy,
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
        // La moneda viaja para que buildAirbnbData no tenga que adivinarla (ver
        // el bug de conversión anotado en AirbnbEstimateData.currency).
        currency: (rawResponse?.currency as string) ?? "USD",
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

  // Acá ocurre el gasto: pasado este punto la llamada está facturada, responda
  // lo que responda AirROI. Se cuenta ANTES del fetch y no después del `ok`
  // justamente por eso — un 502 de AirROI también se paga, y contarlo solo en el
  // camino feliz subestimaría la factura.
  void contarLlamadaAirroi(db, options?.origen ?? "informe", false);

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

  // Display-only (transparencia 2026-06): occ realizada desde la pool cruda
  // `comparable_listings`. DELIBERADAMENTE separado de `rawComparables` de abajo
  // — NO se agrega a esa lista de alias para no flipear el path a "comparables".
  // El porqué, con los números medidos, está en el bloque largo de más abajo
  // (justo antes del resolver de alias). No re-midas: ya está hecho.
  const realizedOccupancy = summarizeRealizedOccupancy(
    (airroiRaw as Record<string, unknown>)?.comparable_listings,
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POR QUÉ `comparable_listings` NO ESTÁ EN LA LISTA DE ALIAS DE ABAJO
  // (medido el 2026-08-12 — no hace falta volver a medirlo)
  //
  // AirROI SÍ manda comparables, en CADA respuesta, bajo la clave
  // `comparable_listings`: 14 a 25 listings, mediana 25, verificado en 40 de 40
  // raw_response guardadas. Traen el shape exacto que espera `filterComparables`
  // (performance_metrics.ttm_*, ratings, host_info), y `processComparables`
  // devuelve resultado en 40/40 — ningún filtro los descarta. Las claves
  // top-level reales son: revenue, currency, location, occupancy, percentiles,
  // average_daily_rate, comparable_listings, monthly_revenue_distributions.
  // Ninguno de los seis alias de abajo existe, así que el array cae a [] y el
  // flujo se va al Path B. Por eso las 8 columnas de comparables de
  // `airbnb_estimates` están en cero en las 1.000 filas.
  //
  // NO es un olvido: agregar la clave acá cambia los NÚMEROS del producto, y la
  // medición dice que los cambia mucho. Comparables vs calculador, medianas:
  //
  //     ADR       0,89×   (p25 0,77 · p75 1,09)
  //     ocupación 0,70×   (p25 0,59 · p75 0,86)
  //     revenue   0,62×
  //
  // Recomputado con el motor real sobre los 6 seeds GE del golden STR: los SEIS
  // terminan en BUSCAR OTRA, con scores entre −13 y −38 puntos. GE-1 cae de
  // COMPRAR/78 a BUSCAR OTRA/58. En la práctica, Franco STR dejaría de
  // recomendar comprar casi nunca.
  //
  // Y el flip tiene dos costos que van en contra de su propio objetivo:
  //   · se pierde la curva estacional — la rama comparables de buildAirbnbData
  //     setea FLAT_MONTHLY, así que el gráfico de 12 meses queda plano;
  //   · los percentiles dejan de ser los de AirROI y pasan a sintetizarse desde
  //     premium/standard con multiplicadores fijos (×1,15, ×1,20). La tabla
  //     P25–P90 del drawer de sensibilidad sería MENOS empírica que hoy.
  //
  // LO QUE FALTA PARA DECIDIR (pendiente con AirROI): qué mide exactamente el
  // `occupancy` de /calculator/estimate frente al `ttm_occupancy` de los
  // listings, y cuál recomiendan para evaluar una compra. No son el mismo número
  // mal calculado: son dos cosas distintas —potencial de zona vs realizado de 12
  // meses, con listings mal gestionados y recién publicados adentro— y cuál es
  // el benchmark correcto para un comprador no se resuelve leyendo código.
  //
  // Mientras tanto los comparables SÍ se usan, pero solo para display:
  // `summarizeRealizedOccupancy` (abajo) calcula la ocupación realizada y su n,
  // que el informe muestra bajo la ocupación estimada. Eso no toca el scoring.
  //
  // Ver: memoria `airroi-comparables-flip-bloqueado`.
  // ─────────────────────────────────────────────────────────────────────────

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
      realizedOccupancy,
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
        // Ídem: la moneda cruda de AirROI, sin asumir USD.
        currency: (airroiRaw.currency as string) ?? "USD",
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
      realizedOccupancy,
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

/**
 * LA ZONA (T2 · 05-sep-2026): la fila cruda del estimate que usó este análisis, por la
 * MISMA llave de caché (dirección + comuna + dormitorios + baños + huéspedes). Devuelve
 * los 25 avisos parecidos y la fecha de esa consulta; null sin fila. Solo lectura.
 *
 * T2.1: lee con el cliente ADMIN del servidor (service role), acotado a UNA fila por
 * cache_key. `airbnb_estimates` tiene RLS activo y cero políticas: con el cliente de
 * sesión la consulta vuelve vacía y la celda "contra quién te comparan" decía "sin datos
 * suficientes" en prod. No se agrega política: la tabla no es del usuario. Sin service
 * role (entorno local sin la variable) devuelve null.
 */
export async function loadAirbnbEstimateCrudo(
  k: { direccion: string; comuna: string; dormitorios: number; banos: number; huespedes: number },
): Promise<{ createdAt: string; listings: unknown[] } | null> {
  if (!k.direccion) return null;
  const db = getAdminClient();
  if (!db) return null;
  const cacheKey = makeCacheKey(k.direccion, k.comuna, k.dormitorios, k.banos, k.huespedes);
  const { data, error } = await db
    .from("airbnb_estimates")
    .select("created_at, raw_response")
    .eq("cache_key", cacheKey)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  const row = data[0] as { created_at: string; raw_response?: { comparable_listings?: unknown } };
  const listings = Array.isArray(row.raw_response?.comparable_listings) ? (row.raw_response!.comparable_listings as unknown[]) : [];
  return { createdAt: row.created_at, listings };
}
