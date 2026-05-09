import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getUFValue } from "@/lib/uf";
import { calcShortTerm } from "@/lib/engines/short-term-engine";
import { calcFrancoScoreSTR, type ScoreSTRInputs } from "@/lib/engines/short-term-score";
import { chargeAnalysisCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import { getAirbnbEstimate } from "@/lib/airbnb/get-estimate";

function createPaymentsAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
import type { AirbnbData, ShortTermInputs } from "@/lib/engines/short-term-engine";
import type {
  AirbnbEstimateData,
  AirbnbEstimateDirectData,
} from "@/lib/airbnb/types";

// ─── Supabase helpers (same pattern as /api/analisis) ──

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
    // 1. Auth — same pattern as /api/analisis
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Solo usuarios registrados crean análisis (Backlog #3).
    if (!user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para crear un análisis" },
        { status: 401 },
      );
    }

    const isAdmin = isAdminUser(user.email);

    // 2. Parse body (antes que charge para leer prepaidChargeId)
    const body = await request.json();
    const prepaidChargeId: string | undefined = body?.prepaidChargeId;

    // 1b. Cobro de crédito (welcome / paid / subscription). Admin bypass.
    // Si viene prepaidChargeId (flujo AMBAS), validamos contra payments en
    // vez de cobrar de nuevo. Ver /api/credits/charge.
    let prepaidNeedClaim = false;

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
        return NextResponse.json(
          { error: "Charge inválido o no encontrado" },
          { status: 403 },
        );
      }

      if (charge.consumed_at === null) {
        prepaidNeedClaim = true; // somos los primeros, claim post-insert
      } else {
        const intent = (charge.payment_data as { intent?: string } | null)?.intent;
        if (intent !== "both") {
          return NextResponse.json(
            { error: "Charge ya consumido" },
            { status: 403 },
          );
        }
      }
    } else if (!isAdmin) {
      const charge = await chargeAnalysisCredit(user.id, null);
      if (!charge.ok) {
        return NextResponse.json({ error: charge.message }, { status: 403 });
      }
    }

    // 3. Fetch UF
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

    // 8. Marcar análisis como premium tras cobro exitoso (o admin bypass).
    // Backlog #3: TODOS los análisis del registrado son premium completos —
    // el welcome credit otorga el mismo nivel que un crédito comprado.
    if (data?.id) {
      await dbClient.from("analisis").update({ is_premium: true }).eq("id", data.id);
      data.is_premium = true;

      // Claim del prepaid charge si nosotros llegamos primero (flujo AMBAS).
      // .is('consumed_at', null) garantiza idempotencia ante el segundo POST.
      if (prepaidChargeId && prepaidNeedClaim) {
        const paymentsAdmin = createPaymentsAdminClient();
        await paymentsAdmin
          .from("payments")
          .update({
            consumed_at: new Date().toISOString(),
            consumed_by_analysis_id: data.id,
          })
          .eq("commerce_order", prepaidChargeId)
          .is("consumed_at", null);
      }
    }

    // 9. Return the inserted row
    return NextResponse.json(data);
  } catch (error) {
    console.error("[short-term] API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
