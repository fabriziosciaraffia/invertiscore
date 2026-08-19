import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { waitUntil } from "@vercel/functions";
import type { AnalisisInput } from "@/lib/types";
import { sendMetaCapiEvent } from "@/lib/meta/capi";
import { runAnalysis } from "@/lib/analysis";
import { getUFValue } from "@/lib/uf";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { resolveDisplayName, ensureWelcomeEmail } from "@/lib/welcome";
import { generateAiAnalysis } from "@/lib/ai-generation";
import { readVeredicto } from "@/lib/results-helpers";
import { captureApiError, captureApiWarning } from "@/lib/observabilidad";
import {
  createSupabaseServer,
  guardPlausibilidad,
  ensureCreditCharged,
  markPremiumAndClaimPrepaid,
  prefetchMedianaComunaVenta,
  buildMedianaSnapshot,
} from "@/lib/api-helpers/analisis-pipeline";
import {
  resolveActor,
  emitirCookieAnon,
  createAnonPipelineClient,
  CHARGE_MODE_ANON,
} from "@/lib/api-helpers/anon-cap";
import { AMBAS_ENABLED } from "@/lib/ambas-flag";
import { desdeBodyLtr } from "@/lib/plausibilidad";
import { redondearPiePct } from "@/lib/analysis/pie-input-data";
import { persistSubmitTiming, type SubmitTiming } from "@/lib/pipeline-timing";

// Goal C: techo explícito. El response sale en segundos, pero el waitUntil
// (emails + generateAiAnalysis con retries) comparte esta invocación. 300s
// acota la generación background — y es la premisa del criterio "generación
// muerta a los 6 min" de ai-status: si subes esto, sube UMBRAL_MUERTA_MS.
export const maxDuration = 300;

export async function POST(request: Request) {
  // Declarados FUERA del try para que el catch pueda reportarlos a Sentry: un
  // error sin user_id ni comuna es un evento que no se puede investigar.
  let userId: string | undefined;
  let comuna: string | undefined;
  // Frontera del INSERT — ver el comentario donde se pone en true. Una falla con
  // `filaCreada === false` no deja rastro en la base.
  let filaCreada = false;

  try {
    // Timing por fase (Goal A): solo medición, se persiste fail-soft en el
    // waitUntil de abajo. Ninguna de estas marcas altera el flujo.
    const t0 = Date.now();
    const timing: SubmitTiming = { recibido_at: new Date(t0).toISOString(), ruta: "analisis" };

    const supabase = createSupabaseServer();

    // El body se parsea ANTES de resolver el actor (cap anónimo F2-2): la rama
    // anónima necesita `turnstileToken` y `ambasGroupId` para decidir. Para el
    // logueado nada cambia — resolveActor devuelve su user igual que antes.
    const body: AnalisisInput & {
      prepaidChargeId?: string;
      ambasGroupId?: string;
      turnstileToken?: string;
    } = await request.json();

    const actor = await resolveActor(supabase, request, {
      turnstileToken: body.turnstileToken,
      // Mismo gate que abajo: con AMBAS apagado el cap anónimo no debe reconocer
      // "hermanos" de un par que ya no se puede crear. Sin esto, dos POSTs con
      // el mismo group_id inventado se colarían como par y consumirían un solo
      // cap para dos análisis.
      ambasGroupId:
        AMBAS_ENABLED && typeof body.ambasGroupId === "string" ? body.ambasGroupId : null,
    });
    if (actor.tipo === "rechazado") return actor.response;
    const user = actor.tipo === "user" ? actor.user : null;
    const esAnon = actor.tipo !== "user";
    userId = user?.id;
    timing.auth_ms = Date.now() - t0;
    // Precisión canónica del pie (fix pie-redondeo, defensa en profundidad): el
    // wizard ya redondea, pero este body es lo que corre el motor Y se persiste
    // en input_data — cualquier cliente que mande el float crudo lo deja sucio
    // para siempre. Se normaliza en el borde, antes de ambas cosas.
    if (Number.isFinite(body.piePct)) body.piePct = redondearPiePct(body.piePct);
    const prepaidChargeId = body.prepaidChargeId;
    comuna = body.comuna;
    // Enlace AMBAS (flujo crédito/welcome): el wizard genera el group_id y lo
    // pasa a los dos POSTs (LTR + STR). Acá es el lado LTR → rol 'ltr'. Se valida
    // como uuid; junk se ignora (fila queda suelta). El hermano se resuelve por
    // group_id en el dashboard y las páginas hijas — un fallo parcial (STR no se
    // crea) deja este group_id sin hermano y esas lecturas lo degradan a suelto.
    //
    // Con el interruptor de AMBAS apagado el group_id entrante se IGNORA en vez
    // de rechazarse: el LTR es un análisis válido por sí mismo y la fila queda
    // suelta, que es el mismo estado degradado que ya manejan el dashboard y las
    // páginas hijas cuando un lado del par falla. Rechazar acá le negaría su
    // análisis a alguien que pidió algo legítimo.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ambasGroupId =
      AMBAS_ENABLED && typeof body.ambasGroupId === "string" && UUID_RE.test(body.ambasGroupId)
        ? body.ambasGroupId
        : null;

    // Pasar UF actual explícitamente al motor (antes era módulo-level mutable;
    // ver audit/sesionA-residual-2/diagnostico.md).
    // SUBIDO sobre el cobro (PIEZA A): el guard de plausibilidad necesita la UF
    // para derivar el yield bruto. Es una lectura cacheada con fallback, sin
    // efectos: moverla no cambia nada del cálculo posterior.
    const tUf = Date.now();
    const ufValue = await getUFValue();
    timing.uf_ms = Date.now() - tUf;

    // Guard de plausibilidad — ANTES de cobrar. Input imposible ⇒ 422, sin
    // crédito consumido y sin fila.
    const plausible = guardPlausibilidad(desdeBodyLtr(body, ufValue), {
      userId: user?.id,
      ruta: "POST /api/analisis",
    });
    if (!plausible.ok) return plausible.response;

    // Cobro: solo con sesión. La rama anónima NO cobra — su "vía de cobro" es
    // el cap ('anon_cap'), y el welcome se consume recién en el claim.
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

    // Pre-fetch async de la mediana comunal de venta UF/m² para inyectarla al
    // motor síncrono (patrón cap_rate). Defensivo: cae a null sin romper.
    const tMediana = Date.now();
    const medianaComuna = await prefetchMedianaComunaVenta(supabase, body, ufValue);
    timing.mediana_ms = Date.now() - tMediana;
    const tMotor = Date.now();
    const result = runAnalysis(body, ufValue, medianaComuna);
    timing.motor_ms = Date.now() - tMotor;

    // Rama anónima: service-role. Sin sesión, el client anon-key queda sujeto a
    // RLS (que no contempla — ni debe contemplar — escrituras anónimas). El
    // INSERT, la prosa IA del waitUntil y el timing corren con este client.
    const dbClient = esAnon ? createAnonPipelineClient() : supabase;

    // Frontera del INSERT: `filaCreada` (declarada arriba, fuera del try) pasa a
    // true recién después de que este INSERT devuelve fila. Una falla antes de
    // ese punto no deja rastro en `analisis`.
    const tInsert = Date.now();
    const { data, error } = await dbClient
      .from("analisis")
      .insert({
        user_id: user?.id ?? null,
        nombre: body.nombre,
        comuna: body.comuna,
        ciudad: body.ciudad,
        direccion: body.direccion || null,
        tipo: body.tipo,
        tipo_analisis: "long-term",
        // Commit E.1 · 2026-05-13: análisis nuevos usan metodología v2
        // (thresholds 70/45/0 unificados · slider 3 segmentos · sin fallback
        // score 50). Análisis pre-Commit-E quedan como v1 (legacy preservation).
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
        // Vía de cobro (opción B, migración charge_mode): columna top-level,
        // NO en input_data (input_data alimenta motor/prompts). En AMBAS el
        // mode viene del payment_data del prepaid vía ensureCreditCharged,
        // así que ambos hermanos lo escriben igual. Gatea el CTA welcome.
        charge_mode: chargeMode,
        // Snapshot de la mediana resuelta acá (Fase A): fuente única futura para
        // sobreprecio/hero/prosa/zona. Nadie lo lee aún (Fase B cablea lecturas).
        mediana_comuna_snapshot: buildMedianaSnapshot(medianaComuna),
        creator_name: user?.user_metadata?.nombre || user?.user_metadata?.full_name || null,
        // Cap anónimo: el hash del token de la cookie es la ventana de claim.
        // `charge_mode` (arriba) queda en 'anon_cap' como marca de origen
        // permanente; este hash lo limpia el claim o el cron a los 30 días.
        ...(actor.tipo === "anon" ? { anon_claim_token_hash: actor.tokenHash } : {}),
        ...(actor.tipo === "anon-hermano" ? { anon_claim_token_hash: actor.tokenHash } : {}),
        // Enlace AMBAS: solo cuando el wizard pasó un group_id válido (lado LTR).
        ...(ambasGroupId ? { ambas_group_id: ambasGroupId, ambas_role: "ltr" } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      // El INSERT falló: tampoco hay fila. Se reporta acá porque este `if` no
      // lanza —devuelve directo—, así que el catch global nunca lo ve.
      captureApiError(error, {
        ruta: "POST /api/analisis",
        operacion: "insert-analisis",
        userId: user?.id,
        tags: { fase: "insert-rechazado", fila_creada: "no" },
        extra: { comuna: body.comuna, tipo_analisis: "long-term" },
      });
      return NextResponse.json(
        { error: "Error al guardar el análisis" },
        { status: 500 },
      );
    }
    filaCreada = true;
    timing.insert_ms = Date.now() - tInsert;
    timing.total_ms = Date.now() - t0;

    // Cookie del cap — DESPUÉS del INSERT exitoso: si la creación falla, el
    // anónimo no queda con el cap quemado y las manos vacías. El hermano AMBAS
    // (segundo POST serializado) no re-emite: su cookie ya existe.
    if (actor.tipo === "anon") emitirCookieAnon(actor.token);

    // Marcar análisis como premium tras cobro exitoso (o admin bypass).
    // Backlog #3: TODOS los análisis del registrado son premium completos
    // — el welcome credit otorga el mismo nivel que un crédito comprado.
    if (data?.id) {
      await markPremiumAndClaimPrepaid({
        dbClient,
        analysisId: data.id,
        prepaidChargeId,
        prepaidNeedClaim,
      });
      data.is_premium = true;
    }

    // Trabajo diferido tras el response. waitUntil (@vercel/functions) garantiza
    // que corra hasta terminar en serverless — un IIFE fire-and-forget sin await
    // puede morir cuando se envía el response (mismo motivo por el que
    // payments/confirm awaitea su IA). Orden deliberado: welcome → ready → IA.
    // El ready va ANTES de generateAiAnalysis: no depende de la IA (score y
    // veredicto ya están en `result`; el hero es on-demand vía @vercel/og), así
    // no queda detrás de una llamada lenta/colgada. El response NO se bloquea.
    if (data?.id) {
      const analysisId = data.id;
      waitUntil((async () => {
        // Timing del submit (Goal A): fail-soft, fuera del response para no
        // sumarle latencia. Va primero: es un UPDATE corto y así queda escrito
        // aunque los emails o la IA de abajo fallen.
        await persistSubmitTiming(dbClient, analysisId, timing);
        // Welcome email idempotente: garantiza que un usuario que llega directo
        // a /analisis/nuevo-v2 (vía deep-link o el héroe del onboarding) sin
        // pasar por /dashboard igual lo reciba. ensureWelcomeEmail usa el claim
        // atómico de welcome_email_sent, así que es seguro dispararlo también
        // acá: envía a lo sumo una vez por usuario (no duplica con /dashboard).
        // Rama anónima (`user` null): ambos bloques de correo se saltan solos —
        // no hay destinatario. La prosa IA de abajo SÍ corre igual.
        if (user?.email) {
          await ensureWelcomeEmail(
            user.id,
            user.email,
            resolveDisplayName(user.user_metadata, user.email),
          );
        }
        if (user?.email) {
          try {
            // Variante AMBAS: si esta fila (LTR) pertenece a un par, resolvemos el
            // hermano STR por ambas_group_id para que el correo anuncie la
            // COMPARATIVA y su CTA lleve a la vista comparativa. El hermano se crea
            // en PARALELO (Promise.allSettled en el wizard) y ahora el ready va
            // antes de la IA, así que puede no existir aún → reintento acotado
            // (máx 2 intentos, ≤5s total, en background). Si no aparece, fallback
            // al correo de análisis suelto (mejor genérico que silencio). Solo el
            // lado LTR envía (el endpoint STR no manda ready-email → sin duplicado).
            let ambas: { ltrId: string; strId: string } | undefined;
            if (ambasGroupId) {
              for (let attempt = 0; attempt < 2; attempt++) {
                const { data: sibling } = await dbClient
                  .from("analisis")
                  .select("id")
                  .eq("ambas_group_id", ambasGroupId)
                  .eq("ambas_role", "str")
                  .maybeSingle();
                if (sibling?.id) {
                  ambas = { ltrId: analysisId, strId: sibling.id };
                  break;
                }
                if (attempt === 0) await new Promise((r) => setTimeout(r, 2500));
              }
            }
            await sendAnalysisReadyEmail(
              user.email,
              resolveDisplayName(user.user_metadata, user.email),
              body.nombre || `${body.comuna} - ${body.superficie}m²`,
              result.score,
              readVeredicto(result) || (result.score >= 70 ? "COMPRAR" : result.score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
              analysisId,
              ambas,
            );
          } catch (e) {
            console.error("Analysis email error:", e);
            captureApiWarning(e, {
              ruta: "POST /api/analisis",
              operacion: "email-analisis-listo",
              userId,
              analysisId,
            });
          }
        }
        // IA al final (no bloquea la notificación). El page la recupera vía
        // polling /ai-status si acá falla. generateAiAnalysis intacto.
        try {
          await generateAiAnalysis(analysisId, dbClient, { trigger: "background" });
        } catch (e) {
          console.error("Background AI generation failed:", e);
          // La fila existe y el usuario ya tiene su análisis; lo que falta es la
          // prosa. El page la recupera por polling, así que no rompe nada — pero
          // si esto falla seguido, la IA está caída y nadie se entera.
          captureApiWarning(e, {
            ruta: "POST /api/analisis",
            operacion: "generacion-ia-background",
            userId,
            analysisId,
          });
        }
      })());
    }

    // Meta CAPI: Lead server-side — el usuario ESTRENÓ su análisis de bienvenida.
    // Gate: chargeMode === 'welcome', la única vía por la que se consume el gratis
    // (admin → 'admin', ilimitado → 'subscription', ledger/legacy → 'paid').
    // event_id = `lead-<userId>` (unificado post-F2 con el Lead del claim, que
    // ya usaba este formato): un usuario = un Lead, venga por donde venga. El
    // caso mixto real —análisis anónimo en un navegador + registro orgánico en
    // otro, y la red de seguridad del claim disparando después— emitía dos
    // Leads con ids distintos; con el id compartido Meta deduplica. Sigue
    // siendo idempotente ante retry del POST (mismo user = mismo id). Sin
    // value: el gratis no factura. En AMBAS dispara SOLO este lado (LTR): el
    // POST STR comparte el mismo cobro y duplicaría el evento — mismo criterio
    // que el correo analysis-ready de arriba.
    //
    // waitUntil PROPIO, separado del bloque de arriba: el timeout de Meta (5s) no
    // debe meterse delante del correo ni de la IA. Corre después del response.
    // Este request SÍ viene del navegador (fetch del wizard), así que a diferencia
    // de los webhooks de Flow lleva IP/UA/_fbp/_fbc → mejor match (patrón
    // auth/callback). Se leen ACÁ, dentro del request, no dentro del deferred.
    if (data?.id && chargeMode === "welcome" && user?.email) {
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
          console.error("[api/analisis] Meta CAPI Lead excepción:", e);
          captureApiWarning(e, {
            ruta: "POST /api/analisis",
            operacion: "meta-capi-lead",
            userId,
          });
        }
      })());
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    // El tag `fila_creada` es lo que hace útil este evento. Si es "no", el
    // usuario intentó generar un análisis y NO existe registro de ese intento en
    // ninguna tabla — este evento de Sentry es la única evidencia de que ocurrió.
    // Si es "sí", la fila está y el error pasó después (email, IA, CAPI), que es
    // molesto pero recuperable.
    captureApiError(error, {
      ruta: "POST /api/analisis",
      operacion: "crear-analisis-ltr",
      userId,
      tags: {
        fase: filaCreada ? "post-insert" : "pre-insert",
        fila_creada: filaCreada ? "si" : "no",
      },
      extra: { comuna },
    });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
