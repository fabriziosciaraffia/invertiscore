import { NextResponse } from "next/server";
import type { AnalisisInput } from "@/lib/types";
import { runAnalysis } from "@/lib/analysis";
import { getUFValue } from "@/lib/uf";
import {
  createSupabaseServer,
  requireAuthenticatedUser,
  buildShortTermAnalysisRow,
  type ShortTermAnalysisBody,
} from "@/lib/api-helpers/analisis-pipeline";

// Crear un análisis BLOQUEADO pre-pago (Camino A, LTR o STR, solo logueado).
//
// Hermano de /api/analisis (LTR) y /api/analisis/short-term (STR) pero
// deliberadamente NO:
//   - NO cobra crédito (sin ensureCreditCharged/chargeAnalysisCredit).
//   - NO marca premium (sin markPremiumAndClaimPrepaid → is_premium queda false).
//   - NO dispara la narrativa IA (LTR la difiere a /api/payments/confirm; STR la
//     genera on-demand al ver el análisis ya pagado — ver results-client STR).
//
// Inserta pending_payment=true → la fila queda inerte y oculta del dashboard
// hasta que confirm la desbloquee. LTR usa runAnalysis (cálculo local gratis);
// STR usa buildShortTermAnalysisRow (incluye AirROI, normalmente cache-HIT del
// prefetch del wizard). El flujo AMBAS NO pasa por acá (crea LTR+STR aparte).
//
// El flujo: paso 4 (logueado, sin crédito) → este endpoint → /checkout?
// product=single&analysisId=<id> → Flow → confirm desbloquea (+ IA según tipo).
export async function POST(request: Request) {
  try {
    // ─── INSTRUMENTACIÓN TEMPORAL (quitar tras medir el bottleneck) ───
    // Mide cada paso para distinguir cold start / getUFValue / runAnalysis /
    // insert. Mirar logs con prefix [LOCKED-TIMING].
    const t0 = Date.now();

    const supabase = createSupabaseServer();

    const auth = await requireAuthenticatedUser(supabase);
    if (!auth.ok) return auth.response;
    const { user } = auth;
    console.log(`[LOCKED-TIMING] auth (createClient + getUser): ${Date.now() - t0}ms`);

    const body: AnalisisInput = await request.json();

    // Discriminador de modalidad. AMBAS NO pasa por acá (el flujo Ambas crea
    // LTR+STR por separado, no una sola fila bloqueada). LTR vs STR: el payload
    // STR trae precioCompra / tipoAnalisis="short-term" (mismos marcadores que
    // antes, ahora para RUTEAR en vez de rechazar).
    const maybeMod = body as unknown as { tipoAnalisis?: string; precioCompra?: unknown; modalidad?: string };
    if (maybeMod.tipoAnalisis === "both" || maybeMod.modalidad === "both") {
      return NextResponse.json(
        { error: "El flujo Ambas no se crea por este endpoint" },
        { status: 400 },
      );
    }
    const isStr = maybeMod.tipoAnalisis === "short-term" || maybeMod.precioCompra !== undefined;

    // ─── Rama STR: motor compartido (incluye AirROI), fila bloqueada ───
    if (isStr) {
      const ufStr = await getUFValue();
      const built = await buildShortTermAnalysisRow(
        body as unknown as ShortTermAnalysisBody,
        ufStr,
      );
      if (!built.ok) return built.response;

      const { data: strData, error: strError } = await supabase
        .from("analisis")
        .insert({
          ...built.row,
          user_id: user.id,
          creator_name: user?.user_metadata?.nombre || user?.user_metadata?.full_name || "Anónimo",
          // Igual que LTR locked: sin cobro, sin premium, fila oculta hasta pagar.
          is_premium: false,
          pending_payment: true,
        })
        .select("id")
        .single();

      if (strError) {
        console.error("[analisis/locked] STR Supabase insert error:", strError);
        return NextResponse.json(
          { error: "Error al guardar el análisis" },
          { status: 500 },
        );
      }

      console.log(`[LOCKED-TIMING] TOTAL handler (STR): ${Date.now() - t0}ms`);
      return NextResponse.json({ id: strData.id });
    }

    // ─── Rama LTR (sin cambios): runAnalysis + insert bloqueado ───
    // Mismo motor y misma UF explícita que /api/analisis (LTR cobrado).
    const tUf = Date.now();
    const ufValue = await getUFValue();
    console.log(`[LOCKED-TIMING] getUFValue: ${Date.now() - tUf}ms`);

    const tRun = Date.now();
    const result = runAnalysis(body, ufValue);
    console.log(`[LOCKED-TIMING] runAnalysis: ${Date.now() - tRun}ms`);

    const tIns = Date.now();

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
    console.log(`[LOCKED-TIMING] insert: ${Date.now() - tIns}ms`);

    if (error) {
      console.error("[analisis/locked] Supabase insert error:", error);
      return NextResponse.json(
        { error: "Error al guardar el análisis" },
        { status: 500 },
      );
    }

    console.log(`[LOCKED-TIMING] TOTAL handler: ${Date.now() - t0}ms`);
    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("[analisis/locked] API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
