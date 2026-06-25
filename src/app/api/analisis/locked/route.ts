import { NextResponse } from "next/server";
import type { AnalisisInput } from "@/lib/types";
import { runAnalysis } from "@/lib/analysis";
import { getUFValue } from "@/lib/uf";
import {
  createSupabaseServer,
  requireAuthenticatedUser,
  buildShortTermAnalysisRow,
  prefetchMedianaComunaVenta,
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

// ─── Builder de la fila LTR locked ──────────────────────
// Construcción de la fila LTR bloqueada (runAnalysis local + objeto insert),
// extraída para compartirla entre la rama LTR-single y la rama AMBAS. Mismo
// shape que /api/analisis (cobrado) salvo is_premium (default false) y
// pending_payment=true. NO incluye user_id/creator_name (los pone el caller,
// que tiene el `user` autenticado a mano).
function buildLockedLtrRow(
  body: AnalisisInput,
  ufValue: number,
  medianaComuna?: { mediana: number | null; n: number }
) {
  const result = runAnalysis(body, ufValue, medianaComuna);
  return {
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
    pending_payment: true,
  };
}

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

    const rawBody = await request.json();

    // Discriminador de modalidad. LTR vs STR (single): el payload STR trae
    // precioCompra / tipoAnalisis="short-term". AMBAS: trae tipoAnalisis="both"
    // con sub-payloads { ltr, str } — crea DOS filas locked en este request.
    const maybeMod = rawBody as {
      tipoAnalisis?: string;
      precioCompra?: unknown;
      modalidad?: string;
      ltr?: unknown;
      str?: unknown;
    };

    // ─── Rama AMBAS: dos filas locked (LTR + STR), sin cobro ───
    // Body { tipoAnalisis:"both", ltr:<payload LTR>, str:<payload STR> }. Ambas
    // nacen pending_payment=true / is_premium=false; confirm las desbloquea y
    // premia (ver payments/confirm rama companion_str_id). Devuelve { ltrId, strId }
    // para que el checkout lleve el LTR en analysis_id y el STR como companion.
    if (maybeMod.tipoAnalisis === "both" || maybeMod.modalidad === "both") {
      const ltrPayload = maybeMod.ltr as AnalisisInput | undefined;
      const strPayload = maybeMod.str as ShortTermAnalysisBody | undefined;
      if (!ltrPayload || !strPayload) {
        return NextResponse.json(
          { error: "Faltan los payloads ltr/str para el flujo Ambas" },
          { status: 400 },
        );
      }

      const ufBoth = await getUFValue();
      // STR primero: puede fallar (AirROI caído / sin datos) con su propio
      // contrato HTTP. Si falla, abortamos sin haber insertado el LTR.
      const builtStr = await buildShortTermAnalysisRow(strPayload, ufBoth);
      if (!builtStr.ok) return builtStr.response;

      // Mediana comunal pre-fetcheada para inyectar al motor LTR (patrón cap_rate).
      const medianaLtr = await prefetchMedianaComunaVenta(supabase, ltrPayload, ufBoth);

      const creatorName =
        user?.user_metadata?.nombre || user?.user_metadata?.full_name || "Anónimo";

      const { data: ltrData, error: ltrErr } = await supabase
        .from("analisis")
        .insert({
          ...buildLockedLtrRow(ltrPayload, ufBoth, medianaLtr),
          user_id: user.id,
          creator_name:
            user?.user_metadata?.nombre || user?.user_metadata?.full_name || null,
          is_premium: false,
        })
        .select("id")
        .single();
      if (ltrErr || !ltrData) {
        console.error("[analisis/locked] BOTH LTR insert error:", ltrErr);
        return NextResponse.json({ error: "Error al guardar el análisis" }, { status: 500 });
      }

      const { data: strData, error: strErr } = await supabase
        .from("analisis")
        .insert({
          ...builtStr.row,
          user_id: user.id,
          creator_name: creatorName,
          is_premium: false,
          pending_payment: true,
        })
        .select("id")
        .single();
      if (strErr || !strData) {
        console.error("[analisis/locked] BOTH STR insert error:", strErr);
        return NextResponse.json({ error: "Error al guardar el análisis" }, { status: 500 });
      }

      console.log(`[LOCKED-TIMING] TOTAL handler (BOTH): ${Date.now() - t0}ms`);
      return NextResponse.json({ ltrId: ltrData.id, strId: strData.id });
    }

    const body = rawBody as AnalisisInput;
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

    // ─── Rama LTR (single): runAnalysis + insert bloqueado ───
    // Mismo motor y misma UF explícita que /api/analisis (LTR cobrado). El row
    // sale de buildLockedLtrRow (compartido con la rama AMBAS); is_premium queda
    // en su default false y pending_payment=true (incluido en el row).
    const tUf = Date.now();
    const ufValue = await getUFValue();
    console.log(`[LOCKED-TIMING] getUFValue: ${Date.now() - tUf}ms`);

    // Mediana comunal pre-fetcheada para inyectar al motor (patrón cap_rate).
    const medianaLtr = await prefetchMedianaComunaVenta(supabase, body, ufValue);

    const tIns = Date.now();
    const { data, error } = await supabase
      .from("analisis")
      .insert({
        ...buildLockedLtrRow(body, ufValue, medianaLtr),
        user_id: user.id,
        creator_name: user?.user_metadata?.nombre || user?.user_metadata?.full_name || null,
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
