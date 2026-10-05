import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { captureApiError } from "@/lib/observabilidad";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { personasSemanal, prechequearSemana, type PresupuestoFichas } from "@/lib/guia/semanal-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// El prechequeo del correo semanal (05-oct-2026, decisión de Fabrizio). De lunes a sábado, cada hora de
// 03:35 a 08:35 UTC (la noche de Chile, cuando nadie usa la guía), chequea dentro del mismo tope por hora
// los avisos que las selecciones del domingo van a necesitar. Un publicado chequeado vale la semana
// (MEMORIA_SEMANAL_MS): el domingo solo completa lo que falte.
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "semanal-prechequeo";
/** Cuánto trabaja una corrida como mucho, para cerrar antes del límite de la función. */
const PRESUPUESTO_MS = 240_000;

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "semanal-prechequeo");
  const t0 = Date.now();
  try {
    const cfg = await leerConfigGuia(admin);
    const personas = await personasSemanal(admin);
    const presupuesto: PresupuestoFichas = { lecturas: 0, bloqueada: false };
    // El punto de partida cambia cada hora: ninguna persona se queda siempre al final de la fila.
    const turno = Math.floor(t0 / 3_600_000) * 13;
    const r = await prechequearSemana(admin, personas, cfg, presupuesto, { turno, hastaMs: t0 + PRESUPUESTO_MS });
    // Un bloqueo de la fuente es una corrida fallida: lo ve el panel y alerta.
    const conteo = presupuesto.bloqueada ? { procesados: 1, exitosos: 0, fallidos: 1 } : { procesados: 1, exitosos: 1, fallidos: 0 };
    return cerrarCron(admin, NOMBRE, conteo, { ...r, lecturas: presupuesto.lecturas, bloqueada: presupuesto.bloqueada });
  } catch (e) {
    captureApiError(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { error: e instanceof Error ? e.message : String(e) });
  }
}
