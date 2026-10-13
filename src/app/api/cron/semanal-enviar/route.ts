import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { cuentasPruebaSinCorreo, descartarSeleccion, enviarSeleccion, type FilaSeleccion } from "@/lib/guia/semanal-servidor";
import { semanaDelEnvio } from "@/lib/guia/semanal";

// ─────────────────────────────────────────────────────────────────────────────
// El lunes sale el correo semanal (02-oct-2026): a cada persona con selección de la semana, una vez. El regalo se
// decide acá. Desde el 13-oct-2026 nadie recibe silencio por un error nuestro: la armada, la PENDIENTE (lo que
// alcanzó a confirmarse, aunque sea menos de tres, después del reintento de la mañana) y la SIN COINCIDENCIAS (el
// correo corto) salen todas; y las cuentas de prueba no reciben nada, salvo las marcadas.
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "semanal-enviar";
/** Cuánto manda una corrida como mucho (13-oct-2026): el lunes 12 mandó 145 en ~260 s, a un paso del corte de 300 s.
 *  Lo que no alcanza lo toma la corrida de las 12:30 (vercel.json): las filas enviadas ya tienen `enviada_at`. */
const PRESUPUESTO_ENVIO_MS = 240_000;
const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "semanal-enviar");
  const semana = new URL(request.url).searchParams.get("semana") ?? semanaDelEnvio();
  try {
    const { data, error } = await admin.from("semanal_selecciones")
      .select("id, user_id, semana, estado, items, combinacion, perfil, variante, token")
      .eq("semana", semana).in("estado", ["armada", "pendiente", "sin_match"]).is("enviada_at", null).order("armada_at").limit(500);
    if (error) throw new Error(`selecciones: ${error.message}`);
    const cuenta = { enviada: 0, descartada: 0, ya: 0, fallida: 0 };
    const fuera = await cuentasPruebaSinCorreo(admin);
    const t0 = Date.now();
    let quedan = 0;
    for (const fila of (data ?? []) as FilaSeleccion[]) {
      if (Date.now() - t0 > PRESUPUESTO_ENVIO_MS) { quedan++; continue; }
      try {
        cuenta[fuera.has(fila.user_id) ? await descartarSeleccion(admin, fila.id) : await enviarSeleccion(admin, fila, SITIO)]++;
      } catch (e) {
        cuenta.fallida++;
        capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "enviar-seleccion", userId: fila.user_id });
      }
    }
    const procesadas = cuenta.enviada + cuenta.descartada + cuenta.fallida;
    // Una corrida sin selecciones que mandar terminó bien: cuenta como una corrida exitosa.
    const conteo = procesadas === 0 ? { procesados: 1, exitosos: 1, fallidos: 0 } : { procesados: procesadas, exitosos: procesadas - cuenta.fallida, fallidos: cuenta.fallida };
    return cerrarCron(admin, NOMBRE, conteo, { semana, ...cuenta, quedan });
  } catch (e) {
    capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { semana, error: e instanceof Error ? e.message : String(e) });
  }
}
