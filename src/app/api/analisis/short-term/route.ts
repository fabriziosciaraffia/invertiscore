import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getUFValue } from "@/lib/uf";
import { calcShortTerm } from "@/lib/engines/short-term-engine";
import { consumeCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import type { AirbnbData, ShortTermInputs } from "@/lib/engines/short-term-engine";
import type {
  AirbnbEstimateData,
  AirbnbEstimateDirectData,
  AirbnbEstimateResponse,
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

    const isGuest = !user;
    const isAdmin = isAdminUser(user?.email);

    // 1b. Credit check — guests and admins skip, others need credits or subscription
    if (!isGuest && !isAdmin && user) {
      const adminDb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      const { data: creditData } = await adminDb
        .from("user_credits")
        .select("credits, subscription_status")
        .eq("user_id", user.id)
        .single();

      const hasAccess =
        creditData?.subscription_status === "active" ||
        (creditData?.credits ?? 0) > 0;

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Necesitas un crédito Pro para este análisis" },
          { status: 403 },
        );
      }
    }

    // 2. Parse body
    const body = await request.json();

    // 3. Fetch UF
    const ufValue = await getUFValue();

    // 4. Call AirROI endpoint (internal)
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const airbnbRes = await fetch(`${baseUrl}/api/airbnb/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward cookies for auth if needed
        cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        address: body.direccion,
        bedrooms: body.dormitorios,
        baths: body.banos,
        guests: body.capacidadHuespedes || 2,
      }),
    });

    const airbnbResult: AirbnbEstimateResponse = await airbnbRes.json();

    if (!airbnbResult.success) {
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
      costoAmoblamiento: body.estaAmoblado ? 0 : (body.costoAmoblamiento || 0),
      arriendoLargoMensual: body.arriendoLargoMensual,
      valorUF: ufValue,
    };

    // 6. Run engine
    const result = calcShortTerm(inputs);

    // 7. Insert in Supabase (same table as LTR)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (isGuest && !serviceRoleKey) {
      return NextResponse.json(
        { error: "Regístrate gratis para guardar tu análisis" },
        { status: 401 },
      );
    }
    const dbClient = isGuest
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey!)
      : supabase;

    const nombre = `Renta Corta - ${body.direccion || body.comuna}`;

    const { data, error } = await dbClient
      .from("analisis")
      .insert({
        user_id: user?.id ?? null,
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
        score: 0,
        desglose: {},
        resumen: result.veredicto || 'Sin veredicto',
        results: { ...result, tipoAnalisis: "short-term", airbnbRaw: airbnbResult.data },
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

    // 8. Consume credit after successful insert (admin & guests skip)
    if (!isGuest && !isAdmin && user && data?.id) {
      await consumeCredit(user.id, data.id);
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
