import { NextResponse } from "next/server";
import { getUFValue } from "@/lib/uf";
import { calcShortTerm } from "@/lib/engines/short-term-engine";
import { calcFrancoScoreSTR, type ScoreSTRInputs } from "@/lib/engines/short-term-score";
import { getAirbnbEstimate } from "@/lib/airbnb/get-estimate";
import {
  createSupabaseServer,
  requireAuthenticatedUser,
  ensureCreditCharged,
  markPremiumAndClaimPrepaid,
} from "@/lib/api-helpers/analisis-pipeline";
import type { AirbnbData, ShortTermInputs } from "@/lib/engines/short-term-engine";
import type {
  AirbnbEstimateData,
  AirbnbEstimateDirectData,
} from "@/lib/airbnb/types";

// ─── Build AirbnbData for the engine ───────────────────
// The engine expects percentiles and monthly factors.
// "calculator_direct" responses include them; "comparables" responses don't.

function isDirectData(d: AirbnbEstimateData | AirbnbEstimateDirectData): d is AirbnbEstimateDirectData {
  return "estimated_adr" in d;
}

/** Even monthly distribution — 1/12 each month */
const FLAT_MONTHLY = Array(12).fill(1 / 12) as number[];

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

// ─── POST handler ──────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();

    const auth = await requireAuthenticatedUser(supabase);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body = await request.json();
    const prepaidChargeId: string | undefined = body?.prepaidChargeId;

    const charge = await ensureCreditCharged({ user, prepaidChargeId });
    if (!charge.ok) return charge.response;
    const { prepaidNeedClaim } = charge;

    const ufValue = await getUFValue();

    // 4. Call AirROI directly (sin sub-fetch HTTP). Bug 2026-05-09:
    // el sub-fetch HTTP a /api/airbnb/estimate sufría doble cold start +
    // doble timeout en flujo AMBAS y devolvía HTML cuando la function
    // colapsaba — el `airbnbRes.json()` parseaba HTML y tiraba SyntaxError
    // genérico en el catch al final (analizado: 71f4d2fd-fd98-…). La lógica
    // core vive en `lib/airbnb/get-estimate.ts` y se llama directo.
    let airbnbResult;
    try {
      airbnbResult = await getAirbnbEstimate(
        body.direccion,
        body.dormitorios,
        body.banos,
        body.capacidadHuespedes || 2,
      );
    } catch (err) {
      console.error("[short-term] AirROI lib threw:", err);
      return NextResponse.json(
        { error: "Estimación de Airbnb no disponible. Intenta de nuevo en unos segundos." },
        { status: 502 },
      );
    }

    if (!airbnbResult.success) {
      console.error("[short-term] AirROI failed:", airbnbResult.error, airbnbResult.message);
      // Diferenciar AirROI down (502) vs caso legítimo sin data (400)
      if (airbnbResult.error === "airbnb_api_error") {
        return NextResponse.json(
          { error: "Estimación de Airbnb no disponible. Intenta de nuevo en unos segundos." },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { error: "No se encontraron datos de Airbnb para esta dirección. Verifica que sea una dirección válida en Santiago." },
        { status: 400 },
      );
    }

    // 5. Build engine inputs
    const airbnbData = buildAirbnbData(airbnbResult.data, ufValue);

    const inputs: ShortTermInputs = {
      precioCompra: body.precioCompra,
      superficie: body.superficieUtil,
      dormitorios: body.dormitorios,
      banos: body.banos,
      piePercent: body.piePct / 100,
      tasaCredito: body.tasaInteres / 100,
      plazoCredito: body.plazoCredito,
      airbnbData,
      modoGestion: body.modoGestion,
      comisionAdministrador: body.comisionAdministrador,
      // Calibración v1 — los 3 ejes operacionales. Si el form aún no los envía,
      // defaults en el motor dan baseline residencial puro (occ 55%, sin uplift ADR).
      tipoEdificio: body.tipoEdificio,
      habilitacion: body.habilitacion,
      adminPro: body.adminPro === true,
      // Overrides manuales (2026-05-10). Valor numérico válido prevalece sobre
      // el derivado de ejes; null/undefined → usar derivado.
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

    // 6. Run engine
    const result = calcShortTerm(inputs);

    // 6b. Compute Franco Score STR
    // Default lat/lng to Santiago centro if not provided (so distances to attractors still compute)
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
      distanciaMetro: typeof body.distanciaMetro === "number" ? body.distanciaMetro : 2000,
    };

    const francoScore = calcFrancoScoreSTR(scoreInputs);

    // 7. Insert in Supabase (same table as LTR)
    const dbClient = supabase;

    const nombre = `Renta Corta - ${body.direccion || body.comuna}`;

    const { data, error } = await dbClient
      .from("analisis")
      .insert({
        user_id: user.id,
        nombre,
        comuna: body.comuna,
        ciudad: body.ciudad || "Santiago",
        direccion: body.direccion || null,
        tipo: "Departamento",
        tipo_analisis: "short-term",
        dormitorios: body.dormitorios,
        banos: body.banos,
        superficie: body.superficieUtil,
        antiguedad: body.tipoPropiedad === 'nuevo' ? 0 : 5,
        precio: body.precioCompraUF,
        arriendo: body.arriendoLargoMensual,
        gastos: body.gastosComunes,
        contribuciones: body.contribuciones || 0,
        score: francoScore.score,
        desglose: francoScore.desglose,
        resumen: francoScore.veredicto,
        // results.tipoAnalisis y input_data.tipoAnalisis se preservan para
        // backward-compat con análisis pre-migration que se leen por JSON.
        results: { ...result, tipoAnalisis: "short-term", veredicto: francoScore.veredicto, francoScore, airbnbRaw: airbnbResult.data },
        input_data: { ...body, tipoAnalisis: "short-term" },
        creator_name:
          user?.user_metadata?.nombre ||
          user?.user_metadata?.full_name ||
          'Anónimo',
        is_premium: false,
      })
      .select()
      .single();

    if (error) {
      console.error("[short-term] Supabase insert error:", error);
      return NextResponse.json(
        { error: "Error al guardar el análisis" },
        { status: 500 },
      );
    }

    // Mark premium + claim prepaid (helper compartido con LTR endpoint).
    if (data?.id) {
      await markPremiumAndClaimPrepaid({
        dbClient,
        analysisId: data.id,
        prepaidChargeId,
        prepaidNeedClaim,
      });
      data.is_premium = true;

      // Calibración v1 — captura del operador del edificio (opcional).
      // Falla silenciosamente si `operadores_str_reportados` aún no existe.
      const operadorReportado: string | undefined =
        typeof body.operadorNombre === "string" ? body.operadorNombre.trim() : undefined;
      if (body.tipoEdificio === "dedicado" && operadorReportado) {
        try {
          await dbClient.from("operadores_str_reportados").insert({
            analisis_id: data.id,
            operador_nombre: operadorReportado.slice(0, 200),
            direccion_aproximada: body.direccion ?? null,
            comuna: body.comuna ?? null,
            lat: typeof body.lat === "number" ? body.lat : null,
            lng: typeof body.lng === "number" ? body.lng : null,
            reportado_por_usuario_id: user.id,
          });
        } catch (e) {
          console.warn("[short-term] operadores_str_reportados insert falló (¿tabla aplicada?):", e);
        }
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[short-term] API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
