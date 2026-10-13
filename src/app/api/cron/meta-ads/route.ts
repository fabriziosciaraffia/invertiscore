import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureApiWarning } from "@/lib/observabilidad";
import { guardarMetrica } from "@/lib/metrics-daily";
import { latirCron } from "@/lib/cron-heartbeat";
import { cerrarCron } from "@/lib/cron-resultado";
import { correrMetaAds } from "@/lib/meta-ads-cron";

/**
 * Cron · Gasto diario de Meta Ads → metrics_daily.
 *
 * Mismo contrato que sentry-metrics: consulta una API externa, escribe una fila
 * por día y por métrica, y ante cualquier problema NO escribe. Un día sin fila se
 * lee como "sin dato"; escribir un cero diría que no gastamos, que es otra cosa.
 *
 * QUÉ SE TRAE: gasto, impresiones, clics y alcance. NADA de conversiones — ver la
 * cabecera de src/lib/meta-ads.ts para el motivo (la atribución modelada de Meta
 * nunca va a cuadrar con auth.users, y dos cifras que no cuadran contaminan la
 * credibilidad del panel entero).
 *
 * POR QUÉ EL DÍA ANTERIOR Y NO EL DÍA EN CURSO: Meta consolida el gasto con
 * retraso. Los insights del día en curso se mueven durante horas, así que pedirlos
 * daría una fila que hoy dice una cosa y mañana otra. Pidiendo AYER, cerrado,
 * cada fila se escribe una sola vez con el número definitivo.
 *
 * ZONA HORARIA: el `time_range` se expresa en la zona de la CUENTA publicitaria,
 * no en UTC. El día se calcula en UTC y se anota en `meta.zona_nota`.
 *
 * SIN UN TOKEN VÁLIDO (13-oct-2026): «sin campaña activa», en silencio — ver la
 * cabecera de src/lib/meta-ads-cron.ts, donde vive la corrida.
 *
 * Auth: Vercel Cron dispara GET con `Authorization: Bearer ${CRON_SECRET}`.
 */

function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Día anterior en UTC, YYYY-MM-DD. */
function ayerUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("[cron/meta-ads] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Latido antes del trabajo: registra "corrió", no "terminó bien".
  const db = createAdminClient();
  await latirCron(db, "meta-ads");

  const r = await correrMetaAds(
    { token: process.env.META_ADS_TOKEN, cuenta: process.env.META_AD_ACCOUNT_ID, fecha: ayerUTC() },
    { fetch: (url, init) => fetch(url, init), guardar: (fila) => guardarMetrica(db, fila), avisar: captureApiWarning, log: console.log },
  );
  return cerrarCron(db, "meta-ads", r.conteo, r.extra);
}

// Vercel Cron dispara GET. Se reusa el handler POST con su validación Bearer —
// mismo patrón que sentry-metrics y los scrapers.
export const GET = POST;
