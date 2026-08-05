import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowGet } from "@/lib/flow";
import { processSubscriptionCharge } from "@/lib/subscriptions/process-charge";
import { captureApiError, captureApiWarning } from "@/lib/observabilidad";
import { respuestaCron } from "@/lib/cron-resultado";

const RUTA = "GET /api/cron/reconcile-subscriptions";

/**
 * Cron — Reconciliación de cobros de suscripción (RED DE SEGURIDAD del webhook).
 *
 * Recupera cargos recurrentes pagados que payment-callback (artefacto 2) haya
 * perdido: escanea payment/getPayments de HOY y AYER (TZ America/Santiago, la de
 * Flow), filtra los de suscripción pagados (commerceOrder `sus_*`, status 2) y los
 * pasa por el MISMO helper processSubscriptionCharge (idempotente: fila por
 * commerce_order UNIQUE, grant por payment_id, boleta por payment_id).
 *
 * Idempotente y barato de re-correr: para los cargos que el webhook YA procesó es
 * un no-op (unos SELECT). Solo hace trabajo real sobre los que el webhook perdió.
 *
 * Frecuencia: DIARIA (Vercel Hobby no admite crons sub-diarios). Como backstop
 * alcanza: el webhook es el camino real-time; la ventana de escaneo HOY+AYER (~48h)
 * garantiza recuperar cualquier cobro perdido dentro de <24h pese al ritmo diario.
 *
 * Canary: el cargo del 22-jun se protege por el cutoff SUBSCRIPTION_GRANT_CUTOFF
 * (su grant se suspende por ser pre-C); además la ventana hoy/ayer deja de
 * alcanzarlo a partir del 24-jun.
 *
 * Auth: Vercel Cron dispara GET con `Authorization: Bearer ${CRON_SECRET}`.
 */

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// yyyy-mm-dd en la TZ de Flow (America/Santiago) → alinea los límites de día con
// los de Flow (requestDate viene en hora Chile). en-CA formatea como yyyy-mm-dd.
function santiagoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Subconjunto del objeto pago de getPayments que usamos (mismo shape que getStatus).
type FlowPayment = {
  flowOrder?: number;
  commerceOrder?: string;
  status?: number | string;
  amount?: number | string;
  payer?: string;
  requestDate?: string;
};

const PAGE_LIMIT = 100; // máximo permitido por getPayments
const MAX_PAGES_PER_DATE = 20; // tope defensivo: 20*100 = 2000 cargos/día por fecha
const SUB_ORDER_RE = /^sus_/; // cargos de suscripción de Flow

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("[cron/reconcile-subscriptions] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const today = santiagoDate(now);
  const yesterday = santiagoDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const dates = today === yesterday ? [today] : [yesterday, today];

  // Contadores de observabilidad. La señal de "el webhook está fallando" es
  // `recovered` (la fila NO existía antes → el webhook la perdió). `emitted` NO
  // sirve para eso: es >0 casi siempre (la boleta ya existe → idempotente).
  let scanned = 0;     // items vistos en getPayments (todos los tipos)
  let eligible = 0;    // pasaron el filtro (sus_ + status 2)
  let processed = 0;   // el helper completó (no lanzó)
  let recovered = 0;   // la fila franco-sub-pay NO existía → el webhook lo perdió
  let granted = 0;     // el helper insertó un lote de créditos nuevo
  let emitted = 0;     // boleta viva al final (emitida ahora o ya existente)
  let notEmitted = 0;  // elegible SIN boleta viva (revisar: kill-switch/sin email/error)
  let skipped = 0;     // helper ok:false (anomalía de mapeo/guards)
  let flowErrors = 0;  // fallos de getPayments (Flow caído/rate-limit/red)
  let chargeErrors = 0;// excepciones procesando un cargo puntual
  let truncated = false; // se alcanzó el tope de páginas → reconciliación incompleta

  for (const date of dates) {
    let start = 0;
    let page = 0;
    while (true) {
      // Tope de páginas: NO truncar en silencio. Si seguía habiendo hasMore,
      // logueamos fuerte y marcamos truncated en la salida.
      if (page >= MAX_PAGES_PER_DATE) {
        truncated = true;
        console.error(
          "[cron/reconcile-subscriptions] TOPE de páginas alcanzado para date=",
          date,
          "— posible reconciliación INCOMPLETA"
        );
        captureApiWarning(new Error(`Tope de ${MAX_PAGES_PER_DATE} páginas alcanzado — reconciliación incompleta`), {
          ruta: RUTA,
          operacion: "paginar-flow",
          tags: { truncado: "true" },
          extra: { date },
        });
        break;
      }

      // (1) Fallo de Flow: try/catch propio del fetch. NO explota el cron ni deja
      // estado a medias — cuenta el error, corta ESTA fecha y sigue. El return
      // final es 200 con { errors } (nunca 500, para que Vercel no reintente raro).
      let raw: unknown;
      try {
        raw = await flowGet("payment/getPayments", { date, start, limit: PAGE_LIMIT });
      } catch (e) {
        flowErrors++;
        console.error(
          "[cron/reconcile-subscriptions] getPayments falló date=",
          date,
          "start=",
          start,
          ":",
          e instanceof Error ? e.message : String(e)
        );
        captureApiError(e, {
          ruta: RUTA,
          operacion: "flow-get-payments",
          extra: { date, start },
        });
        break; // corta esta fecha; sigue con la próxima
      }

      const resp = (raw ?? {}) as { data?: unknown; hasMore?: number | boolean };
      const data = (Array.isArray(resp.data) ? resp.data : []) as FlowPayment[];
      scanned += data.length;

      for (const c of data) {
        // (4) Filtro: SOLO cargos de suscripción PAGADOS. El resto (single, fallidos,
        // pendientes) se ignora.
        if (!SUB_ORDER_RE.test(c.commerceOrder ?? "") || Number(c.status) !== 2) continue;
        eligible++;

        const flowOrder = Number(c.flowOrder);
        const commerceOrderRow = `franco-sub-pay-${flowOrder}`;
        try {
          // (3) Observabilidad: ¿la fila ya existía? Si NO → el webhook lo perdió
          // (recovered). Si SÍ → el webhook ya lo procesó (no-op idempotente).
          const { data: pre } = await supabase
            .from("payments")
            .select("id")
            .eq("commerce_order", commerceOrderRow)
            .maybeSingle();
          const wasNew = !pre;

          const r = await processSubscriptionCharge({
            flowOrder,
            commerceOrder: c.commerceOrder ?? "",
            amount: Number(c.amount),
            status: Number(c.status),
            payer: c.payer,
            chargeDate: c.requestDate,
            flowData: c,
          });

          processed++;
          if (wasNew) recovered++;
          if (r.granted) granted++;
          if (r.emitted) emitted++;
          else notEmitted++;
          if (!r.ok) {
            skipped++;
            console.error(
              "[cron/reconcile-subscriptions] cargo skipped:",
              commerceOrderRow,
              r.reason
            );
            captureApiWarning(new Error(`Cargo no aplicado: ${String(r.reason)}`), {
              ruta: RUTA,
              operacion: "aplicar-cargo",
              commerceOrder: commerceOrderRow,
              tags: { motivo: String(r.reason ?? "sin-motivo").slice(0, 32) },
            });
          }
        } catch (e) {
          chargeErrors++;
          console.error(
            "[cron/reconcile-subscriptions] error procesando",
            commerceOrderRow,
            ":",
            e instanceof Error ? e.message : String(e)
          );
          captureApiError(e, {
            ruta: RUTA,
            operacion: "procesar-cargo",
            commerceOrder: commerceOrderRow,
          });
        }
      }

      page++;
      const hasMore = resp.hasMore === 1 || resp.hasMore === true;
      if (!hasMore || data.length === 0) break;
      start += PAGE_LIMIT;
    }
  }

  // Los fallidos de este cron son los cargos que no se aplicaron (excepción o
  // skip) más las fechas que Flow no entregó. El criterio de status vive en
  // cron-resultado.ts y respeta la intención original de este cron —"nunca 500
  // para que Vercel no reintente raro"— en todo caso salvo uno: si NINGÚN cargo
  // se procesó y hubo errores, la corrida no reconcilió nada y eso sí tiene que
  // verse rojo. Un 207 por errores parciales sigue siendo 2xx.
  const fallidos = chargeErrors + skipped + flowErrors;
  const summary = {
    dates,
    scanned,
    eligible,
    recovered,
    granted,
    emitted,
    notEmitted,
    skipped,
    errors: { flow: flowErrors, charge: chargeErrors },
    truncated,
  };
  console.error(
    "[cron/reconcile-subscriptions]",
    JSON.stringify({ ...summary, processed, fallidos })
  );
  return respuestaCron(
    { procesados: processed + fallidos, exitosos: processed, fallidos },
    summary,
  );
}
