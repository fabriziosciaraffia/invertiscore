import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { captureApiError } from "@/lib/observabilidad";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { armarSeleccion, personasSemanal, type PresupuestoFichas } from "@/lib/guia/semanal-servidor";
import { semanaDelEnvio } from "@/lib/guia/semanal";

// ─────────────────────────────────────────────────────────────────────────────
// El domingo se arma la selección del lunes (02-oct-2026). Corre cada hora del domingo: cada corrida
// toma a quien todavía no tiene selección (o la tiene «pendiente» porque faltó cupo de fichas), dentro
// del tope de fichas por hora que comparte con la guía. Lo que no alcanza, lo toma la corrida siguiente.
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "semanal-armar";
/** Cuánto trabaja una corrida como mucho, para cerrar antes del límite de la función. */
const PRESUPUESTO_MS = 240_000;

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "semanal-armar");
  const t0 = Date.now();
  const semana = new URL(request.url).searchParams.get("semana") ?? semanaDelEnvio();
  try {
    const cfg = await leerConfigGuia(admin);
    const personas = await personasSemanal(admin);
    const presupuesto: PresupuestoFichas = { lecturas: 0, bloqueada: false };
    const cuenta = { armada: 0, sin_match: 0, pendiente: 0, ya: 0, fallidas: 0 };
    for (const p of personas) {
      if (Date.now() - t0 > PRESUPUESTO_MS || presupuesto.bloqueada) break;
      try {
        cuenta[await armarSeleccion(admin, p.userId, semana, cfg, presupuesto)]++;
      } catch (e) {
        cuenta.fallidas++;
        captureApiError(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "armar-seleccion", userId: p.userId });
      }
    }
    const procesadas = cuenta.armada + cuenta.sin_match + cuenta.pendiente + cuenta.fallidas;
    // Una corrida sin nadie que armar terminó bien: cuenta como una corrida exitosa.
    const conteo = procesadas === 0 ? { procesados: 1, exitosos: 1, fallidos: 0 } : { procesados: procesadas, exitosos: procesadas - cuenta.fallidas, fallidos: cuenta.fallidas };
    return cerrarCron(admin, NOMBRE, conteo, {
      semana, personas: personas.length, ...cuenta, lecturas: presupuesto.lecturas, bloqueada: presupuesto.bloqueada,
    });
  } catch (e) {
    captureApiError(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { semana, error: e instanceof Error ? e.message : String(e) });
  }
}
