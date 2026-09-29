import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { latirCron, leerLatidos } from "@/lib/cron-heartbeat";
import { alertarUnaVezAlDia, cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";

// ─────────────────────────────────────────────────────────────────────────────
// La vigilancia de los crons (29-sep-2026). Cada 6 horas lee el estado de todos los crons vigilados
// (cron-heartbeat.ts, leerLatidos) y manda a hola@ un correo por cada uno en rojo, a lo más uno por
// cron y motivo al día. Cubre lo que el cierre de cada corrida no puede ver desde adentro:
//   · el cron que NO corrió (un deploy dentro de su ventana, el 10-ago-2026);
//   · el que latió y reventó antes de cerrar (no llegó a cerrarCron);
//   · el que corre, cierra verde y dejó de escribir lo que escribía (scrape-unidades-nuevas, del 03-ago
//     al 29-sep: 57 días sin una unidad con el latido en verde).
// Las fallas que el propio cron detecta ya avisan solas desde cerrarCron; acá se repiten solo si la
// alerta del día no salió (misma anotación en metrics_daily).
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const NOMBRE = "vigilar-crons";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await latirCron(sb, NOMBRE);
  const hoy = new Date().toISOString().slice(0, 10);

  try {
    const estado = (await leerLatidos(sb)).filter((c) => c.nombre !== NOMBRE);
    const enRojo = estado.filter((c) => c.enRojo);
    let alertas = 0;
    for (const c of enRojo) {
      const motivo = c.atrasado ? "atrasado" : c.sinCierre ? "sin-cierre" : c.sinEscribir ? "sin-escribir" : c.ultimoResultado && c.ultimoResultado !== "ok" ? "falla" : "frescura";
      if (await alertarUnaVezAlDia(sb, c.nombre, hoy, c.motivo ?? "en rojo", {}, motivo)) alertas++;
    }
    // La vigilancia misma sale bien aunque haya crons en rojo: su trabajo es verlos y avisar.
    return cerrarCron(sb, NOMBRE, { procesados: estado.length, exitosos: estado.length, fallidos: 0 }, {
      enRojo: enRojo.map((c) => ({ cron: c.nombre, motivo: c.motivo })),
      alertasEnviadas: alertas,
    });
  } catch (e) {
    return cerrarCron(sb, NOMBRE, CORRIDA_FALLIDA, { error: `leer el estado: ${String(e).slice(0, 200)}` });
  }
}
