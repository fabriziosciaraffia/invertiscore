import { NextResponse } from "next/server";
import { flowGet } from "@/lib/flow";
import { createServiceClient } from "@/lib/supabase/service";
import { acreditarPagoUnico } from "@/lib/pagos/acreditar-pago";
import { pagosSinAcreditar } from "@/lib/pagos/sin-acreditar";
import { devolverCobro, devolucionDesdeModo } from "@/lib/access";
import { sendPaymentConfirmationEmail } from "@/lib/email";
import { nombreReal } from "@/lib/welcome";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { cerrarCron } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";

// ─────────────────────────────────────────────────────────────────────────────
// EL RECONCILIADOR DE PAGOS (04-nov-2026, auditoría de promesas parte 1, decisión de Fabrizio). Una vez al día cruza lo
// que Flow cobró con lo que el ledger acreditó, para que ningún pago quede sin su crédito ni ningún crédito gastado sin
// su informe:
//   1 · FLOW → NOSOTROS: los pagos únicos que Flow cobró ayer y hoy y que acá siguen pendientes (su aviso nunca llegó)
//       se marcan pagados.
//   2 · PAGADOS SIN LOTE (los de 1 y los que payments/confirm no pudo acreditar): se acreditan por el mismo camino que el
//       webhook (lib/pagos/acreditar-pago.ts) y, si «Pago confirmado» no salió, sale ahora, una vez.
//   3 · COBROS SIN INFORME: «Analizar este» y la renta corta de la selección que cobraron y no alcanzaron a crear el
//       informe (una solicitud cortada a mitad, sin catch que devolviera) devuelven el crédito y sueltan la fila.
// Cuenta lo que hizo y lo que no pudo: un pago que no se acredita queda en el panel («Pagos sin acreditar»).
// Lo fija el tier DATOS-Y-PLATA.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;

const RUTA = "GET /api/cron/reconciliar-pagos";
/** Hasta dónde mira los pagados sin lote. */
const VENTANA_DIAS = 30;
/** Un cobro sin informe más viejo que esto ya no está en curso (la creación tiene tope de 300 s). */
const COBRO_COLGADO_MS = 30 * 60 * 1000;
const PAGE_LIMIT = 100;
const MAX_PAGINAS = 20;

type PagoFlow = { flowOrder?: number; commerceOrder?: string; status?: number | string };

function fechaSantiago(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServiceClient();
  await latirCron(sb, "reconciliar-pagos");
  const ahora = new Date();
  let marcadosPagados = 0, acreditados = 0, correos = 0, devueltos = 0, fallidos = 0;

  // ── 1 · Flow → nosotros ──────────────────────────────────────────────────
  const hoy = fechaSantiago(ahora), ayer = fechaSantiago(new Date(ahora.getTime() - 864e5));
  for (const date of hoy === ayer ? [hoy] : [ayer, hoy]) {
    for (let pagina = 0, start = 0; pagina < MAX_PAGINAS; pagina++, start += PAGE_LIMIT) {
      let resp: { data?: unknown; hasMore?: number | boolean };
      try {
        resp = ((await flowGet("payment/getPayments", { date, start, limit: PAGE_LIMIT })) ?? {}) as typeof resp;
      } catch (e) {
        fallidos++;
        capturarFallaDeCron(e, { ruta: RUTA, operacion: "flow-get-payments", extra: { date, start } });
        break;
      }
      const lista = (Array.isArray(resp.data) ? resp.data : []) as PagoFlow[];
      for (const c of lista) {
        // Solo pagos únicos cobrados (los de suscripción los reconcilia cron/reconcile-subscriptions).
        if (Number(c.status) !== 2 || !c.commerceOrder || /^sus_/.test(c.commerceOrder)) continue;
        const { data: fila } = await sb.from("payments").select("id, status").eq("commerce_order", c.commerceOrder).maybeSingle();
        if (!fila || fila.status === "paid") continue;
        const { error } = await sb.from("payments")
          .update({ status: "paid", flow_status: 2, ...(c.flowOrder ? { flow_order: c.flowOrder } : {}), updated_at: new Date().toISOString() })
          .eq("id", fila.id);
        if (error) { fallidos++; capturarFallaDeCron(error, { ruta: RUTA, operacion: "marcar-pagado", extra: { commerceOrder: c.commerceOrder } }); }
        else marcadosPagados++;
      }
      if (!resp.hasMore || lista.length < PAGE_LIMIT) break;
    }
  }

  // ── 2 · Pagados sin lote ─────────────────────────────────────────────────
  let sinLote: Awaited<ReturnType<typeof pagosSinAcreditar>> = [];
  try {
    sinLote = await pagosSinAcreditar(sb, VENTANA_DIAS, ahora);
  } catch (e) {
    fallidos++;
    capturarFallaDeCron(e, { ruta: RUTA, operacion: "leer-sin-acreditar" });
  }
  for (const p of sinLote) {
    try {
      const companion = (p.payment_data as { companion_str_id?: string } | null)?.companion_str_id ?? null;
      if (!(await acreditarPagoUnico(sb, p, { companionStrId: companion }))) continue;
      acreditados++;
      // «Pago confirmado» si no salió (payments/confirm no lo manda cuando no pudo acreditar): una vez, con la llave del pago.
      const yaEnviado = !!(p.payment_data as { confirmacion_enviada_at?: string } | null)?.confirmacion_enviada_at;
      if (!yaEnviado && p.user_id) {
        const { data: u } = await sb.auth.admin.getUserById(p.user_id);
        const email = u?.user?.email;
        if (email && u?.user) {
          const enviado = await sendPaymentConfirmationEmail(email, nombreReal(u.user.user_metadata) ?? "", p.product ?? "", p.amount ?? 0, p.analysis_id ?? undefined, undefined, { userId: p.user_id, idempotencyKey: `pago_confirmado/${p.commerce_order}` });
          if (enviado) {
            correos++;
            await sb.from("payments")
              .update({ payment_data: { ...((p.payment_data as Record<string, unknown> | null) ?? {}), confirmacion_enviada_at: new Date().toISOString() } })
              .eq("id", p.id)
              .is("payment_data->>confirmacion_enviada_at", null);
          }
        }
      }
    } catch (e) {
      fallidos++;
      capturarFallaDeCron(e, { ruta: RUTA, operacion: "acreditar-pago", userId: p.user_id ?? undefined, extra: { commerceOrder: p.commerce_order } });
    }
  }

  // ── 3 · Cobros sin informe ───────────────────────────────────────────────
  const colgadoAntes = new Date(ahora.getTime() - COBRO_COLGADO_MS).toISOString();
  for (const tabla of ["guia_analisis", "semanal_str_analisis"] as const) {
    // Borrar y devolver en un paso: la fila borrada es la que se devuelve, así dos corridas no devuelven dos veces.
    const { data: colgados, error } = await sb.from(tabla)
      .delete()
      .is("analysis_id", null)
      .not("cobrado_at", "is", null)
      .lt("cobrado_at", colgadoAntes)
      .lt("reclamado_at", colgadoAntes)
      .select("user_id, charge_mode");
    if (error) { fallidos++; capturarFallaDeCron(error, { ruta: RUTA, operacion: `soltar-${tabla}` }); continue; }
    for (const c of colgados ?? []) {
      if (await devolverCobro(c.user_id as string, devolucionDesdeModo(c.charge_mode as string | null))) devueltos++;
      else fallidos++;
    }
  }

  const exitosos = marcadosPagados + acreditados + devueltos;
  return cerrarCron(sb, "reconciliar-pagos", { procesados: exitosos + fallidos, exitosos, fallidos }, { marcadosPagados, acreditados, correos, devueltos, sinLote: sinLote.length });
}
