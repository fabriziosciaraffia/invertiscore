import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { captureApiError } from "@/lib/observabilidad";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { personasSemanal, type PresupuestoFichas } from "@/lib/guia/semanal-servidor";
import { avisarPersona } from "@/lib/guia/inmediato-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// El aviso inmediato (05-oct-2026): cada día a las 09:40 UTC, después de la evaluación de avisos de las
// 08:20, a cada persona con «Ya» vigente se le mandan los avisos NUEVOS que dan Comprar con su perfil y
// siguen publicados, en un solo correo. A quien su «Ya» cumplió 60 días sin compra, la pregunta.
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "aviso-inmediato";
const PRESUPUESTO_MS = 240_000;
const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "aviso-inmediato");
  const t0 = Date.now();
  try {
    const cfg = await leerConfigGuia(admin);
    const personas = await personasSemanal(admin);
    const presupuesto: PresupuestoFichas = { lecturas: 0, bloqueada: false };
    const cuenta = { enviado: 0, pregunta: 0, nada: 0, ya: 0, no: 0, fallido: 0 };
    for (const p of personas) {
      if (Date.now() - t0 > PRESUPUESTO_MS || presupuesto.bloqueada) break;
      try {
        cuenta[await avisarPersona(admin, p.userId, cfg, presupuesto, SITIO)]++;
      } catch (e) {
        cuenta.fallido++;
        captureApiError(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "avisar", userId: p.userId });
      }
    }
    const procesados = cuenta.enviado + cuenta.pregunta + cuenta.fallido;
    const conteo = procesados === 0 ? { procesados: 1, exitosos: 1, fallidos: 0 } : { procesados, exitosos: procesados - cuenta.fallido, fallidos: cuenta.fallido };
    return cerrarCron(admin, NOMBRE, conteo, { personas: personas.length, ...cuenta, lecturas: presupuesto.lecturas, bloqueada: presupuesto.bloqueada });
  } catch (e) {
    captureApiError(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { error: e instanceof Error ? e.message : String(e) });
  }
}
