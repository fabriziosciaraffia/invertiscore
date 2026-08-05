import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  grantCredits,
  recurringProductByPlan,
  addOneMonth,
} from "@/lib/credits-grant";
import { captureApiError } from "@/lib/observabilidad";
import { respuestaCron } from "@/lib/cron-resultado";

const RUTA = "GET /api/cron/monthly-grants";

/**
 * Cron 2.8 — Renovación MENSUAL de planes ANUALES.
 *
 * Los planes anuales cobran el año up-front pero otorgan capacity MENSUAL
 * (plan10=10/mes, plan50=50/mes, acumulable). register-callback otorga el mes 1
 * y setea user_credits.next_monthly_grant_at = subscription_start + 1 mes. Este
 * cron otorga los meses 2-12: por cada sub anual activa cuyo next_monthly_grant_at
 * ya venció, inserta el lote del/los mes(es) debidos y avanza la fecha +1 mes
 * (loop catch-up si el cron se saltó corridas), hasta subscription_ends_at.
 *
 * Idempotente por RECLAMO: cada mes se toma con un compare-and-swap sobre
 * next_monthly_grant_at (UPDATE con la fecha leída en el WHERE) y el lote se
 * inserta solo si el reclamo tuvo efecto. Una 2da corrida el mismo día no
 * encuentra la fecha que esperaba y no otorga — vale igual para dos corridas
 * simultáneas, que antes podían duplicar. Ver el comentario del loop.
 *
 * Auth: Vercel Cron dispara GET con `Authorization: Bearer ${CRON_SECRET}`.
 */

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Tope defensivo de lotes por fila en una sola corrida (un año = 12 meses; el
// inicial lo da register-callback). Evita un loop runaway ante datos corruptos.
const MAX_CATCHUP_MONTHS = 13;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("[cron/monthly-grants] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // Subs anuales finitas activas con un lote mensual vencido.
  const { data: rows, error } = await supabase
    .from("user_credits")
    .select("user_id, active_plan, subscription_ends_at, next_monthly_grant_at")
    .eq("billing_period", "annual")
    .eq("subscription_status", "active")
    .eq("is_unlimited", false)
    .in("active_plan", ["plan10", "plan50"])
    .not("next_monthly_grant_at", "is", null)
    .lte("next_monthly_grant_at", nowIso);

  if (error) {
    console.error("[cron/monthly-grants] query error:", error);
    captureApiError(error, { ruta: RUTA, operacion: "query-subs-anuales" });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let processed = 0;
  let granted = 0;
  // Cada fila que no llega a otorgar su lote es un suscriptor que pagó el año y
  // no recibió los análisis del mes. Antes solo quedaba en un console.error.
  let fallidos = 0;
  // Dos subconjuntos de fallidos, con consecuencias distintas:
  //  · no se pudo reclamar el mes → no se otorgó nada, el mes se reintenta solo
  //    si la fecha sigue vencida (o lo tomó otra corrida, que sí otorga);
  //  · se reclamó y el grant falló → la fecha YA avanzó, así que ese mes no
  //    vuelve solo: hay que otorgarlo a mano.
  let fechaNoReclamada = 0;
  let grantTrasReclamo = 0;

  for (const row of rows ?? []) {
    try {
      processed++;

      // Resolver capacity + key del catálogo desde active_plan + 'annual'.
      const match = recurringProductByPlan(row.active_plan, "annual");
      const capacity = match?.product.capacity;
      if (!match || capacity == null) {
        console.error(
          "[cron/monthly-grants] sin producto/capacity para active_plan:",
          row.active_plan,
          "user:",
          row.user_id
        );
        fallidos++;
        captureApiError(
          new Error(`Sin producto/capacity para active_plan="${row.active_plan}"`),
          {
            ruta: RUTA,
            operacion: "resolver-producto",
            userId: row.user_id,
            tags: { plan: String(row.active_plan) },
          },
        );
        continue;
      }
      const { key } = match;

      if (!row.subscription_ends_at) {
        console.error(
          "[cron/monthly-grants] subscription_ends_at nulo, se omite user:",
          row.user_id
        );
        fallidos++;
        captureApiError(
          new Error("subscription_ends_at nulo en sub anual activa"),
          { ruta: RUTA, operacion: "validar-fin-ciclo", userId: row.user_id },
        );
        continue;
      }
      const ends = new Date(row.subscription_ends_at);

      // Loop catch-up: otorga cada mes vencido aún dentro del ciclo anual.
      //
      // RECLAMAR ANTES DE OTORGAR (compare-and-swap). Hasta el 2026-08-05 el
      // orden era el inverso —otorgar los N meses y recién después avanzar la
      // fecha, una sola vez, fuera del loop— y eso dejaba dos agujeros:
      //
      //   · si el UPDATE final fallaba, los lotes YA estaban insertados y la
      //     fila quedaba armada para re-otorgarlos TODOS mañana. La idempotencia
      //     del cron descansa en esa fecha, así que no escribirla es regalar
      //     créditos en silencio;
      //   · dos corridas solapadas leían el mismo `next` y ninguna se enteraba
      //     de la otra.
      //
      // El CAS cierra los dos: el UPDATE lleva el valor leído en el WHERE, así
      // que solo tiene éxito si nadie lo movió desde que se leyó, y si no vuelve
      // fila es que otro proceso reclamó ese mes. Mismo mecanismo que usa
      // `chargeAnalysisCredit` para el welcome credit (access.ts) — la única
      // defensa correcta contra esto que ya existía en el repo.
      //
      // El precio de moverlo adentro del loop son N updates en vez de uno (N ≤ 13,
      // en la práctica 1). A cambio, un fallo cuesta UN mes en vez del catch-up
      // entero, que era la mitad del problema.
      let next = new Date(row.next_monthly_grant_at as string);
      let iterations = 0;
      while (
        next.getTime() <= now.getTime() &&
        next.getTime() < ends.getTime() &&
        iterations < MAX_CATCHUP_MONTHS
      ) {
        const siguiente = addOneMonth(next);
        // Si el mes que viene ya cae fuera del ciclo anual, la fecha queda en
        // null: deja de otorgar hasta que la renovación la re-arme. Mismo corte
        // que antes, solo que ahora se decide por iteración.
        const nuevoNext =
          siguiente.getTime() >= ends.getTime() ? null : siguiente.toISOString();

        const { data: reclamado, error: casErr } = await supabase
          .from("user_credits")
          .update({
            next_monthly_grant_at: nuevoNext,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", row.user_id)
          // El guard: la fecha tiene que seguir siendo la que leímos.
          .eq("next_monthly_grant_at", next.toISOString())
          .select("user_id")
          .maybeSingle();

        if (casErr || !reclamado) {
          // Sin reclamo no se otorga: es exactamente lo que evita el duplicado.
          // `casErr` es una falla de escritura; `!reclamado` sin error significa
          // que otro proceso ya avanzó esta fecha (o la fila cambió debajo).
          console.error(
            "[cron/monthly-grants] no se pudo reclamar el mes, no se otorga; user:",
            row.user_id,
            casErr ?? "(la fecha cambió: otra corrida lo tomó)"
          );
          fallidos++;
          fechaNoReclamada++;
          captureApiError(
            casErr ?? new Error("CAS sin efecto — next_monthly_grant_at cambió bajo el cron"),
            {
              ruta: RUTA,
              operacion: "reclamar-mes",
              userId: row.user_id,
              tags: {
                plan: String(row.active_plan),
                // Sin lote insertado: el usuario NO recibió los créditos de este
                // mes. Se repara otorgando a mano desde /admin/grants.
                consecuencia: "mes-no-otorgado",
                motivo: casErr ? "update-fallido" : "fecha-ya-movida",
              },
              extra: { mes_debido: next.toISOString(), lotes_previos_en_esta_fila: iterations },
            },
          );
          break;
        }

        // Reclamado. Recién ahora se inserta el lote.
        const grantId = await grantCredits(row.user_id, key, capacity, {});
        if (!grantId) {
          console.error(
            "[cron/monthly-grants] grantCredits falló DESPUÉS de reclamar el mes; user:",
            row.user_id
          );
          fallidos++;
          grantTrasReclamo++;
          captureApiError(new Error("grantCredits devolvió null tras reclamar el mes"), {
            ruta: RUTA,
            operacion: "otorgar-lote-mensual",
            userId: row.user_id,
            tags: {
              plan: String(row.active_plan),
              // El trade-off aceptado del CAS: la fecha ya avanzó, así que este
              // mes no se reintenta solo. El usuario queda sin sus créditos y hay
              // que otorgarlos a mano desde /admin/grants — con el user_id y el
              // mes de acá no hay nada que adivinar.
              consecuencia: "mes-no-otorgado-requiere-grant-manual",
            },
            extra: {
              mes_debido: next.toISOString(),
              capacity,
              lotes_otorgados_en_esta_fila: iterations,
            },
          });
          break;
        }
        granted++;
        next = siguiente;
        iterations++;
      }
    } catch (e) {
      // Un error en una fila no aborta el resto.
      console.error(
        "[cron/monthly-grants] error procesando user:",
        row?.user_id,
        e instanceof Error ? e.message : String(e)
      );
      fallidos++;
      captureApiError(e, {
        ruta: RUTA,
        operacion: "procesar-fila",
        userId: row?.user_id,
      });
    }
  }

  console.error(
    `[cron/monthly-grants] processed=${processed} granted=${granted} fallidos=${fallidos}`
  );
  return respuestaCron(
    { procesados: processed, exitosos: processed - fallidos, fallidos },
    { granted, fechaNoReclamada, grantTrasReclamo },
  );
}
