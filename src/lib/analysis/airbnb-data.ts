// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCTOR DE LOS DATOS DE AIRBNB — puro, sin red ni sesión (13-sep-2026).
//
// Vivía en `api-helpers/analisis-pipeline.ts`, que importa `next/headers` y cookies de
// Supabase. Eso lo volvía inimportable desde cualquier componente cliente: la página de
// fixtures `/dev/drawers-pixel` no podía recomputar STR como lo hace la ruta real, y sus
// shots mostraban un estado que producción ya no tiene.
//
// La función siempre fue pura. Se muda acá y el pipeline la re-exporta, así que ningún
// llamador cambia.
// ─────────────────────────────────────────────────────────────────────────────
import type { AirbnbData } from "@/lib/engines/short-term-engine";
import type { AirbnbEstimateData, AirbnbEstimateDirectData } from "@/lib/airbnb/types";

const FLAT_MONTHLY = Array(12).fill(1 / 12) as number[];

function isDirectData(
  d: AirbnbEstimateData | AirbnbEstimateDirectData,
): d is AirbnbEstimateDirectData {
  return "estimated_adr" in d;
}

// Construye el AirbnbData que espera el motor (percentiles + factores
// mensuales). "calculator_direct" trae percentiles de AirROI; "comparables" los
// sintetiza desde los tiers premium/standard. Movido verbatim desde
// /api/analisis/short-term/route.ts (único consumer).
// Exportado (E.1b): el golden STR (str-recompute) lo reusa para recomputar con la MISMA
// transformación raw→airbnbData que producción, sin una réplica que pueda driftar.
export function buildAirbnbData(
  raw: AirbnbEstimateData | AirbnbEstimateDirectData,
  ufValue: number,
): AirbnbData {
  if (isDirectData(raw)) {
    // Calculator_direct path — percentiles come from AirROI
    const pctl = raw.percentiles as Record<string, Record<string, number>> | undefined;
    const monthly = Array.isArray(raw.monthly_revenue) ? raw.monthly_revenue as number[] : FLAT_MONTHLY;
    const isCLP = (raw.currency ?? "USD") === "CLP";
    const toClp = (v: number) => (isCLP ? v : Math.round(v * ufValue));

    const revP = pctl?.revenue ?? {};
    const occP = pctl?.occupancy ?? {};
    const adrP = pctl?.average_daily_rate ?? {};

    const est_adr = toClp(raw.estimated_adr);
    const est_rev = toClp(raw.estimated_annual_revenue);

    return {
      estimated_adr: est_adr,
      estimated_occupancy: raw.estimated_occupancy,
      estimated_annual_revenue: est_rev,
      percentiles: {
        revenue: {
          p25: toClp(revP.p25 ?? est_rev * 0.75),
          p50: toClp(revP.p50 ?? est_rev),
          p75: toClp(revP.p75 ?? est_rev * 1.25),
          p90: toClp(revP.p90 ?? est_rev * 1.50),
          avg: toClp(revP.avg ?? revP.mean ?? est_rev),
        },
        occupancy: {
          p25: occP.p25 ?? raw.estimated_occupancy * 0.75,
          p50: occP.p50 ?? raw.estimated_occupancy,
          p75: occP.p75 ?? Math.min(raw.estimated_occupancy * 1.15, 0.95),
          p90: occP.p90 ?? Math.min(raw.estimated_occupancy * 1.25, 0.98),
          avg: occP.avg ?? occP.mean ?? raw.estimated_occupancy,
        },
        average_daily_rate: {
          p25: toClp(adrP.p25 ?? est_adr * 0.80),
          p50: toClp(adrP.p50 ?? est_adr),
          p75: toClp(adrP.p75 ?? est_adr * 1.20),
          p90: toClp(adrP.p90 ?? est_adr * 1.40),
          avg: toClp(adrP.avg ?? adrP.mean ?? est_adr),
        },
      },
      monthly_revenue: monthly,
      currency: "CLP",
    };
  }

  // Comparables path — synthesize percentiles from tier data
  const adr = raw.median_adr;
  const occ = raw.median_occupancy;
  const rev = raw.median_annual_revenue;

  // Use premium/standard tiers to create spread
  const premAdr = raw.premium.median_adr || adr * 1.20;
  const premOcc = raw.premium.median_occupancy || Math.min(occ * 1.10, 0.95);
  const premRev = raw.premium.median_annual_revenue || rev * 1.30;
  const stdAdr = raw.standard.median_adr || adr * 0.85;
  const stdOcc = raw.standard.median_occupancy || occ * 0.85;
  const stdRev = raw.standard.median_annual_revenue || rev * 0.75;

  // Conversión a CLP — MISMA regla que la rama direct de arriba.
  //
  // Acá había un bug dormido: la versión anterior decía "comparables-based data
  // is in USD" y multiplicaba SIEMPRE por ufValue. AirROI devuelve CLP en la
  // enorme mayoría de las respuestas (100 de 120 medidas el 2026-08-12), así que
  // esa rama habría convertido pesos a pesos-por-UF: un ADR de $58.005 se
  // transformaba en $2.175.502.000 (×39.500). Nunca se notó porque la rama no se
  // ejecuta —`comparable_listings` no está cableado al scoring, ver la nota larga
  // en get-estimate.ts—, pero quedaba armada para el día que alguien la encienda.
  //
  // LIMITACIÓN CONOCIDA, heredada de la rama direct: cuando AirROI responde en
  // una moneda que no es CLP ni CLP-equivalente (se observaron DOP, MXN, EUR,
  // BRL, ARS, PEN, SEK, MAD, USD en ~17% de las respuestas, casi siempre porque
  // no geolocalizó la dirección en Chile), el ×ufValue tampoco es correcto: trata
  // esa unidad como si fuera UF. No se arregla acá para no cambiar la conducta de
  // la rama viva; queda anotado como pendiente propio.
  const isCLP = (raw.currency ?? "USD") === "CLP";
  const toCLP = (v: number) => (isCLP ? v : Math.round(v * ufValue));

  return {
    estimated_adr: toCLP(adr),
    estimated_occupancy: occ,
    estimated_annual_revenue: toCLP(rev),
    percentiles: {
      revenue: {
        p25: toCLP(stdRev),
        p50: toCLP(rev),
        p75: toCLP(premRev),
        p90: toCLP(Math.round(premRev * 1.15)),
        avg: toCLP(rev),
      },
      occupancy: {
        p25: stdOcc,
        p50: occ,
        p75: premOcc,
        p90: Math.min(premOcc * 1.10, 0.98),
        avg: occ,
      },
      average_daily_rate: {
        p25: toCLP(stdAdr),
        p50: toCLP(adr),
        p75: toCLP(premAdr),
        p90: toCLP(Math.round(premAdr * 1.15)),
        avg: toCLP(adr),
      },
    },
    monthly_revenue: FLAT_MONTHLY,
    currency: "CLP",
  };
}
