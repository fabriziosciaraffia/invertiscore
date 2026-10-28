import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA, type ConteoCron } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { conTope, desdeDondeQuedo, PRESUPUESTO_PRECHEQUEO_MS, TOPE_DURO_PRECHEQUEO_MS, type ProgresoPrechequeo } from "@/lib/guia/semanal";
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
// 12-oct-2026: y un TECHO de 280 s pase lo que pase. El presupuesto no le pone límite a un paso que ya empezó; si una
// consulta se cuelga, la corrida cierra igual a tiempo, guarda por quién seguir y queda como fallida (alerta).
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "semanal-prechequeo";

/** El cierre también con techo: si la base no responde, se contesta igual antes del corte de 300 s. */
async function cerrarConTope(admin: ReturnType<typeof createServiceClient>, conteo: ConteoCron, extra: Record<string, unknown>, t0: number) {
  const c = await conTope(cerrarCron(admin, NOMBRE, conteo, extra), Math.max(1_000, t0 + 295_000 - Date.now()));
  return c.listo ? c.valor : NextResponse.json({ ...extra, cierreSinRegistrar: true });
}

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "semanal-prechequeo");
  const t0 = Date.now();
  // Lo que se sabe MIENTRAS corre: si el techo la corta, de acá sale por quién seguir.
  const progreso: ProgresoPrechequeo<string> = { siguiente: null, chequeos: 0, revisadas: 0 };
  const presupuesto: PresupuestoFichas = { lecturas: 0, bloqueada: false };
  let total = 0;
  let leyoDondeQuedo = false;
  try {
    const corrida = await conTope((async () => {
      const cfg = await leerConfigGuia(admin);
      // Un orden estable: «dónde quedó» solo sirve si la lista no cambia de orden entre corridas. Las cuentas de prueba al
      // final (28-oct-2026): el tope de fichas lo usan primero las personas.
      const personas = (await personasSemanal(admin)).sort((a, b) => Number(a.prueba) - Number(b.prueba) || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
      total = personas.length;
      const anterior = await leerAvancePrechequeo(admin);
      const desde = desdeDondeQuedo(personas, anterior?.siguiente ?? null);
      progreso.siguiente = desde;
      leyoDondeQuedo = true;
      const r = await prechequearSemana(admin, personas, cfg, presupuesto, {
        desde,
        hastaMs: t0 + PRESUPUESTO_PRECHEQUEO_MS,
        progreso,
      });
      return { r, personas, desde };
    })(), t0 + TOPE_DURO_PRECHEQUEO_MS - Date.now());
    if (!corrida.listo) {
      // EL TECHO: un paso colgado. Cierra igual, a tiempo; la siguiente sigue después de la persona trabada. Si
      // ni alcanzó a leer dónde quedó la anterior, no lo pisa. Es una corrida fallida: el panel lo ve y alerta.
      const avance = { siguiente: progreso.siguiente, revisadas: progreso.revisadas, total, chequeos: progreso.chequeos, porTiempo: true, porCupo: false, ms: Date.now() - t0 };
      if (leyoDondeQuedo) await conTope(guardarAvancePrechequeo(admin, avance), 5_000);
      console.log(`[semanal-prechequeo] techo ${JSON.stringify({ ms: avance.ms, leyoDondeQuedo, chequeos: avance.chequeos, revisadas: avance.revisadas, lecturas: presupuesto.lecturas })}`);
      return cerrarConTope(admin, { procesados: 1, exitosos: 0, fallidos: 1 }, { cortadoPorTecho: true, lecturas: presupuesto.lecturas, avance }, t0);
    }
    const { r, personas, desde } = corrida.valor;
    // Hasta dónde llegó: la corrida siguiente sigue desde ahí.
    const avance = { siguiente: r.siguiente, revisadas: r.revisadas, total: personas.length, chequeos: r.chequeos, porTiempo: r.porTiempo, porCupo: r.porCupo, ms: Date.now() - t0 };
    await conTope(guardarAvancePrechequeo(admin, avance), 5_000);
    // El cierre, en los logs de la función: cuánto duró, cuánto tardó cada aviso y dónde empezó y quedó (como
    // posición en la lista, no el id de la persona). Sin esta línea, la duración real solo se ve en la base.
    const posicion = (u: string | null) => (u ? personas.findIndex((p) => p.userId === u) : null);
    console.log(`[semanal-prechequeo] cierre ${JSON.stringify({
      ms: Date.now() - t0, empezoEn: posicion(desde), sigueEn: posicion(r.siguiente), total: personas.length, revisadas: r.revisadas,
      chequeos: r.chequeos, msChequeos: r.msChequeos, msPasoMax: r.msPasoMax, lecturas: presupuesto.lecturas, porTiempo: r.porTiempo, porCupo: r.porCupo,
    })}`);
    // Un bloqueo de la fuente es una corrida fallida: lo ve el panel y alerta.
    const conteo = presupuesto.bloqueada ? { procesados: 1, exitosos: 0, fallidos: 1 } : { procesados: 1, exitosos: 1, fallidos: 0 };
    return cerrarConTope(admin, conteo, { ...r, lecturas: presupuesto.lecturas, bloqueada: presupuesto.bloqueada, avance }, t0);
  } catch (e) {
    capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarConTope(admin, CORRIDA_FALLIDA, { error: e instanceof Error ? e.message : String(e) }, t0);
  }
}
