import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { correosDeCambios, vigilarElegidos } from "@/lib/invierte-v2/vigilancia-servidor";
import { noche as nocheB4 } from "@/lib/invierte-v2/b4-servidor";
import { DEPS_AVISO_B4 } from "@/lib/invierte-v2/b4-avisos";
import { reanalizarVencidas, tareasConfirmacionAtrasada } from "@/lib/invierte-v2/depto-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// La vigilancia de los deptos elegidos (Invierte con Franco, entrega 2, 18-nov-2026; vigilancia-servidor.ts): a las 9, 10 y 11
// UTC (6, 7 y 8 de la mañana en Chile), después de la carga y de la evaluación de la noche. Cada corrida pasa el historial de
// precios a UF, relee por el carril de Invierte los deptos elegidos que no se leyeron en 24 horas (hasta el tope del carril) y
// anota los cambios. El correo del día sale solo en la de las 11 UTC (8 de la mañana): uno por persona como mucho.
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "invierte-vigilar";
const HORA_CORREOS_UTC = 11;

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "invierte-vigilar");
  try {
    const ahora = new Date();
    const v = await vigilarElegidos(admin, { ahora });
    // Etapa 3, B1: los análisis con ubicación confirmada que vencieron (precio, motor o una semana) se rehacen.
    const reanalisis = await reanalizarVencidas(admin, ahora).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
    // B2: un depto que sigue confirmando a los 3 días deja una tarea interna (lámina 4.1-confirmando).
    const atrasados = await tareasConfirmacionAtrasada(admin, ahora).catch(() => null);
    // B4 (23-nov-2026): vence lo que pasó su plazo, deja la tarea de insistir al tercer día, pasa la siguiente en cola y avisa si el
    // precio publicado bajó de la oferta viva. Una oferta vence al terminar su día (medianoche de Santiago) y esta pasada de la mañana la cierra.
    const ofertas = await nocheB4(admin, DEPS_AVISO_B4, ahora).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
    const c = ahora.getUTCHours() === HORA_CORREOS_UTC ? await correosDeCambios(admin, ahora) : null;
    if (v.error) return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { ...v, correos: c, reanalisis });
    return cerrarCron(admin, NOMBRE, { procesados: Math.max(1, v.deptos), exitosos: Math.max(1, v.deptos), fallidos: 0 }, { ...v, correos: c, reanalisis, atrasados, ofertas });
  } catch (e) {
    capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { error: e instanceof Error ? e.message : String(e) });
  }
}
