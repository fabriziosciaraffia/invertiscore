import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { randomUUID } from "crypto";
import type { AnalisisInput } from "@/lib/types";
import { runAnalysis } from "@/lib/analysis";
import { getUFValue } from "@/lib/uf";
import {
  createSupabaseServer,
  requireAuthenticatedUser,
  guardPlausibilidad,
  buildShortTermAnalysisRow,
  prefetchMedianaComunaVenta,
  buildMedianaSnapshot,
  type ShortTermAnalysisBody,
} from "@/lib/api-helpers/analisis-pipeline";
import { desdeBodyLtr, desdeBodyStr } from "@/lib/plausibilidad";
import { AMBAS_ENABLED, AMBAS_OFF_ERROR } from "@/lib/ambas-flag";
import { redondearPiePct } from "@/lib/analysis/pie-input-data";
import { METHODOLOGY_VERSION_ACTUAL } from "@/lib/modelo-costos";
import { waitUntil } from "@vercel/functions";
import { persistSubmitTiming, type SubmitTiming } from "@/lib/pipeline-timing";

// Goal C: mismo perfil que /api/analisis/short-term (sin IA; AirROI en la rama
// STR es el único fetch externo sin timeout).
export const maxDuration = 120;

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
  // Precisión canónica del pie (fix pie-redondeo, defensa en profundidad):
  // mismo criterio que /api/analisis — se normaliza antes del motor y del
  // input_data. Único punto para las ramas LTR-single y AMBAS.
  if (Number.isFinite(body.piePct)) body.piePct = redondearPiePct(body.piePct);
  // Versión de metodología en el body (gate del modelo de costos; se persiste en
  // input_data). Mismo criterio que /api/analisis. Ver modelo-costos.ts.
  body.methodologyVersion = METHODOLOGY_VERSION_ACTUAL;
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
    // Snapshot de la mediana (Fase A): null si el caller no resolvió mediana.
    mediana_comuna_snapshot: medianaComuna ? buildMedianaSnapshot(medianaComuna) : null,
    pending_payment: true,
  };
}

export async function POST(request: Request) {
  try {
    // ─── INSTRUMENTACIÓN TEMPORAL (quitar tras medir el bottleneck) ───
    // Mide cada paso para distinguir cold start / getUFValue / runAnalysis /
    // insert. Mirar logs con prefix [LOCKED-TIMING].
    const t0 = Date.now();
    // Timing persistido (Goal A): convive con los console.log [LOCKED-TIMING]
    // (que son temporales); `ruta` se ajusta por rama antes de persistir.
    const timing: SubmitTiming = { recibido_at: new Date(t0).toISOString(), ruta: "locked-ltr" };

    const supabase = createSupabaseServer();

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

    // Interruptor de AMBAS — antes de la sesión, de la UF, del motor y de
    // cualquier insert. Igual que en /api/credits/charge: es una decisión de
    // producto, no de autorización, y ponerlo delante lo hace verificable sin
    // sesión. Pesa más acá que en ningún otro punto: este camino termina en
    // /checkout con pago real por Flow, así que una fila pending_payment de un
    // producto que ya no se ofrece exigiría reembolso manual.
    if (
      (maybeMod.tipoAnalisis === "both" || maybeMod.modalidad === "both") &&
      !AMBAS_ENABLED
    ) {
      return NextResponse.json({ error: AMBAS_OFF_ERROR }, { status: 400 });
    }

    const auth = await requireAuthenticatedUser(supabase);
    if (!auth.ok) return auth.response;
    const { user } = auth;
    console.log(`[LOCKED-TIMING] auth (createClient + getUser): ${Date.now() - t0}ms`);
    timing.auth_ms = Date.now() - t0;

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

      timing.ruta = "locked-both";
      const tUfBoth = Date.now();
      const ufBoth = await getUFValue();
      timing.uf_ms = Date.now() - tUfBoth;

      // Guard de plausibilidad — antes de TODO (AirROI, motor, inserts). Acá no
      // se cobra crédito, pero este camino termina en /checkout con pago REAL
      // por Flow y emisión de boleta: un análisis imposible que llegue a pagarse
      // exige reembolso manual. Rechazar acá no deja fila ni pending_payment.
      const plausibleBoth = guardPlausibilidad(
        {
          ...desdeBodyLtr(ltrPayload, ufBoth),
          // Las dos ramas comparten precio/superficie; la STR solo aporta los
          // overrides de tarifa/ocupación cuando el usuario los corrigió.
          str: desdeBodyStr(strPayload, ufBoth).str,
        },
        { userId: user.id, ruta: "POST /api/analisis/locked (both)" },
      );
      if (!plausibleBoth.ok) return plausibleBoth.response;

      // STR primero: puede fallar (AirROI caído / sin datos) con su propio
      // contrato HTTP. Si falla, abortamos sin haber insertado el LTR.
      const tMedianaBoth = Date.now();
      const medianaStrBoth = await prefetchMedianaComunaVenta(
        supabase,
        { comuna: strPayload.comuna ?? "", superficie: strPayload.superficieUtil, dormitorios: strPayload.dormitorios,
          esNuevo: strPayload.tipoPropiedad === "nuevo", antiguedad: strPayload.antiguedad },
        ufBoth,
      );
      timing.mediana_ms = Date.now() - tMedianaBoth;
      const builtStr = await buildShortTermAnalysisRow(strPayload, ufBoth, medianaStrBoth, timing);
      if (!builtStr.ok) return builtStr.response;

      // Mediana comunal pre-fetcheada para inyectar al motor LTR (patrón cap_rate).
      // Su costo se SUMA a mediana_ms (dos prefetch en esta rama).
      const tMedianaLtr = Date.now();
      const medianaLtr = await prefetchMedianaComunaVenta(supabase, ltrPayload, ufBoth);
      timing.mediana_ms = (timing.mediana_ms ?? 0) + (Date.now() - tMedianaLtr);

      const creatorName =
        user?.user_metadata?.nombre || user?.user_metadata?.full_name || "Anónimo";

      // Enlace de subordinación AMBAS (migración 20260715): el group_id nace acá,
      // compartido por las dos filas del par; cada una lleva su rol. El dashboard
      // colapsa el par en una card comparativa y las páginas hijas resuelven el
      // hermano por este group_id. Insert atómico-por-par: ambas filas se crean
      // en el mismo request, así que no hay ventana de huérfano en el flujo locked.
      const ambasGroupId = randomUUID();

      const tInsBoth = Date.now();
      const { data: ltrData, error: ltrErr } = await supabase
        .from("analisis")
        .insert({
          ...buildLockedLtrRow(ltrPayload, ufBoth, medianaLtr),
          user_id: user.id,
          creator_name:
            user?.user_metadata?.nombre || user?.user_metadata?.full_name || null,
          is_premium: false,
          ambas_group_id: ambasGroupId,
          ambas_role: "ltr",
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
          ambas_group_id: ambasGroupId,
          ambas_role: "str",
        })
        .select("id")
        .single();
      if (strErr || !strData) {
        console.error("[analisis/locked] BOTH STR insert error:", strErr);
        return NextResponse.json({ error: "Error al guardar el análisis" }, { status: 500 });
      }

      console.log(`[LOCKED-TIMING] TOTAL handler (BOTH): ${Date.now() - t0}ms`);
      timing.insert_ms = Date.now() - tInsBoth;
      timing.total_ms = Date.now() - t0;
      // Mismo bloque submit a las DOS filas del par (el request fue uno solo).
      waitUntil(Promise.all([
        persistSubmitTiming(supabase, ltrData.id, timing),
        persistSubmitTiming(supabase, strData.id, timing),
      ]));
      return NextResponse.json({ ltrId: ltrData.id, strId: strData.id });
    }

    const body = rawBody as AnalisisInput;
    const isStr = maybeMod.tipoAnalisis === "short-term" || maybeMod.precioCompra !== undefined;

    // ─── Rama STR: motor compartido (incluye AirROI), fila bloqueada ───
    if (isStr) {
      timing.ruta = "locked-str";
      const tUfStr = Date.now();
      const ufStr = await getUFValue();
      timing.uf_ms = Date.now() - tUfStr;
      const bodyStr = body as unknown as ShortTermAnalysisBody;

      // Guard de plausibilidad — antes del fetch a AirROI y del insert.
      const plausibleStr = guardPlausibilidad(desdeBodyStr(bodyStr, ufStr), {
        userId: user.id,
        ruta: "POST /api/analisis/locked (str)",
      });
      if (!plausibleStr.ok) return plausibleStr.response;

      const tMedianaStr = Date.now();
      const medianaStr = await prefetchMedianaComunaVenta(
        supabase,
        { comuna: bodyStr.comuna ?? "", superficie: bodyStr.superficieUtil, dormitorios: bodyStr.dormitorios,
          esNuevo: bodyStr.tipoPropiedad === "nuevo", antiguedad: bodyStr.antiguedad },
        ufStr,
      );
      timing.mediana_ms = Date.now() - tMedianaStr;
      const built = await buildShortTermAnalysisRow(bodyStr, ufStr, medianaStr, timing);
      if (!built.ok) return built.response;

      const tInsStr = Date.now();
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
      timing.insert_ms = Date.now() - tInsStr;
      timing.total_ms = Date.now() - t0;
      waitUntil(persistSubmitTiming(supabase, strData.id, timing));
      return NextResponse.json({ id: strData.id });
    }

    // ─── Rama LTR (single): runAnalysis + insert bloqueado ───
    // Mismo motor y misma UF explícita que /api/analisis (LTR cobrado). El row
    // sale de buildLockedLtrRow (compartido con la rama AMBAS); is_premium queda
    // en su default false y pending_payment=true (incluido en el row).
    const tUf = Date.now();
    const ufValue = await getUFValue();
    console.log(`[LOCKED-TIMING] getUFValue: ${Date.now() - tUf}ms`);
    timing.uf_ms = Date.now() - tUf;

    // Guard de plausibilidad — antes de runAnalysis (que corre dentro de
    // buildLockedLtrRow, inline en el insert de abajo) y antes del insert.
    const plausibleLtr = guardPlausibilidad(desdeBodyLtr(body, ufValue), {
      userId: user.id,
      ruta: "POST /api/analisis/locked (ltr)",
    });
    if (!plausibleLtr.ok) return plausibleLtr.response;

    // Mediana comunal pre-fetcheada para inyectar al motor (patrón cap_rate).
    const tMedianaLtrSolo = Date.now();
    const medianaLtr = await prefetchMedianaComunaVenta(supabase, body, ufValue);
    timing.mediana_ms = Date.now() - tMedianaLtrSolo;

    // Hoisteado del insert para medir el motor aparte del write (Goal A) —
    // misma construcción, mismo orden, cero cambio de comportamiento.
    const tMotorLtr = Date.now();
    const ltrRowBuilt = buildLockedLtrRow(body, ufValue, medianaLtr);
    timing.motor_ms = Date.now() - tMotorLtr;

    const tIns = Date.now();
    const { data, error } = await supabase
      .from("analisis")
      .insert({
        ...ltrRowBuilt,
        user_id: user.id,
        creator_name: user?.user_metadata?.nombre || user?.user_metadata?.full_name || null,
      })
      .select("id")
      .single();
    console.log(`[LOCKED-TIMING] insert: ${Date.now() - tIns}ms`);
    timing.insert_ms = Date.now() - tIns;

    if (error) {
      console.error("[analisis/locked] Supabase insert error:", error);
      return NextResponse.json(
        { error: "Error al guardar el análisis" },
        { status: 500 },
      );
    }

    console.log(`[LOCKED-TIMING] TOTAL handler: ${Date.now() - t0}ms`);
    timing.total_ms = Date.now() - t0;
    waitUntil(persistSubmitTiming(supabase, data.id, timing));
    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("[analisis/locked] API error:", error);
    // Mismo gap que POST /api/analisis: si esto explota antes del INSERT, el
    // usuario intentó crear un análisis bloqueado y no queda rastro en la base.
    captureApiError(error, { ruta: "POST /api/analisis/locked", operacion: "crear-analisis-bloqueado" });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
