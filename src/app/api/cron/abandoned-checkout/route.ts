import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCheckoutRecoveryEmail } from "@/lib/email";
import { FLOW_PRODUCTS, type FlowProductKey } from "@/lib/flow-products";
import { captureApiWarning } from "@/lib/observabilidad";
import { respuestaCron } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";

const RUTA = "GET /api/cron/abandoned-checkout";

/**
 * Cron · Recuperación de carrito abandonado (ruta A · single · + ruta B · planes).
 *
 * payments/create (single) y subscriptions/create (planes, ruta B) insertan una
 * fila status='pending' al iniciar el checkout. Si el usuario abandona, Flow
 * nunca finaliza y la fila queda en 'pending'. Este cron busca esas filas con
 * created_at > 6h, sin email de recuperación previo, manda el email (copy
 * ramificado single vs plan) y marca recovery_email_sent_at para no reenviar.
 *
 * Cubre todas las keys del catálogo (single + 6 planes). Exclusiones: quienes ya
 * compraron un 'single' pagado, y quienes tienen subscription_status='active'
 * (red de seguridad ruta B: al activar, register-callback flipea su pending a paid).
 *
 * Idempotente por RECLAMO: recovery_email_sent_at IS NULL en el filtro y la
 * marca se toma con un compare-and-swap ANTES de enviar (UPDATE con
 * `.is(null)` en el WHERE). El correo sale solo si el reclamo tuvo efecto, así
 * que dos corridas solapadas no pueden mandar dos.
 *
 * Auth: Vercel Cron dispara GET con `Authorization: Bearer ${CRON_SECRET}`.
 */

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Umbral de abandono: una 'pending' más vieja que esto se considera abandonada
// (no "está pagando ahora"). 6 horas.
const ABANDON_THRESHOLD_MS = 6 * 60 * 60 * 1000;

// Productos recuperables: el single (ruta A) + los planes de suscripción
// (ruta B, pending dejado por subscriptions/create). Todas las keys del catálogo.
const RECOVERABLE_PRODUCTS = Object.keys(FLOW_PRODUCTS) as FlowProductKey[];

// Tope de candidatos por corrida. El loop de abajo es serial (un getUserById y
// un envío por fila); sin tope, una acumulación de pendings —un día de Flow
// caído, un bug que dejó de marcar— vuelve la corrida tan larga como la cola y
// la corta el maxDuration a mitad, sin resumen. Con 50 la corrida cabe siempre;
// lo que no alcanzó se toma mañana (los más viejos primero) y Sentry avisa que
// la cola superó el tope, que es la señal que importa.
const TOPE_POR_CORRIDA = 50;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("[cron/abandoned-checkout] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  // Latido ANTES del trabajo: registra "corrió", no "terminó bien". Ver la
  // doctrina completa en cron-heartbeat.ts.
  await latirCron(supabase, "abandoned-checkout");

  const cutoffIso = new Date(Date.now() - ABANDON_THRESHOLD_MS).toISOString();

  // Candidatos: compras únicas iniciadas y no pagadas, viejas, sin email previo.
  // Primero el conteo exacto de la cola (head, sin filas), después el lote.
  const { count: candidatosTotales, error: errCount } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .in("product", RECOVERABLE_PRODUCTS)
    .lte("created_at", cutoffIso)
    .is("recovery_email_sent_at", null);
  if (errCount) {
    console.error("[cron/abandoned-checkout] count error:", errCount);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const { data: candidates, error } = await supabase
    .from("payments")
    .select("id, user_id, product, created_at")
    .eq("status", "pending")
    .in("product", RECOVERABLE_PRODUCTS)
    .lte("created_at", cutoffIso)
    .is("recovery_email_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(TOPE_POR_CORRIDA);

  if (error) {
    console.error("[cron/abandoned-checkout] query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const colaTotal = candidatosTotales ?? candidates?.length ?? 0;
  const topeAlcanzado = colaTotal > TOPE_POR_CORRIDA;
  if (topeAlcanzado) {
    // No es un error de esta corrida: es que la cola creció más de lo que una
    // corrida procesa. Lo que queda se toma mañana, pero alguien tiene que
    // mirar por qué se acumuló.
    captureApiWarning(new Error(`Cola de carritos abandonados (${colaTotal}) supera el tope por corrida (${TOPE_POR_CORRIDA})`), {
      ruta: RUTA,
      operacion: "tope-por-corrida",
      tags: { tope: String(TOPE_POR_CORRIDA) },
      extra: { candidatos_totales: colaTotal, procesados_en_esta_corrida: candidates?.length ?? 0 },
    });
  }

  // Excluir usuarios que YA compraron un 'single' (en otra orden ya pagada): no
  // se les recupera. commerce_order es único, así que un pago del MISMO intento
  // ya no matchea status='pending'; esto cubre el caso de un 2º intento pagado.
  const userIds = Array.from(new Set((candidates ?? []).map((c) => c.user_id)));
  let paidUserIds = new Set<string>();
  if (userIds.length > 0) {
    const { data: paidRows, error: paidErr } = await supabase
      .from("payments")
      .select("user_id")
      .in("user_id", userIds)
      .eq("status", "paid")
      .eq("product", "single");
    if (paidErr) {
      console.error("[cron/abandoned-checkout] paid lookup error:", paidErr);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }
    paidUserIds = new Set((paidRows ?? []).map((r) => r.user_id));
  }

  // Red de seguridad (ruta B): excluir users con suscripción activa. Al activar,
  // register-callback flipea el pending a 'paid' (ya no sería candidato), pero si
  // por timing/fallo quedó un pending vivo no queremos nagear a quien ya suscribió.
  let activeSubUserIds = new Set<string>();
  if (userIds.length > 0) {
    const { data: activeRows, error: activeErr } = await supabase
      .from("user_credits")
      .select("user_id")
      .in("user_id", userIds)
      .eq("subscription_status", "active");
    if (activeErr) {
      console.error("[cron/abandoned-checkout] active-sub lookup error:", activeErr);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }
    activeSubUserIds = new Set((activeRows ?? []).map((r) => r.user_id));
  }

  // Exclusión single-pagado SCOPED al producto: un single pagado solo bloquea la
  // recuperación de un pending 'single' (ruta A), NO la de un pending de plan
  // (ruta B) — un comprador de análisis suelto puede abandonar un checkout de
  // suscripción y debe ser recuperable. Para planes, la red es activeSubUserIds.
  const toRecover = (candidates ?? []).filter(
    (c) => !(c.product === "single" && paidUserIds.has(c.user_id)) && !activeSubUserIds.has(c.user_id),
  );

  let processed = 0;
  let sent = 0;
  // Cada correo que no sale es una venta que no se intenta recuperar. Va como
  // warning, no error: un fallo aislado no es una emergencia, pero uno sostenido
  // significa que la recuperación dejó de existir.
  let fallidos = 0;
  // Los dos fallos se reparan distinto, así que se cuentan por separado:
  //  · no reclamado    → nadie recibió nada; si el update falló, la fila sigue
  //    en NULL y la próxima corrida la vuelve a tomar sola;
  //  · falló tras reclamo → la fila ya quedó marcada, así que ese correo NO
  //    vuelve: hay que reenviarlo a mano.
  let noReclamados = 0;
  let envioTrasReclamo = 0;

  for (const row of toRecover) {
    try {
      processed++;

      const { data: userData } = await supabase.auth.admin.getUserById(row.user_id);
      const u = userData?.user;
      if (!u?.email) {
        console.error(
          "[cron/abandoned-checkout] sin email para user:",
          row.user_id
        );
        fallidos++;
        captureApiWarning(new Error("Usuario sin email en auth — no hay a dónde escribir"), {
          ruta: RUTA,
          operacion: "resolver-email",
          userId: row.user_id,
        });
        continue;
      }

      const name =
        u.user_metadata?.nombre || u.user_metadata?.full_name || null;
      const productKey = row.product as FlowProductKey;
      const productLabel =
        FLOW_PRODUCTS[productKey]?.subject ?? "tu análisis";
      // Tipo de checkout abandonado: 'single' (análisis suelto) vs plan
      // (suscripción) → ramifica el copy del email. Derivado del kind del catálogo.
      const productKind = FLOW_PRODUCTS[productKey]?.kind === "recurring" ? "plan" : "single";

      // RECLAMAR ANTES DE ENVIAR (compare-and-swap).
      //
      // Antes era al revés —enviar y después marcar— y el comentario decía que
      // dejar la fila sin marcar era a propósito, "para no perder la
      // recuperación". La intención era buena pero el orden protegía del caso
      // menos probable: si la marca fallaba, el correo YA había salido y la fila
      // volvía a estar elegible, así que el usuario recibía el mismo correo al
      // día siguiente. Y dos corridas solapadas mandaban dos.
      //
      // Ahora la marca va primero, con la condición en el WHERE: solo una
      // corrida puede pasar de NULL a fecha. Mismo mecanismo que
      // `chargeAnalysisCredit` (access.ts) y que monthly-grants.
      const { data: reclamado, error: casErr } = await supabase
        .from("payments")
        .update({ recovery_email_sent_at: new Date().toISOString() })
        .eq("id", row.id)
        // El guard: la fila tiene que seguir sin correo enviado.
        .is("recovery_email_sent_at", null)
        .select("id")
        .maybeSingle();

      if (casErr || !reclamado) {
        console.error(
          "[cron/abandoned-checkout] no se pudo reclamar la fila, no se envía; payment:",
          row.id,
          casErr ?? "(ya estaba marcada: otra corrida la tomó)"
        );
        fallidos++;
        noReclamados++;
        captureApiWarning(
          casErr ?? new Error("CAS sin efecto — la fila ya tenía recovery_email_sent_at"),
          {
            ruta: RUTA,
            operacion: "reclamar-envio",
            userId: row.user_id,
            tags: {
              producto: String(row.product),
              motivo: casErr ? "update-fallido" : "ya-reclamada",
              // Nadie recibió nada de más. Si fue update-fallido, la fila sigue
              // en NULL y la próxima corrida la vuelve a tomar.
              consecuencia: "correo-no-enviado-se-reintenta",
            },
            extra: { payment_id: row.id },
          },
        );
        continue;
      }

      // Reclamada. Recién ahora sale el correo.
      const ok = await sendCheckoutRecoveryEmail(u.email, name, productLabel, productKind);
      if (!ok) {
        console.error(
          "[cron/abandoned-checkout] envío falló DESPUÉS de reclamar; payment:",
          row.id
        );
        fallidos++;
        envioTrasReclamo++;
        // El trade-off del CAS: la fila ya quedó marcada, así que este correo no
        // se reintenta solo. Es una venta que no se intenta recuperar — molesta,
        // no cuesta plata. El reenvío manual necesita a quién y de qué producto:
        // los dos están acá.
        captureApiWarning(new Error("sendCheckoutRecoveryEmail devolvió false tras reclamar la fila"), {
          ruta: RUTA,
          operacion: "enviar-correo-recuperacion",
          userId: row.user_id,
          tags: {
            producto: String(row.product),
            consecuencia: "correo-no-enviado-requiere-reenvio-manual",
          },
          // Va el user_id, no el email: con el id se resuelve en auth, y
          // observabilidad.ts pide identificadores, no contenido.
          extra: { payment_id: row.id, producto_label: productLabel },
        });
        continue;
      }
      sent++;
    } catch (e) {
      // Un error en una fila no aborta el resto.
      console.error(
        "[cron/abandoned-checkout] error procesando payment:",
        row?.id,
        e instanceof Error ? e.message : String(e)
      );
      fallidos++;
      captureApiWarning(e, {
        ruta: RUTA,
        operacion: "procesar-fila",
        userId: row?.user_id,
        extra: { payment_id: row?.id },
      });
    }
  }

  console.error(
    `[cron/abandoned-checkout] processed=${processed} sent=${sent} fallidos=${fallidos}`
  );
  return respuestaCron(
    { procesados: processed, exitosos: sent, fallidos },
    { sent, noReclamados, envioTrasReclamo, colaTotal, topePorCorrida: TOPE_POR_CORRIDA, topeAlcanzado },
  );
}
