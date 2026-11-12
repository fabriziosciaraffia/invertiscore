import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { correrRelleno } from "@/lib/publicadores/relleno";
import { depsRelleno, proxyRelleno } from "@/lib/publicadores/relleno-servidor";
import { recontarPublicadores } from "@/lib/publicadores/publicadores-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// El relleno de publicadores (12-nov-2026, src/lib/publicadores/relleno.ts): cada 10 minutos, un lote de fichas por Decodo
// —primero los deptos con inscripciones en Invierte con Franco, después los que convienen—, hasta 200 fichas por hora y con
// un fusible que lo detiene ante bloqueos o respuestas raras. Al final recuenta los avisos activos y los que convienen de
// cada publicador, y su clase. Sin `DECODO_RELLENO_URL` no lee nada (nunca sale por la IP de las personas).
// Auth: Vercel Cron, `Authorization: Bearer ${CRON_SECRET}`.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const NOMBRE = "relleno-publicadores";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  await latirCron(admin, "relleno-publicadores");
  try {
    if (!proxyRelleno()) {
      // Sin la credencial de Decodo no se lee: queda dicho en la corrida y en /admin/invierte. El recuento corre igual.
      const rc = await recontarPublicadores(admin);
      return cerrarCron(admin, NOMBRE, { procesados: 1, exitosos: 1, fallidos: 0 }, { estado: "sin-credencial", recuento: rc.ok, clases: rc.clases });
    }
    const r = await correrRelleno(depsRelleno(admin));
    const rc = await recontarPublicadores(admin);
    // El fusible es una corrida fallida: va al resumen del día de los crons de varias corridas, con su motivo.
    const conteo = r.estado === "fusible"
      ? { procesados: Math.max(1, r.leidas), exitosos: Math.max(0, r.leidas - 1), fallidos: 1 }
      : { procesados: Math.max(1, r.leidas), exitosos: Math.max(1, r.leidas), fallidos: 0 };
    return cerrarCron(admin, NOMBRE, conteo, {
      ...r,
      fusible: r.fusible ? `${r.fusible.motivo}: ${r.fusible.detalle}` : null,
      ...(r.fusible ? { error: `fusible del relleno (${r.fusible.motivo}): ${r.fusible.detalle}` } : {}),
      recuento: rc.ok,
      clases: rc.clases,
    });
  } catch (e) {
    capturarFallaDeCron(e, { ruta: `GET /api/cron/${NOMBRE}`, operacion: "corrida" });
    return cerrarCron(admin, NOMBRE, CORRIDA_FALLIDA, { error: e instanceof Error ? e.message : String(e) });
  }
}
