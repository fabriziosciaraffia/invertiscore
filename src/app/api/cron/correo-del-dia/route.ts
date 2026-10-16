import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { cuentasPruebaSinCorreo, type PresupuestoFichas } from "@/lib/guia/semanal-servidor";
import { delDiaPendientes, procesarDelDia } from "@/lib/guia/del-dia-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// La cola del correo del día (16-oct-2026, la puerta B; del-dia.ts): cada 10 minutos, las cuentas nuevas de /deptos cuyo
// correo todavía no salió. Cada una arma su selección dentro del cupo de lecturas de ficha (el tope por hora es el de
// siempre, compartido con la guía y el semanal); si el cupo se copa, la vuelta siguiente sigue, y pasada la hora sale
// con lo que ya se vio publicado. La primera vuelta de cada cuenta corre en el momento del alta (/api/deptos/alta).
// Las cuentas de prueba no reciben nada, salvo las marcadas (como el semanal).
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "correo-del-dia";
const PRESUPUESTO_MS = 240_000;
const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "correo-del-dia");
  const t0 = Date.now();
  try {
    const filas = await delDiaPendientes(admin);
    const cuenta = { enviada: 0, espera: 0, descartada: 0, ya: 0, fallida: 0 };
    if (filas.length > 0) {
      const cfg = await leerConfigGuia(admin);
      const fuera = await cuentasPruebaSinCorreo(admin);
      for (const fila of filas) {
        if (Date.now() - t0 > PRESUPUESTO_MS) break;
        if (fuera.has(fila.user_id)) {
          await admin.from("semanal_selecciones").update({ estado: "descartada" }).eq("id", fila.id).is("enviada_at", null);
          cuenta.descartada++;
          continue;
        }
        const presupuesto: PresupuestoFichas = { lecturas: 0, bloqueada: false };
        try {
          cuenta[await procesarDelDia(admin, fila, cfg, SITIO, presupuesto)]++;
        } catch (e) {
          cuenta.fallida++;
          capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "procesar", userId: fila.user_id });
        }
      }
    }
    const procesadas = cuenta.enviada + cuenta.descartada + cuenta.espera + cuenta.fallida;
    // Una corrida sin nadie en la cola terminó bien: cuenta como una corrida exitosa.
    const conteo = procesadas === 0 ? { procesados: 1, exitosos: 1, fallidos: 0 } : { procesados: procesadas, exitosos: procesadas - cuenta.fallida, fallidos: cuenta.fallida };
    return cerrarCron(admin, NOMBRE, conteo, { cola: filas.length, ...cuenta });
  } catch (e) {
    capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { error: e instanceof Error ? e.message : String(e) });
  }
}
