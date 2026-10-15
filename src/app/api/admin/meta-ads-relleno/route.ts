import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureApiWarning } from "@/lib/observabilidad";
import { guardarMetrica } from "@/lib/metrics-daily";
import { correrMetaAds, diasDelRango, MAX_DIAS_RELLENO } from "@/lib/meta-ads-cron";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/meta-ads-relleno?desde=AAAA-MM-DD&hasta=AAAA-MM-DD (15-oct-2026, medición para la campaña): el gasto de
// Meta Ads de días que el cron no midió —del 28-jul al 10-ago de 2026, antes de que el cron existiera— y los clics al
// enlace de los días ya medidos. Pide los días de a uno, con la misma corrida del cron (meta-ads-cron.ts) y escribe en
// metrics_daily; a lo más 60 días por llamada. No es una corrida del cron: no late ni cierra. Sin un token válido se
// detiene en el primer día y lo dice (la pausa «sin campaña activa»).
// Auth: `Authorization: Bearer ${CRON_SECRET}`, como el cron.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const u = new URL(request.url);
  const dias = diasDelRango(u.searchParams.get("desde"), u.searchParams.get("hasta"));
  if (!dias) return NextResponse.json({ error: `rango inválido (AAAA-MM-DD, a lo más ${MAX_DIAS_RELLENO} días)` }, { status: 400 });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const deps = { fetch: (url: string, init?: RequestInit) => fetch(url, init), guardar: (fila: Parameters<typeof guardarMetrica>[1]) => guardarMetrica(db, fila), avisar: captureApiWarning, log: console.log };
  const relleno: Array<{ fecha: string; ok: boolean; extra: Record<string, unknown> }> = [];
  for (const fecha of dias) {
    const r = await correrMetaAds({ token: process.env.META_ADS_TOKEN, cuenta: process.env.META_AD_ACCOUNT_ID, fecha }, deps);
    relleno.push({ fecha, ok: r.conteo.fallidos === 0 && r.extra.pausa === undefined, extra: r.extra });
    if (r.extra.pausa !== undefined) break;
  }
  return NextResponse.json({ relleno });
}
