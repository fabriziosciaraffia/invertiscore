import { NextResponse } from "next/server";
import { getUFValue } from "@/lib/uf";
import {
  createSupabaseServer,
  requireAuthenticatedUser,
  ensureCreditCharged,
  markPremiumAndClaimPrepaid,
  buildShortTermAnalysisRow,
  prefetchMedianaComunaVenta,
} from "@/lib/api-helpers/analisis-pipeline";

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

    // Bloque medio (AirROI + motor + score + armado del row) compartido con
    // /api/analisis/locked vía buildShortTermAnalysisRow — un solo call-site de
    // getAirbnbEstimate (key AirROI sin drift de hash). Devuelve { ok:false,
    // response } con el mismo contrato HTTP (502 AirROI down / 400 sin datos).
    // Mediana comunal pre-fetcheada para el hallazgo de sobreprecio de la pirámide STR
    // (patrón LTR). No bloquea: cae a { mediana:null } y sobreprecio se omite.
    const medianaComuna = await prefetchMedianaComunaVenta(
      supabase,
      { comuna: body.comuna, superficie: body.superficieUtil, dormitorios: body.dormitorios },
      ufValue,
    );
    const built = await buildShortTermAnalysisRow(body, ufValue, medianaComuna);
    if (!built.ok) return built.response;

    // 7. Insert en Supabase (misma tabla que LTR). El row computado viene del
    // helper; acá decidimos user_id/creator_name/is_premium (cobrado → premium
    // vía markPremiumAndClaimPrepaid abajo).
    const dbClient = supabase;

    const { data, error } = await dbClient
      .from("analisis")
      .insert({
        ...built.row,
        user_id: user.id,
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
