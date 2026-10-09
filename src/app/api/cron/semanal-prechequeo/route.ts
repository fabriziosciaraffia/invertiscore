import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { desdeDondeQuedo, PRESUPUESTO_PRECHEQUEO_MS } from "@/lib/guia/semanal";
import {
  guardarAvancePrechequeo, leerAvancePrechequeo, personasSemanal, prechequearSemana, type PresupuestoFichas,
} from "@/lib/guia/semanal-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// El prechequeo del correo semanal (05-oct-2026, decisión de Fabrizio). De lunes a sábado, cada hora de
// 03:35 a 08:35 UTC (la noche de Chile, cuando nadie usa la guía), chequea dentro del mismo tope por hora
// los avisos que las selecciones del domingo van a necesitar. Un publicado chequeado vale la semana
// (MEMORIA_SEMANAL_MS): el domingo solo completa lo que falte.
// 09-oct-2026: llegaba al corte de 300 s en casi todas las corridas (171 personas; prepararlas cuesta más que
// el presupuesto, y el cierre las volvía a recorrer sin reloj). Ahora se da 240 s, chequea lo que alcance,
// cierra limpio guardando dónde quedó, y la corrida siguiente sigue desde ahí. Tier PRECHEQUEO-PRESUPUESTO.
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "semanal-prechequeo";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "semanal-prechequeo");
  const t0 = Date.now();
  try {
    const cfg = await leerConfigGuia(admin);
    // Un orden estable: «dónde quedó» solo sirve si la lista no cambia de orden entre corridas.
    const personas = (await personasSemanal(admin)).sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
    const anterior = await leerAvancePrechequeo(admin);
    const presupuesto: PresupuestoFichas = { lecturas: 0, bloqueada: false };
    const desde = desdeDondeQuedo(personas, anterior?.siguiente ?? null);
    const r = await prechequearSemana(admin, personas, cfg, presupuesto, {
      desde,
      hastaMs: t0 + PRESUPUESTO_PRECHEQUEO_MS,
    });
    // Hasta dónde llegó: la corrida siguiente sigue desde ahí.
    const avance = { siguiente: r.siguiente, revisadas: r.revisadas, total: personas.length, chequeos: r.chequeos, porTiempo: r.porTiempo, porCupo: r.porCupo, ms: Date.now() - t0 };
    await guardarAvancePrechequeo(admin, avance);
    // El cierre, en los logs de la función: cuánto duró, cuánto tardó cada aviso y dónde empezó y quedó (como
    // posición en la lista, no el id de la persona). Sin esta línea, la duración real solo se ve en la base.
    const posicion = (u: string | null) => (u ? personas.findIndex((p) => p.userId === u) : null);
    console.log(`[semanal-prechequeo] cierre ${JSON.stringify({
      ms: Date.now() - t0, empezoEn: posicion(desde), sigueEn: posicion(r.siguiente), total: personas.length, revisadas: r.revisadas,
      chequeos: r.chequeos, msChequeos: r.msChequeos, msPasoMax: r.msPasoMax, lecturas: presupuesto.lecturas, porTiempo: r.porTiempo, porCupo: r.porCupo,
    })}`);
    // Un bloqueo de la fuente es una corrida fallida: lo ve el panel y alerta.
    const conteo = presupuesto.bloqueada ? { procesados: 1, exitosos: 0, fallidos: 1 } : { procesados: 1, exitosos: 1, fallidos: 0 };
    return cerrarCron(admin, NOMBRE, conteo, { ...r, lecturas: presupuesto.lecturas, bloqueada: presupuesto.bloqueada, avance });
  } catch (e) {
    capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { error: e instanceof Error ? e.message : String(e) });
  }
}
