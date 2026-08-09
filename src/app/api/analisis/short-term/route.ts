import { NextResponse } from "next/server";
import { captureApiError, captureApiWarning } from "@/lib/observabilidad";
import { cookies } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { getUFValue } from "@/lib/uf";
import { sendMetaCapiEvent } from "@/lib/meta/capi";
import {
  createSupabaseServer,
  requireAuthenticatedUser,
  guardPlausibilidad,
  ensureCreditCharged,
  markPremiumAndClaimPrepaid,
  buildShortTermAnalysisRow,
  prefetchMedianaComunaVenta,
} from "@/lib/api-helpers/analisis-pipeline";
import { desdeBodyStr } from "@/lib/plausibilidad";
import { persistSubmitTiming, type SubmitTiming } from "@/lib/pipeline-timing";

// Goal C: techo explícito. Sin IA en este request; el riesgo es el fetch a
// AirROI (sin timeout propio) — 120s corta el cuelgue indefinido sin matar un
// cache-miss lento legítimo.
export const maxDuration = 120;

// ─── POST handler ──────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Timing por fase (Goal A): solo medición, persistencia fail-soft post-insert.
    const t0 = Date.now();
    const timing: SubmitTiming = { recibido_at: new Date(t0).toISOString(), ruta: "short-term" };

    const supabase = createSupabaseServer();

    const auth = await requireAuthenticatedUser(supabase);
    if (!auth.ok) return auth.response;
    const { user } = auth;
    timing.auth_ms = Date.now() - t0;

    const body = await request.json();
    const prepaidChargeId: string | undefined = body?.prepaidChargeId;
    // Enlace AMBAS (flujo crédito/welcome): lado STR → rol 'str'. Ver comentario
    // gemelo en /api/analisis (LTR). uuid válido o se ignora (fila suelta).
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ambasGroupId =
      typeof body?.ambasGroupId === "string" && UUID_RE.test(body.ambasGroupId)
        ? body.ambasGroupId
        : null;

    // SUBIDO sobre el cobro (PIEZA A): el guard de plausibilidad necesita la UF
    // para derivar el yield bruto. Lectura cacheada con fallback, sin efectos.
    const tUf = Date.now();
    const ufValue = await getUFValue();
    timing.uf_ms = Date.now() - tUf;

    // Guard de plausibilidad — ANTES de cobrar. Acá pesa doble: el cobro estaba
    // por delante del fetch a AirROI, así que un input imposible quemaba el
    // crédito y encima gastaba una llamada externa. Solo valida tarifa/ocupación
    // cuando el usuario las CORRIGIÓ (overrides no nulos); con la estimación de
    // AirROI no hay input humano que juzgar.
    const plausible = guardPlausibilidad(desdeBodyStr(body, ufValue), {
      userId: user.id,
      ruta: "POST /api/analisis/short-term",
    });
    if (!plausible.ok) return plausible.response;

    const tCobro = Date.now();
    const charge = await ensureCreditCharged({ user, prepaidChargeId });
    if (!charge.ok) return charge.response;
    const { prepaidNeedClaim, mode: chargeMode } = charge;
    timing.cobro_ms = Date.now() - tCobro;

    // Bloque medio (AirROI + motor + score + armado del row) compartido con
    // /api/analisis/locked vía buildShortTermAnalysisRow — un solo call-site de
    // getAirbnbEstimate (key AirROI sin drift de hash). Devuelve { ok:false,
    // response } con el mismo contrato HTTP (502 AirROI down / 400 sin datos).
    // Mediana comunal pre-fetcheada para el hallazgo de sobreprecio de la pirámide STR
    // (patrón LTR). No bloquea: cae a { mediana:null } y sobreprecio se omite.
    const tMediana = Date.now();
    const medianaComuna = await prefetchMedianaComunaVenta(
      supabase,
      { comuna: body.comuna, superficie: body.superficieUtil, dormitorios: body.dormitorios,
        esNuevo: body.tipoPropiedad === "nuevo", antiguedad: body.antiguedad },
      ufValue,
    );
    timing.mediana_ms = Date.now() - tMediana;
    const built = await buildShortTermAnalysisRow(body, ufValue, medianaComuna, timing);
    if (!built.ok) return built.response;

    // 7. Insert en Supabase (misma tabla que LTR). El row computado viene del
    // helper; acá decidimos user_id/creator_name/is_premium (cobrado → premium
    // vía markPremiumAndClaimPrepaid abajo).
    const dbClient = supabase;

    const tInsert = Date.now();
    const { data, error } = await dbClient
      .from("analisis")
      .insert({
        ...built.row,
        // Vía de cobro (opción B, espejo LTR): columna top-level, no en
        // input_data. /api/analisis/locked no la escribe (pre-pago → NULL).
        charge_mode: chargeMode,
        user_id: user.id,
        creator_name:
          user?.user_metadata?.nombre ||
          user?.user_metadata?.full_name ||
          'Anónimo',
        is_premium: false,
        // Enlace AMBAS: solo cuando el wizard pasó un group_id válido (lado STR).
        ...(ambasGroupId ? { ambas_group_id: ambasGroupId, ambas_role: "str" } : {}),
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
    timing.insert_ms = Date.now() - tInsert;
    timing.total_ms = Date.now() - t0;

    // Timing del submit (Goal A): fail-soft, un UPDATE corto vía RPC, diferido
    // con waitUntil para no sumar latencia al response. No altera nada del handler.
    if (data?.id) waitUntil(persistSubmitTiming(dbClient, data.id, timing));

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

    // Meta CAPI: Lead server-side — el usuario estrenó su análisis de bienvenida
    // en un STR SUELTO. `ambasGroupId === null` es el gate de dedup: en AMBAS el
    // cobro es uno solo y lo reporta el lado LTR (mismo criterio que el correo
    // analysis-ready), así que este lado se calla. Resto del contrato idéntico al
    // de /api/analisis: event_id = id del análisis, email hasheado en el helper,
    // sin value, waitUntil propio con su try/catch — Meta jamás rompe ni demora
    // la creación.
    if (data?.id && chargeMode === "welcome" && !ambasGroupId && user.email) {
      const leadId = data.id as string;
      const leadEmail = user.email;
      const cookieStore = cookies();
      const leadCtx = {
        eventSourceUrl: new URL(request.url).origin,
        clientIp:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
        fbp: cookieStore.get("_fbp")?.value ?? null,
        fbc: cookieStore.get("_fbc")?.value ?? null,
      };
      waitUntil((async () => {
        try {
          await sendMetaCapiEvent({
            eventName: "Lead",
            eventId: leadId,
            email: leadEmail,
            ...leadCtx,
          });
        } catch (e) {
          console.error("[short-term] Meta CAPI Lead excepción:", e);
          captureApiWarning(e, { ruta: "POST /api/analisis/short-term", operacion: "meta-capi-lead" });
        }
      })());
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[short-term] API error:", error);
    captureApiError(error, { ruta: "POST /api/analisis/short-term", operacion: "crear-analisis-str" });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
