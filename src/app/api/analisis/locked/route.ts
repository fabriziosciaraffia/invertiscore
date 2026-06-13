import { NextResponse } from "next/server";
import type { AnalisisInput } from "@/lib/types";
import { runAnalysis } from "@/lib/analysis";
import { getUFValue } from "@/lib/uf";
import {
  createSupabaseServer,
  requireAuthenticatedUser,
} from "@/lib/api-helpers/analisis-pipeline";

// Crear un análisis LTR BLOQUEADO pre-pago (Camino A, solo LTR + solo logueado).
//
// Hermano de /api/analisis (LTR cobrado) pero deliberadamente NO:
//   - NO cobra crédito (sin ensureCreditCharged/chargeAnalysisCredit).
//   - NO marca premium (sin markPremiumAndClaimPrepaid → is_premium queda false).
//   - NO dispara la narrativa IA (Anthropic se difiere a /api/payments/confirm
//     tras el pago, para no gastar tokens en quien abandona el checkout).
//
// Inserta pending_payment=true → la fila queda inerte y oculta del dashboard
// hasta que confirm la desbloquee. El motor (runAnalysis) es cálculo local
// gratis, así que computar la fila por adelantado no tiene costo de API.
//
// El flujo: paso 4 (logueado, LTR, sin crédito) → este endpoint → /checkout?
// product=single&analysisId=<id> → Flow → confirm desbloquea + dispara IA.
export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();

    const auth = await requireAuthenticatedUser(supabase);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body: AnalisisInput = await request.json();

    // Guard LTR-only: este endpoint NO computa STR (crear STR pagaría AirROI al
    // crear, fuera de alcance). Rechazar payloads con marcadores short-term.
    const maybeStr = body as unknown as { tipoAnalisis?: string; precioCompra?: unknown };
    if (maybeStr.tipoAnalisis === "short-term" || maybeStr.precioCompra !== undefined) {
      return NextResponse.json(
        { error: "Este endpoint solo crea análisis de renta larga (LTR)" },
        { status: 400 },
      );
    }

    // Mismo motor y misma UF explícita que /api/analisis (LTR cobrado).
    const ufValue = await getUFValue();
    const result = runAnalysis(body, ufValue);

    // Mismo insert que /api/analisis (route.ts), con dos diferencias:
    //   - is_premium queda en su default false (NO se llama markPremium).
    //   - pending_payment=true (oculta la fila del dashboard hasta el pago).
    const { data, error } = await supabase
      .from("analisis")
      .insert({
        user_id: user.id,
        nombre: body.nombre,
        comuna: body.comuna,
        ciudad: body.ciudad,
        direccion: body.direccion || null,
        tipo: body.tipo,
        tipo_analisis: "long-term",
        methodology_version: "v2",
        dormitorios: body.dormitorios,
        banos: body.banos,
        superficie: body.superficie,
        antiguedad: body.antiguedad,
        precio: body.precio,
        arriendo: body.arriendo,
        gastos: body.gastos,
        contribuciones: body.contribuciones,
        score: result.score,
        desglose: result.desglose,
        resumen: result.resumen,
        results: result,
        input_data: body,
        creator_name: user?.user_metadata?.nombre || user?.user_metadata?.full_name || null,
        pending_payment: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[analisis/locked] Supabase insert error:", error);
      return NextResponse.json(
        { error: "Error al guardar el análisis" },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("[analisis/locked] API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
