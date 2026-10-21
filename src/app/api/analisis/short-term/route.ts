import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { waitUntil } from "@vercel/functions";
import { getUFValue } from "@/lib/uf";
import { capturarAnalisisCreado } from "@/lib/medicion-activacion";
import { capturarReanalisis, sanearReanalisis } from "@/lib/reanalisis-servidor";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { nombreReal } from "@/lib/welcome";
import { readVeredicto } from "@/lib/results-helpers";
import {
  createSupabaseServer,
  guardPlausibilidad,
  ensureCreditCharged,
  markPremiumAndClaimPrepaid,
  buildShortTermAnalysisRow,
  prefetchMercadoStr } from "@/lib/api-helpers/analisis-pipeline";
import {
  resolveActor,
  emitirCookieAnon,
  createAnonPipelineClient,
  CHARGE_MODE_ANON,
} from "@/lib/api-helpers/anon-cap";
import { guardarPerfil, perfilDesdeStr } from "@/lib/lo-que-sigue/perfil";
import { AMBAS_ENABLED } from "@/lib/ambas-flag";
import { desdeBodyStr } from "@/lib/plausibilidad";
import { persistSubmitTiming, type SubmitTiming } from "@/lib/pipeline-timing";

// Goal F: techo explícito 300s. Lo subió la prosa STR en el waitUntil (retirada del informe el
// 25-sep-2026); AirROI solo pedía 120.
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
    // El re-análisis al precio recomendado (21-oct-2026, lib/reanalisis.ts): espejo de /api/analisis; en AMBAS no va.
    const reanalisis = ambasGroupId ? null : await sanearReanalisis(supabase, user?.id, body as Record<string, unknown>, Number(body?.precioCompraUF));
    if (ambasGroupId) delete (body as Record<string, unknown>).reanalisis;

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
    const medianaComuna = await prefetchMercadoStr(
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
    // «Lo que sigue» (28-sep-2026): el perfil de inversión, guardado con el análisis (espejo LTR).
    try {
      await guardarPerfil(createAnonPipelineClient(), perfilDesdeStr(body, (built.row as { resumen?: string | null }).resumen ?? null, {
        analysisId: data.id as string,
        userId: user?.id ?? null,
        anonClaimTokenHash: actor.tipo === "anon" || actor.tipo === "anon-hermano" ? actor.tokenHash : null,
      }));
    } catch (e) {
      console.error("[short-term] perfil de inversión:", e);
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

    // La activación (15-oct-2026): `analisis_creado` en PostHog, solo con cuenta y solo el STR suelto (en AMBAS lo
    // cuenta el lado LTR). El Lead de bienvenida se retiró: desde el 15-oct Lead es «dejó su correo».
    if (data?.id && user?.id && !ambasGroupId) {
      waitUntil(capturarAnalisisCreado({ userId: user.id, analysisId: data.id as string, modalidad: "str", via: reanalisis ? "reanalisis" : "wizard" }));
      if (reanalisis) waitUntil(capturarReanalisis({ userId: user.id, analysisId: data.id as string, r: reanalisis, modalidad: "str", conPago: false }));
    }

    // «Tu análisis está listo» también en renta corta (02-oct-2026): hasta acá solo lo mandaba
    // /api/analisis y quien analizaba un depto para Airbnb no recibía nada. Solo con sesión (sin
    // destinatario no hay correo; el anónimo lo recibe al guardar) y solo el STR suelto: en AMBAS lo
    // manda el lado LTR, con la comparativa. En background: el correo nunca demora ni rompe la creación
    // (sendAnalysisReadyEmail traga y loguea).
    if (data?.id && user?.email && !ambasGroupId) {
      const para = user.email;
      const nombrePersona = nombreReal(user.user_metadata) ?? "";
      const titulo = (data.nombre as string | null) || `${body.comuna} - ${body.superficieUtil}m²`;
      const veredictoStr = readVeredicto(data.results as never) ?? ((data.resumen as string | null) || "AJUSTA SUPUESTOS");
      waitUntil(sendAnalysisReadyEmail(para, nombrePersona, titulo, Number(data.score) || 0, veredictoStr, data.id as string, undefined, { userId: user.id }));
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
