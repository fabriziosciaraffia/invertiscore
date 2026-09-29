import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendRecordatorioPackEmail } from "@/lib/email";
import { captureApiWarning } from "@/lib/observabilidad";
import { cerrarCron } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { capturarServidor } from "@/lib/posthog-servidor";
import { debeRecordar, DIAS_RECORDATORIO } from "@/lib/lo-que-sigue/recordatorio";
import { eventoRecordatorioPack } from "@/lib/lo-que-sigue/eventos-servidor";
import { PACK_ANALISIS, PRODUCTO_PACK } from "@/lib/lo-que-sigue/oferta-pack";

// ─────────────────────────────────────────────────────────────────────────────
// El recordatorio del pack (30-sep-2026), una vez al día: a quien pagó el pack hace tres días o más y
// no usó ninguno de los tres, «Te quedan 3 análisis, con tus números ya cargados.». SALE UNA SOLA VEZ:
// se reclama la fila (`recordatorio_pack_enviado_at` de NULL a fecha, con la condición en el WHERE)
// ANTES de enviar, y solo se envía si el reclamo tuvo efecto. Mismo patrón que abandoned-checkout.
// ─────────────────────────────────────────────────────────────────────────────

const RUTA = "GET /api/cron/recordatorio-pack";
const TOPE_POR_CORRIDA = 50;

function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/recordatorio-pack] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  await latirCron(supabase, "recordatorio-pack");

  const corte = new Date(Date.now() - DIAS_RECORDATORIO * 24 * 60 * 60 * 1000).toISOString();
  // Primero los lotes del pack INTACTOS (los tres análisis sin usar): quien ya usó alguno nunca entra
  // a la cola, así la cola no se llena de filas que no tocan.
  const { data: lotes, error: errLotes } = await supabase
    .from("credit_grants")
    .select("payment_id, remaining")
    .eq("source", PRODUCTO_PACK)
    .eq("remaining", PACK_ANALISIS)
    .not("payment_id", "is", null)
    .order("granted_at", { ascending: true })
    .limit(500);
  if (errLotes) {
    captureApiWarning(errLotes, { ruta: RUTA, operacion: "leer-lotes" });
    return cerrarCron(supabase, "recordatorio-pack", { procesados: 0, exitosos: 0, fallidos: 1 });
  }
  const restantesPorPago = new Map((lotes ?? []).map((l) => [l.payment_id as string, l.remaining as number]));
  if (restantesPorPago.size === 0) return cerrarCron(supabase, "recordatorio-pack", { procesados: 0, exitosos: 0, fallidos: 0 }, { enviados: 0 });
  const { data: pagos, error } = await supabase
    .from("payments")
    .select("id, user_id, analysis_id, status, product, updated_at, recordatorio_pack_enviado_at")
    .in("id", Array.from(restantesPorPago.keys()))
    .eq("product", PRODUCTO_PACK)
    .eq("status", "paid")
    .is("recordatorio_pack_enviado_at", null)
    .lte("updated_at", corte)
    .order("updated_at", { ascending: true })
    .limit(TOPE_POR_CORRIDA);
  if (error) {
    captureApiWarning(error, { ruta: RUTA, operacion: "leer-candidatos" });
    return cerrarCron(supabase, "recordatorio-pack", { procesados: 0, exitosos: 0, fallidos: 1 });
  }

  let procesados = 0;
  let enviados = 0;
  let fallidos = 0;
  let noReclamados = 0;
  let sinUsarNo = 0;
  for (const p of pagos ?? []) {
    const ahora = new Date();
    if (!debeRecordar({ status: p.status, product: p.product, pagadoEl: p.updated_at, recordatorioEnviadoEl: p.recordatorio_pack_enviado_at, restantes: restantesPorPago.get(p.id) ?? null }, ahora)) { sinUsarNo++; continue; }
    procesados++;

    // RECLAMAR ANTES DE ENVIAR: solo una corrida pasa de NULL a fecha.
    const { data: reclamado, error: casErr } = await supabase
      .from("payments")
      .update({ recordatorio_pack_enviado_at: ahora.toISOString() })
      .eq("id", p.id)
      .is("recordatorio_pack_enviado_at", null)
      .select("id")
      .maybeSingle();
    if (casErr || !reclamado) {
      noReclamados++;
      continue;
    }

    const { data: u } = await supabase.auth.admin.getUserById(p.user_id);
    const correo = u?.user?.email;
    if (!correo) {
      fallidos++;
      captureApiWarning(new Error("pack sin correo"), { ruta: RUTA, operacion: "correo", userId: p.user_id });
      continue;
    }
    const ok = await sendRecordatorioPackEmail(correo, p.analysis_id, { userId: p.user_id });
    if (!ok) {
      // El reclamo queda: preferimos no mandar a mandar dos veces.
      fallidos++;
      captureApiWarning(new Error("recordatorio no salió"), { ruta: RUTA, operacion: "enviar", userId: p.user_id });
      continue;
    }
    enviados++;
    try {
      await capturarServidor(eventoRecordatorioPack({ userId: p.user_id, paymentId: p.id, analysisId: p.analysis_id }));
    } catch {
      /* la medición no rompe el cron */
    }
  }

  return cerrarCron(supabase, "recordatorio-pack", { procesados, exitosos: enviados, fallidos }, { enviados, noReclamados, yaUsaronAlguno: sinUsarNo, topePorCorrida: TOPE_POR_CORRIDA });
}
