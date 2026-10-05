import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { enviarSeleccion, type FilaSeleccion } from "@/lib/guia/semanal-servidor";
import { semanaDelEnvio } from "@/lib/guia/semanal";

// ─────────────────────────────────────────────────────────────────────────────
// El lunes sale el correo semanal (02-oct-2026): a cada selección armada el domingo, una vez. Solo con
// tres o más deptos que sigan publicados; si no, no hay correo. El regalo se decide acá.
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "semanal-enviar";
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
      .select("id, user_id, semana, items, combinacion, perfil, variante, token")
      .eq("semana", semana).eq("estado", "armada").is("enviada_at", null).order("armada_at").limit(500);
    if (error) throw new Error(`selecciones: ${error.message}`);
    const cuenta = { enviada: 0, descartada: 0, ya: 0, fallida: 0 };
    for (const fila of (data ?? []) as FilaSeleccion[]) {
      try {
        cuenta[await enviarSeleccion(admin, fila, SITIO)]++;
      } catch (e) {
        cuenta.fallida++;
        capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "enviar-seleccion", userId: fila.user_id });
      }
    }
    const procesadas = cuenta.enviada + cuenta.descartada + cuenta.fallida;
    // Una corrida sin selecciones que mandar terminó bien: cuenta como una corrida exitosa.
    const conteo = procesadas === 0 ? { procesados: 1, exitosos: 1, fallidos: 0 } : { procesados: procesadas, exitosos: procesadas - cuenta.fallida, fallidos: cuenta.fallida };
    return cerrarCron(admin, NOMBRE, conteo, { semana, ...cuenta });
  } catch (e) {
    capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { semana, error: e instanceof Error ? e.message : String(e) });
  }
}
