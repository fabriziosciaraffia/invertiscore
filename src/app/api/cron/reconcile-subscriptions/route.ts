import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowGet } from "@/lib/flow";
import { processSubscriptionCharge, parseSubscriptionId } from "@/lib/subscriptions/process-charge";
import { sendSubscribeIfFirstCharge } from "@/lib/subscriptions/subscribe-event";
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
 * Cubre también el Subscribe de Meta del primer cobro (helper compartido con el
 * webhook, sendSubscribeIfFirstCharge). Antes no lo hacía: un cargo recuperado acá
 * dejaba la fila escrita y la conversión sin enviar — y el webhook posterior ya
 * contaba 1 previa, así que tampoco disparaba.
 *
 * Frecuencia: HORARIA. Era diaria (09:00 CLT) porque Vercel Hobby topa los crons a
 * una corrida por día; con la cuenta en Pro esa restricción no aplica.
 *
 * El cambio no fue cosmético: el cobro perdido del 9-ago-2026 ocurrió a las 23:56
 * CLT, o sea 9 horas después de la corrida del día y 9 antes de la siguiente. El
 * reconciler no falló —todavía no le tocaba correr—, y en el peor caso la latencia
 * de detección era de 24h. Con ritmo horario baja a ≤1h. Las corridas sin trabajo
 * son no-ops de un par de SELECT: el helper deduplica por las tres capas de
 * idempotencia, así que reprocesar lo ya procesado no cuesta ni escribe.
 *
 * La ventana de escaneo sigue siendo HOY+AYER (~48h): cubre de sobra el hueco entre
 * corridas y protege ante horas salteadas.
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

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FECHAS_MANUALES = 3; // tope: cada fecha son N llamadas a getPayments

/**
 * Fechas a escanear. Por defecto HOY+AYER (el cron diario). Con `?date=` se puede
 * apuntar a fechas puntuales — para rescatar un cargo que quedó fuera de la
 * ventana, como el del 9-ago-2026 que el webhook perdió y que para cuando se
 * diagnosticó ya no alcanzaba el barrido automático.
 *
 * Sigue detrás del CRON_SECRET: es la misma operación del cron, disparada a mano.
 */
function resolverFechas(url: URL, now: Date): { dates: string[]; manual: boolean; invalidas: string[] } {
  const pedidas = url.searchParams
    .getAll("date")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);

  if (pedidas.length === 0) {
    const today = santiagoDate(now);
    const yesterday = santiagoDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    return { dates: today === yesterday ? [today] : [yesterday, today], manual: false, invalidas: [] };
  }

  // Validación estricta: un `date` mal formado haría que Flow devuelva otra cosa
  // (o todo), y un barrido sobre la fecha equivocada es trabajo a ciegas.
  const invalidas = pedidas.filter((d) => !FECHA_RE.test(d) || Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()));
  const validas = pedidas
    .filter((d) => !invalidas.includes(d))
    .filter((d, i, arr) => arr.indexOf(d) === i) // dedupe sin Set (target del tsconfig)
    .slice(0, MAX_FECHAS_MANUALES);
  return { dates: validas, manual: true, invalidas };
}

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

  const url = new URL(request.url);
  const now = new Date();
  const { dates, manual, invalidas } = resolverFechas(url, now);

  if (invalidas.length > 0) {
    return NextResponse.json(
      { error: "date inválida (formato esperado YYYY-MM-DD)", invalidas },
      { status: 400 }
    );
  }

  /**
   * DRY-RUN (`?dry=1`): escanea y reporta, SIN escribir una sola fila.
   *
   * Existe por lo que pasó con el cargo del 9-ago: no pudimos distinguir "el cron
   * no corrió" de "corrió y el cargo no estaba en getPayments". El modo normal no
   * sirve para averiguarlo — si el cargo está, lo procesa; si no está, devuelve
   * 200 con todo en cero, que es exactamente lo mismo que devuelve un día sano.
   * Con dry=1 se puede mirar primero y decidir después.
   */
  const dryRun = url.searchParams.get("dry") === "1";

  const supabase = createAdminClient();

  // Detalle por cargo elegible. Solo se llena en dry-run: en modo normal serían
  // cientos de filas en el body sin que nadie las lea.
  const detalle: Array<{
    flowOrder: number;
    commerceOrder: string;
    amount: number;
    requestDate: string | null;
    filaExiste: boolean;
    subMapeable: boolean;
  }> = [];

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
  let subscribeSent = 0;   // Subscribe (Meta) despachado por este cron
  let subscribeFailed = 0; // el helper de Subscribe devolvió reason='exception'
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

          // DRY-RUN: hasta acá todo fue lectura. Reportamos qué haríamos y
          // seguimos con el próximo cargo sin tocar nada. Incluimos si el sub es
          // mapeable a un user, que es el otro modo en que un cargo se pierde en
          // silencio (el helper devolvería user_unresolved).
          if (dryRun) {
            const subIdCargo = parseSubscriptionId(c.commerceOrder);
            let subMapeable = false;
            if (subIdCargo) {
              const { data: uc } = await supabase
                .from("user_credits")
                .select("user_id")
                .eq("subscription_id", subIdCargo)
                .maybeSingle();
              subMapeable = !!uc?.user_id;
            }
            detalle.push({
              flowOrder,
              commerceOrder: c.commerceOrder ?? "",
              amount: Number(c.amount),
              requestDate: c.requestDate ?? null,
              filaExiste: !wasNew,
              subMapeable,
            });
            if (wasNew) recovered++; // "lo habría recuperado"
            continue;
          }

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

          // Meta CAPI: Subscribe del PRIMER cobro, con el MISMO gate que el webhook
          // (helper compartido). Sin esto, un cargo recuperado por este cron creaba
          // fila + grant + boleta pero la conversión nunca salía — y como la fila
          // franco-sub-pay-* quedaba escrita, un webhook posterior contaba 1 previa y
          // tampoco disparaba. Fuga silenciosa.
          //
          // Va DESPUÉS de processSubscriptionCharge (el conteo excluye la fila del
          // cargo actual, que ya existe) y POR CARGO, dentro del try del loop: un
          // fallo de Meta en un cargo no aborta la reconciliación de los demás.
          // r.userId lo expone el helper del cobro — el mismo user al que se le aplicó
          // ESTE cargo, sin repetir la query de mapeo.
          //
          // Sin gate por r.ok, a propósito: PARIDAD con el webhook, que tampoco lo
          // mira. Si el cargo está pagado en Flow pero nuestra fila falló, la conversión
          // es real igual; y el reintento queda acotado por la ventana HOY+AYER.
          // Si el webhook ya envió, este envío es redundante pero inofensivo: comparte
          // el event_id sub-<subId> y Meta lo colapsa (≤2 corridas).
          if (r.userId) {
            const sub = await sendSubscribeIfFirstCharge({
              supabase,
              userId: r.userId,
              commerceOrder: c.commerceOrder ?? "",
              amount: Number(c.amount),
              flowOrder,
              payerEmail: c.payer,
            });
            if (sub.sent) subscribeSent++;
            else if (sub.reason === "exception") subscribeFailed++;
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
  // PUNTO CIEGO que costó el diagnóstico del 9-ago: una corrida que escanea pagos
  // y no encuentra NINGÚN cargo de suscripción devuelve 200 con todo en cero —
  // idéntica a un día sano sin cobros.
  //
  // POR QUÉ NO ALCANZA CON `eligible === 0` POR CORRIDA, ni con una racha de
  // corridas. Con el cron horario, la enorme mayoría de las horas NO tiene cobros:
  // la facturación es MENSUAL. Una racha contada en corridas tendría que valer
  // ~700 (29 días × 24) para no ser ruido, y se rompería sola al cambiar la
  // frecuencia del cron.
  //
  // La racha se mide en TIEMPO, y el reloj ya existe: la fila de cargo más reciente
  // (`franco-sub-pay-*`) en nuestra propia base. Cero estado nuevo que mantener,
  // inmune a la frecuencia del cron y a los redeploys.
  //
  // N = 40 DÍAS: el ciclo mensual más largo son 31 días y la gracia de past_due
  // suma 7 (38). 40 deja margen sin volverse laxo. Con al menos una suscripción
  // MENSUAL activa, 40 días sin un solo cargo registrado no es un mes tranquilo:
  // es que dejamos de ver los cobros.
  //
  // Las suscripciones anuales quedan fuera del guard a propósito — cobran una vez
  // al año y dispararían el aviso todos los meses.
  const DIAS_SIN_CARGOS_ANOMALO = 40;
  if (!dryRun && scanned > 0 && eligible === 0) {
    const [{ data: ultimoCargo }, { count: subsMensuales }] = await Promise.all([
      supabase
        .from("payments")
        .select("created_at")
        .like("commerce_order", "franco-sub-pay-%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("user_credits")
        .select("user_id", { count: "exact", head: true })
        .eq("subscription_status", "active")
        .eq("billing_period", "monthly"),
    ]);

    const msSinCargos = ultimoCargo?.created_at
      ? Date.now() - new Date(ultimoCargo.created_at).getTime()
      : Infinity;
    const diasSinCargos = msSinCargos / (24 * 60 * 60 * 1000);

    // count null = "no sé" (fallo de la query), NUNCA 0: sin el dato no afirmamos
    // que no hay suscripciones activas ni disparamos un aviso a ciegas.
    if ((subsMensuales ?? 0) > 0 && diasSinCargos > DIAS_SIN_CARGOS_ANOMALO) {
      console.error(
        "[cron/reconcile-subscriptions] hay",
        subsMensuales,
        "suscripciones mensuales activas y el último cargo registrado tiene",
        Math.floor(diasSinCargos),
        "días — revisar si getPayments sigue listando los cargos de suscripción"
      );
      captureApiWarning(
        new Error(
          `Sin cargos de suscripción hace ${Math.floor(diasSinCargos)} días con ${subsMensuales} suscripciones mensuales activas`
        ),
        {
          ruta: RUTA,
          operacion: "escanear-cargos",
          tags: { sin_elegibles: "true" },
          extra: {
            dates,
            scanned,
            diasSinCargos: Math.floor(diasSinCargos),
            subsMensualesActivas: subsMensuales,
            umbralDias: DIAS_SIN_CARGOS_ANOMALO,
          },
        }
      );
    }
  }

  const fallidos = chargeErrors + skipped + flowErrors;
  const summary = {
    dates,
    manual,
    dryRun,
    ...(dryRun ? { detalle } : {}),
    scanned,
    eligible,
    recovered,
    granted,
    emitted,
    notEmitted,
    skipped,
    // Marketing, no reconciliación: subscribeFailed NO entra en `fallidos` — que Meta
    // no reciba el evento no significa que el cargo quedó mal aplicado, y este cron no
    // debe ponerse rojo por eso. Van al summary para poder observarlos igual.
    subscribeSent,
    subscribeFailed,
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
