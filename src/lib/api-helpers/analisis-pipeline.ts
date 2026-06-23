// Helpers compartidos entre /api/analisis (LTR) y /api/analisis/short-term
// (STR). Extraídos para reducir duplicación: ~80 líneas idénticas viven en
// ambos endpoints.
//
// Patrón:
//   1. createSupabaseServer()      — server-side Supabase client con cookies.
//   2. createPaymentsAdminClient() — admin client para validar/claim payments.
//   3. requireAuthenticatedUser()  — auth gate, returns 401 NextResponse if no user.
//   4. ensureCreditCharged()       — handle prepaid charge OR cobro normal,
//                                    con admin bypass.
//   5. markPremiumAndClaimPrepaid()— post-insert: mark is_premium=true +
//                                    claim del prepaid charge si aplica.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { chargeAnalysisCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import {
  calcShortTerm,
  type ShortTermInputs,
  type AirbnbData,
  type TipoEdificioSTR,
  type HabilitacionSTR,
} from "@/lib/engines/short-term-engine";
import { calcFrancoScoreSTR, type ScoreSTRInputs } from "@/lib/engines/short-term-score";
import { getAirbnbEstimate } from "@/lib/airbnb/get-estimate";
import type { AirbnbEstimateData, AirbnbEstimateDirectData } from "@/lib/airbnb/types";

// ─── Clients ───────────────────────────────────────────

export function createSupabaseServer() {
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
              cookieStore.set(name, value, options),
            );
          } catch {
            // ignored in route handler
          }
        },
      },
    },
  );
}

export function createPaymentsAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Auth gate ─────────────────────────────────────────

export interface AuthOk {
  ok: true;
  user: User;
}
export interface AuthErr {
  ok: false;
  response: NextResponse;
}

/**
 * Resuelve el user autenticado del request o devuelve 401.
 * El caller hace `if (!auth.ok) return auth.response;` y luego usa `auth.user`.
 */
export async function requireAuthenticatedUser(
  supabase: SupabaseClient,
): Promise<AuthOk | AuthErr> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Debes iniciar sesión para crear un análisis" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}

// ─── Credit charge ─────────────────────────────────────

export interface ChargeOk {
  ok: true;
  /** True cuando llegamos PRIMERO al claim del prepaid charge (flujo AMBAS).
   * Caller debe llamar markPremiumAndClaimPrepaid con prepaidNeedClaim=true. */
  prepaidNeedClaim: boolean;
}
export interface ChargeErr {
  ok: false;
  response: NextResponse;
}

/**
 * Maneja el cobro de crédito unificado:
 *   - Si viene `prepaidChargeId`: valida contra payments. Permite consume si
 *     intent='both'. Marca prepaidNeedClaim=true si somos los primeros.
 *   - Si NO viene prepaidChargeId y NO es admin: cobra crédito vía
 *     `chargeAnalysisCredit`.
 *   - Si NO viene y ES admin: bypass, no cobra.
 */
export async function ensureCreditCharged(opts: {
  user: User;
  prepaidChargeId?: string | null;
}): Promise<ChargeOk | ChargeErr> {
  const { user, prepaidChargeId } = opts;
  const isAdmin = isAdminUser(user.email);

  if (prepaidChargeId) {
    const paymentsAdmin = createPaymentsAdminClient();
    const { data: charge } = await paymentsAdmin
      .from("payments")
      .select("payment_data, consumed_at")
      .eq("commerce_order", prepaidChargeId)
      .eq("user_id", user.id)
      .eq("status", "paid")
      .maybeSingle();

    if (!charge) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Charge inválido o no encontrado" },
          { status: 403 },
        ),
      };
    }

    if (charge.consumed_at === null) {
      return { ok: true, prepaidNeedClaim: true };
    }

    // Ya consumido: solo permitido si intent='both' (segundo análisis del flujo AMBAS).
    const intent = (charge.payment_data as { intent?: string } | null)?.intent;
    if (intent !== "both") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Charge ya consumido" },
          { status: 403 },
        ),
      };
    }
    return { ok: true, prepaidNeedClaim: false };
  }

  if (!isAdmin) {
    const charge = await chargeAnalysisCredit(user.id, null);
    if (!charge.ok) {
      return {
        ok: false,
        response: NextResponse.json({ error: charge.message }, { status: 403 }),
      };
    }
  }
  return { ok: true, prepaidNeedClaim: false };
}

// ─── Post-insert: premium + claim ──────────────────────

/**
 * Marca el análisis como premium y, si el caller llegó primero al claim del
 * prepaid charge (prepaidNeedClaim=true), lo claim-ea de forma idempotente.
 * El UPDATE con `.is('consumed_at', null)` garantiza que el segundo POST del
 * flujo AMBAS no sobrescribe el claim del primero.
 */
export async function markPremiumAndClaimPrepaid(opts: {
  dbClient: SupabaseClient;
  analysisId: string;
  prepaidChargeId?: string | null;
  prepaidNeedClaim: boolean;
}): Promise<void> {
  const { dbClient, analysisId, prepaidChargeId, prepaidNeedClaim } = opts;

  await dbClient.from("analisis").update({ is_premium: true }).eq("id", analysisId);

  if (prepaidChargeId && prepaidNeedClaim) {
    const paymentsAdmin = createPaymentsAdminClient();
    await paymentsAdmin
      .from("payments")
      .update({
        consumed_at: new Date().toISOString(),
        consumed_by_analysis_id: analysisId,
      })
      .eq("commerce_order", prepaidChargeId)
      .is("consumed_at", null);
  }
}

// ─── STR: AirROI → motor → row (compartido inline ⇄ locked) ────────────
//
// buildShortTermAnalysisRow corre el bloque medio del análisis STR
// (getAirbnbEstimate → buildAirbnbData → calcShortTerm → calcFrancoScoreSTR →
// armado del row) y devuelve los campos computados del row SIN decidir
// is_premium / pending_payment / user_id / creator_name (eso lo resuelve cada
// ruta). Es el espejo STR de runAnalysis (LTR), pero async porque incluye el
// fetch a AirROI. Vive acá para que getAirbnbEstimate tenga UN solo call-site
// (key AirROI sin drift de hash), compartido por /api/analisis/short-term
// (inline cobrado) y /api/analisis/locked (STR bloqueado pre-pago).

/** Distribución mensual plana — 1/12 cada mes (fallback). */
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
function buildAirbnbData(
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

  // Values are already in the AirROI currency (typically USD for comparables)
  // Convert to CLP — comparables-based data is in USD
  const toCLP = (v: number) => Math.round(v * ufValue);

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

/** Shape del body STR que consume el helper. El call-site pasa el payload del
 * wizard (request.json()); los campos passthrough al motor usan los tipos del
 * engine para typecheck estricto sin `any`. */
export interface ShortTermAnalysisBody {
  direccion: string;
  comuna?: string;
  ciudad?: string;
  tipoPropiedad?: string;
  dormitorios: number;
  banos: number;
  superficieUtil: number;
  capacidadHuespedes?: number;
  precioCompra: number;
  precioCompraUF: number;
  piePct: number;
  tasaInteres: number;
  plazoCredito: number;
  modoGestion: "auto" | "administrador";
  comisionAdministrador: number;
  tipoEdificio?: TipoEdificioSTR;
  habilitacion?: HabilitacionSTR;
  adminPro?: boolean;
  adrOverride?: number | null;
  occOverride?: number | null;
  costoElectricidad: number;
  costoAgua: number;
  costoWifi: number;
  costoInsumos: number;
  gastosComunes: number;
  mantencion: number;
  contribuciones?: number;
  estaAmoblado?: boolean;
  costoAmoblamiento?: number;
  arriendoLargoMensual: number;
  edificioPermiteAirbnb?: string;
  lat?: number;
  lng?: number;
}

export type BuildShortTermRowResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; response: NextResponse };

/**
 * Corre el bloque medio del análisis STR y devuelve los campos del row (sin
 * is_premium / pending_payment / user_id / creator_name). Devuelve
 * `{ ok:false, response }` con el mismo contrato HTTP que tenía el endpoint
 * inline (502 si AirROI cae, 400 si no hay datos) — el caller hace
 * `if (!built.ok) return built.response`.
 */
export async function buildShortTermAnalysisRow(
  body: ShortTermAnalysisBody,
  ufValue: number,
): Promise<BuildShortTermRowResult> {
  // AirROI directo (sin sub-fetch HTTP). Único call-site de getAirbnbEstimate.
  let airbnbResult;
  try {
    airbnbResult = await getAirbnbEstimate(
      body.direccion,
      body.comuna ?? "",
      body.dormitorios,
      body.banos,
      body.capacidadHuespedes || 2,
    );
  } catch (err) {
    console.error("[short-term] AirROI lib threw:", err);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Estimación de Airbnb no disponible. Intenta de nuevo en unos segundos." },
        { status: 502 },
      ),
    };
  }

  if (!airbnbResult.success) {
    console.error("[short-term] AirROI failed:", airbnbResult.error, airbnbResult.message);
    // Diferenciar AirROI down (502) vs caso legítimo sin data (400)
    if (airbnbResult.error === "airbnb_api_error") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Estimación de Airbnb no disponible. Intenta de nuevo en unos segundos." },
          { status: 502 },
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No se encontraron datos de Airbnb para esta dirección. Verifica que sea una dirección válida en Santiago." },
        { status: 400 },
      ),
    };
  }

  const airbnbData = buildAirbnbData(airbnbResult.data, ufValue);

  const inputs: ShortTermInputs = {
    precioCompra: body.precioCompra,
    superficie: body.superficieUtil,
    dormitorios: body.dormitorios,
    banos: body.banos,
    tipoPropiedad: typeof body.tipoPropiedad === "string" ? body.tipoPropiedad : undefined,
    // Antigüedad para el CapEx de puesta a punto: el form STR no la captura,
    // así que se deriva igual que la fila persistida (nuevo=0, usado=5).
    antiguedad: body.tipoPropiedad === "nuevo" ? 0 : 5,
    comuna: typeof body.comuna === "string" ? body.comuna : undefined,
    piePercent: body.piePct / 100,
    tasaCredito: body.tasaInteres / 100,
    plazoCredito: body.plazoCredito,
    airbnbData,
    modoGestion: body.modoGestion,
    comisionAdministrador: body.comisionAdministrador,
    tipoEdificio: body.tipoEdificio,
    habilitacion: body.habilitacion,
    adminPro: body.adminPro === true,
    adrOverride: typeof body.adrOverride === "number" ? body.adrOverride : null,
    occOverride: typeof body.occOverride === "number" ? body.occOverride : null,
    costoElectricidad: body.costoElectricidad,
    costoAgua: body.costoAgua,
    costoWifi: body.costoWifi,
    costoInsumos: body.costoInsumos,
    gastosComunes: body.gastosComunes,
    mantencion: body.mantencion,
    contribuciones: body.contribuciones || 0,
    costoAmoblamiento: body.estaAmoblado ? 0 : (body.costoAmoblamiento || 0),
    arriendoLargoMensual: body.arriendoLargoMensual,
    valorUF: ufValue,
  };

  const result = calcShortTerm(inputs);

  // Default lat/lng a Santiago centro si no vienen (distancias a atractores).
  const lat = typeof body.lat === "number" ? body.lat : -33.4378;
  const lng = typeof body.lng === "number" ? body.lng : -70.6504;

  const monthlyRevenue = Array.isArray(airbnbData.monthly_revenue) ? airbnbData.monthly_revenue : [];
  const revenueP50 = airbnbData.percentiles?.revenue?.p50 ?? airbnbData.estimated_annual_revenue ?? 0;

  const scoreInputs: ScoreSTRInputs = {
    results: result,
    precioCompra: body.precioCompra,
    dormitorios: body.dormitorios,
    superficie: body.superficieUtil,
    regulacionEdificio: body.edificioPermiteAirbnb || "no_seguro",
    lat,
    lng,
    revenueP50,
    monthlyRevenue,
  };

  const francoScore = calcFrancoScoreSTR(scoreInputs);

  const nombre = `Renta Corta - ${body.direccion || body.comuna}`;

  return {
    ok: true,
    row: {
      nombre,
      comuna: body.comuna,
      ciudad: body.ciudad || "Santiago",
      direccion: body.direccion || null,
      tipo: "Departamento",
      tipo_analisis: "short-term",
      // Commit E.1 · 2026-05-13: STR nuevos en metodología v2.
      methodology_version: "v2",
      dormitorios: body.dormitorios,
      banos: body.banos,
      superficie: body.superficieUtil,
      antiguedad: body.tipoPropiedad === "nuevo" ? 0 : 5,
      precio: body.precioCompraUF,
      arriendo: body.arriendoLargoMensual,
      gastos: body.gastosComunes,
      contribuciones: body.contribuciones || 0,
      score: francoScore.score,
      desglose: francoScore.desglose,
      resumen: francoScore.veredicto,
      // `ocupacionRealizadaComparables` es DISPLAY-ONLY: se adjunta acá, fuera
      // de calcShortTerm/calcFrancoScoreSTR, por lo que NO toca el veredicto.
      // Vive en el helper para que single (short-term/route) y pre-pago
      // (analisis/locked) lo persistan por igual.
      results: {
        ...result,
        tipoAnalisis: "short-term",
        veredicto: francoScore.veredicto,
        francoScore,
        airbnbRaw: airbnbResult.data,
        ...(airbnbResult.realizedOccupancy
          ? { ocupacionRealizadaComparables: airbnbResult.realizedOccupancy }
          : {}),
      },
      input_data: { ...body, tipoAnalisis: "short-term" },
    },
  };
}
