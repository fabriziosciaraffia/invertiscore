import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { armarSeleccion, cuentasPruebaSinCorreo, type PresupuestoFichas } from "@/lib/guia/semanal-servidor";
import { semanaDelEnvio } from "@/lib/guia/semanal";

// ─────────────────────────────────────────────────────────────────────────────
// El reintento del lunes temprano (13-oct-2026, decisión de Fabrizio): la selección que el domingo quedó
// «pendiente» —los chequeos de fichas no alcanzaron a confirmarla— se vuelve a armar a las 08, 09, 10 y 11 UTC,
// antes del envío de las 12 (vercel.json). Con el mismo tope de fichas que el domingo. Lo que siga pendiente a
// las 12 sale igual con lo que sí quedó confirmado (semanal.ts › queEnviarSemanal). El 12-oct una persona de
// Quilicura quedó pendiente con tres Comprar publicados y perdió la semana.
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "semanal-reintento";
const PRESUPUESTO_MS = 240_000;

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "semanal-reintento");
  const t0 = Date.now();
  const semana = new URL(request.url).searchParams.get("semana") ?? semanaDelEnvio();
  try {
    const { data, error } = await admin.from("semanal_selecciones").select("user_id")
      .eq("semana", semana).eq("tipo", "semanal").eq("estado", "pendiente").is("enviada_at", null).order("armada_at").limit(500);
    if (error) throw new Error(`pendientes: ${error.message}`);
    const fuera = await cuentasPruebaSinCorreo(admin);
    const pendientes = (data ?? []).map((r) => r.user_id as string).filter((u) => !fuera.has(u));
    const cfg = await leerConfigGuia(admin);
    const presupuesto: PresupuestoFichas = { lecturas: 0, bloqueada: false };
    const cuenta = { armada: 0, sin_match: 0, pendiente: 0, ya: 0, fallidas: 0 };
    for (const userId of pendientes) {
      if (Date.now() - t0 > PRESUPUESTO_MS || presupuesto.bloqueada) break;
      try {
        cuenta[await armarSeleccion(admin, userId, semana, cfg, presupuesto)]++;
      } catch (e) {
        cuenta.fallidas++;
        capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "rearmar-pendiente", userId });
      }
    }
    // Sin pendientes es lo normal: una corrida sin trabajo terminó bien.
    const procesadas = cuenta.armada + cuenta.sin_match + cuenta.pendiente + cuenta.fallidas;
    const conteo = procesadas === 0 ? { procesados: 1, exitosos: 1, fallidos: 0 } : { procesados: procesadas, exitosos: procesadas - cuenta.fallidas, fallidos: cuenta.fallidas };
    return cerrarCron(admin, NOMBRE, conteo, { semana, pendientes: pendientes.length, ...cuenta, lecturas: presupuesto.lecturas, bloqueada: presupuesto.bloqueada });
  } catch (e) {
    capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { semana, error: e instanceof Error ? e.message : String(e) });
  }
}
