import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { reintentarRentaCortaAtrasada, type PresupuestoFichas } from "@/lib/guia/semanal-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// La renta corta atrasada (02-nov-2026, goal de los cortes por statement_timeout; decisión de Fabrizio). El semanal de quien
// solo tiene el bloque de renta corta y su zona falló no sale el lunes vacío: espera. Cada hora, de lunes a miércoles
// (vercel.json), desde el envío original del lunes a las 12:00 UTC y hasta 48 horas después, se vuelve a armar y sale
// atrasado apenas la zona responda, una sola vez. Pasadas las 48 horas, esa semana no sale y queda un error en Sentry con
// quién y qué comuna (semanal-servidor.ts › reintentarRentaCortaAtrasada).
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "semanal-renta-corta";
const PRESUPUESTO_MS = 240_000;
const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "semanal-renta-corta");
  const t0 = Date.now();
  try {
    const cfg = await leerConfigGuia(admin);
    const presupuesto: PresupuestoFichas = { lecturas: 0, bloqueada: false };
    const r = await reintentarRentaCortaAtrasada(admin, cfg, presupuesto, SITIO, { hastaMs: t0 + PRESUPUESTO_MS });
    const procesadas = r.enviadas + r.esperan + r.sinEnvio + r.fallidas;
    // Sin filas esperando es lo normal: una corrida sin trabajo terminó bien.
    const conteo = procesadas === 0 ? { procesados: 1, exitosos: 1, fallidos: 0 } : { procesados: procesadas, exitosos: procesadas - r.fallidas, fallidos: r.fallidas };
    return cerrarCron(admin, NOMBRE, conteo, { ...r, lecturas: presupuesto.lecturas, bloqueada: presupuesto.bloqueada });
  } catch (e) {
    capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { error: e instanceof Error ? e.message : String(e) });
  }
}
