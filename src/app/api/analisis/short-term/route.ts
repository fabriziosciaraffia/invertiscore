import { NextResponse } from "next/server";
import { captureApiError, captureApiWarning } from "@/lib/observabilidad";
import { cookies } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { getUFValue } from "@/lib/uf";
import { sendMetaCapiEvent } from "@/lib/meta/capi";
import {
  createSupabaseServer,
  guardPlausibilidad,
  ensureCreditCharged,
  markPremiumAndClaimPrepaid,
  buildShortTermAnalysisRow,
  prefetchMedianaComunaVenta,
} from "@/lib/api-helpers/analisis-pipeline";
import {
  resolveActor,
  emitirCookieAnon,
  createAnonPipelineClient,
  CHARGE_MODE_ANON,
} from "@/lib/api-helpers/anon-cap";
import { AMBAS_ENABLED } from "@/lib/ambas-flag";
import { desdeBodyStr } from "@/lib/plausibilidad";
import { persistSubmitTiming, type SubmitTiming } from "@/lib/pipeline-timing";
import Anthropic from "@anthropic-ai/sdk";
import { generarYPersistirProsaStr } from "@/lib/str-prosa-persist";

const anthropic = new Anthropic();

// Goal F: techo explícito 300s — desde este goal la generación de prosa STR
// corre en el waitUntil de ESTA invocación (patrón LTR, Goal C), así que el
// techo pasa de 120 (solo AirROI) a 300. ACOPLADO al criterio de "generación
// muerta" del ai-status STR (UMBRAL_MUERTA_MS = 6 min > 300s): si subes esto,
// sube el umbral allá.
export const maxDuration = 300;

// ─── POST handler ──────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Timing por fase (Goal A): solo medición, persistencia fail-soft post-insert.
    const t0 = Date.now();
    const timing: SubmitTiming = { recibido_at: new Date(t0).toISOString(), ruta: "short-term" };

    const supabase = createSupabaseServer();

    // Body ANTES del actor (cap anónimo F2-2): la rama anónima necesita
    // `turnstileToken` y `ambasGroupId`. Ver comentario gemelo en /api/analisis.
    const body = await request.json();
    const prepaidChargeId: string | undefined = body?.prepaidChargeId;
    // Enlace AMBAS (flujo crédito/welcome): lado STR → rol 'str'. Ver comentario
    // gemelo en /api/analisis (LTR). uuid válido o se ignora (fila suelta).
    // Con el interruptor de AMBAS apagado se IGNORA (ver comentario gemelo en
    // /api/analisis): la fila queda como STR suelto. Efecto lateral buscado —
    // `ambasGroupId === null` es también el gate de dedup del email de
    // bienvenida más abajo, así que el STR vuelve a comportarse como uno suelto
    // de punta a punta.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ambasGroupId =
      AMBAS_ENABLED && typeof body?.ambasGroupId === "string" && UUID_RE.test(body.ambasGroupId)
        ? body.ambasGroupId
        : null;

    // En AMBAS anónimo este es el SEGUNDO POST del par serializado: la cookie
    // emitida por el POST LTR ya viaja acá, y resolveActor la reconoce como
    // hermano (mismo token + mismo group_id) en vez de rechazarla como cap
    // consumido. STR suelto anónimo cae en la rama "anon" normal.
    const actor = await resolveActor(supabase, request, {
      turnstileToken: body?.turnstileToken,
      ambasGroupId,
    });
    if (actor.tipo === "rechazado") return actor.response;
    const user = actor.tipo === "user" ? actor.user : null;
    const esAnon = actor.tipo !== "user";
    timing.auth_ms = Date.now() - t0;

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
      userId: user?.id,
      ruta: "POST /api/analisis/short-term",
    });
    if (!plausible.ok) return plausible.response;

    // Cobro: solo con sesión (espejo LTR). La rama anónima no cobra — su vía
    // es el cap; el welcome se consume en el claim.
    const tCobro = Date.now();
    let prepaidNeedClaim = false;
    let chargeMode: string = CHARGE_MODE_ANON;
    if (user) {
      const charge = await ensureCreditCharged({ user, prepaidChargeId });
      if (!charge.ok) return charge.response;
      prepaidNeedClaim = charge.prepaidNeedClaim;
      chargeMode = charge.mode;
    }
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
    // Rama anónima: service-role (espejo LTR — RLS no contempla escrituras anon).
    const dbClient = esAnon ? createAnonPipelineClient() : supabase;

    const tInsert = Date.now();
    const { data, error } = await dbClient
      .from("analisis")
      .insert({
        ...built.row,
        // Vía de cobro (opción B, espejo LTR): columna top-level, no en
        // input_data. /api/analisis/locked no la escribe (pre-pago → NULL).
        charge_mode: chargeMode,
        user_id: user?.id ?? null,
        creator_name:
          user?.user_metadata?.nombre ||
          user?.user_metadata?.full_name ||
          (user ? 'Anónimo' : null),
        is_premium: false,
        // Cap anónimo: hash del token de la cookie (ventana de claim). En el
        // hermano AMBAS es el MISMO hash del LTR — el claim adopta el par junto.
        ...(actor.tipo === "anon" || actor.tipo === "anon-hermano"
          ? { anon_claim_token_hash: actor.tokenHash }
          : {}),
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

    // Cookie del cap — tras el INSERT exitoso (espejo LTR). Solo el STR SUELTO
    // anónimo la emite; el hermano AMBAS ya la tiene del POST LTR.
    if (actor.tipo === "anon") emitirCookieAnon(actor.token);

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

      // Goal F — generación de prosa en BACKGROUND (patrón LTR, Goal C): corre
      // en el waitUntil de esta invocación, el response no espera. El cliente
      // la recupera por polling a /short-term/[id]/ai-status; si esto muere,
      // el rescate con dictamen server regenera. Un fallo acá NUNCA rompe la
      // creación (el helper captura y registra en pipeline_timing).
      {
        const analysisRow = data as Record<string, unknown>;
        const analysisIdBg = data.id as string;
        waitUntil(
          generarYPersistirProsaStr({
            analysisId: analysisIdBg,
            analysis: analysisRow,
            supabase: dbClient,
            anthropic,
            trigger: "background",
          }).then(() => undefined),
        );
      }

      // Calibración v1 — captura del operador del edificio (opcional).
      // Falla silenciosamente si `operadores_str_reportados` aún no existe.
      const operadorReportado: string | undefined =
        typeof body.operadorNombre === "string" ? body.operadorNombre.trim() : undefined;
      // Solo con sesión: el reporte lleva `reportado_por_usuario_id` y un
      // anónimo no tiene id que poner (el wizard v4 además no llega acá con
      // tipoEdificio "dedicado" — el campo es del wizard STR legacy).
      if (user && body.tipoEdificio === "dedicado" && operadorReportado) {
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
    // de /api/analisis: event_id = `lead-<userId>` (unificado post-F2 con el
    // Lead del claim — un usuario, un Lead, dedup por id compartido), email
    // hasheado en el helper, sin value, waitUntil propio con su try/catch —
    // Meta jamás rompe ni demora la creación.
    if (data?.id && chargeMode === "welcome" && !ambasGroupId && user?.email) {
      const leadId = `lead-${user.id}`;
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
